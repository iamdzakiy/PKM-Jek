import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { toNoteDTO } from '@/lib/dto';
import { APP_LOCALE, APP_TZ, greeting } from '@/lib/utils';
import { DashboardBoard, type DashboardData } from '@/components/pkm/dashboard-board';
import type { FolderKey } from '@/lib/types';
import type { MemoryFolder, Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const noteInclude = { topics: { include: { topic: true } }, memoryScore: true } satisfies Prisma.NoteInclude;

function inFolder(userId: string, folders: MemoryFolder[]): Prisma.NoteWhereInput {
  return { userId, memoryScore: { is: { folder: { in: folders } } } };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();

  const [folderGroups, totalNotes, lastFocus, hotTopics, resurfacing, tasks, openTasks, events, dueRecall] = await Promise.all([
    prisma.memoryScore.groupBy({
      by: ['folder'],
      where: { note: { userId: user.id } },
      _count: { _all: true },
      _avg: { memoryBuoyancy: true },
    }),
    prisma.note.count({ where: { userId: user.id } }),
    prisma.note.findMany({
      where: inFolder(user.id, ['LAST_FOCUS']),
      include: noteInclude,
      orderBy: { memoryScore: { memoryBuoyancy: 'desc' } },
      take: 6,
    }),
    prisma.note.findMany({
      where: inFolder(user.id, ['HOT_TOPICS']),
      include: noteInclude,
      orderBy: { updatedAt: 'desc' },
      take: 4,
    }),
    prisma.note.findMany({
      where: inFolder(user.id, ['FORGOTTEN', 'TIME_CAPSULE']),
      include: noteInclude,
      orderBy: { memoryScore: { preservationValue: 'desc' } },
      take: 6,
    }),
    prisma.task.findMany({
      where: { userId: user.id, status: { not: 'DONE' } },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 5,
    }),
    prisma.task.count({ where: { userId: user.id, status: { not: 'DONE' } } }),
    prisma.event.findMany({
      where: { userId: user.id, startAt: { gte: now } },
      orderBy: { startAt: 'asc' },
      take: 3,
    }),
    prisma.activeRecallSession.count({ where: { nextReviewAt: { lte: now }, note: { userId: user.id } } }),
  ]);

  const counts: Record<FolderKey, number> = { LAST_FOCUS: 0, HOT_TOPICS: 0, ACTIVE: 0, TIME_CAPSULE: 0, FORGOTTEN: 0 };
  let weightedMB = 0;
  let scored = 0;
  for (const g of folderGroups) {
    counts[g.folder] += g._count._all;
    weightedMB += (g._avg.memoryBuoyancy ?? 0) * g._count._all;
    scored += g._count._all;
  }
  // Notes that have no MemoryScore row yet count as plain ACTIVE until the next recompute.
  counts.ACTIVE += Math.max(0, totalNotes - scored);

  const data: DashboardData = {
    greeting: `${greeting(now)}.`,
    dateLabel: now.toLocaleDateString(APP_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: APP_TZ }),
    counts,
    total: totalNotes,
    avgMB: scored ? weightedMB / scored : 0,
    dueRecall,
    openTasks,
    nextTask: tasks[0] ? { id: tasks[0].id, title: tasks[0].title, dueAt: tasks[0].dueAt?.toISOString() ?? null, location: tasks[0].location } : null,
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt?.toISOString() ?? null, location: t.location })),
    events: events.map((e) => ({ id: e.id, title: e.title, startAt: e.startAt.toISOString(), location: e.location })),
    lastFocus: lastFocus.map(toNoteDTO),
    hotTopics: hotTopics.map(toNoteDTO),
    resurfacing: resurfacing.map(toNoteDTO),
  };

  return <DashboardBoard data={data} />;
}
