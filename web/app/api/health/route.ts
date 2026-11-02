import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isPushConfigured } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let dbStatus: 'ok' | 'down' = 'ok';
  try {
    await db.execute('SELECT 1');
  } catch {
    dbStatus = 'down';
  }

  return NextResponse.json(
    {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      db: dbStatus,
      pushConfigured: isPushConfigured(),
      timestamp: new Date().toISOString(),
    },
    { status: dbStatus === 'ok' ? 200 : 503 },
  );
}
