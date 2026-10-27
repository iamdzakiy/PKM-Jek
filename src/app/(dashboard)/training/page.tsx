import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { jakartaDay } from '@/lib/adhd/progress';
import { daysBetween, isoWeekday } from '@/lib/adhd/today';
import { PageHeader } from '@/components/pkm/page-header';
import { TrainingBoard, type TrainingData } from '@/components/pkm/training-board';
import { PPL_AFTER_WEEKS, cardioFor, gymWorkoutFor, type LoggedSet, type WorkoutKey } from '@/lib/training/program';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Latihan' };

const GYM: WorkoutKey[] = ['A', 'B', 'PUSH', 'PULL', 'LEGS', 'HOME'];

export default async function TrainingPage() {
  const user = await requireUser();
  const ymd = jakartaDay();
  const weekday = isoWeekday(ymd);

  const [logs, firstGym, body, gymHabit] = await Promise.all([
    prisma.workoutLog.findMany({ where: { userId: user.id }, orderBy: { date: 'desc' }, take: 40 }),
    prisma.workoutLog.findFirst({ where: { userId: user.id, workout: { in: ['A', 'B', 'PUSH', 'PULL', 'LEGS'] } }, orderBy: { date: 'asc' }, select: { date: true } }),
    prisma.bodyLog.findMany({ where: { userId: user.id }, orderBy: { date: 'desc' }, take: 12 }),
    prisma.habit.findFirst({ where: { userId: user.id, archived: false, name: { equals: 'Gym', mode: 'insensitive' } }, select: { timeOfDay: true, daysOfWeek: true } }),
  ]);

  // Fase ikut sesi gym terakhir: sekali kamu mencatat Push/Pull/Legs, jadwal ikut PPL.
  const lastGym = logs.find((l) => GYM.includes(l.workout as WorkoutKey) && l.workout !== 'HOME');
  const phase = lastGym && ['PUSH', 'PULL', 'LEGS'].includes(lastGym.workout) ? 'ppl' : 'fullbody';
  const weeksIn = firstGym ? Math.floor(daysBetween(ymd, firstGym.date.toISOString().slice(0, 10)) / 7) : 0;

  const lastByExercise: Record<string, LoggedSet & { date: string }> = {};
  const today: Partial<Record<WorkoutKey, { sets: LoggedSet[]; minutes: number | null; distanceKm: number | null }>> = {};
  for (const l of logs) {
    const d = l.date.toISOString().slice(0, 10);
    const sets = (Array.isArray(l.sets) ? l.sets : []) as unknown as LoggedSet[];
    if (d === ymd) {
      today[l.workout as WorkoutKey] = { sets, minutes: l.minutes, distanceKm: l.distanceKm };
      continue;
    }
    for (const s of sets) if (!lastByExercise[s.exercise]) lastByExercise[s.exercise] = { ...s, date: d };
  }

  const data: TrainingData = {
    ymd,
    weekday,
    phase,
    weeksIn,
    pplReady: phase === 'fullbody' && weeksIn >= PPL_AFTER_WEEKS,
    suggested: gymWorkoutFor(ymd, weekday, phase) ?? cardioFor(weekday),
    lastByExercise,
    today,
    recent: logs.slice(0, 8).map((l) => ({ date: l.date.toISOString().slice(0, 10), workout: l.workout as WorkoutKey, minutes: l.minutes, distanceKm: l.distanceKm })),
    body: body.map((b) => ({ date: b.date.toISOString().slice(0, 10), weightKg: b.weightKg, waistCm: b.waistCm })).reverse(),
    scheduleSynced: !!gymHabit && gymHabit.timeOfDay === '05:30' && gymHabit.daysOfWeek.join() === '1,3,5',
  };

  return (
    <>
      <PageHeader title="Latihan" description="Gym 3x seminggu, naik level pelan-pelan. Dari Jek Bulking Plan." />
      <TrainingBoard data={data} />
    </>
  );
}
