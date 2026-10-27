'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { parseLocalDateTime } from '@/lib/utils';
import { pushTaskToGoogle, removeRowFromGoogle } from '@/lib/google/sync';
import { asEnergy } from '@/lib/adhd/energy';
import { firstThreeSteps } from '@/lib/adhd/chunker';
import { awardWin } from '@/lib/adhd/progress';
import { XP } from '@/lib/adhd/xp';
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
    data: {
      userId: user.id,
      title,
      projectId: project?.id ?? null,
      location,
      dueAt,
      energyType: asEnergy(formData.get('energyType')),
      consequence: String(formData.get('consequence') ?? '').trim().slice(0, 200) || null,
      energyNeed: [1, 2, 3].includes(Number(formData.get('energyNeed'))) ? Number(formData.get('energyNeed')) : null,
      estimateMin: Number(formData.get('estimateMin')) > 0 ? Math.min(600, Math.round(Number(formData.get('estimateMin')))) : null,
      firstSteps: firstThreeSteps(title),
    },
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
  const task = await prisma.task.updateMany({ where: { id: taskId, userId: user.id }, data: { status, lastTouchedAt: new Date() } });
  if (task.count > 0) {
    if (status === 'DONE') await awardWin(user.id, 'Tugas selesai', 'task', XP.task).catch(() => undefined);
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

/** Label tenaga (1–3) dan usaha (menit). `null` mengosongkan; field yang tidak dikirim tidak diubah. */
export async function setTaskLabels(taskId: string, labels: { energyNeed?: number | null; estimateMin?: number | null }): Promise<ActionResult> {
  const user = await requireUser();
  const data: { energyNeed?: number | null; estimateMin?: number | null; lastTouchedAt: Date } = { lastTouchedAt: new Date() };
  if ('energyNeed' in labels) data.energyNeed = labels.energyNeed && labels.energyNeed >= 1 && labels.energyNeed <= 3 ? Math.round(labels.energyNeed) : null;
  if ('estimateMin' in labels) data.estimateMin = labels.estimateMin && labels.estimateMin > 0 ? Math.min(600, Math.round(labels.estimateMin)) : null;
  const r = await prisma.task.updateMany({ where: { id: taskId, userId: user.id }, data });
  revalidatePath('/tasks');
  revalidatePath('/');
  return r.count ? { ok: true } : { ok: false, message: 'Tugas tidak ditemukan.' };
}

/** Kalender mingguan: taruh tugas di tanggal `ymd` (WIB), atau `null` untuk balik ke belum dijadwalkan. */
export async function planTaskOn(taskId: string, ymd: string | null): Promise<ActionResult> {
  const user = await requireUser();
  if (ymd !== null && !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return { ok: false, message: 'Tanggal tidak valid.' };
  const task = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
  if (!task) return { ok: false, message: 'Tugas tidak ditemukan.' };
  const plannedFor = ymd ? new Date(`${ymd}T00:00:00.000Z`) : null;
  // Jam tenggat ikut pindah ke hari baru (jamnya tetap), supaya kalender dan Hari Ini sepakat.
  let dueAt = task.dueAt;
  if (dueAt && ymd) {
    const wib = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(dueAt);
    dueAt = new Date(`${ymd}T${wib}:00+07:00`);
  }
  const updated = await prisma.task.update({ where: { id: taskId }, data: { plannedFor, dueAt, lastTouchedAt: new Date() } });
  if (dueAt?.getTime() !== task.dueAt?.getTime()) await pushTaskToGoogle(updated);
  revalidatePath('/tasks');
  revalidatePath('/');
  return { ok: true };
}
