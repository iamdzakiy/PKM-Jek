import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clearWatchChannel, pullFromGoogle } from '@/lib/google/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Google may probe the endpoint with a GET (channel verification handshake) before the first push. */
export async function GET(request: NextRequest) {
  const channelId = request.headers.get('x-goog-channel-id');
  const channelToken = request.headers.get('x-goog-channel-token');
  if (!channelId || !channelToken) return new NextResponse(null, { status: 400 });
  const account = await prisma.googleAccount.findFirst({ where: { channelId, channelToken } });
  return new NextResponse(null, { status: account ? 200 : 404 });
}

/**
 * Google Calendar push endpoint (events.watch). Google pings this on every
 * change to the watched calendar; the payload carries no data — we re-pull
 * the syncToken delta and respond.
 *
 * Verification:
 *  - the channel id in X-Goog-Channel-Id must match the stored one;
 *  - the X-Goog-Channel-Token must match the random token we minted at
 *    registration (Google echoes it back), so an attacker who guesses the URL
 *    can't trigger syncs or observe channel state.
 *
 * Special states Google sends: `sync` (first ping after watch registration —
 * nothing to do) and `not_found` (channel expired or calendar gone — drop the
 * channel so the renewal cron starts fresh).
 */
export async function POST(request: NextRequest) {
  const channelId = request.headers.get('x-goog-channel-id');
  const channelToken = request.headers.get('x-goog-channel-token');
  const resourceState = request.headers.get('x-goog-resource-state');

  if (!channelId) return new NextResponse(null, { status: 400 });

  const account = await prisma.googleAccount.findFirst({ where: { channelId } });
  // Unknown or token-mismatched channel: claim gone (410) so Google stops
  // retrying and re-registering is driven purely by our cron.
  if (!account || !channelToken || account.channelToken !== channelToken) {
    return new NextResponse(null, { status: 410 });
  }

  if (resourceState === 'not_found') {
    await clearWatchChannel(account.id);
    return new NextResponse(null, { status: 200 });
  }
  if (resourceState === 'sync') return new NextResponse(null, { status: 200 });

  try {
    const stats = await pullFromGoogle(account.userId);
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    console.error('[google] webhook pull failed:', err);
    // 500 makes Google retry the notification with backoff — desirable.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
