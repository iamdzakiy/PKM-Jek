import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { createTask } from '@/app/actions/tasks';
import { PageHeader } from '@/components/pkm/page-header';
import type { TaskDTO } from '@/components/pkm/task-list';
import { TasksWorkspace } from '@/components/pkm/tasks-workspace';
import { jakartaDay } from '@/lib/adhd/progress';
import { EFFORT, NEED, effortLabel } from '@/lib/tasks/labels';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Card } from '@/components/ui/card';
import { DeadlinePlanner } from '@/components/pkm/deadline-planner';
import { TaskEnergyField } from '@/components/pkm/task-energy-field';
import { Field, Input, Select } from '@/components/ui/input';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tugas' };

export default async function TasksPage() {
  const user = await requireUser();
  const [tasks, projects] = await Promise.all([
    prisma.task.findMany({ where: { userId: user.id, archived: false }, include: { project: { select: { name: true, tag: true } } }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }] }),
    prisma.project.findMany({ where: { userId: user.id, status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const dto: TaskDTO[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    dueAt: t.dueAt?.toISOString() ?? null,
    location: t.location,
    project: t.project?.name ?? null,
    energyType: t.energyType,
    firstSteps: t.firstSteps ?? [],
    consequence: t.consequence,
    tag: t.project?.tag ?? null,
    day: t.plannedFor ? t.plannedFor.toISOString().slice(0, 10) : t.dueAt ? jakartaDay(t.dueAt) : null,
    estimateMin: t.estimateMin,
    energyNeed: t.energyNeed,
  }));

  return (
    <>
      <PageHeader title="Tugas" description="Kasih jam dan tempat. Tugas tanpa waktu gampang mengendap." />

      <Card className="mb-6">
        <ActionForm action={createTask} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field label="Tugas" htmlFor="title" className="sm:col-span-2">
            <Input id="title" name="title" required maxLength={200} placeholder="mis. Kirim proposal sponsor" />
          </Field>
          <Field label="Kapan" htmlFor="dueAt">
            <Input id="dueAt" name="dueAt" type="datetime-local" />
          </Field>
          <Field label="Di mana" htmlFor="location">
            <Input id="location" name="location" maxLength={120} placeholder="mis. Rumah" />
          </Field>
          <Field label="Proyek (opsional)" htmlFor="projectId" className="sm:col-span-2">
            <Select id="projectId" name="projectId" defaultValue="">
              <option value="">Tanpa proyek</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4 sm:col-span-2">
            <Field label="Tenaga" htmlFor="energyNeed">
              <Select id="energyNeed" name="energyNeed" defaultValue="">
                <option value="">Belum tahu</option>
                {NEED.map((n) => (
                  <option key={n.value} value={n.value}>
                    {n.emoji} {n.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Usaha" htmlFor="estimateMin">
              <Select id="estimateMin" name="estimateMin" defaultValue="">
                <option value="">Belum tahu</option>
                {EFFORT.map((m) => (
                  <option key={m} value={m}>
                    ±{effortLabel(m)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-4">
            <TaskEnergyField />
          </div>
          <div className="flex items-end">
            <SubmitButton className="w-full">Tambah tugas</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <DeadlinePlanner />

      <TasksWorkspace tasks={dto} today={jakartaDay()} />
    </>
  );
}
