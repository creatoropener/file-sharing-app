// components/drop-zone.tsx
'use client';

import { motion } from 'framer-motion';
import { CloudUpload, FolderOpen, ShieldCheck } from 'lucide-react';
import { useDropzone } from '@/hooks/use-dropzone';
import { useTransferStore } from '@/lib/store/transfer-store';

export function DropZone() {
  const { isDragging, errors, handlers, openPicker } = useDropzone();
  const fileCount = useTransferStore((s) => s.files.length);

  return (
    <section aria-label="File upload" className="w-full">
      <motion.div
        {...handlers}
        role="button"
        tabIndex={0}
        aria-label="Drag and drop files here, or press Enter to browse"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        animate={{
          scale: isDragging ? 1.01 : 1,
          borderColor: isDragging ? 'rgb(34 211 238)' : 'rgb(63 63 70)',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex min-h-[280px] w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed bg-zinc-950/60 p-8 text-center outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:min-h-[340px]"
        onClick={openPicker}
      >
        <motion.div animate={{ y: isDragging ? -6 : 0 }} className="rounded-2xl bg-cyan-400/10 p-5">
          <CloudUpload className="h-10 w-10 text-cyan-400" aria-hidden />
        </motion.div>
        <div>
          <p className="text-lg font-semibold text-zinc-100">
            {isDragging ? 'Release to add files' : 'Drop files here'}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Up to 5GB per file · encrypted in your browser before upload
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200">
          <FolderOpen className="h-4 w-4" aria-hidden /> Browse files
        </span>
        <p className="flex items-center gap-1.5 text-xs text-zinc-600">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          AES-256-GCM · keys never leave your device
        </p>
      </motion.div>

      {errors.length > 0 && (
        <ul role="alert" className="mt-3 space-y-1 text-sm text-red-400">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}
      {fileCount > 0 && <p className="mt-3 text-sm text-zinc-500">{fileCount} file(s) staged</p>}
    </section>
  );
}
