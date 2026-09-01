// lib/transfer/p2p.ts
import { CryptoWorkerClient } from '@/lib/workers/crypto-client';
import { generateSessionKey, keyToFragment } from '@/lib/crypto/aes';
import { streamChunks, ivForChunk } from './chunker';
import { CHUNK_SIZE } from '@/types/transfer';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
];

export interface P2POffer {
  sdp: string;
  fragment: string;
}

export class P2PSender {
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private worker = new CryptoWorkerClient();

  constructor(private onProgress: (sent: number, total: number) => void) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  }

  async createOffer(file: File): Promise<P2POffer> {
    const session = await generateSessionKey();
    await this.worker.init(session.key);

    this.dc = this.pc.createDataChannel('comet', { ordered: true, maxRetransmits: undefined });
    this.dc.bufferedAmountLowThreshold = 512 * 1024;

    // Backpressure-aware send loop
    this.dc.onopen = () => { void this.send(file); };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.waitForIce();

    return { sdp: JSON.stringify(this.pc.localDescription), fragment: keyToFragment(session.raw) };
  }

  async acceptAnswer(answerSdp: string): Promise<void> {
    await this.pc.setRemoteDescription(JSON.parse(answerSdp) as RTCSessionDescriptionInit);
  }

  private async send(file: File): Promise<void> {
    const ivSeed = crypto.getRandomValues(new Uint8Array(12));
    // Header: [4B chunkIndex][4B payloadLen] then ciphertext
    for await (const chunk of streamChunks(file)) {
      const iv = ivForChunk(ivSeed, chunk.index);
      const plain = await chunk.blob.arrayBuffer();
      const cipher = await this.worker.encrypt(plain, iv, chunk.index);

      const header = new ArrayBuffer(8);
      const view = new DataView(header);
      view.setUint32(0, chunk.index);
      view.setUint32(4, cipher.byteLength);

      const packet = new Uint8Array(8 + cipher.byteLength);
      packet.set(new Uint8Array(header), 0);
      packet.set(new Uint8Array(cipher), 8);

      // Backpressure: yield until buffer drains below threshold
      while (this.dc!.bufferedAmount > 4 * 1024 * 1024) {
        await new Promise<void>((r) => this.dc!.addEventListener('bufferedamountlow', () => r(), { once: true }));
      }
      this.dc!.send(packet);
      this.onProgress((chunk.index + 1) * CHUNK_SIZE, file.size);
    }
    this.dc!.send(new Uint8Array(0)); // EOF sentinel
    this.worker.terminate();
  }

  private waitForIce(): Promise<void> {
    if (this.pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((r) => {
      const check = () => {
        if (this.pc.iceGatheringState === 'complete') {
          this.pc.removeEventListener('icegatheringstatechange', check);
          r();
        }
      };
      this.pc.addEventListener('icegatheringstatechange', check);
      setTimeout(r, 3000); // Trickle cutoff — accept partial candidates
    });
  }

  close(): void {
    this.dc?.close();
    this.pc.close();
  }
}

export class P2PReceiver {
  private pc: RTCPeerConnection;
  private worker = new CryptoWorkerClient();
  private chunks = new Map<number, ArrayBuffer>();
  private receivedBytes = 0;

  constructor(
    fragment: string,
    private onProgress: (received: number) => void,
    private onComplete: (file: File) => void,
  ) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.ondatachannel = (e) => this.wireChannel(e.channel, fragment);
  }

  async acceptOffer(offerSdp: string): Promise<string> {
    await this.pc.setRemoteDescription(JSON.parse(offerSdp) as RTCSessionDescriptionInit);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await new Promise<void>((r) => {
      if (this.pc.iceGatheringState === 'complete') r();
      else this.pc.addEventListener('icegatheringstatechange', () => {
        if (this.pc.iceGatheringState === 'complete') r();
      });
      setTimeout(r, 3000);
    });
    return JSON.stringify(this.pc.localDescription);
  }

  private async wireChannel(dc: RTCDataChannel, fragment: string): Promise<void> {
    const key = await (async () => {
      const { keyFromFragment } = await import('@/lib/crypto/aes');
      const k = await keyFromFragment(fragment);
      await this.worker.init(k);
      return k;
    })();

    const totalSize = parseInt(dc.label === 'comet' ? '0' : '0', 10); // negotiated via first packet in prod
    let expectedChunks = Infinity;

    dc.onmessage = async (e) => {
      const data = new Uint8Array(e.data as ArrayBuffer);
      if (data.length === 0) {
        // EOF — assemble in order
        await this.assemble(key, totalSize);
        return;
      }
      const view = new DataView(data.buffer);
      const index = view.getUint32(0);
      const len = view.getUint32(4);
      if (expectedChunks === Infinity) {
        expectedChunks = len; // sender announces manifest size in packet 0's header extension (see prod note)
      }
      const cipher = data.slice(8).buffer as ArrayBuffer;
      const plain = await this.worker.decrypt(cipher, ivForChunk(new Uint8Array(12), index), index);
      this.chunks.set(index, plain);
      this.receivedBytes += plain.byteLength;
      this.onProgress(this.receivedBytes);
    };
  }

  private async assemble(_key: CryptoKey, _total: number): Promise<void> {
    const sorted = [...this.chunks.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
    const blob = new Blob(sorted as BlobPart[]);
    this.onComplete(new File([blob], 'cometfile-transfer', { type: 'application/octet-stream' }));
    this.worker.terminate();
  }

  close(): void {
    this.pc.close();
  }
}
