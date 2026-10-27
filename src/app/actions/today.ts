'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { pushTaskToGoogle } from '@/lib/google/sync';
import { firstThreeSteps } from '@/lib/adhd/chunker';
import { awardWin, dayAsDate, jakartaDay } from '@/lib/adhd/progress';
import { minutesOfDay } from '@/lib/adhd/today';
import { STARTER_HABITS, installMorningSources, installRoles, upsertHabits } from '@/lib/adhd/starter';
import { XP } from '@/lib/adhd/xp';
import { appendToDaily } from '@/lib/notes/daily';
import type { ActionResult } from '@/lib/types';

const FAIL = 'Belum tersimpan. Coba sekali lagi?';

function revalidateToday() {
  for (const p of ['/', '/tasks', '/habits', '/progress']) revalidatePath(p);
}

function todayDate() {
  return dayAsDate(jakartaDay());
}

/** "HH:MM" hari ini (WIB) sebagai Date. */
function todayAt(hhmm: string): Date {
  return new Date(`${jakartaDay()}T${hhmm.padStart(5, '0')}:00+07:00`);
}

// ── Check-in energi ─────────────────────────────────────────────────────

export async function setTodayEnergy(level: number): Promise<ActionResult> {
  const user = await requireUser();
  const energy = Math.min(3, Math.max(1, Math.round(level)));
  const date = todayDate();
  await prisma.dailyCheckin.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { energy },
    create: { userId: user.id, date, energy },
  });
  revalidatePath('/');
  return { ok: true, message: energy === 1 ? 'Mode minimum nyala. Versi kecil udah cukup hari ini.' : 'Sip, tercatat.' };
}

// ── Tugas ───────────────────────────────────────────────────────────────

/** Tambah tugas langsung ke Hari Ini, opsional dengan jam. */
export async function addTodayTask(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const title = String(formData.get('title') ?? '').trim().slice(0, 200);
  if (!title) return { ok: false, message: 'Tulis tugasnya dulu.' };
  const time = String(formData.get('time') ?? '').trim();
  const dueAt = minutesOfDay(time) === null ? null : todayAt(time);
  const est = Number(formData.get('estimateMin') ?? 30);

  const task = await prisma.task.create({
    data: {
      userId: user.id,
      title,
      dueAt,
      plannedFor: todayDate(),
      estimateMin: Number.isFinite(est) && est > 0 ? Math.min(600, Math.round(est)) : null,
      firstSteps: firstThreeSteps(title),
    },
  });
  await pushTaskToGoogle(task);
  revalidateToday();
  return { ok: true, message: 'Masuk Hari Ini.' };
}

/** Jadwalkan tugas dari inbox: hari ini, besok, atau lepas lagi ke inbox. */
export async function planTask(taskId: string, when: 'today' | 'tomorrow' | 'none'): Promise<ActionResult> {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
  if (!task) return { ok: false, message: FAIL };

  const today = todayDate();
  const plannedFor = when === 'today' ? today : when === 'tomorrow' ? new Date(today.getTime() + 86_400_000) : null;
  // Tenggat yang sudah lewat ikut digeser supaya tidak terus muncul sebagai "lewat".
  const stale = task.dueAt && task.dueAt.getTime() < Date.now();
  const dueAt = stale && plannedFor ? new Date(plannedFor.getTime() + 10 * 3_600_000) : task.dueAt; // 17:00 WIB

  const updated = await prisma.task.update({ where: { id: taskId }, data: { plannedFor, dueAt, lastTouchedAt: new Date() } });
  if (dueAt !== task.dueAt) await pushTaskToGoogle(updated);
  revalidateToday();
  return { ok: true, message: when === 'today' ? 'Masuk Hari Ini.' : when === 'tomorrow' ? 'Digeser ke besok.' : 'Balik ke inbox.' };
}

/**
 * "Bukan hari ini" / "Nanti": geser tugas `days` hari ke depan. Jam tenggat
 * yang jatuh sebelum hari itu ikut pindah (jamnya tetap) supaya tidak muncul
 * lagi di Hari Ini sebagai "lewat".
 */
export async function deferTask(taskId: string, days = 1): Promise<ActionResult> {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
  if (!task) return { ok: false, message: FAIL };
  const step = Math.min(30, Math.max(1, Math.round(days))) * 86_400_000;
  const plannedFor = new Date(todayDate().getTime() + step);
  const dayStart = new Date(`${jakartaDay()}T00:00:00+07:00`).getTime() + step;
  let dueAt = task.dueAt;
  if (dueAt && dueAt.getTime() < dayStart) {
    const timeOfDay = (dueAt.getTime() - new Date(`${jakartaDay(dueAt)}T00:00:00+07:00`).getTime()) % 86_400_000;
    dueAt = new Date(dayStart + timeOfDay);
  }
  const updated = await prisma.task.update({ where: { id: taskId }, data: { plannedFor, dueAt, lastTouchedAt: new Date() } });
  if (dueAt !== task.dueAt) await pushTaskToGoogle(updated);
  revalidateToday();
  return { ok: true, message: days === 1 ? 'Oke, besok aja.' : `Disimpan buat ${days} hari lagi.` };
}

/** Buang dari inbox (diarsipkan, masih bisa dicari). */
export async function dropTask(taskId: string): Promise<ActionResult> {
  const user = await requireUser();
  const res = await prisma.task.updateMany({ where: { id: taskId, userId: user.id }, data: { archived: true, lastTouchedAt: new Date() } });
  revalidateToday();
  return res.count ? { ok: true, message: 'Dibuang. Masih bisa dicari kalau perlu.' } : { ok: false, message: FAIL };
}

export async function toggleTaskDone(taskId: string, done: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
  if (!task) return { ok: false, message: FAIL };
  const updated = await prisma.task.update({ where: { id: taskId }, data: { status: done ? 'DONE' : 'OPEN', lastTouchedAt: new Date() } });
  if (done && task.status !== 'DONE') await awardWin(user.id, task.title, 'task', XP.task);
  await pushTaskToGoogle(updated);
  revalidateToday();
  return { ok: true, message: done ? `+${XP.task} XP` : undefined };
}

// ── Habit ───────────────────────────────────────────────────────────────

/** Centang habit dari Hari Ini. `mini` = versi minimum, tetap dihitung selesai. */
export async function toggleHabitToday(habitId: string, done: boolean, mini = false): Promise<ActionResult> {
  const user = await requireUser();
  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId: user.id } });
  if (!habit) return { ok: false, message: FAIL };
  const date = todayDate();
  const existing = await prisma.habitLog.findUnique({ where: { habitId_date: { habitId, date } } });

  if (!done) {
    if (existing) await prisma.habitLog.update({ where: { id: existing.id }, data: { completed: false, stepsDone: 0 } });
    revalidateToday();
    return { ok: true };
  }

  const variantUsed = mini ? 'mini' : existing?.variantUsed ?? null;
  await prisma.habitLog.upsert({
    where: { habitId_date: { habitId, date } },
    update: { completed: true, stepsDone: Math.max(1, existing?.stepsDone ?? 0), variantUsed },
    create: { habitId, date, completed: true, stepsDone: 1, variantUsed },
  });
  if (!existing?.completed) await awardWin(user.id, mini ? `${habit.name} (mini)` : habit.name, 'habit', XP.habit);
  revalidateToday();
  return { ok: true, message: `+${XP.habit} XP` };
}

// ── Tutup Hari ──────────────────────────────────────────────────────────

export async function closeDay(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parts = ['win', 'lesson', 'tomorrow'].map((k) => String(formData.get(k) ?? '').trim().slice(0, 500));
  const labels = ['Yang berhasil hari ini', 'Yang bikin berat', 'Satu hal paling penting besok'];
  const journal = parts.some(Boolean) ? parts.map((p, i) => (p ? `${labels[i]}: ${p}` : '')).filter(Boolean).join('\n') : null;
  const med = Number(formData.get('meditationMin') ?? 0);
  const meditationMin = Number.isFinite(med) && med > 0 ? Math.min(120, Math.round(med)) : null;

  const date = todayDate();
  const existing = await prisma.dailyCheckin.findUnique({ where: { userId_date: { userId: user.id, date } } });
  await prisma.dailyCheckin.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { journal: journal ?? existing?.journal ?? null, meditationMin: meditationMin ?? existing?.meditationMin ?? null, closedAt: new Date() },
    create: { userId: user.id, date, journal, meditationMin, closedAt: new Date() },
  });
  if (journal) await appendToDaily(user.id, jakartaDay(), 'Tutup hari', parts.map((p, i) => (p ? `- ${labels[i]}: ${p}` : '')).filter(Boolean).join('\n'));
  if (!existing?.closedAt) await awardWin(user.id, 'Tutup Hari', 'reset', XP.reset);
  revalidateToday();
  return { ok: true, message: 'Hari ditutup. Istirahat, kamu udah cukup.' };
}

// ── Paket awal ──────────────────────────────────────────────────────────

/** Rutinitas harian, peran sebagai proyek bertag, dan sumber cek pagi. Yang sudah ada dibiarkan. */
export async function installStarterPack(): Promise<ActionResult> {
  const user = await requireUser();
  const { created } = await upsertHabits(user.id, STARTER_HABITS, false);
  const roles = await installRoles(user.id);
  const sources = await installMorningSources(user.id);
  for (const p of ['/projects', '/admin']) revalidatePath(p);
  revalidateToday();
  const parts = [created && `${created} rutinitas`, roles && `${roles} peran`, sources && `${sources} sumber cek pagi`].filter(Boolean);
  return { ok: true, message: parts.length ? `${parts.join(', ')} dipasang.` : 'Semua udah terpasang.' };
}

export async function installRolePack(): Promise<ActionResult> {
  const user = await requireUser();
  const n = await installRoles(user.id);
  revalidatePath('/projects');
  return { ok: true, message: n ? `${n} peran dipasang. Pakai tagnya di tangkap cepat, mis. #imd.` : 'Semua peran udah ada.' };
}

export async function installMorningPack(): Promise<ActionResult> {
  const user = await requireUser();
  const n = await installMorningSources(user.id);
  await upsertHabits(user.id, STARTER_HABITS.filter((h) => h.name === 'Cek pagi'), false);
  revalidatePath('/admin');
  revalidateToday();
  return { ok: true, message: n ? `${n} sumber cek pagi dipasang.` : 'Sumber cek pagi udah lengkap.' };
}

// ── Timebox: seret tugas ke jam ─────────────────────────────────────────

/**
 * Pasang tugas di jam tertentu hari ini (menit sejak 00:00 WIB), atau lepas
 * jamnya (null). Kalau Google Calendar tersambung, blok kalendernya ikut
 * dibuat/dipindah/dihapus, sepanjang estimasi tugas.
 */
export async function scheduleTaskAt(taskId: string, minute: number | null): Promise<ActionResult> {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
  if (!task) return { ok: false, message: FAIL };

  let dueAt: Date | null = null;
  if (minute !== null) {
    const m = Math.min(23 * 60 + 59, Math.max(0, Math.round(minute)));
    dueAt = todayAt(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  const updated = await prisma.task.update({ where: { id: taskId }, data: { dueAt, plannedFor: todayDate(), lastTouchedAt: new Date() } });
  await pushTaskToGoogle(updated);
  revalidateToday();
  return { ok: true, message: dueAt ? 'Dijadwalkan. Kalender ikut pindah.' : 'Jamnya dilepas.' };
}
