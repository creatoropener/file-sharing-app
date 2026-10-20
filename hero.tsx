// components/hero.tsx  (React Server Component — zero client JS)
import { ArrowDown } from 'lucide-react';

const STATS = [
  { value: 'AES-256', label: 'GCM encryption' },
  { value: '5 GB', label: 'max file size' },
  { value: '0 KB', label: 'stored keys' },
] as const;

export function Hero() {
  return (
    <header className="mb-12 text-center">
      <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-xs font-medium text-cyan-300">
        End-to-end encrypted · zero-knowledge
      </p>

      <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
        Your files.{' '}
        <span className="bg-gradient-to-r from-cyan-400 to-sky-500 bg-clip-text text-transparent">
          Your keys.
        </span>
      </h1>

      <p className="mx-auto mt-4 max-w-xl text-zinc-400">
        CometFile encrypts everything in your browser before a single byte leaves.
        The decryption key travels only in the link fragment — servers never see it.
      </p>

      <dl className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-4" aria-label="Key facts">
        {STATS.map(({ value, label }) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-3">
            <dt className="sr-only">{label}</dt>
            <dd className="text-lg font-bold tabular-nums text-cyan-400">{value}</dd>
            <dd className="mt-0.5 text-[11px] text-zinc-500">{label}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-10 flex items-center justify-center gap-1.5 text-xs text-zinc-600">
        <ArrowDown className="h-3.5 w-3.5 animate-bounce" aria-hidden />
        Start by dropping a file below
      </p>
    </header>
  );
}
