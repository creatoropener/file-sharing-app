// components/share-panel.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Link2, Cloud, UploadCloud } from 'lucide-react';
import { useUpload } from '@/hooks/use-transfer';
import { useTransferStore } from '@/lib/store/transfer-store';
import { FileCard } from '@/components/file-card';

export function SharePanel() {
  const files = useTransferStore((s) => s.files);
  const shareUrl = useTransferStore((s) => s.shareUrl);
  const start = useUpload();
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full space-y-4">
      <ul className="space-y-2" aria-label="Staged files">
        <AnimatePresence initial={false}>
          {files.map((f) => (
            <FileCard key={f.id} id={f.id} name={f.name} size={f.size} />
          ))}
        </AnimatePresence>
      </ul>

      {files.length > 0 && (
        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 py-2.5 font-semibold text-zinc-950 transition hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50"
          disabled={busyId !== null}
          onClick={async () => {
            const f = files[0];
            setBusyId(f.id);
            await start.start(f.id, f.file);
            setBusyId(null);
          }}
        >
          <UploadCloud className="h-4 w-4" aria-hidden />
          {busyId ? 'Encrypting & uploading…' : 'Encrypt & Upload'}
        </button>
      )}

      <AnimatePresence>
        {shareUrl && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-400">
              <Link2 className="h-4 w-4 shrink-0" aria-hidden />
              Encrypted link ready — the key is in the fragment (#) and is never sent to any server.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                readOnly
                value={shareUrl}
                aria-label="Share URL"
                onFocus={(e) => e.target.select()}
                className="min-w-0 flex-1 truncate rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300"
              />
              <button
                onClick={copy}
                aria-label="Copy share link"
                className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
              <Cloud className="h-3 w-3" aria-hidden /> Files auto-expire from storage after 24 hours.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
