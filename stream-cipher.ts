// lib/crypto/stream-cipher.ts
import { encryptChunk, decryptChunk, generateIv } from './aes';
import { CHUNK_SIZE } from '@/types/transfer';

export interface CipherStreamOptions {
  /** 12-byte IV seed; a random one is generated if omitted */
  ivSeed?: Uint8Array;
  /** Chunk size for internal buffering (default: 4MB) */
  chunkSize?: number;
}

function ivFrom(seed: Uint8Array, index: number): Uint8Array {
  const iv = new Uint8Array(12);
  iv.set(seed);
  new DataView(iv.buffer).setUint32(8, index);
  return iv;
}

/**
 * Returns a TransformStream that encrypts a byte stream chunk-by-chunk
 * with AES-256-GCM. Each output chunk is [u32 plaintextLen][u32 ivIndex][ciphertext+tag],
 * so the decrypt side can self-synchronize without extra framing.
 *
 * Usage:
 *   const readable = file.stream().pipeThrough(await createEncryptionStream(key));
 *   for await (const cipherChunk of readable) { ... }
 */
export async function createEncryptionStream(
  key: CryptoKey,
  options: CipherStreamOptions = {},
): Promise<TransformStream<Uint8Array, Uint8Array>> {
  const chunkSize = options.chunkSize ?? CHUNK_SIZE;
  const ivSeed = options.ivSeed ?? generateIv();
  let pending: Uint8Array = new Uint8Array(0);
  let index = 0;

  return new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      // Coalesce incoming bytes into chunkSize buffers
      const merged = new Uint8Array(pending.length + chunk.byteLength);
      merged.set(pending);
      merged.set(chunk, pending.length);

      let offset = 0;
      while (merged.length - offset >= chunkSize) {
        const plain = merged.subarray(offset, offset + chunkSize);
        const iv = ivFrom(ivSeed, index++);
        const cipher = await encryptChunk(key, iv, plain.slice().buffer as ArrayBuffer);

        const frame = new Uint8Array(8 + cipher.byteLength);
        new DataView(frame.buffer).setUint32(0, plain.byteLength);
        new DataView(frame.buffer).setUint32(4, iv.buffer === undefined ? 0 : index - 1);
        frame.set(new Uint8Array(cipher), 8);
        controller.enqueue(frame);
        offset += chunkSize;
      }
      pending = merged.slice(offset);
    },

    async flush(controller) {
      if (pending.length > 0) {
        const iv = ivFrom(ivSeed, index++);
        const cipher = await encryptChunk(key, iv, pending.slice().buffer as ArrayBuffer);
        const frame = new Uint8Array(8 + cipher.byteLength);
        new DataView(frame.buffer).setUint32(0, pending.byteLength);
        new DataView(frame.buffer).setUint32(4, index - 1);
        frame.set(new Uint8Array(cipher), 8);
        controller.enqueue(frame);
      }
    },
  });
}

/**
 * Inverse of createEncryptionStream: reconstitutes framed ciphertext into
 * decrypted plaintext bytes.
 */
export async function createDecryptionStream(
  key: CryptoKey,
): Promise<TransformStream<Uint8Array, Uint8Array>> {
  let pending: Uint8Array = new Uint8Array(0);

  return new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      const merged = new Uint8Array(pending.length + chunk.byteLength);
      merged.set(pending);
      merged.set(chunk, pending.length);

      let offset = 0;
      const view = () => new DataView(merged.buffer, merged.byteOffset + offset, merged.byteLength - offset);

      while (merged.byteLength - offset >= 8) {
        const plainLen = view().getUint32(0);
        const ivIndex = view().getUint32(4);
        const frameLen = 8 + plainLen + 16; // 16-byte GCM tag
        if (merged.byteLength - offset < frameLen) break;

        const iv = new Uint8Array(12);
        new DataView(iv.buffer).setUint32(8, ivIndex);
        const cipher = merged.slice(offset + 8, offset + frameLen).buffer as ArrayBuffer;
        const plain = await decryptChunk(key, iv, cipher);
        controller.enqueue(new Uint8Array(plain));
        offset += frameLen;
      }
      pending = merged.slice(offset);
    },

    flush(controller) {
      if (pending.byteLength > 0) throw new Error('Truncated ciphertext stream');
      controller.terminate();
    },
  });
}
