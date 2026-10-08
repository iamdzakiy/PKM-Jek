'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { addDays, nextInterval } from '@/lib/memory/recall';
import { refreshNoteScore } from '@/lib/memory/refresh';
import type { ActionResult } from '@/lib/types';

/** Adds a due-now quiz question to a note (used from the note editor). */
export async function addRecallQuestion(noteId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const question = String(formData.get('question') ?? '').trim().slice(0, 300);
  const correctAnswer = String(formData.get('answer') ?? '').trim().slice(0, 600);
  if (!question || !correctAnswer) return { ok: false, message: 'Isi pertanyaan dan jawabannya.' };

  const note = await prisma.note.findFirst({ where: { id: noteId, userId: user.id }, select: { id: true } });
  if (!note) return { ok: false, message: 'Catatan tidak ditemukan.' };

  await prisma.activeRecallSession.create({
    data: { noteId, question, correctAnswer, intervalDays: 1, nextReviewAt: new Date() },
  });
  revalidatePath('/recall');
  revalidatePath(`/notes/${noteId}`);
  return { ok: true, message: 'Kuis dijadwalkan.' };
}

/** Grades a free-recall answer and reschedules it (SM-2-lite: 1 → 7 → 30 → 90 days, reset to 1 on a miss). */
export async function submitRecallAnswer(sessionId: string, userAnswer: string, isCorrect: boolean): Promise<ActionResult> {
  const user = await requireUser();

  // Ownership is checked through the note. The original version trusted any session id.
  const session = await prisma.activeRecallSession.findFirst({
    where: { id: sessionId, note: { userId: user.id } },
  });
  if (!session) return { ok: false, message: 'Kuis tidak ditemukan.' };
  if (session.nextReviewAt > new Date()) return { ok: false, message: 'Kuis ini belum jatuh tempo.' };

  const interval = nextInterval(session.intervalDays, isCorrect);
  await prisma.activeRecallSession.update({
    where: { id: sessionId },
    data: {
      userAnswer: userAnswer.slice(0, 600),
      isCorrect,
      reviewedAt: new Date(),
      intervalDays: interval,
      nextReviewAt: addDays(new Date(), interval),
    },
  });

  // A successful recall is itself a strong interaction signal for MB.
  await prisma.interaction.create({
    data: { noteId: session.noteId, type: isCorrect ? 'COMMENT' : 'VIEW', weight: isCorrect ? 0.9 : 0.2 },
  });
  await refreshNoteScore(session.noteId);

  revalidatePath('/recall');
  revalidatePath('/');
  return { ok: true, message: `Kuis kembali dalam ${interval} hari.` };
}
