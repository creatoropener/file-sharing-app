// components/file-card.tsx
'use client';

import { motion } from 'framer-motion';
import { File as FileIcon, X, UploadCloud, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ProgressRing } from './progress-ring';
import { useTransferStore } from '@/lib/store/transfer-store';
import { formatBytes, formatSpeed, formatEta } from '@/lib/utils/format';

export function FileCard({ id, name, size }: { id: string; name: string; size: number }) {
  const progress = useTransferStore((s) => s.progress[id]);
  const removeFile = useTransferStore((s) => s.removeFile);
  const ratio = progress && progress.bytesTotal > 0 ? progress.bytesDone / progress.bytesTotal : 0;
  const active = progress && progress.phase !== 'done' && progress.phase !== 'error' && progress.phase !== 'idle';

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24 }}
      className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"
    >
      {progress?.phase === 'done' ? (
        <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-400" aria-hidden />
      ) : progress?.phase === 'error' ? (
        <AlertTriangle className="h-8 w-8 shrink-0 text-red-400" aria-label={progress.error} />
      ) : active ? (
        <ProgressRing value={ratio} size={44} label={`Uploading ${name}`} />
      ) : (
        <FileIcon className="h-8 w-8 shrink-0 text-zinc-500" aria-hidden />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">{name}</p>
        <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
          {formatBytes(size)}
          {active && progress.speedBps > 0 && (
            <> · {formatSpeed(progress.speedBps)} · {formatEta(progress.etaSeconds)} left</>
          )}
          {progress?.phase === 'done' && ' · Encrypted & uploaded'}
        </p>
      </div>

      {!active && (
        <button
          onClick={() => removeFile(id)}
          aria-label={`Remove ${name}`}
          className="rounded-md p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </motion.li>
  );
}
