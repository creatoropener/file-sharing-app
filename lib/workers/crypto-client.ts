'use client';

/**
 * Promise-based wrapper around crypto.worker.ts.
 * Owns the Worker lifecycle, correlates responses by message id,
 * and uses transferables (zero-copy) for chunk buffers.
 */
export class CryptoWorkerClient {
  private worker: Worker;
  private seq = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor() {
    this.worker = new Worker(new URL('./crypto.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent) => {
      const { type, id, payload } = e.data;
      const p = this.pending.get(id);
      if (!p) return;
      this.pending.delete(id);
      if (type === 'error') p.reject(new Error(payload.message));
      else p.resolve(payload);
    };
    this.worker.onerror = (e) => {
      this.pending.forEach((p) => p.reject(new Error(e.message)));
      this.pending.clear();
    };
  }

  async init(key: CryptoKey): Promise<void> {
    await this.call('init', { key });
  }

  async encrypt(buffer: ArrayBuffer, iv: Uint8Array, chunkIndex: number): Promise<ArrayBuffer> {
    const r = (await this.call('encrypt', { buffer, iv, chunkIndex }, [buffer])) as { cipher: ArrayBuffer };
    return r.cipher;
  }

  async decrypt(cipher: ArrayBuffer, iv: Uint8Array, chunkIndex: number): Promise<ArrayBuffer> {
    const r = (await this.call('decrypt', { cipher, iv, chunkIndex }, [cipher])) as { plain: ArrayBuffer };
    return r.plain;
  }

  private call(type: string, payload: unknown, transfer?: Transferable[]): Promise<unknown> {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type, payload, id }, transfer ?? []);
    });
  }

  terminate(): void {
    this.worker.terminate();
    this.pending.forEach((p) => p.reject(new Error('Worker terminated')));
    this.pending.clear();
  }
}
