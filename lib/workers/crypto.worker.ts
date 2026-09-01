// crypto.worker.ts
/// <reference lib="webworker" />

let key: CryptoKey | null = null;

const subtle = crypto.subtle;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, id } = e.data;

  switch (type) {
    case 'init': {
      key = payload.key as CryptoKey;
      self.postMessage({ type: 'ready', id });
      break;
    }
    case 'encrypt': {
      if (!key) throw new Error('Worker not initialized');
      const { buffer, iv, chunkIndex } = payload as {
        buffer: ArrayBuffer; iv: Uint8Array; chunkIndex: number;
      };
      const aad = new TextEncoder().encode(`cf:${chunkIndex}`);
const cipher = await subtle.encrypt(
  {
    name: 'AES-GCM',
    iv: iv as BufferSource,
    additionalData: aad as BufferSource,
    tagLength: 128,
  },
  key,
  buffer,
);
      // Transfer ownership back — zero-copy
      self.postMessage({ type: 'encrypted', id, payload: { cipher, chunkIndex } }, [cipher]);
      break;
    }
    case 'decrypt': {
      if (!key) throw new Error('Worker not initialized');
      const { cipher, iv, chunkIndex } = payload as {
        cipher: ArrayBuffer; iv: Uint8Array; chunkIndex: number;
      };
      const aad = new TextEncoder().encode(`cf:${chunkIndex}`);
      const plain = await subtle.decrypt(
  {
    name: 'AES-GCM',
    iv: iv as BufferSource,
    additionalData: aad as BufferSource,
    tagLength: 128,
  },
  key,
  cipher as BufferSource,
);
      self.postMessage({ type: 'decrypted', id, payload: { plain, chunkIndex } }, [plain]);
      break;
    }
    case 'hash': {
      const { buffer } = payload as { buffer: ArrayBuffer };
      const digest = await subtle.digest('SHA-256', buffer);
      self.postMessage({ type: 'hashed', id, payload: { digest } }, [digest]);
      break;
    }
  }
};

export {};
