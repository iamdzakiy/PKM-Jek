'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/current-user';
import { createNoteRecord } from '@/lib/notes-service';
import type { ActionResult } from '@/lib/types';
import type { NoteType } from '@prisma/client';

const TYPE_TAGS: Record<string, NoteType> = {
  task: 'TASK',
  tugas: 'TASK',
  idea: 'IDEA',
  ide: 'IDEA',
  insight: 'INSIGHT',
};

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
  const topics: string[] = [];
  for (const m of raw.matchAll(HASHTAG)) {
    const tag = m[2].toLowerCase();
    if (TYPE_TAGS[tag]) {
      if (type === 'NOTE') type = TYPE_TAGS[tag];
    } else {
      topics.push(m[2]);
    }
  }

  const stripped = raw.replace(HASHTAG, '$1').replace(/[ \t]+\n/g, '\n').trim();
  const [firstLine, ...rest] = stripped.split('\n');
  const title = (firstLine.trim() || 'Tanpa judul').slice(0, 120);
  const content = rest.join('\n').trim();

  const note = await createNoteRecord({ userId: user.id, title, content, type, topicNames: topics });

  revalidatePath('/');
  revalidatePath('/notes');
  return { ok: true, message: 'Tertangkap di Last Focus.', href: `/notes/${note.id}` };
}
