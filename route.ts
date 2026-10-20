// app/api/manifest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { FileManifest } from '@/types/transfer';

export const runtime = 'edge';

// Ephemeral KV (Workers KV / Upstash). TTL = 24h. Server sees only
// ciphertext names + IVs — never the key (which lives in the URL fragment).
interface Store { get(k: string): Promise<FileManifest | null>; put(k: string, v: string, ttl: number): Promise<void>; }

const store: Store = {
  async get(k) {
    // Swap for your KV binding / REST client
    const res = await fetch(`process.env.KVRESTURL/get/manifest:{process.env.KV_REST_URL}/get/manifest:process.env.KVR​ESTU​RL/get/manifest:{k}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_TOKEN}` },
    });
    if (!res.ok) return null;
    const { result } = (await res.json()) as { result: string | null };
    return result ? (JSON.parse(result) as FileManifest) : null;
  },
  async put(k, v, ttl) {
    await fetch(`process.env.KVRESTURL/set/manifest:{process.env.KV_REST_URL}/set/manifest:process.env.KVR​ESTU​RL/set/manifest:{k}?ex=${ttl}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.KV_REST_TOKEN}` },
      body: v,
    });
  },
};

export async function POST(req: NextRequest) {
  const manifest = (await req.json()) as FileManifest;

  if (!manifest.id || !manifest.chunkCount || manifest.chunkCount > 1280 || manifest.size > 5 * 1024 ** 3) {
    return NextResponse.json({ error: 'Invalid manifest' }, { status: 400 });
  }
  await store.put(manifest.id, JSON.stringify(manifest), 86_400);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const manifest = await store.get(id);
  if (!manifest) return NextResponse.json({ error: 'Not found or expired' }, { status: 404 });
  return NextResponse.json(manifest);
}
