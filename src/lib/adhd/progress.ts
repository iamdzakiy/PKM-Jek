import { prisma } from '@/lib/prisma';
import { APP_TZ } from '@/lib/utils';
import { levelFromXp } from './xp';

/** Tanggal kalender WIB, format YYYY-MM-DD. */
export function jakartaDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ }).format(d);
}

/** Nilai untuk kolom @db.Date (tengah malam UTC pada tanggal WIB). */
export function dayAsDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

/** Maksimal hari terlewat yang tidak memutus streak (freeze lunak). */
const GRACE_DAYS = 2;

/**
 * Satu-satunya jalur menambah XP. XP tidak pernah berkurang, streak tidak
 * pernah memunculkan peringatan: terlalu lama kosong cukup mulai hitung lagi.
 */
export async function awardWin(userId: string, label: string, kind: string, xp: number) {
  const now = new Date();
  const today = jakartaDay(now);

  const current = await prisma.userProgress.findUnique({ where: { userId } });
  const lastDay = current?.lastWinAt ? jakartaDay(current.lastWinAt) : null;

  let streak = current?.streakDays ?? 0;
  if (!lastDay) streak = 1;
  else {
    const gap = dayDiff(today, lastDay);
    if (gap === 0) streak = Math.max(1, streak);
    else if (gap <= GRACE_DAYS + 1) streak += 1;
    else streak = 1;
  }

  const totalXp = (current?.xp ?? 0) + xp;

  const [win] = await prisma.$transaction([
    prisma.microWin.create({ data: { userId, label: label.slice(0, 120), kind, xp } }),
    prisma.userProgress.upsert({
      where: { userId },
      update: { xp: totalXp, level: levelFromXp(totalXp), streakDays: streak, lastWinAt: now },
      create: { userId, xp: totalXp, level: levelFromXp(totalXp), streakDays: streak, lastWinAt: now },
    }),
  ]);
  return win;
}
