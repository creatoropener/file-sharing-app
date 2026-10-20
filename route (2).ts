// app/api/signal/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface SignalMessage { roomId: string; role: 'offerer' | 'answerer'; sdp: string; ts: number; }

// In-memory ring per isolate is acceptable for short-lived signaling;
// swap for KV with 120s TTL in multi-isolate deployments.
const rooms = new Map<string, SignalMessage[]>();

export async function POST(req: NextRequest) {
  const msg = (await req.json()) as SignalMessage;
  if (!msg.roomId || !msg.sdp || msg.sdp.length > 16_384) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  }
  const list = rooms.get(msg.roomId) ?? [];
  list.push({ ...msg, ts: Date.now() });
  rooms.set(msg.roomId, list.slice(-4));
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('room') ?? '';
  const since = Number(req.nextUrl.searchParams.get('since') ?? 0);
  const msgs = (rooms.get(roomId) ?? []).filter((m) => m.ts > since);
  return NextResponse.json(msgs);
}
