import { prisma } from '@/lib/prisma';
import { zip } from '@/lib/zip';

/**
 * Export: catatan sebagai Markdown (bisa dibuka di Obsidian, tautan [[...]]
 * tetap jalan karena nama file = judul) dan backup lengkap semua data
 * sebagai JSON untuk keadaan darurat. Token Google sengaja tidak ikut.
 */

type ExportNote = {
  id: string;
  title: string;
  content: string;
  type: string;
  dailyFor: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: { name: string; tag: string | null } | null;
  topics: { topic: { name: string } }[];
};

const NOTE_INCLUDE = { project: { select: { name: true, tag: true } }, topics: { select: { topic: { select: { name: true } } } } } as const;

/** Nama file aman di Windows/Mac/Android; judul kembar diberi akhiran. */
function fileName(title: string, used: Set<string>): string {
  const base = title.replace(/[\\/:*?"<>|#^[\]\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Tanpa judul';
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} (${i})`;
  used.add(name.toLowerCase());
  return name;
}

const yamlStr = (s: string) => JSON.stringify(s);

export function noteMarkdown(n: ExportNote): string {
  const tags = [...n.topics.map((t) => t.topic.name), ...(n.project?.tag ? [n.project.tag] : [])];
  const front = [
    '---',
    `title: ${yamlStr(n.title)}`,
    `type: ${n.type.toLowerCase()}`,
    ...(n.project ? [`project: ${yamlStr(n.project.name)}`] : []),
    ...(tags.length ? [`tags: [${Array.from(new Set(tags)).map(yamlStr).join(', ')}]`] : []),
    ...(n.dailyFor ? [`date: ${n.dailyFor.toISOString().slice(0, 10)}`] : []),
    `created: ${n.createdAt.toISOString()}`,
    `updated: ${n.updatedAt.toISOString()}`,
    '---',
    '',
  ];
  return `${front.join('\n')}# ${n.title}\n\n${n.content.trim()}\n`;
}

function notesToFiles(notes: ExportNote[], root: string) {
  const used = new Set<string>();
  return notes.map((n) => ({ path: `${root}${n.dailyFor ? 'Harian/' : ''}${fileName(n.title, used)}.md`, content: noteMarkdown(n) }));
}

export async function exportNote(userId: string, noteId: string) {
  const note = await prisma.note.findFirst({ where: { id: noteId, userId }, include: NOTE_INCLUDE });
  if (!note) return null;
  return { name: `${fileName(note.title, new Set())}.md`, body: noteMarkdown(note) };
}

/** Semua catatan sebagai folder Markdown dalam satu zip. */
export async function exportNotesZip(userId: string) {
  const notes = await prisma.note.findMany({ where: { userId }, include: NOTE_INCLUDE, orderBy: { createdAt: 'asc' } });
  return zip(notesToFiles(notes, 'Catatan/'));
}

/** Backup darurat: semua data akun (JSON per tabel + catatan Markdown + petunjuk). */
export async function exportEverythingZip(userId: string) {
  const where = { userId };
  const [user, progress, google, projects, topics, people, events, tasks, notes, habits, adminSources, adminSweeps, adminItems, opportunities, sprints, microWins, bodyDoubleSessions, checkins, workouts, bodyLogs, plans] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, createdAt: true } }),
    prisma.userProgress.findUnique({ where }),
    prisma.googleAccount.findUnique({ where, select: { email: true, calendarId: true, connectedAt: true } }),
    prisma.project.findMany({ where }),
    prisma.topic.findMany({ where }),
    prisma.person.findMany({ where }),
    prisma.event.findMany({ where }),
    prisma.task.findMany({ where }),
    prisma.note.findMany({
      where,
      include: { ...NOTE_INCLUDE, people: { select: { person: { select: { name: true } } } }, memoryScore: true, recallSessions: true, interactions: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.habit.findMany({ where, include: { logs: true } }),
    prisma.adminSource.findMany({ where }),
    prisma.adminSweepSession.findMany({ where }),
    prisma.adminItem.findMany({ where }),
    prisma.opportunity.findMany({ where }),
    prisma.sprint.findMany({ where }),
    prisma.microWin.findMany({ where }),
    prisma.bodyDoubleSession.findMany({ where }),
    prisma.dailyCheckin.findMany({ where }),
    prisma.workoutLog.findMany({ where }),
    prisma.bodyLog.findMany({ where }),
    prisma.planEntry.findMany({ where }),
  ]);

  const now = new Date();
  const data = { user, progress, googleCalendar: google, projects, topics, people, events, tasks, notes, habits, adminSources, adminSweeps, adminItems, opportunities, sprints, microWins, bodyDoubleSessions, checkins, workouts, bodyLogs, plans };
  const counts = Object.entries(data)
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => `- ${k}: ${(v as unknown[]).length}`)
    .join('\n');
  const json = (v: unknown) => JSON.stringify(v, null, 2);

  return zip(
    [
      {
        path: 'BACA-DULU.md',
        content: `# Backup Star Command\n\nDibuat ${now.toISOString()} untuk ${user?.email ?? userId}.\n\n- \`data/semua.json\`: semua data dalam satu file.\n- \`data/<tabel>.json\`: data yang sama, dipisah per jenis.\n- \`Catatan/\`: semua catatan sebagai Markdown, bisa langsung dibuka di Obsidian.\n\nToken Google Calendar tidak ikut demi keamanan; sambungkan ulang dari Pengaturan kalau perlu.\n\n## Isi\n${counts}\n`,
      },
      { path: 'data/semua.json', content: json({ exportedAt: now, version: 1, ...data }) },
      ...Object.entries(data).map(([k, v]) => ({ path: `data/${k}.json`, content: json(v) })),
      ...notesToFiles(notes, 'Catatan/'),
    ],
    now
  );
}
