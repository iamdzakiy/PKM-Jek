import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureWatchChannel } from '@/lib/google/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Daily channel renewal (Vercel Cron, `Authorization: Bearer $CRON_SECRET`).
 * Google kills watch channels after at most 7 days, so we re-register every
 * day with margin. Also sweeps any channel that is already within 12h of its
 * expiration, and re-registers for accounts whose webhook reported not_found.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const accounts = await prisma.googleAccount.findMany();
  const now = Date.now();
  let renewed = 0;
  let failed = 0;

  for (const account of accounts) {
    const expiringSoon = !account.channelExpiration || account.channelExpiration.getTime() - now < 12 * 3600 * 1000;
    const channelLost = !account.channelResourceId; // webhook saw not_found
    if (!expiringSoon && !channelLost) continue;
    try {
      await ensureWatchChannel(account);
      renewed += 1;
    } catch (err) {
      failed += 1;
      console.error(`[google] watch renewal failed for ${account.email}:`, err);
    }
  }

  return NextResponse.json({ ok: true, total: accounts.length, renewed, failed });
}

export const GET = handle;
export const POST = handle;
