// hooks/use-dropzone.ts
'use client';

import { useCallback, useRef, useState } from 'react';
import { useTransferStore, FileMeta } from '@/lib/store/transfer-store';
import { MAX_FILE_SIZE } from '@/types/transfer';

export function useDropzone() {
  const addFiles = useTransferStore((s) => s.addFiles);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const dragDepth = useRef(0);

  const ingest = useCallback(
    (list: FileList | File[]) => {
      const accepted: FileMeta[] = [];
      const errs: string[] = [];
      for (const file of Array.from(list)) {
        if (file.size > MAX_FILE_SIZE) {
          errs.push(`"${file.name}" exceeds the 5GB limit.`);
          continue;
        }
        accepted.push({
  id: crypto.randomUUID(),
  file,
  name: file.name,
  size: file.size,
  type: file.type,
  status: 'staged',
  progress: 0,
});
      }
      if (accepted.length) addFiles(accepted);
      setErrors(errs);
    },
    [addFiles],
  );

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current++;
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (--dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      if (e.dataTransfer.files.length) ingest(e.dataTransfer.files);
    },
    [ingest],
  );

  const openPicker = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = () => input.files && ingest(input.files);
    input.click();
  }, [ingest]);

  return { isDragging, errors, handlers: { onDragEnter, onDragLeave, onDragOver, onDrop }, openPicker, ingest };
}
