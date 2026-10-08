import { BrainCircuit } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { PageHeader } from '@/components/pkm/page-header';
import { RecallDeck } from '@/components/pkm/recall-deck';
import { EmptyState } from '@/components/pkm/empty-state';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Active Recall' };

export default async function RecallPage() {
  const user = await requireUser();
  const now = new Date();

  // "Due" means the next review date has arrived. The original also required
  // reviewedAt = null, which made every answered question vanish forever
  // instead of coming back at its H+7 / H+30 slot.
  const [due, upcoming] = await Promise.all([
    prisma.activeRecallSession.findMany({
      where: { nextReviewAt: { lte: now }, note: { userId: user.id } },
      include: { note: { select: { id: true, title: true } } },
      orderBy: { nextReviewAt: 'asc' },
    }),
    prisma.activeRecallSession.findFirst({
      where: { nextReviewAt: { gt: now }, note: { userId: user.id } },
      orderBy: { nextReviewAt: 'asc' },
      select: { nextReviewAt: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Active Recall"
        description="Jawab dari ingatan sebelum melihat jawaban. Jadwalnya H+1, H+7, H+30, lalu makin jarang."
      />
      {due.length === 0 ? (
        <EmptyState
          icon={BrainCircuit}
          title="Semua kuis terjadwal ulang"
          description={
            upcoming
              ? `Kuis berikutnya jatuh tempo ${formatDate(upcoming.nextReviewAt, { weekday: 'long', day: 'numeric', month: 'long' })}. Atau jadwalkan kuis baru dari halaman sebuah catatan.`
              : 'Belum ada kuis. Jadwalkan kuis pertamamu dari halaman sebuah catatan.'
          }
        />
      ) : (
        <RecallDeck items={due.map((s) => ({ id: s.id, question: s.question, correctAnswer: s.correctAnswer, noteId: s.note.id, noteTitle: s.note.title }))} />
      )}
    </>
  );
}
