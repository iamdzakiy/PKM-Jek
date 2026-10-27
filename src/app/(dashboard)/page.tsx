import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { APP_LOCALE, APP_TZ, greeting } from '@/lib/utils';
import { dayAsDate, jakartaDay } from '@/lib/adhd/progress';
import { habitDue, heatRank, isoWeekday, jakartaMinutes, minutesOfDay } from '@/lib/adhd/today';
import { HABIT_LINKS } from '@/lib/adhd/starter';
import { WORKOUTS, gymWorkoutFor, type WorkoutKey } from '@/lib/training/program';
import { levelFromXp, xpForLevel } from '@/lib/adhd/xp';
import { TodayBoard, type TodayData, type TodayItem } from '@/components/pkm/today-board';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hari Ini' };

const DAY = 86_400_000;

export default async function TodayPage() {
  const user = await requireUser();
  const now = new Date();
  const ymd = jakartaDay(now);
  const today = dayAsDate(ymd);
  // Batas hari WIB dalam UTC: 00:00 WIB = 17:00 UTC hari sebelumnya.
  const start = new Date(`${ymd}T00:00:00+07:00`);
  const end = new Date(start.getTime() + DAY);
  const weekAgo = new Date(start.getTime() - 6 * DAY);

  const [checkin, habits, tasks, inbox, events, upcoming, progress, wins] = await Promise.all([
    prisma.dailyCheckin.findUnique({ where: { userId_date: { userId: user.id, date: today } } }),
    prisma.habit.findMany({
      where: { userId: user.id, archived: false },
      include: { logs: { where: { completed: true, date: { gte: new Date(today.getTime() - 90 * DAY) } }, orderBy: { date: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.task.findMany({
      where: {
        userId: user.id,
        archived: false,
        OR: [
          { plannedFor: today },
          { dueAt: { gte: start, lt: end } },
          // tenggat lewat yang belum selesai ikut muncul, dengan tawaran geser
          { dueAt: { lt: start }, status: { not: 'DONE' } },
        ],
        NOT: { status: 'DONE', lastTouchedAt: { lt: start } },
      },
      include: { project: { select: { tag: true } } },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      take: 40,
    }),
    prisma.task.findMany({
      where: { userId: user.id, archived: false, status: { not: 'DONE' }, plannedFor: null, dueAt: null, parentId: null },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.event.findMany({ where: { userId: user.id, startAt: { gte: start, lt: end } }, orderBy: { startAt: 'asc' } }),
    prisma.task.findMany({
      where: { userId: user.id, archived: false, status: { not: 'DONE' }, dueAt: { gte: end, lt: new Date(end.getTime() + 6 * DAY) }, plannedFor: null },
      orderBy: { dueAt: 'asc' },
      take: 5,
    }),
    prisma.userProgress.findUnique({ where: { userId: user.id } }),
    prisma.microWin.findMany({ where: { userId: user.id, createdAt: { gte: weekAgo } }, select: { createdAt: true } }),
  ]);

  // Habit yang sudah selesai hari ini perlu log hari ini; ambil terpisah supaya `take: 1` di atas tetap "terakhir selesai".
  const doneToday = new Set(
    (await prisma.habitLog.findMany({ where: { date: today, completed: true, habit: { userId: user.id } }, select: { habitId: true, variantUsed: true } })).map((l) => l.habitId)
  );

  // Sesi gym hari ini ikut fase terakhir yang dicatat (Full Body → PPL).
  const lastGym = await prisma.workoutLog.findFirst({ where: { userId: user.id, workout: { in: ['A', 'B', 'PUSH', 'PULL', 'LEGS'] } }, orderBy: { date: 'desc' }, select: { workout: true } });
  const gymKey: WorkoutKey | null = gymWorkoutFor(ymd, isoWeekday(ymd), lastGym && ['PUSH', 'PULL', 'LEGS'].includes(lastGym.workout) ? 'ppl' : 'fullbody');

  const items: TodayItem[] = [];
  const later: { name: string; label: string }[] = [];

  for (const h of habits) {
    const last = h.logs[0] ? h.logs[0].date.toISOString().slice(0, 10) : null;
    const d = habitDue({ daysOfWeek: h.daysOfWeek, intervalDays: h.intervalDays }, ymd, last, doneToday.has(h.id));
    if (!d.due) {
      if (h.intervalDays && d.label) later.push({ name: h.name, label: d.label });
      continue;
    }
    items.push({
      key: `h-${h.id}`,
      kind: 'habit',
      id: h.id,
      title: h.name.toLowerCase() === 'gym' && gymKey ? `Gym · ${WORKOUTS[gymKey].name}` : h.name,
      minute: minutesOfDay(h.timeOfDay),
      done: doneToday.has(h.id),
      sub: h.minimumVersion,
      heat: d.heat,
      heatLabel: d.label,
      overdue: false,
      sortHeat: heatRank(d.heat),
      estimate: 0,
      href: HABIT_LINKS[h.name.toLowerCase()] ?? null,
    });
  }

  for (const t of tasks) {
    const overdue = !!t.dueAt && t.dueAt < start && t.status !== 'DONE';
    items.push({
      key: `t-${t.id}`,
      kind: 'task',
      id: t.id,
      title: t.title,
      minute: t.dueAt && !overdue ? jakartaMinutes(t.dueAt) : null,
      done: t.status === 'DONE',
      sub: [t.project?.tag && `#${t.project.tag}`, t.location ?? (t.estimateMin ? `±${t.estimateMin} menit` : null)].filter(Boolean).join(' · ') || null,
      heat: overdue ? 'warm' : 'due',
      heatLabel: overdue ? 'Kelewat, geser ke hari ini?' : null,
      overdue,
      sortHeat: overdue ? 0 : 2,
      estimate: t.estimateMin ?? 30,
    });
  }

  for (const e of events) {
    items.push({
      key: `e-${e.id}`,
      kind: 'event',
      id: e.id,
      title: e.title,
      minute: jakartaMinutes(e.startAt),
      done: false,
      sub: e.location,
      heat: 'calm',
      heatLabel: null,
      overdue: false,
      sortHeat: 3,
      estimate: 0,
    });
  }

  const winDays = new Set(wins.map((w) => jakartaDay(w.createdAt)));
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = jakartaDay(new Date(start.getTime() - (6 - i) * DAY + 12 * 3_600_000));
    return { ymd: day, active: winDays.has(day), isToday: day === ymd };
  });

  const xp = progress?.xp ?? 0;
  const level = levelFromXp(xp);
  const data: TodayData = {
    greeting: greeting(now),
    name: user.name?.split(' ')[0] || 'Jek',
    dateLabel: now.toLocaleDateString(APP_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: APP_TZ }),
    energy: checkin?.energy ?? null,
    closed: !!checkin?.closedAt,
    items,
    inbox: inbox.map((t) => ({ id: t.id, title: t.title })),
    upcoming: upcoming.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt!.toISOString() })),
    laterChores: later,
    habitCount: habits.length,
    streak: progress?.streakDays ?? 0,
    shields: progress?.streakFrozen ?? 2,
    xp,
    level,
    levelFloor: xpForLevel(level),
    levelCeil: xpForLevel(level + 1),
    week,
  };

  return <TodayBoard data={data} />;
}
