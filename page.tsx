// app/page.tsx
import { ShieldCheck, Zap, Waves } from 'lucide-react';
import { Hero } from '@/components/hero';
import { DropZone } from '@/components/drop-zone';
import { SharePanel } from '@/components/share-panel';

export default function HomePage() {
  return (
    <main className="relative mx-auto max-w-3xl px-4 py-16 md:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.12),transparent_60%)]" />
      <Hero />
      <DropZone />
      <div className="mt-8"><SharePanel /></div>

      <section aria-label="How it works" className="mt-16 grid gap-6 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, title: 'Zero-knowledge', body: 'AES-256-GCM via Web Crypto. Keys are generated locally and live in the URL #fragment only.' },
          { icon: Zap, title: 'P2P or Cloud', body: 'Direct WebRTC transfer when both parties are online; presigned R2 streaming otherwise.' },
          { icon: Waves, title: 'Streamed, not loaded', body: '4MB chunks flow through Web Workers and the Streams API — 5GB files never blow up your tab.' },
        ].map(({ icon: Icon, title, body }) => (
          <article key={title} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
            <Icon className="mb-3 h-6 w-6 text-cyan-400" aria-hidden />
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
