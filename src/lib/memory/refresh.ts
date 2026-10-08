import { prisma } from '@/lib/prisma';
import { computeMemoryBuoyancy, computePreservationValue, categorizeIntoFolder } from './scoring';

const noteInclude = {
  interactions: { select: { type: true, createdAt: true } },
  topics: { include: { topic: true } },
  people: { include: { person: true } },
} as const;

type NoteForScoring = NonNullable<Awaited<ReturnType<typeof loadNote>>>;

function loadNote(noteId: string) {
  return prisma.note.findUnique({ where: { id: noteId }, include: noteInclude });
}

function scoreNote(note: NoteForScoring, now: Date) {
  const mb = computeMemoryBuoyancy(note.interactions, now);
  const { PV } = computePreservationValue({
    note,
    topics: note.topics,
    people: note.people,
    projectLinked: Boolean(note.projectId),
    totalInteractionCount: note.interactions.length,
  });
  const lastInteractionAt = note.interactions.length
    ? note.interactions.reduce((latest, i) => (i.createdAt > latest ? i.createdAt : latest), note.interactions[0].createdAt)
    : null;
  const folder = categorizeIntoFolder({
    memoryBuoyancy: mb,
    preservationValue: PV,
    lastInteractionAt,
    hasHotTopic: note.topics.some((t) => t.topic.isHot),
    now,
  });
  return { mb, PV, folder };
}

/** Recomputes MB / PV / folder for one note right away (after an edit, a view, a recall). */
export async function refreshNoteScore(noteId: string) {
  const note = await loadNote(noteId);
  if (!note) return null;
  const now = new Date();
  const { mb, PV, folder } = scoreNote(note, now);
  return prisma.memoryScore.upsert({
    where: { noteId },
    update: { memoryBuoyancy: mb, preservationValue: PV, folder, computedAt: now },
    create: { noteId, memoryBuoyancy: mb, preservationValue: PV, folder, computedAt: now },
  });
}

/** Recomputes every note, optionally limited to one user. Used by the nightly cron and the weekly review button. */
export async function refreshAllScores(userId?: string) {
  const notes = await prisma.note.findMany({
    where: userId ? { userId } : undefined,
    include: noteInclude,
  });
  const now = new Date();

  const writes = notes.map((note) => {
    const { mb, PV, folder } = scoreNote(note, now);
    return prisma.memoryScore.upsert({
      where: { noteId: note.id },
      update: { memoryBuoyancy: mb, preservationValue: PV, folder, computedAt: now },
      create: { noteId: note.id, memoryBuoyancy: mb, preservationValue: PV, folder, computedAt: now },
    });
  });

  // Chunked so a large vault never opens hundreds of statements in one transaction.
  const CHUNK = 50;
  for (let i = 0; i < writes.length; i += CHUNK) {
    await prisma.$transaction(writes.slice(i, i + CHUNK));
  }
  return notes.length;
}

const VIEW_DEDUPE_MINUTES = 30;

/**
 * Logs a VIEW interaction, but at most once per window per note. Without this,
 * every re-render (form submit, revalidation, back/forward) inflated MB.
 */
export async function recordView(noteId: string) {
  const since = new Date(Date.now() - VIEW_DEDUPE_MINUTES * 60_000);
  const recent = await prisma.interaction.findFirst({
    where: { noteId, createdAt: { gte: since } },
    select: { id: true },
  });
  if (recent) return false;
  await prisma.interaction.create({ data: { noteId, type: 'VIEW', weight: 0.2 } });
  return true;
}
