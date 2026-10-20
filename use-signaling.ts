'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SignalMessage {
  roomId: string;
  role: 'offerer' | 'answerer';
  sdp: string;
  ts: number;
}

async function poll(roomId: string, since: number, signal: AbortSignal): Promise<SignalMessage[]> {
  const res = await fetch(`/api/signal?room={encodeURIComponent(roomId)}&since={since}`, { signal });
  if (!res.ok) return [];
  return res.json() as Promise<SignalMessage[]>;
}

async function push(msg: SignalMessage): Promise<void> {
  await fetch('/api/signal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  });
}

export function useSignaling(roomId: string, role: 'offerer' | 'answerer') {
  const [connected, setConnected] = useState(false);
  const [remoteSdp, setRemoteSdp] = useState<string | null>(null);
  const lastTs = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const publish = useCallback(
    (sdp: string) => push({ roomId, role, sdp, ts: Date.now() }),
    [roomId, role],
  );

  useEffect(() => {
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    const tick = async () => {
      try {
        const msgs = await poll(roomId, lastTs.current, signal);
        for (const m of msgs) {
          if (m.role !== role) {
            lastTs.current = Math.max(lastTs.current, m.ts);
            setRemoteSdp(m.sdp);
            setConnected(true);
          }
        }
      } catch { /* transient */ }
    };
    const interval = setInterval(tick, 1200);
    void tick();
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [roomId, role]);

  return { publish, remoteSdp, connected };
}
