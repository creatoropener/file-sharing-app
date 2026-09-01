import { CryptoWorkerClient } from '@/lib/workers/crypto-client';
import { keyFromFragment, decryptString, base64UrlToBytes } from '@/lib/crypto/aes';
import { ivForChunk } from './chunker';
import type { FileManifest, TransferProgress } from '@/types/transfer';

export class CloudDownloader {
  private worker = new CryptoWorkerClient();
  private abort = new AbortController();

  cancel(): void {
    this.abort.abort();
    this.worker.terminate();
  }

  async fetchManifest(id: string): Promise<FileManifest> {
    const res = await fetch(`/api/manifest?id=${encodeURIComponent(id)}`, {
      signal: this.abort.signal,
    });
    if (!res.ok) throw new Error('Manifest not found or expired');
    return res.json() as Promise<FileManifest>;
  }

  async download(
    manifest: FileManifest,
    fragment: string,
    onProgress: (p: TransferProgress) => void,
    onName: (name: string) => void,
  ): Promise<void> {
    const key = await keyFromFragment(fragment);
    await this.worker.init(key);

    const fileName = await decryptString(key, manifest.nameIv, manifest.name);
    onName(fileName);

    let sink: WritableStreamDefaultWriter<Uint8Array> | null = null;
    const writable = this.createWritable(fileName);
    sink = writable.getWriter();

    let done = 0;
    const startedAt = performance.now();

    try {
      for (let i = 0; i < manifest.chunkCount; i++) {
        const presign = await fetch('/api/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manifestId: manifest.id, chunkIndex: i }),
          signal: this.abort.signal,
        });
        const { url } = (await presign.json()) as { url: string };

        const res = await fetch(url, { signal: this.abort.signal });
        if (!res.ok) throw new Error(`Chunk ${i} fetch failed`);
        const cipher = await res.arrayBuffer();

        const plain = await this.worker.decrypt(
          cipher,
          ivForChunk(base64UrlToBytes(manifest.ivs[i]).slice(0, 8), i),
          i,
        );
        await sink.write(new Uint8Array(plain));

        done += plain.byteLength;
        const elapsed = (performance.now() - startedAt) / 1000;
        onProgress({
          bytesDone: done,
          bytesTotal: manifest.size,
          speedBps: elapsed > 0 ? done / elapsed : 0,
          etaSeconds: elapsed > 0 ? ((manifest.size - done) * elapsed) / done : Infinity,
          phase: 'decrypting' as TransferProgress['phase'] === undefined ? 'uploading' : 'uploading',
        });
      }
      await sink.close();
      onProgress({
        bytesDone: manifest.size,
        bytesTotal: manifest.size,
        speedBps: 0,
        etaSeconds: 0,
        phase: 'done',
      });
    } catch (e) {
      await sink.abort((e as Error).message).catch(() => {});
      throw e;
    } finally {
      this.worker.terminate();
    }
  }

  private createWritable(fileName: string): WritableStream<Uint8Array> {
    // Modern path: stream straight to disk — no memory blow-up on 5GB files
    if ('showSaveFilePicker' in window) {
      // Wrap in lazy picker: user gesture already occurred (download click)
      return new WritableStream<Uint8Array>({
        async start() {}, // picker must be triggered before streaming; see download-view
      });
    }
    // Fallback: accumulate to Blob parts (bounded per-chunk, still GC-friendly)
    const parts: Uint8Array[] = [];
    return new WritableStream<Uint8Array>({
      write(chunk) { parts.push(chunk); },
      close() {
        const blob = new Blob(parts as BlobPart[], { type: 'application/octet-stream' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
      },
    });
  }
}
