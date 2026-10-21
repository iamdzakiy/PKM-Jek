'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { asNoteType, createNoteRecord, parseTopicNames } from '@/lib/notes-service';
import { refreshNoteScore } from '@/lib/memory/refresh';
import { clamp01 } from '@/lib/utils';
import type { ActionResult } from '@/lib/types';

function revalidateVault(noteId?: string) {
  if (noteId) revalidatePath(`/notes/${noteId}`);
  revalidatePath('/notes');
  revalidatePath('/');
}

export async function createNote(formData: FormData): Promise<void> {
  const user = await requireUser();

  const title = String(formData.get('title') ?? '').trim().slice(0, 200);
  if (!title) redirect('/notes?new=1');

  const note = await createNoteRecord({
    userId: user.id,
    title,
    content: String(formData.get('content') ?? '').trim(),
    type: asNoteType(formData.get('type')),
    projectId: String(formData.get('projectId') ?? '') || null,
    location: String(formData.get('location') ?? '').trim() || null,
    topicNames: parseTopicNames(String(formData.get('topics') ?? '')),
  });

  revalidateVault();
  redirect(`/notes/${note.id}`);
}

export async function updateNote(noteId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const title = String(formData.get('title') ?? '').trim().slice(0, 200);
  if (!title) return { ok: false, message: 'Judul tidak boleh kosong.' };

  const existing = await prisma.note.findFirst({ where: { id: noteId, userId: user.id } });
  if (!existing) return { ok: false, message: 'Catatan tidak ditemukan.' };

  const parseScore = (key: string, fallback: number) => {
    const raw = formData.get(key);
    if (raw === null || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? clamp01(n) : fallback;
  };

  const projectIdRaw = String(formData.get('projectId') ?? '');
  const eventIdRaw = String(formData.get('eventId') ?? '');
  const [project, event] = await Promise.all([
    projectIdRaw ? prisma.project.findFirst({ where: { id: projectIdRaw, userId: user.id }, select: { id: true } }) : null,
    eventIdRaw ? prisma.event.findFirst({ where: { id: eventIdRaw, userId: user.id }, select: { id: true } }) : null,
  ]);

  await prisma.note.update({
    where: { id: noteId },
    data: {
      title,
      content: String(formData.get('content') ?? '').trim(),
      type: asNoteType(formData.get('type')),
      quality: parseScore('quality', existing.quality),
      coverage: parseScore('coverage', existing.coverage),
      projectId: project?.id ?? null,
      eventId: event?.id ?? null,
      userInvestment: Math.min(1, existing.userInvestment + 0.1),
      interactions: { create: { type: 'EDIT', weight: 0.8 } },
    },
  });

  await refreshNoteScore(noteId);
  revalidateVault(noteId);
  return { ok: true, message: 'Perubahan tersimpan.' };
}

export async function deleteNote(noteId: string): Promise<void> {
  const user = await requireUser();
  await prisma.note.deleteMany({ where: { id: noteId, userId: user.id } });
  revalidateVault();
  redirect('/notes');
}

// ── Links (topics and people) ───────────────────────────────────────────

async function ownedNote(noteId: string, userId: string) {
  return prisma.note.findFirst({ where: { id: noteId, userId }, select: { id: true } });
}

export async function addNoteTopic(noteId: string, name: string): Promise<ActionResult> {
  const user = await requireUser();
  const [clean] = parseTopicNames(name);
  if (!clean) return { ok: false, message: 'Tulis nama topik.' };
  if (!(await ownedNote(noteId, user.id))) return { ok: false, message: 'Catatan tidak ditemukan.' };

  const topic = await prisma.topic.upsert({
    where: { userId_name: { userId: user.id, name: clean } },
    update: {},
    create: { userId: user.id, name: clean },
  });
  await prisma.noteTopic.upsert({
    where: { noteId_topicId: { noteId, topicId: topic.id } },
    update: {},
    create: { noteId, topicId: topic.id },
  });
  await refreshNoteScore(noteId);
  revalidateVault(noteId);
  return { ok: true };
}

export async function removeNoteTopic(noteId: string, topicId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await ownedNote(noteId, user.id))) return { ok: false, message: 'Catatan tidak ditemukan.' };
  await prisma.noteTopic.deleteMany({ where: { noteId, topicId } });
  await refreshNoteScore(noteId);
  revalidateVault(noteId);
  return { ok: true };
}

export async function toggleNotePerson(noteId: string, personId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await ownedNote(noteId, user.id))) return { ok: false, message: 'Catatan tidak ditemukan.' };
  const person = await prisma.person.findFirst({ where: { id: personId, userId: user.id }, select: { id: true } });
  if (!person) return { ok: false, message: 'Orang tidak ditemukan.' };

  const key = { noteId_personId: { noteId, personId } };
  const existing = await prisma.notePerson.findUnique({ where: key });
  if (existing) await prisma.notePerson.delete({ where: key });
  else await prisma.notePerson.create({ data: { noteId, personId } });

  await refreshNoteScore(noteId);
  revalidateVault(noteId);
  return { ok: true };
}
