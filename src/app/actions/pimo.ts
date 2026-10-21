'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { refreshAllScores } from '@/lib/memory/refresh';
import { parseLocalDateTime } from '@/lib/utils';
import type { ActionResult } from '@/lib/types';
import type { ProjectStatus } from '@prisma/client';
import { pushEventToGoogle, removeRowFromGoogle } from '@/lib/google/sync';

const PROJECT_STATUSES: ProjectStatus[] = ['ACTIVE', 'ARCHIVED', 'COMPLETED'];

// ── Projects ────────────────────────────────────────────────────────────

export async function createProject(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const name = String(formData.get('name') ?? '').trim().slice(0, 120);
  const description = String(formData.get('description') ?? '').trim().slice(0, 500) || null;
  if (!name) return { ok: false, message: 'Nama proyek wajib diisi.' };

  await prisma.project.create({ data: { userId: user.id, name, description } });
  revalidatePath('/projects');
  return { ok: true, message: 'Proyek ditambahkan.' };
}

export async function setProjectStatus(projectId: string, status: ProjectStatus): Promise<ActionResult> {
  const user = await requireUser();
  if (!PROJECT_STATUSES.includes(status)) return { ok: false, message: 'Status tidak valid.' };
  await prisma.project.updateMany({ where: { id: projectId, userId: user.id }, data: { status } });
  revalidatePath('/projects');
  return { ok: true };
}

// ── Topics ──────────────────────────────────────────────────────────────

export async function createTopic(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const name = String(formData.get('name') ?? '').trim().replace(/^#+/, '').slice(0, 40);
  const isHot = formData.get('isHot') === 'on';
  if (!name) return { ok: false, message: 'Nama topik wajib diisi.' };

  await prisma.topic.upsert({
    where: { userId_name: { userId: user.id, name } },
    update: { isHot },
    create: { userId: user.id, name, isHot },
  });
  if (isHot) await refreshAllScores(user.id);
  revalidatePath('/topics');
  revalidatePath('/');
  return { ok: true, message: 'Topik tersimpan.' };
}

export async function toggleHotTopic(topicId: string, isHot: boolean): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.topic.updateMany({ where: { id: topicId, userId: user.id }, data: { isHot } });
  // A hot topic changes which folder its notes belong to, so reflect it immediately.
  await refreshAllScores(user.id);
  revalidatePath('/topics');
  revalidatePath('/');
  return { ok: true };
}

// ── People ──────────────────────────────────────────────────────────────

export async function createPerson(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const name = String(formData.get('name') ?? '').trim().slice(0, 120);
  const relation = String(formData.get('relation') ?? '').trim().slice(0, 120) || null;
  const raw = Number(formData.get('importance') ?? 3);
  const importance = Number.isFinite(raw) ? Math.min(5, Math.max(1, Math.round(raw))) : 3;
  if (!name) return { ok: false, message: 'Nama wajib diisi.' };

  await prisma.person.create({ data: { userId: user.id, name, relation, importance } });
  revalidatePath('/people');
  return { ok: true, message: 'Orang ditambahkan.' };
}

// ── Events ──────────────────────────────────────────────────────────────

export async function createEvent(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const title = String(formData.get('title') ?? '').trim().slice(0, 160);
  const startAt = parseLocalDateTime(String(formData.get('startAt') ?? ''));
  const location = String(formData.get('location') ?? '').trim().slice(0, 160) || null;
  if (!title || !startAt) return { ok: false, message: 'Judul dan waktu wajib diisi.' };

  const event = await prisma.event.create({ data: { userId: user.id, title, startAt, location } });
  // Best-effort mirror to Google — a Calendar outage must not fail the form.
  await pushEventToGoogle(event);
  revalidatePath('/events');
  revalidatePath('/');
  return { ok: true, message: 'Acara ditambahkan.' };
}

export async function deleteEvent(eventId: string): Promise<ActionResult> {
  const user = await requireUser();
  const event = await prisma.event.findFirst({ where: { id: eventId, userId: user.id } });
  if (!event) return { ok: true }; // already gone — idempotent
  await prisma.event.delete({ where: { id: event.id } });
  await removeRowFromGoogle(user.id, event.googleEventId);
  revalidatePath('/events');
  revalidatePath('/');
  return { ok: true, message: 'Acara dihapus.' };
}
