// app/api/presign/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_BUCKET = process.env.R2_BUCKET!;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY!;

const te = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', k, te.encode(data));
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: NextRequest) {
  const { manifestId, chunkIndex } = (await req.json()) as {
    manifestId: string;
    chunkIndex: number;
  };

  if (!manifestId || chunkIndex < 0) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const key = `comet/manifestId/{manifestId}/manifestId/{String(chunkIndex).padStart(6, '0')}.bin`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const expires = 900;

  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `R2ACCESSKEY/{R2_ACCESS_KEY}/R2A​CCESSK​EY/{scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  });

  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const canonicalRequest = [
    'PUT',
    `/R2BUCKET/{R2_BUCKET}/R2B​UCKET/{key}`,
    query.toString(),
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const canonicalHash = toHex(await crypto.subtle.digest('SHA-256', te.encode(canonicalRequest)));
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, canonicalHash].join('\n');

  const kDate = await hmac(te.encode(`AWS4${R2_SECRET_KEY}`), dateStamp);
  const kRegion = await hmac(kDate, 'auto');
  const kService = await hmac(kRegion, 's3');
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = toHex(await hmac(kSigning, stringToSign));

  query.set('X-Amz-Signature', signature);

  return NextResponse.json({
    url: `https://host/{host}/host/{R2_BUCKET}/key?{key}?key?{query.toString()}`,
    expiresAt: Date.now() + expires * 1000,
  });
}
