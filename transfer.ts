// types/transfer.ts
export interface FileManifest {
  id: string;
  name: string;              // encrypted at rest (base64)
  nameIv: string;
  mime: string;
  size: number;
  chunkSize: number;         // 4 * 1024 * 1024
  chunkCount: number;
  ivs: string[];             // per-chunk IVs, base64
  authTagVerified: boolean;
  createdAt: number;
  sha256: string;            // integrity of ciphertext
}

export interface TransferProgress {
  bytesDone: number;
  bytesTotal: number;
  speedBps: number;
  etaSeconds: number;
  phase: 'idle' | 'hashing' | 'encrypting' | 'uploading' | 'sealing' | 'done' | 'error';
  error?: string;
}

export interface PresignRequest {
  manifestId: string;
  chunkIndex: number;
}

export interface PresignResponse {
  url: string;
  expiresAt: number;
}

export type TransportMode = 'cloud' | 'p2p';

export const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
export const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
