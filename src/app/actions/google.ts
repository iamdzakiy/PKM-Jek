'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { buildAuthUrl, googleEnvProblem, stopWatch } from '@/lib/google/client';
import { pullFromGoogle } from '@/lib/google/sync';
import type { ActionResult } from '@/lib/types';

/**
 * Kicks off the OAuth dance: builds the consent URL with the app user id in
 * `state` and redirects. Google calls /api/google/callback on the way back.
 * Uses redirect() (throws) rather than { href } because the target is an
 * external origin.
 */
export async function connectGoogle(): Promise<never> {
  const user = await requireUser();
  if (googleEnvProblem()) redirect('/settings/google?google=env');
  redirect(buildAuthUrl(user.id));
}

/** Revokes the grant, stops the watch channel, and drops the row. Local Event/Task rows stay. */
export async function disconnectGoogle(): Promise<ActionResult> {
  const user = await requireUser();
  const account = await prisma.googleAccount.findUnique({ where: { userId: user.id } });
  if (account) {
    if (account.channelId && account.channelResourceId) {
      await stopWatch(account, { id: account.channelId, resourceId: account.channelResourceId });
    }
    // Revoke the token at Google's end too (best-effort — 404/410 is fine).
    if (account.accessToken) {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: account.accessToken }),
      }).catch(() => undefined);
    }
    await prisma.googleAccount.delete({ where: { id: account.id } });
  }
  revalidatePath('/settings/google');
  revalidatePath('/events');
  return { ok: true, message: 'Akun Google diputus.' };
}

/** Manual "pull now": runs the incremental merge on demand from the settings screen. */
export async function syncNowGoogle(): Promise<ActionResult> {
  const user = await requireUser();
  const account = await prisma.googleAccount.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!account) return { ok: false, message: 'Belum terhubung ke Google Calendar.' };

  try {
    const stats = await pullFromGoogle(user.id);
    revalidatePath('/events');
    revalidatePath('/');
    return {
      ok: true,
      message: `Sinkron selesai: ${stats.imported} baru, ${stats.updated} diperbarui, ${stats.deleted} dihapus.`,
    };
  } catch (err) {
    console.error('[google] manual sync failed:', err);
    return { ok: false, message: 'Gagal menarik perubahan dari Google. Coba lagi.' };
  }
}
