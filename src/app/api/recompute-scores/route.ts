import { NextResponse, type NextRequest } from 'next/server';
import { refreshAllScores } from '@/lib/memory/refresh';
import { prisma } from '@/lib/prisma';
import { at1700Jakarta } from '@/lib/adhd/lead-days';

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

  // Auto-defer tanpa drama: tugas yang lewat >24 jam dan tidak disentuh >48 jam
  // digeser ke hari ini 17:00 WIB, bukan dibiarkan menumpuk sebagai beban.
  let deferred = 0;
  try {
    const now = Date.now();
    const stale = await prisma.task.findMany({
      where: {
        status: { not: 'DONE' },
        archived: false,
        dueAt: { lt: new Date(now - 24 * 3_600_000) },
        lastTouchedAt: { lt: new Date(now - 48 * 3_600_000) },
      },
      select: { id: true },
    });
    if (stale.length) {
      const target = at1700Jakarta(new Date(now));
      const res = await prisma.task.updateMany({ where: { id: { in: stale.map((t) => t.id) } }, data: { dueAt: target } });
      deferred = res.count;
    }
    console.log(`[adhd] auto-defer: ${deferred}`);
  } catch (e) {
    console.error('[adhd] auto-defer gagal', e);
  }
  return NextResponse.json({ ok: true, updated, deferred });
}

export const GET = handle;
export const POST = handle;
