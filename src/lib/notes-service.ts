import { prisma } from '@/lib/prisma';
import { refreshNoteScore } from '@/lib/memory/refresh';
import { APP_LOCALE, APP_TZ } from '@/lib/utils';
import type { NoteType } from '@prisma/client';

export const NOTE_TYPES: NoteType[] = ['NOTE', 'TASK', 'IDEA', 'INSIGHT'];

export function asNoteType(value: unknown): NoteType {
  return NOTE_TYPES.includes(value as NoteType) ? (value as NoteType) : 'NOTE';
}

/** "#Managed Forgetting, pimo" -> ["Managed Forgetting", "pimo"], de-duplicated, max 8. */
export function parseTopicNames(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const name = part.trim().replace(/^#+/, '').slice(0, 40);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.slice(0, 8);
}

export interface NewNoteInput {
  userId: string;
  title: string;
  content: string;
  type: NoteType;
  projectId?: string | null;
  location?: string | null;
  topicNames?: string[];
}

/** One code path for the full form and for Quick Capture, so both feed the memory engine identically. */
export async function createNoteRecord(input: NewNoteInput) {
  const { userId, title, content, type, location } = input;

  let projectId = input.projectId || null;
  if (projectId) {
    const owned = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
    if (!owned) projectId = null;
  }

  const topicIds: string[] = [];
  for (const name of input.topicNames ?? []) {
    const topic = await prisma.topic.upsert({
      where: { userId_name: { userId, name } },
      update: {},
      create: { userId, name },
    });
    topicIds.push(topic.id);
  }

  const note = await prisma.note.create({
    data: {
      userId,
      title,
      content,
      type,
      projectId,
      spatiotemporalLocation: location || null,
      spatiotemporalTime: new Date().toLocaleTimeString(APP_LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: APP_TZ }),
      interactions: { create: { type: 'CREATE', weight: 1.0 } },
      topics: { create: topicIds.map((topicId) => ({ topicId })) },
    },
  });

  await refreshNoteScore(note.id);
  return note;
}
