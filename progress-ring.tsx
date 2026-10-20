// components/progress-ring.tsx
'use client';

import { motion } from 'framer-motion';

interface ProgressRingProps {
  value: number; // 0..1
  size?: number;
  label?: string;
}

export function ProgressRing({ value, size = 120, label }: ProgressRingProps) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Transfer progress'}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-zinc-800" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke} strokeLinecap="round"
          className="text-cyan-400"
          stroke="currentColor"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))) }}
          transition={{ type: 'tween', ease: 'linear', duration: 0.25 }}
        />
      </svg>
      <span className="absolute text-sm font-semibold tabular-nums text-zinc-100">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}
