import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BrainCircuit, Link2, Gauge } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { deleteNote, updateNote } from '@/app/actions/notes';
import { addRecallQuestion } from '@/app/actions/recall';
import { computePreservationValue } from '@/lib/memory/scoring';
import { recordView, refreshNoteScore } from '@/lib/memory/refresh';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Badge, type Tone } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { RangeField } from '@/components/ui/range-field';
import { ScorePill } from '@/components/pkm/score-pill';
import { PvBreakdown } from '@/components/pkm/pv-breakdown';
import { NoteLinks } from '@/components/pkm/note-links';
import { ConfirmDelete } from '@/components/pkm/confirm-delete';
import { Stagger, StaggerItem } from '@/components/motion/primitives';
import { formatDate, formatRelative } from '@/lib/utils';
import { FOLDER_HINT, FOLDER_LABEL, TYPE_LABEL, type FolderKey } from '@/lib/types';

export const dynamic = 'force-dynamic';

const FOLDER_TONE: Record<FolderKey, Tone> = { LAST_FOCUS: 'brand', HOT_TOPICS: 'warn', ACTIVE: 'neutral', TIME_CAPSULE: 'cream', FORGOTTEN: 'neutral' };

export default async function NoteDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();

  const exists = await prisma.note.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
  if (!exists) notFound();

  // Opening a note counts as "seeing it again", logged at most once per 30 minutes
  // (the original logged on every render), and the score is refreshed right away.
  if (await recordView(params.id)) await refreshNoteScore(params.id);

  const [note, projects, events, allPeople, interactionCount] = await Promise.all([
    prisma.note.findFirstOrThrow({
      where: { id: params.id, userId: user.id },
      include: {
        topics: { include: { topic: true } },
        people: { include: { person: true } },
        memoryScore: true,
        recallSessions: { orderBy: { createdAt: 'desc' } },
        project: true,
      },
    }),
    prisma.project.findMany({ where: { userId: user.id, status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.event.findMany({ where: { userId: user.id }, select: { id: true, title: true, startAt: true }, orderBy: { startAt: 'desc' }, take: 30 }),
    prisma.person.findMany({ where: { userId: user.id }, orderBy: [{ importance: 'desc' }, { name: 'asc' }] }),
    prisma.interaction.count({ where: { noteId: params.id } }),
  ]);

  const breakdown = computePreservationValue({
    note,
    topics: note.topics,
    people: note.people,
    projectLinked: Boolean(note.projectId),
    totalInteractionCount: interactionCount,
  });

  const linkedPeople = new Set(note.people.map((p) => p.personId));
  const folder = (note.memoryScore?.folder ?? 'ACTIVE') as FolderKey;
  const now = new Date();

  return (
    <Stagger className="space-y-6">
      <StaggerItem className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/notes" className="mr-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-ink">
            <ArrowLeft size={15} /> Catatan
          </Link>
          <Badge tone="brand">{TYPE_LABEL[note.type]}</Badge>
          <Badge tone={FOLDER_TONE[folder]} title={FOLDER_HINT[folder]}>
            {FOLDER_LABEL[folder]}
          </Badge>
          {note.project && <Badge>{note.project.name}</Badge>}
        </div>
        <ConfirmDelete action={deleteNote.bind(null, note.id)} />
      </StaggerItem>

      <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
        <StaggerItem className="space-y-6">
          <Card>
            <ActionForm action={updateNote.bind(null, note.id)} reset={false} className="space-y-4">
              <Field label="Judul" htmlFor="title">
                <Input id="title" name="title" defaultValue={note.title} required maxLength={200} className="h-11 text-base font-semibold" />
              </Field>
              <Field label="Isi" htmlFor="content">
                <Textarea id="content" name="content" defaultValue={note.content} rows={11} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Tipe" htmlFor="type">
                  <Select id="type" name="type" defaultValue={note.type}>
                    <option value="NOTE">Catatan</option>
                    <option value="TASK">Tugas</option>
                    <option value="IDEA">Ide</option>
                    <option value="INSIGHT">Insight</option>
                  </Select>
                </Field>
                <Field label="Proyek" htmlFor="projectId">
                  <Select id="projectId" name="projectId" defaultValue={note.projectId ?? ''}>
                    <option value="">Tanpa proyek</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Acara" htmlFor="eventId">
                  <Select id="eventId" name="eventId" defaultValue={note.eventId ?? ''}>
                    <option value="">Tanpa acara</option>
                    {events.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title} · {formatDate(e.startAt)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <RangeField label="Quality" name="quality" defaultValue={note.quality} hint="Seberapa lengkap isinya" />
                <RangeField label="Coverage" name="coverage" defaultValue={note.coverage} hint="Seberapa mewakili topiknya" />
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-xs text-ink-faint" suppressHydrationWarning>
                  Diubah {formatRelative(note.updatedAt, now)}
                  {note.spatiotemporalLocation ? ` · ${note.spatiotemporalLocation}` : ''}
                </p>
                <SubmitButton>Simpan perubahan</SubmitButton>
              </div>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader>
              <BrainCircuit size={16} className="text-brand" />
              <CardTitle>Active Recall</CardTitle>
            </CardHeader>
            <ActionForm action={addRecallQuestion.bind(null, note.id)} className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input name="question" placeholder="Pertanyaan kuis" required maxLength={300} aria-label="Pertanyaan kuis" />
              <Input name="answer" placeholder="Jawaban yang benar" required maxLength={600} aria-label="Jawaban yang benar" />
              <div className="sm:col-span-2">
                <SubmitButton variant="secondary" size="sm">
                  Jadwalkan kuis
                </SubmitButton>
              </div>
            </ActionForm>

            {note.recallSessions.length === 0 ? (
              <p className="text-sm text-ink-soft">Belum ada kuis. Pertanyaan yang kamu tulis sendiri paling efektif untuk diingat.</p>
            ) : (
              <ul className="space-y-2">
                {note.recallSessions.map((s) => {
                  const due = s.nextReviewAt <= now;
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2/60 px-3 py-2.5 text-sm">
                      <span className="min-w-0 truncate text-ink">{s.question}</span>
                      {due ? (
                        <Badge tone="warn">jatuh tempo</Badge>
                      ) : (
                        <Badge tone={s.isCorrect === false ? 'danger' : 'mint'}>kembali {formatDate(s.nextReviewAt)}</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </StaggerItem>

        <StaggerItem className="space-y-6">
          <Card>
            <CardHeader>
              <Gauge size={16} className="text-brand" />
              <CardTitle>Skor memori</CardTitle>
            </CardHeader>
            {note.memoryScore ? (
              <div className="space-y-3">
                <ScorePill label="MB" value={note.memoryScore.memoryBuoyancy} tone="brand" wide />
                <ScorePill label="PV" value={note.memoryScore.preservationValue} tone="mint" wide />
                <p className="pt-1 text-xs leading-relaxed text-ink-faint" suppressHydrationWarning>
                  {FOLDER_HINT[folder]}. Dihitung {formatRelative(note.memoryScore.computedAt, now)}.
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Skor dihitung pada interaksi berikutnya.</p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rincian Preservation Value</CardTitle>
            </CardHeader>
            <PvBreakdown breakdown={breakdown} />
          </Card>

          <Card>
            <CardHeader>
              <Link2 size={16} className="text-brand" />
              <CardTitle>Koneksi</CardTitle>
            </CardHeader>
            <NoteLinks
              noteId={note.id}
              topics={note.topics.map(({ topic }) => ({ id: topic.id, name: topic.name }))}
              people={allPeople.map((p) => ({ id: p.id, name: p.name, relation: p.relation, importance: p.importance, linked: linkedPeople.has(p.id) }))}
            />
          </Card>
        </StaggerItem>
      </div>
    </Stagger>
  );
}
