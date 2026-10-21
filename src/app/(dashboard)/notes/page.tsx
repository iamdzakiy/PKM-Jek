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
        description="Yang aktif mengambang di atas. Yang jarang disentuh tenggelam ke Forgotten, tidak pernah dihapus."
      />
      <div className="mb-6">
        <NewNotePanel projects={projects} defaultOpen={searchParams.new === '1'} />
      </div>
      <NotesBoard notes={notes.map(toNoteDTO)} initialView={initialView} />
    </>
  );
}
