import { FileManifest } from '@/types/transfer';

const subtle = crypto.subtle;

export interface SessionKey {
  raw: Uint8Array;       // 32 bytes — goes into URL fragment
  key: CryptoKey;        // non-extractable runtime handle
}

export async function generateSessionKey(): Promise<SessionKey> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, [
    'encrypt', 'decrypt',
  ]);
  return { raw, key };
}

export function keyToFragment(key: Uint8Array): string {
  return bytesToBase64Url(key);
}

export async function keyFromFragment(fragment: string): Promise<CryptoKey> {
  const raw = base64UrlToBytes(fragment);
  if (raw.length !== 32) throw new Error('Invalid key length');
  return subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export function generateIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

export async function encryptChunk(
  key: CryptoKey,
  iv: Uint8Array,
  data: ArrayBuffer,
  aad?: ArrayBuffer,
): Promise<ArrayBuffer> {
  return subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad, tagLength: 128 },
    key,
    data,
  );
}

export async function decryptChunk(
  key: CryptoKey,
  iv: Uint8Array,
  cipher: ArrayBuffer,
  aad?: ArrayBuffer,
): Promise<ArrayBuffer> {
  return subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad, tagLength: 128 },
    key,
    cipher,
  );
}

export async function encryptString(key: CryptoKey, plain: string): Promise<{ iv: string; data: string }> {
  const iv = generateIv();
  const buf = new TextEncoder().encode(plain);
  const cipher = await encryptChunk(key, iv, buf.buffer as ArrayBuffer);
  return { iv: bytesToBase64Url(iv), data: bytesToBase64Url(new Uint8Array(cipher)) };
}

export async function decryptString(key: CryptoKey, ivB64: string, dataB64: string): Promise<string> {
  const plain = await decryptChunk(key, base64UrlToBytes(ivB64), base64UrlToBytes(dataB64).buffer as ArrayBuffer);
  return new TextDecoder().decode(plain);
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// — base64url, allocation-light —
export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
