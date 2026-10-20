// components/download-view.tsx
'use client';

import { useCallback, useState } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { useDownload } from '@/hooks/use-transfer';
import { ProgressRing } from './progress-ring';
import { formatBytes, formatSpeed } from '@/lib/utils/format';
import type { TransferProgress } from '@/types/transfer';

export function DownloadView({ manifestId }: { manifestId: string }) {
  const { start, cancel } = useDownload(manifestId);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [fileName, setFileName] = useState<string>('encrypted file');
  const [error, setError] = useState<string | null>(null);

  const begin = useCallback(async () => {
    setError(null);
    // File System Access API: request the destination handle inside the user
    // gesture, stream decrypted bytes directly to disk — constant memory.
    let writableFactory: (() => Promise<WritableStream<Uint8Array>>) | undefined;
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as unknown as {
          showSaveFilePicker: (o: { suggestedName: string }) => Promise<FileSystemFileHandle>;
        }).showSaveFilePicker({ suggestedName: 'cometfile-download' });
        writableFactory = () => handle.createWritable();
      } catch { /* user cancelled picker */ return; }
    }
    try {
      await start(
        window.location.hash.slice(1),
        setProgress,
        setFileName,
        writableFactory,
      );
    } catch (e) {
      setError(
        (e as Error).message.includes('decrypt') || (e as Error).message.includes('operation')
          ? 'Wrong key or corrupted data — check that the full link (including #…) was copied.'
          : (e as Error).message,
      );
    }
  }, [start]);

  const ratio = progress && progress.bytesTotal > 0 ? progress.bytesDone / progress.bytesTotal : 0;

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h1 className="text-2xl font-bold text-zinc-100">{fileName}</h1>
      {progress?.bytesTotal ? (
        <p className="text-sm tabular-nums text-zinc-500">
          {formatBytes(progress.bytesDone)} / {formatBytes(progress.bytesTotal)}
          {progress.speedBps > 0 && ` · ${formatSpeed(progress.speedBps)}`}
        </p>
      ) : null}

      {progress && progress.phase !== 'done' && progress.phase !== 'error' && (
        <ProgressRing value={ratio} size={140} label="Download progress" />
      )}
      {progress?.phase === 'done' && (
        <p className="flex items-center gap-2 text-emerald-400" role="status">
          <ShieldCheck className="h-5 w-5" aria-hidden /> Integrity verified (GCM auth tag passed)
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      {(!progress || progress.phase === 'error') && (
        <button
          onClick={begin}
          className="flex items-center gap-2 rounded-full bg-cyan-500 px-8 py-3 font-semibold text-zinc-950 transition hover:bg-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
        >
          <Download className="h-5 w-5" aria-hidden /> Decrypt & Download
        </button>
      )}
      {progress && progress.phase !== 'done' && progress.phase !== 'error' && (
        <button onClick={cancel} className="text-sm text-zinc-500 hover:text-zinc-300">Cancel</button>
      )}
    </div>
  );
}
