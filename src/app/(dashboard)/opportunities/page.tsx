import { Radar } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { createOpportunity } from '@/app/actions/adhd';
import { PageHeader } from '@/components/pkm/page-header';
import { EmptyState } from '@/components/pkm/empty-state';
import { OpportunityCard, type OpportunityDTO } from '@/components/pkm/opportunity-card';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Peluang' };

export default async function OpportunitiesPage() {
  const user = await requireUser();
  const rows = await prisma.opportunity.findMany({ where: { userId: user.id, status: { not: 'ARCHIVED' } }, orderBy: { handoverDate: 'asc' } });
  const dto: OpportunityDTO[] = rows.map((o) => ({ id: o.id, title: o.title, source: o.source, url: o.url, handoverDate: o.handoverDate.toISOString(), status: o.status }));

  return (
    <>
      <PageHeader title="Peluang" description="Beasiswa, hibah, lomba. Tenggatnya dipecah jadi langkah kecil." />
      <Card className="mb-6">
        <ActionForm action={createOpportunity} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama peluang" htmlFor="o-title"><Input id="o-title" name="title" required maxLength={160} /></Field>
          <Field label="Tenggat" htmlFor="o-date"><Input id="o-date" name="handoverDate" type="datetime-local" required /></Field>
          <Field label="Sumber (opsional)" htmlFor="o-source"><Input id="o-source" name="source" maxLength={80} /></Field>
          <Field label="Tautan (opsional)" htmlFor="o-url"><Input id="o-url" name="url" type="url" /></Field>
          <div className="sm:col-span-2"><SubmitButton>Masukkan ke radar</SubmitButton></div>
        </ActionForm>
      </Card>
      {dto.length === 0 ? (
        <EmptyState icon={Radar} title="Radar masih kosong" description="Tambahkan satu peluang yang menarik perhatianmu." />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{dto.map((o) => <OpportunityCard key={o.id} opp={o} />)}</ul>
      )}
    </>
  );
}
