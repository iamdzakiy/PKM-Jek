import Link from 'next/link';
import { CalendarDays, Download } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { toNoteDTO } from '@/lib/dto';
import { PageHeader } from '@/components/pkm/page-header';
import { NotesBoard } from '@/components/pkm/notes-board';
import { NewNotePanel } from '@/components/pkm/new-note-panel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Catatan' };

const VIEWS = { capsule: 'capsule', forgotten: 'forgotten', all: 'all' } as const;

export default async function NotesPage({ searchParams }: { searchParams: { new?: string; folder?: string } }) {
  const user = await requireUser();
  const [notes, projects] = await Promise.all([
    prisma.note.findMany({
      where: { userId: user.id },
      include: { topics: { include: { topic: true } }, memoryScore: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.project.findMany({ where: { userId: user.id, status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const initialView = VIEWS[searchParams.folder as keyof typeof VIEWS] ?? 'visible';

  return (
    <>
      <PageHeader
        title="Catatan"
        description="Yang sering disentuh tetap di atas. Yang lama tenggelam, tapi nggak pernah dihapus."
        actions={
          <>
            <Link href="/notes/harian" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-solid px-3.5 text-sm font-semibold text-white transition hover:brightness-110">
              <CalendarDays size={16} /> Catatan hari ini
            </Link>
            <a href="/export" download className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-ink-soft transition hover:bg-surface-2 hover:text-ink" title="Semua catatan sebagai Markdown (.zip)">
              <Download size={16} /> Export
            </a>
          </>
        }
      />
      <div className="mb-6">
        <NewNotePanel projects={projects} defaultOpen={searchParams.new === '1'} />
      </div>
      <NotesBoard notes={notes.map(toNoteDTO)} initialView={initialView} />
    </>
  );
}
