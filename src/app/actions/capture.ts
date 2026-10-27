'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/current-user';
import { createNoteRecord, normalizeTag } from '@/lib/notes-service';
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
const TOMORROW_TAGS = ['besok', 'tomorrow'];

const HASHTAG = /(^|\s)#([\p{L}\p{N}_-]+)/gu;

/**
 * Tangkap cepat: satu kotak teks, nol keputusan. Hashtag dibaca begini:
 * #hariini / #besok = tugas terjadwal, #tugas / #ide / #insight = tipe,
 * tag proyek (#imd, #statdas) = masuk proyek itu, tag lain jadi topik
 * (dinormalisasi: huruf kecil, spasi jadi "-").
 * Baris pertama jadi judul.
 */
export async function quickCapture(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const raw = String(formData.get('text') ?? '').trim();
  if (!raw) return { ok: false, message: 'Tulis sesuatu dulu.' };

  let type: NoteType = 'NOTE';
  let planned: 'today' | 'tomorrow' | null = null;
  // #tag yang cocok dengan tag proyek (mis. #imd) mengarahkan catatan/tugas ke proyek itu.
  const projects = await prisma.project.findMany({ where: { userId: user.id, tag: { not: null } }, select: { id: true, tag: true } });
  const projectByTag = new Map(projects.map((p) => [p.tag as string, p.id]));
  let projectId: string | null = null;
  const topics: string[] = [];
  for (const m of raw.matchAll(HASHTAG)) {
    const tag = normalizeTag(m[2]);
    if (TODAY_TAGS.includes(tag) || TOMORROW_TAGS.includes(tag)) {
      // "#hariini" / "#besok" = jadikan tugas dan langsung jadwalkan.
      planned = TODAY_TAGS.includes(tag) ? 'today' : 'tomorrow';
      type = 'TASK';
    } else if (TYPE_TAGS[tag]) {
      if (type === 'NOTE') type = TYPE_TAGS[tag];
    } else if (projectByTag.has(tag)) {
      projectId ??= projectByTag.get(tag)!;
    } else if (tag && !topics.includes(tag)) {
      topics.push(tag);
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

  const note = await createNoteRecord({ userId: user.id, title, content, type, topicNames: topics, projectId });

  // Tugas ikut dibuat sebagai baris Task supaya langsung muncul di daftar dan sprint.
  if (type === 'TASK') {
    const today = dayAsDate(jakartaDay());
    const plannedFor = planned === 'today' ? today : planned === 'tomorrow' ? new Date(today.getTime() + 86_400_000) : null;
    await prisma.task.create({
      data: { userId: user.id, title, projectId, energyType: asEnergy(energy), firstSteps: firstThreeSteps(title), plannedFor },
    });
    revalidatePath('/tasks');
  }

  revalidatePath('/');
  revalidatePath('/notes');
  const message =
    planned === 'today' ? 'Masuk Hari Ini.' : planned === 'tomorrow' ? 'Masuk rencana besok.' : type === 'TASK' ? 'Masuk inbox.' : 'Tersimpan di Catatan.';
  return { ok: true, message, href: `/notes/${note.id}` };
}
