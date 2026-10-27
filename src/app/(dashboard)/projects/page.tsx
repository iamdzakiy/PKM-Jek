import { FolderKanban } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { createProject } from '@/app/actions/pimo';
import { installRolePack } from '@/app/actions/today';
import { ROLE_PROJECTS } from '@/lib/adhd/starter';
import { PageHeader } from '@/components/pkm/page-header';
import { EmptyState } from '@/components/pkm/empty-state';
import { ProjectCard } from '@/components/pkm/project-card';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Card } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Stagger, StaggerItem } from '@/components/motion/primitives';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Proyek' };

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    include: { _count: { select: { notes: true, tasks: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <PageHeader title="Proyek" description="Tiap peran dan kepanitiaan punya tag. Tulis #tag di tangkap cepat, tugasnya langsung masuk sini." />

      {ROLE_PROJECTS.some((r) => !projects.some((p) => p.tag === r.tag || p.name.toLowerCase() === r.name.toLowerCase())) && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">
            Pasang peranmu: {ROLE_PROJECTS.map((r) => `#${r.tag}`).join(' ')}
          </p>
          <ActionForm action={installRolePack}>
            <SubmitButton>Pasang peran</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <Card className="mb-6">
        <ActionForm action={createProject} className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr,0.5fr,1.2fr,auto] sm:items-end">
          <Field label="Nama proyek" htmlFor="name">
            <Input id="name" name="name" required maxLength={120} placeholder="mis. Ketua IMD 2026" />
          </Field>
          <Field label="Tag" htmlFor="tag">
            <Input id="tag" name="tag" maxLength={20} placeholder="imd" />
          </Field>
          <Field label="Deskripsi" htmlFor="description">
            <Textarea id="description" name="description" rows={1} maxLength={500} className="min-h-10" />
          </Field>
          <SubmitButton>Tambah proyek</SubmitButton>
        </ActionForm>
      </Card>

      {projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Belum ada proyek" description="Buat proyek pertama untuk mengelompokkan catatan dan tugas yang saling terkait." />
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <StaggerItem key={p.id}>
              <ProjectCard id={p.id} name={p.name} tag={p.tag} description={p.description} status={p.status} notes={p._count.notes} tasks={p._count.tasks} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}
