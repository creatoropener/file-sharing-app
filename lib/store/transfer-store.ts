'use client';

import { create } from 'zustand';
import type { TransferProgress, TransportMode } from '@/types/transfer';

export interface FileMeta {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'staged' | 'encrypting' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

export interface TransferState {
  files: FileMeta[];
  mode: TransportMode;
  progress: Record<string, TransferProgress>;
  shareUrl: string | null;
  setFiles: (files: FileMeta[]) => void;
  addFiles: (files: FileMeta[]) => void;
  removeFile: (id: string) => void;
  setMode: (m: TransportMode) => void;
  setProgress: (id: string, p: TransferProgress) => void;
  setShareUrl: (url: string | null) => void;
  reset: () => void;
}

export interface FileMeta {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
}

export const useTransferStore = create<TransferState>((set) => ({
  files: [],
  mode: 'cloud',
  progress: {},
  shareUrl: null,
  setFiles: (files) => set({ files }),
  addFiles: (files) => set((s) => ({ files: [...s.files, ...files] })),
  removeFile: (id) =>
    set((s) => ({
      files: s.files.filter((f) => f.id !== id),
      progress: Object.fromEntries(Object.entries(s.progress).filter(([k]) => k !== id)),
    })),
  setMode: (mode) => set({ mode }),
  setProgress: (id, p) =>
    set((s) => ({ progress: { ...s.progress, [id]: p } })),
  setShareUrl: (shareUrl) => set({ shareUrl }),
  reset: () => set({ files: [], progress: {}, shareUrl: null }),
}));
