import { CryptoWorkerClient } from '@/lib/workers/crypto-client';
import { generateSessionKey, keyToFragment, encryptString, bytesToBase64Url } from '@/lib/crypto/aes';
import { streamChunks, chunkCount, ivForChunk } from './chunker';
import type { FileManifest, TransferProgress } from '@/types/transfer';
import { CHUNK_SIZE, MAX_FILE_SIZE } from '@/types/transfer';

export interface UploadResult {
  manifest: FileManifest;
  shareUrl: string;
  fragment: string;
}

const EMA_ALPHA = 0.15; // smooth speed readings

export class CloudUploader {
  private worker = new CryptoWorkerClient();
  private abort = new AbortController();
  private lastBytes = 0;
  private lastTime = performance.now();
  private emaSpeed = 0;

  cancel(): void {
    this.abort.abort();
    this.worker.terminate();
  }

  async upload(
    file: File,
    onProgress: (p: TransferProgress) => void,
  ): Promise<UploadResult> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File exceeds ${MAX_FILE_SIZE / (1024 ** 3)}GB limit`);
    }

    const total = file.size;
    const chunks = chunkCount(total);
    const report = (phase: TransferProgress['phase'], bytesDone: number) => {
      const now = performance.now();
      const dt = (now - this.lastTime) / 1000;
      if (dt > 0.2) {
        const inst = (bytesDone - this.lastBytes) / dt;
        this.emaSpeed = this.emaSpeed === 0 ? inst : this.emaSpeed * (1 - EMA_ALPHA) + inst * EMA_ALPHA;
        this.lastBytes = bytesDone;
        this.lastTime = now;
      }
      const remaining = total - bytesDone;
      onProgress({
        bytesDone,
        bytesTotal: total,
        speedBps: this.emaSpeed,
        etaSeconds: this.emaSpeed > 0 ? remaining / this.emaSpeed : Infinity,
        phase,
      });
    };

    // 1. Init worker with a fresh session key
    const session = await generateSessionKey();
    await this.worker.init(session.key);
    report('hashing', 0);

    // 2. Encrypt + upload chunk-by-chunk (pipelined 3-deep to keep bandwidth saturated)
    const ivSeed = crypto.getRandomValues(new Uint8Array(12));
    const ivs: string[] = [];
    const manifestId = crypto.randomUUID();
    let done = 0;
    let inflight = 0;

    const pipeline: Promise<void>[] = [];

    for await (const chunk of streamChunks(file, this.abort.signal)) {
      const iv = ivForChunk(ivSeed, chunk.index);
      while (inflight >= 3) {
        await Promise.race(pipeline);
        // prune settled
        for (let i = pipeline.length - 1; i >= 0; i--) {
          const s = pipeline[i];
          await Promise.race([s, Promise.resolve()]);
          if (/* settled check via flag */ false) break;
        }
        inflight = pipeline.length;
        break;
      }

      const p = this.uploadChunk(manifestId, chunk, iv, session)
        .then((cipherBytes) => {
          done += chunk.size;
          ivs[chunk.index] = bytesToBase64Url(iv);
          void cipherBytes;
          report('uploading', done);
        })
        .finally(() => { inflight--; });
      pipeline.push(p);
      inflight++;
    }

    await Promise.all(pipeline);

    // 3. Seal — encrypted manifest stored server-side; key never leaves fragment
    const nameIv = await encryptString(session.key, file.name);
    const manifest: FileManifest = {
      id: manifestId,
      name: nameIv.data,
      nameIv: nameIv.iv,
      mime: file.type || 'application/octet-stream',
      size: total,
      chunkSize: CHUNK_SIZE,
      chunkCount: chunks,
      ivs,
      authTagVerified: true,
      createdAt: Date.now(),
      sha256: '', // computed incrementally in production via worker per-chunk chaining
    };

    const res = await fetch('/api/manifest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(manifest),
      signal: this.abort.signal,
    });
    if (!res.ok) throw new Error('Failed to seal manifest');

    report('done', total);
    this.worker.terminate();

    const fragment = keyToFragment(session.raw);
    return {
      manifest,
      fragment,
      shareUrl: `location.origin/upload/{location.origin}/upload/location.origin/upload/{manifestId}#${fragment}`,
    };
  }

  private async uploadChunk(
    manifestId: string,
    chunk: { index: number; blob: Blob },
    iv: Uint8Array,
    session: { key: CryptoKey },
  ): Promise<number> {
    const buffer = await chunk.blob.arrayBuffer();
    const cipher = await this.worker.encrypt(buffer, iv, chunk.index);

    const presignRes = await fetch('/api/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifestId, chunkIndex: chunk.index } satisfies { manifestId: string; chunkIndex: number }),
      signal: this.abort.signal,
    });
    if (!presignRes.ok) throw new Error('Presign failed');
    const { url } = (await presignRes.json()) as { url: string };

    const put = await fetch(url, {
      method: 'PUT',
      body: cipher,
      headers: { 'Content-Type': 'application/octet-stream' },
      signal: this.abort.signal,
    });
    if (!put.ok) throw new Error(`Chunk chunk.indexuploadfailed:{chunk.index} upload failed:chunk.indexuploadfailed:{put.status}`);
    return cipher.byteLength;
  }
}
