import { CHUNK_SIZE } from '@/types/transfer';

export interface Chunk {
  index: number;
  offset: number;
  size: number;
  blob: Blob;
}

export function chunkCount(fileSize: number): number {
  return Math.max(1, Math.ceil(fileSize / CHUNK_SIZE));
}

export async function* streamChunks(file: File, signal?: AbortSignal): AsyncGenerator<Chunk> {
  const total = chunkCount(file.size);
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const offset = i * CHUNK_SIZE;
    const size = Math.min(CHUNK_SIZE, file.size - offset);
    // slice() is zero-copy metadata; underlying bytes stream from disk on read
    yield { index: i, offset, size, blob: file.slice(offset, offset + size) };
  }
}

export function ivForChunk(seed: Uint8Array, index: number): Uint8Array {
  // Deterministic per-chunk IV derived from a random 12-byte seed + chunk index.
  // GCM forbids IV reuse under the same key; (seed, index) pairs are unique per session.
  const iv = new Uint8Array(12);
  iv.set(seed);
  const view = new DataView(iv.buffer);
  view.setUint32(8, index); // last 4 bytes = counter
  return iv;
}
