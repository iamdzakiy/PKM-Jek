import { prisma } from '@/lib/prisma';
import { refreshNoteScore } from '@/lib/memory/refresh';
import { APP_LOCALE, APP_TZ } from '@/lib/utils';
import type { NoteType } from '@prisma/client';

export const NOTE_TYPES: NoteType[] = ['NOTE', 'TASK', 'IDEA', 'INSIGHT'];

export function asNoteType(value: unknown): NoteType {
  return NOTE_TYPES.includes(value as NoteType) ? (value as NoteType) : 'NOTE';
}

/**
 * Satu bentuk untuk semua tag: huruf kecil, spasi jadi "-", tanpa "#".
 * "#Managed Forgetting" -> "managed-forgetting", "BT5131" -> "bt5131".
 */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/** "#Managed Forgetting, pimo" -> ["managed-forgetting", "pimo"], tanpa duplikat, maks 8. */
export function parseTopicNames(raw: string): string[] {
  const out = new Set<string>();
  for (const part of raw.split(',')) {
    const name = normalizeTag(part);
    if (name) out.add(name);
  }
  return Array.from(out).slice(0, 8);
}

/**
 * Cari topik tanpa peduli huruf besar/kecil, supaya topik lama ("PIMO")
 * dipakai ulang alih-alih membuat kembarannya ("pimo").
 */
export async function resolveTopic(userId: string, rawName: string, isHot?: boolean) {
  const name = normalizeTag(rawName);
  const existing = await prisma.topic.findFirst({ where: { userId, name: { equals: name, mode: 'insensitive' } } });
  if (existing) {
    return isHot === undefined || existing.isHot === isHot ? existing : prisma.topic.update({ where: { id: existing.id }, data: { isHot } });
  }
  return prisma.topic.create({ data: { userId, name, isHot: isHot ?? false } });
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
    const topic = await resolveTopic(userId, name);
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
