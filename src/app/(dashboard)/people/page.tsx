import { Star, Users } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { createPerson } from '@/app/actions/pimo';
import { PageHeader } from '@/components/pkm/page-header';
import { EmptyState } from '@/components/pkm/empty-state';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { Stagger, StaggerItem } from '@/components/motion/primitives';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orang' };

export default async function PeoplePage() {
  const user = await requireUser();
  const people = await prisma.person.findMany({
    where: { userId: user.id },
    include: { _count: { select: { notes: true } } },
    orderBy: [{ importance: 'desc' }, { name: 'asc' }],
  });

  return (
    <>
      <PageHeader title="Orang" description="Hubungkan catatan ke orang penting. Semakin tinggi kepentingannya, semakin besar Social Graph pada Preservation Value." />

      <Card className="mb-6">
        <ActionForm action={createPerson} className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr,1fr,140px,auto] sm:items-end">
          <Field label="Nama" htmlFor="name">
            <Input id="name" name="name" required maxLength={120} />
          </Field>
          <Field label="Relasi" htmlFor="relation">
            <Input id="relation" name="relation" maxLength={120} placeholder="mis. dosen pembimbing" />
          </Field>
          <Field label="Kepentingan" htmlFor="importance">
            <Select id="importance" name="importance" defaultValue="3">
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} dari 5
                </option>
              ))}
            </Select>
          </Field>
          <SubmitButton>Tambah orang</SubmitButton>
        </ActionForm>
      </Card>

      {people.length === 0 ? (
        <EmptyState icon={Users} title="Belum ada orang" description="Tambahkan dosen pembimbing, kolaborator, atau siapa pun yang sering muncul di catatanmu." />
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => (
            <StaggerItem key={p.id}>
              <Card className="flex items-center gap-3.5 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft font-heading text-sm font-bold uppercase text-brand" aria-hidden="true">
                  {p.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {p.relation ?? 'Tanpa relasi'} · {p._count.notes} catatan
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5" role="img" aria-label={`Kepentingan ${p.importance} dari 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={13} className={n <= p.importance ? 'text-warn' : 'text-line'} fill={n <= p.importance ? 'currentColor' : 'none'} />
                  ))}
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}
