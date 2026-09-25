import test from 'node:test'; import assert from 'node:assert/strict'; import { readableFromBytes, collectBytes } from 'file:///patchproof/web_streams.mjs'; import { createEncryptionStream, createDecryptionStream } from '@/lib/crypto/stream-cipher'; import { generateSessionKey } from '@/lib/crypto/aes';
test('encryption/decryption round trip recovers original bytes including final partial chunk', async () => {
  const original = new Uint8Array([1, 2, 3, 4, 5]);
  let recovered: Uint8Array | undefined;
  await assert.doesNotReject(async () => {
    const { key } = await generateSessionKey();
    const forward = await createEncryptionStream(key);
    const encoded = await collectBytes(readableFromBytes(original, 2).pipeThrough(forward));
    const inverse = await createDecryptionStream(key);
    recovered = await collectBytes(readableFromBytes(encoded, 2).pipeThrough(inverse));
  });
  assert.deepStrictEqual(recovered, original);
});
