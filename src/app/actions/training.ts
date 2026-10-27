'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { awardWin, dayAsDate, jakartaDay } from '@/lib/adhd/progress';
import { TRAINING_HABITS, upsertHabits } from '@/lib/adhd/starter';
import { WORKOUTS, type LoggedSet, type WorkoutKey } from '@/lib/training/program';
import { XP } from '@/lib/adhd/xp';
import type { ActionResult } from '@/lib/types';

const KEYS = Object.keys(WORKOUTS) as WorkoutKey[];

/** Habit yang ikut tercentang saat sesi disimpan. */
function habitNameFor(key: WorkoutKey) {
  return key === 'RUN' ? 'lari' : key === 'YOGA' ? 'yoga' : 'gym';
}

function revalidateTraining() {
  for (const p of ['/training', '/', '/habits', '/progress']) revalidatePath(p);
}

export interface WorkoutInput {
  workout: WorkoutKey;
  sets: LoggedSet[];
  minutes?: number | null;
  distanceKm?: number | null;
  notes?: string | null;
}

/** Simpan sesi hari ini (boleh disimpan ulang), lalu centang habit-nya. */
export async function saveWorkout(input: WorkoutInput): Promise<ActionResult> {
  const user = await requireUser();
  if (!KEYS.includes(input.workout)) return { ok: false, message: 'Jenis latihan tidak dikenal.' };
  const plan = WORKOUTS[input.workout];
  const known = new Set(plan.exercises.map((e) => e.id));

  const sets: LoggedSet[] = (input.sets ?? [])
    .filter((s) => known.has(s.exercise))
    .map((s) => ({
      exercise: s.exercise,
      weight: typeof s.weight === 'number' && Number.isFinite(s.weight) && s.weight >= 0 ? Math.min(500, Math.round(s.weight * 4) / 4) : null,
      reps: (s.reps ?? []).map((r) => Math.max(0, Math.min(200, Math.round(Number(r) || 0)))).filter((r) => r > 0).slice(0, 8),
    }))
    .filter((s) => s.reps.length > 0);

  const minutes = input.minutes && input.minutes > 0 ? Math.min(300, Math.round(input.minutes)) : null;
  const distanceKm = input.distanceKm && input.distanceKm > 0 ? Math.min(100, Math.round(input.distanceKm * 100) / 100) : null;
  if (plan.exercises.length > 0 && sets.length === 0) return { ok: false, message: 'Isi minimal satu set dulu.' };

  const date = dayAsDate(jakartaDay());
  const data = { sets: sets as unknown as Prisma.InputJsonArray, minutes, distanceKm, notes: input.notes?.trim().slice(0, 500) || null };
  await prisma.workoutLog.upsert({
    where: { userId_date_workout: { userId: user.id, date, workout: input.workout } },
    update: data,
    create: { userId: user.id, date, workout: input.workout, ...data },
  });

  // Centang habit yang cocok (Gym / Lari / Yoga). Versi rumah dihitung versi mini.
  const habit = await prisma.habit.findFirst({ where: { userId: user.id, archived: false, name: { startsWith: habitNameFor(input.workout), mode: 'insensitive' } } });
  let fresh = true;
  if (habit) {
    const existing = await prisma.habitLog.findUnique({ where: { habitId_date: { habitId: habit.id, date } } });
    fresh = !existing?.completed;
    const variantUsed = input.workout === 'HOME' ? 'mini' : plan.name;
    await prisma.habitLog.upsert({
      where: { habitId_date: { habitId: habit.id, date } },
      update: { completed: true, stepsDone: Math.max(1, existing?.stepsDone ?? 0), variantUsed },
      create: { habitId: habit.id, date, completed: true, stepsDone: 1, variantUsed },
    });
  }
  if (fresh) await awardWin(user.id, plan.name, 'habit', XP.habit);

  revalidateTraining();
  return { ok: true, message: fresh ? `${plan.name} beres. Sector cleared, Ranger! +${XP.habit} XP` : 'Catatan latihan diperbarui.' };
}

/** Timbang mingguan (boleh kapan saja, satu catatan per hari). */
export async function logBody(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const weightKg = Number(String(formData.get('weightKg') ?? '').replace(',', '.'));
  const waistRaw = String(formData.get('waistCm') ?? '').replace(',', '.').trim();
  const waistCm = waistRaw ? Number(waistRaw) : null;
  if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 200) return { ok: false, message: 'Berat badannya belum valid.' };
  const waist = waistCm !== null && Number.isFinite(waistCm) && waistCm > 40 && waistCm < 200 ? Math.round(waistCm * 10) / 10 : null;

  const date = dayAsDate(jakartaDay());
  const weight = Math.round(weightKg * 10) / 10;
  await prisma.bodyLog.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { weightKg: weight, waistCm: waist },
    create: { userId: user.id, date, weightKg: weight, waistCm: waist },
  });

  const habit = await prisma.habit.findFirst({ where: { userId: user.id, archived: false, name: { equals: 'Timbang', mode: 'insensitive' } } });
  if (habit) {
    await prisma.habitLog.upsert({
      where: { habitId_date: { habitId: habit.id, date } },
      update: { completed: true, stepsDone: 1 },
      create: { habitId: habit.id, date, completed: true, stepsDone: 1 },
    });
  }
  revalidateTraining();
  return { ok: true, message: `${weight} kg tercatat.` };
}

/** Samakan jam habit latihan dengan rencana (gym 05.30, lari Sabtu, yoga Kamis & Minggu, dll). */
export async function syncTrainingHabits(): Promise<ActionResult> {
  const user = await requireUser();
  const { created, updated } = await upsertHabits(user.id, TRAINING_HABITS, true);
  revalidateTraining();
  return { ok: true, message: `Jadwal latihan diselaraskan (${created} baru, ${updated} disesuaikan).` };
}
