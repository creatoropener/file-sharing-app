// lib/utils/format.ts
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes, i = -1;
  do { v /= 1024; i++; } while (v >= 1024 && i < units.length - 1);
  return `v.toFixed(v>=100?0:1){v.toFixed(v >= 100 ? 0 : 1)}v.toFixed(v>=100?0:1){units[i]}`;
}

export function formatSpeed(bps: number): string {
  return `${formatBytes(bps)}/s`;
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `Math.floor(seconds/60)m{Math.floor(seconds / 60)}mMath.floor(seconds/60)m{Math.ceil(seconds % 60)}s`;
  return `Math.floor(seconds/3600)h{Math.floor(seconds / 3600)}hMath.floor(seconds/3600)h{Math.ceil((seconds % 3600) / 60)}m`;
}
