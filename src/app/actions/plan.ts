'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { awardWin, dayAsDate, jakartaDay } from '@/lib/adhd/progress';
import { refreshAllScores } from '@/lib/memory/refresh';
import { XP } from '@/lib/adhd/xp';
import type { ActionResult } from '@/lib/types';

const SCOPES = ['VISION', 'SEASON', 'WEEK'] as const;

/** Simpan vision / target musim / top 3 minggu. Form: scope, period, content. */
export async function savePlan(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const scope = String(formData.get('scope') ?? '') as (typeof SCOPES)[number];
  if (!SCOPES.includes(scope)) return { ok: false, message: 'Bagian tidak dikenal.' };
  const period = scope === 'VISION' ? '' : String(formData.get('period') ?? '').slice(0, 10);
  const content = String(formData.get('content') ?? '').trim().slice(0, 4000);
  await prisma.planEntry.upsert({
    where: { userId_scope_period: { userId: user.id, scope, period } },
    update: { content },
    create: { userId: user.id, scope, period, content },
  });
  revalidatePath('/review');
  return { ok: true, message: 'Tersimpan.' };
}

/**
 * Tutup review mingguan: hitung ulang skor memori (catatan dingin tenggelam
 * ke arsip, tidak dihapus), centang habit Review mingguan, dan beri XP.
 */
export async function finishWeeklyReview(): Promise<ActionResult> {
  const user = await requireUser();
  const count = await refreshAllScores(user.id);
  const date = dayAsDate(jakartaDay());
  const habit = await prisma.habit.findFirst({ where: { userId: user.id, archived: false, name: { startsWith: 'review', mode: 'insensitive' } } });
  let fresh = true;
  if (habit) {
    const existing = await prisma.habitLog.findUnique({ where: { habitId_date: { habitId: habit.id, date } } });
    fresh = !existing?.completed;
    await prisma.habitLog.upsert({
      where: { habitId_date: { habitId: habit.id, date } },
      update: { completed: true, stepsDone: 1 },
      create: { habitId: habit.id, date, completed: true, stepsDone: 1 },
    });
  }
  if (fresh) await awardWin(user.id, 'Review mingguan', 'reset', XP.reset);
  for (const p of ['/review', '/', '/notes', '/memory']) revalidatePath(p);
  return { ok: true, message: `Review beres. ${count} catatan dirapikan, yang dingin turun ke arsip.` };
}
