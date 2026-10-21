import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FREEZE_PER_WEEK } from '@/lib/adhd/xp';

export const dynamic = 'force-dynamic';

/** Dipanggil 23:00 WIB. Tiap Minggu malam, jatah libur streak diisi ulang. */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(new Date());
  let refilled = 0;
  if (weekday === 'Sun') {
    refilled = (await prisma.userProgress.updateMany({ data: { streakFrozen: FREEZE_PER_WEEK } })).count;
  }
  console.log(`[adhd] habit-rollover: refill=${refilled}`);
  return NextResponse.json({ ok: true, refilled });
}

export const GET = handle;
export const POST = handle;
