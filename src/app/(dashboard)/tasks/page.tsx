import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { createTask } from '@/app/actions/tasks';
import { PageHeader } from '@/components/pkm/page-header';
import { TaskList, type TaskDTO } from '@/components/pkm/task-list';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tugas' };

export default async function TasksPage() {
  const user = await requireUser();
  const [tasks, projects] = await Promise.all([
    prisma.task.findMany({ where: { userId: user.id }, include: { project: true }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }] }),
    prisma.project.findMany({ where: { userId: user.id, status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const dto: TaskDTO[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    dueAt: t.dueAt?.toISOString() ?? null,
    location: t.location,
    project: t.project?.name ?? null,
  }));

  return (
    <>
      <PageHeader title="Tugas" description="Tetapkan kapan dan di mana. Niat yang samar mengendap jadi tugas zombie." />

      <Card className="mb-6">
        <ActionForm action={createTask} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field label="Tugas" htmlFor="title" className="sm:col-span-2">
            <Input id="title" name="title" required maxLength={200} placeholder="mis. Baca artikel PIMO" />
          </Field>
          <Field label="Kapan" htmlFor="dueAt">
            <Input id="dueAt" name="dueAt" type="datetime-local" />
          </Field>
          <Field label="Di mana" htmlFor="location">
            <Input id="location" name="location" maxLength={120} placeholder="mis. Rumah" />
          </Field>
          <Field label="Proyek (opsional)" htmlFor="projectId" className="sm:col-span-3">
            <Select id="projectId" name="projectId" defaultValue="">
              <option value="">Tanpa proyek</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <SubmitButton className="w-full">Tambah tugas</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <TaskList initial={dto} />
    </>
  );
}
