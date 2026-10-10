'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { parseLocalDateTime } from '@/lib/utils';
import { pushTaskToGoogle, removeRowFromGoogle } from '@/lib/google/sync';
import type { ActionResult } from '@/lib/types';
import type { TaskStatus } from '@prisma/client';

const TASK_STATUSES: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE'];

/**
 * "Benign friction" capture: the form asks for an explicit when and where
 * instead of letting a vague intention linger, per the Kairotask pattern in
 * the research notes. Time is parsed as Jakarta wall time, not server time.
 */
export async function createTask(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const title = String(formData.get('title') ?? '').trim().slice(0, 200);
  const dueAt = parseLocalDateTime(String(formData.get('dueAt') ?? ''));
  const location = String(formData.get('location') ?? '').trim().slice(0, 120) || null;
  const projectIdRaw = String(formData.get('projectId') ?? '');
  if (!title) return { ok: false, message: 'Judul tugas wajib diisi.' };

  const project = projectIdRaw
    ? await prisma.project.findFirst({ where: { id: projectIdRaw, userId: user.id }, select: { id: true } })
    : null;

  const task = await prisma.task.create({
    data: { userId: user.id, title, projectId: project?.id ?? null, location, dueAt },
  });
  // Tasks only mirror to Calendar when they have a dueAt (handled inside).
  await pushTaskToGoogle(task);
  revalidatePath('/tasks');
  revalidatePath('/');
  return { ok: true, message: 'Tugas ditambahkan.' };
}

export async function setTaskStatus(taskId: string, status: TaskStatus): Promise<ActionResult> {
  const user = await requireUser();
  if (!TASK_STATUSES.includes(status)) return { ok: false, message: 'Status tidak valid.' };
  const task = await prisma.task.updateMany({ where: { id: taskId, userId: user.id }, data: { status } });
  if (task.count > 0) {
    // Reflect the ✓ in the mirrored event's description; no-op when not synced.
    const row = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
    if (row) await pushTaskToGoogle(row);
  }
  revalidatePath('/tasks');
  revalidatePath('/');
  return { ok: true };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
  await prisma.task.deleteMany({ where: { id: taskId, userId: user.id } });
  await removeRowFromGoogle(user.id, task?.googleEventId ?? null);
  revalidatePath('/tasks');
  revalidatePath('/');
  return { ok: true };
}
