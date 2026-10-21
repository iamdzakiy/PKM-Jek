import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { PageHeader } from '@/components/pkm/page-header';
import { AdminSweepTimer } from '@/components/pkm/admin-sweep-timer';
import { Card, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sweep Admin' };

export default async function SweepPage({ params }: { params: { sessionId: string } }) {
  const user = await requireUser();
  const session = await prisma.adminSweepSession.findFirst({
    where: { id: params.sessionId, userId: user.id },
    include: { items: { include: { source: true }, orderBy: { createdAt: 'asc' } } },
  });
  if (!session) notFound();
  const sources = await prisma.adminSource.findMany({ where: { userId: user.id, active: true }, orderBy: { createdAt: 'asc' } });

  return (
    <>
      <PageHeader title="Sweep berjalan" description="Buka tiap sumber, catat satu baris untuk setiap hal yang butuh tindakan. Jangan dibalas dulu." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <AdminSweepTimer
            sessionId={session.id}
            startedAt={session.startedAt.toISOString()}
            plannedMin={session.plannedMin}
            ended={!!session.endedAt}
            sources={sources.map((s) => ({ id: s.id, name: s.name, url: s.url }))}
          />
        </Card>
        <Card>
          <CardTitle className="mb-4">Tercatat ({session.items.length})</CardTitle>
          <ul className="space-y-2">
            {session.items.map((i) => (
              <li key={i.id} className="rounded-lg bg-surface-2/60 px-3 py-2 text-sm">
                <p className="text-ink">{i.title}</p>
                <p className="text-xs text-ink-faint">{i.source.name}</p>
              </li>
            ))}
            {session.items.length === 0 && <li className="text-sm text-ink-soft">Belum ada temuan. Tidak apa-apa kalau memang kosong.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
