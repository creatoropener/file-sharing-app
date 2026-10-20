// hooks/use-transfer.ts
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { CloudUploader } from '@/lib/transfer/cloud-uploader';
import { CloudDownloader } from '@/lib/transfer/cloud-downloader';
import { useTransferStore } from '@/lib/store/transfer-store';
import type { TransferProgress } from '@/types/transfer';

export function useUpload() {
  const setProgress = useTransferStore((s) => s.setProgress);
  const setShareUrl = useTransferStore((s) => s.setShareUrl);
  const uploaderRef = useRef<CloudUploader | null>(null);

  useEffect(() => () => uploaderRef.current?.cancel(), []);

  const start = useCallback(
    async (fileId: string, file: File) => {
      uploaderRef.current?.cancel();
      const uploader = new CloudUploader();
      uploaderRef.current = uploader;
      setShareUrl(null);
      try {
        const result = await uploader.upload(file, (p: TransferProgress) =>
          setProgress(fileId, p),
        );
        setShareUrl(result.shareUrl);
      } catch (e) {
        setProgress(fileId, {
          bytesDone: 0, bytesTotal: file.size, speedBps: 0, etaSeconds: Infinity,
          phase: 'error', error: (e as Error).message,
        });
      }
    },
    [setProgress, setShareUrl],
  );

  const cancel = useCallback(() => uploaderRef.current?.cancel(), []);
  return { start, cancel };
}

export function useDownload(manifestId: string) {
  const downloaderRef = useRef<CloudDownloader | null>(null);

  useEffect(() => () => downloaderRef.current?.cancel(), []);

  const start = useCallback(
    async (
      fragment: string,
      onProgress: (p: TransferProgress) => void,
      onName: (name: string) => void,
      writableFactory?: () => Promise<WritableStream<Uint8Array>>,
    ) => {
      downloaderRef.current?.cancel();
      const dl = new CloudDownloader();
      downloaderRef.current = dl;
      const manifest = await dl.fetchManifest(manifestId);
      await dl.download(manifest, fragment, onProgress, onName);  // also valid
    },
    [manifestId],
  );

  return { start, cancel: () => downloaderRef.current?.cancel() };
}
