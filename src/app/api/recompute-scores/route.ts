import { NextResponse, type NextRequest } from 'next/server';
import { refreshAllScores } from '@/lib/memory/refresh';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Nightly recomputation of Memory Buoyancy / Preservation Value / folder for
 * every note. Vercel Cron calls this with GET and sends
 * `Authorization: Bearer $CRON_SECRET`. POST is kept for manual triggers.
 *
 * Two fixes over the original: Vercel Cron uses GET (a POST-only route
 * answered 405 every night), and an unset CRON_SECRET used to make the header
 * "Bearer undefined" a valid password.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const updated = await refreshAllScores();
  return NextResponse.json({ ok: true, updated });
}

export const GET = handle;
export const POST = handle;
