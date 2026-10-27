'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/current-user';
import { createNoteRecord } from '@/lib/notes-service';
import { prisma } from '@/lib/prisma';
import { asEnergy, isEnergy } from '@/lib/adhd/energy';
import { categorizeCapture } from '@/lib/adhd/categorize';
import { firstThreeSteps } from '@/lib/adhd/chunker';
import { dayAsDate, jakartaDay } from '@/lib/adhd/progress';
import type { ActionResult } from '@/lib/types';
import type { NoteType } from '@prisma/client';

const TYPE_TAGS: Record<string, NoteType> = {
  task: 'TASK',
  tugas: 'TASK',
  idea: 'IDEA',
  ide: 'IDEA',
  insight: 'INSIGHT',
};

const TODAY_TAGS = ['hariini', 'today'];

const HASHTAG = /(^|\s)#([\p{L}\p{N}_-]+)/gu;

/**
 * Quick Capture: one text box, zero decisions. A tiny concept router reads
 * hashtags: #task / #idea / #insight set the type, any other #tag becomes a
 * topic. The first line is the title. Everything lands in ♦Last Focus♦.
 */
export async function quickCapture(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const raw = String(formData.get('text') ?? '').trim();
  if (!raw) return { ok: false, message: 'Tulis sesuatu dulu.' };

  let type: NoteType = 'NOTE';
  let forToday = false;
  const topics: string[] = [];
  for (const m of raw.matchAll(HASHTAG)) {
    const tag = m[2].toLowerCase();
    if (TODAY_TAGS.includes(tag)) {
      // "#hariini" = harus beres hari ini: jadikan tugas dan pasang di Hari Ini.
      forToday = true;
      type = 'TASK';
    } else if (TYPE_TAGS[tag]) {
      if (type === 'NOTE') type = TYPE_TAGS[tag];
    } else {
      topics.push(m[2]);
    }
  }

  // Tanpa hashtag tipe, tebak secara heuristik. Hashtag eksplisit selalu menang.
  const guess = categorizeCapture(raw);
  if (type === 'NOTE') type = guess.type;
  const chosen = String(formData.get('energy') ?? '');
  const energy = isEnergy(chosen) ? chosen : guess.energy;

  const stripped = raw.replace(HASHTAG, '$1').replace(/[ \t]+\n/g, '\n').trim();
  const [firstLine, ...rest] = stripped.split('\n');
  const title = (firstLine.trim() || 'Tanpa judul').slice(0, 120);
  const content = rest.join('\n').trim();

  const note = await createNoteRecord({ userId: user.id, title, content, type, topicNames: topics });

  // Tugas ikut dibuat sebagai baris Task supaya langsung muncul di daftar dan sprint.
  if (type === 'TASK') {
    await prisma.task.create({
      data: { userId: user.id, title, energyType: asEnergy(energy), firstSteps: firstThreeSteps(title), plannedFor: forToday ? dayAsDate(jakartaDay()) : null },
    });
    revalidatePath('/tasks');
  }

  revalidatePath('/');
  revalidatePath('/notes');
  return { ok: true, message: forToday ? 'Tertangkap, masuk Hari Ini.' : type === 'TASK' ? 'Tertangkap. Tugas baru masuk inbox Hari Ini.' : 'Tertangkap, aman di Last Focus.', href: `/notes/${note.id}` };
}
