import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { PageHeader } from '@/components/pkm/page-header';
import { SprintBoard, type ActiveSprint, type SprintTask } from '@/components/pkm/sprint-board';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sprint' };

export default async function SprintsPage() {
  const user = await requireUser();
  const [tasks, running] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, status: { not: 'DONE' }, archived: false },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 60,
    }),
    prisma.sprint.findFirst({ where: { userId: user.id, endedAt: null, endsAt: { gt: new Date() } }, orderBy: { startsAt: 'desc' } }),
  ]);

  const dto: SprintTask[] = tasks.map((t) => ({ id: t.id, title: t.title, energyType: t.energyType, dueLabel: t.dueAt ? formatDateTime(t.dueAt.toISOString()) : null }));
  const active: ActiveSprint | null = running ? { id: running.id, energyType: running.energyType, taskTitle: running.taskTitle, endsAt: running.endsAt.toISOString() } : null;

  return (
    <>
      <PageHeader title="Sprint" description="Pilih energimu, lalu satu blok fokus. Maksimal 120 menit, diikuti jeda 15 menit." />
      <SprintBoard tasks={dto} active={active} />
    </>
  );
}
