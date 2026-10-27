'use server';

import { revalidatePath } from 'next/cache';
import type { HabitCategory } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { pushTaskToGoogle } from '@/lib/google/sync';
import { firstThreeSteps } from '@/lib/adhd/chunker';
import { awardWin, dayAsDate, jakartaDay } from '@/lib/adhd/progress';
import { minutesOfDay } from '@/lib/adhd/today';
import { XP } from '@/lib/adhd/xp';
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
  const est = Number(formData.get('estimateMin') ?? 0);

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
  if (!existing?.closedAt) await awardWin(user.id, 'Tutup Hari', 'reset', XP.reset);
  revalidateToday();
  return { ok: true, message: 'Hari ditutup. Istirahat, kamu udah cukup.' };
}

// ── Paket awal ──────────────────────────────────────────────────────────

interface Starter {
  name: string;
  category: HabitCategory;
  timeOfDay: string | null;
  daysOfWeek?: number[];
  intervalDays?: number;
  minimumVersion: string;
  variants?: string[];
}

/** Rutinitas dari rencana "Jek Life System v1". Bisa diubah atau diarsipkan kapan saja. */
const STARTER: Starter[] = [
  { name: 'Meditasi', category: 'MENTAL', timeOfDay: '07:00', minimumVersion: '2 menit tarik napas' },
  { name: 'Gym', category: 'PHYSICAL', timeOfDay: '10:30', daysOfWeek: [1, 3, 5], minimumVersion: '20 menit, 3 gerakan utama', variants: ['Workout A', 'Workout B'] },
  { name: 'Lari santai', category: 'PHYSICAL', timeOfDay: '07:00', daysOfWeek: [6], minimumVersion: 'Jalan kaki 15 menit' },
  { name: 'Makan siang besar', category: 'ROUTINE', timeOfDay: '12:00', minimumVersion: 'Nasi + 1 lauk protein' },
  { name: 'Cuci piring', category: 'ROUTINE', timeOfDay: '19:30', minimumVersion: 'Yang ada di wastafel aja' },
  { name: 'Shake bulking', category: 'ROUTINE', timeOfDay: '21:00', minimumVersion: 'Segelas susu' },
  { name: 'Journaling', category: 'REFLECTIVE', timeOfDay: '21:30', minimumVersion: '3 kalimat' },
  { name: 'Cuci baju', category: 'ROUTINE', timeOfDay: null, intervalDays: 3, minimumVersion: 'Rendam / masukin mesin dulu' },
  { name: 'Beresin kamar', category: 'ROUTINE', timeOfDay: null, intervalDays: 2, minimumVersion: '5 menit beresin meja' },
  { name: 'Review mingguan', category: 'REFLECTIVE', timeOfDay: '20:00', daysOfWeek: [7], minimumVersion: 'Lihat jadwal minggu depan' },
];

export async function installStarterPack(): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await prisma.habit.findMany({ where: { userId: user.id, archived: false }, select: { name: true } });
  const have = new Set(existing.map((h) => h.name.toLowerCase()));
  const fresh = STARTER.filter((s) => !have.has(s.name.toLowerCase()));

  for (const s of fresh) {
    await prisma.habit.create({
      data: {
        userId: user.id,
        name: s.name,
        category: s.category,
        timeOfDay: s.timeOfDay,
        daysOfWeek: s.daysOfWeek ?? [1, 2, 3, 4, 5, 6, 7],
        intervalDays: s.intervalDays ?? null,
        minimumVersion: s.minimumVersion,
        variants: s.variants ?? [],
        firstSteps: firstThreeSteps(s.name, s.category),
      },
    });
  }
  revalidateToday();
  return { ok: true, message: fresh.length ? `${fresh.length} rutinitas dipasang.` : 'Semua rutinitas udah ada.' };
}
