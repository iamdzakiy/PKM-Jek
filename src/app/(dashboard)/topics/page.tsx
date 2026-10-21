import { Hash } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { createTopic } from '@/app/actions/pimo';
import { PageHeader } from '@/components/pkm/page-header';
import { EmptyState } from '@/components/pkm/empty-state';
import { TopicChip } from '@/components/pkm/topic-chip';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Stagger, StaggerItem } from '@/components/motion/primitives';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Topik' };

export default async function TopicsPage() {
  const user = await requireUser();
  const topics = await prisma.topic.findMany({
    where: { userId: user.id },
    include: { _count: { select: { notes: true } } },
    orderBy: [{ isHot: 'desc' }, { name: 'asc' }],
  });

  return (
    <>
      <PageHeader title="Topik" description="Topik menghubungkan catatan lintas proyek dan waktu. Topik hot menahan catatannya tetap terlihat." />

      <Card className="mb-6">
        <ActionForm action={createTopic} className="flex flex-wrap items-end gap-4">
          <Field label="Nama topik" htmlFor="name" className="min-w-[220px] flex-1">
            <Input id="name" name="name" required maxLength={40} placeholder="mis. Managed Forgetting" />
          </Field>
          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="isHot" className="h-4 w-4 rounded accent-[rgb(var(--brand-solid))]" /> Hot topic
          </label>
          <SubmitButton>Tambah</SubmitButton>
        </ActionForm>
      </Card>

      {topics.length === 0 ? (
        <EmptyState icon={Hash} title="Belum ada topik" description="Topik muncul otomatis saat kamu menandai catatan dengan #tag, atau tambahkan di sini." />
      ) : (
        <Stagger className="flex flex-wrap gap-3">
          {topics.map((t) => (
            <StaggerItem key={t.id}>
              <TopicChip id={t.id} name={t.name} isHot={t.isHot} notes={t._count.notes} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}
