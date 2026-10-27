'use server';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { parseQuery, scoreText, snippet } from '@/lib/search';

export interface SearchHit {
  kind: 'note' | 'task' | 'project' | 'topic' | 'person' | 'event';
  id: string;
  title: string;
  href: string;
  snippet: string | null;
  meta: string | null;
  /** catatan yang sudah tenggelam ke Forgotten/Time Capsule tetap bisa ditemukan */
  sunk?: boolean;
  score: number;
}

export interface SearchResult {
  hits: SearchHit[];
  when: string | null;
  terms: string[];
}

const shortDate = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });

/** Cari di semua catatan, tugas, proyek, topik, orang, dan acara. */
export async function searchEverything(raw: string): Promise<SearchResult> {
  const user = await requireUser();
  const q = parseQuery(raw.slice(0, 200));
  if (q.terms.length === 0 && q.tags.length === 0 && !q.from) return { hits: [], when: null, terms: [] };

  const userId = user.id;
  const anyText = (fields: string[]) => q.terms.flatMap((w) => fields.map((f) => ({ [f]: { contains: w, mode: 'insensitive' as const } })));
  const range = q.from && q.to ? { gte: q.from, lt: q.to } : undefined;

  const tagClause = q.tags.length ? [{ OR: [{ topics: { some: { topic: { name: { in: q.tags } } } } }, { project: { tag: { in: q.tags } } }] }] : [];
  const noteWhere: Prisma.NoteWhereInput = {
    userId,
    AND: [
      ...(q.terms.length ? [{ OR: [...anyText(['title', 'content']), { topics: { some: { topic: { name: { in: q.terms } } } } }] }] : []),
      ...tagClause,
      ...(range ? [{ OR: [{ createdAt: range }, { updatedAt: range }, { event: { startAt: range } }] }] : []),
    ],
  };
  const taskWhere: Prisma.TaskWhereInput = {
    userId,
    archived: false,
    AND: [
      ...(q.terms.length ? [{ OR: anyText(['title']) }] : []),
      ...(q.tags.length ? [{ project: { tag: { in: q.tags } } }] : []),
      ...(range ? [{ OR: [{ createdAt: range }, { dueAt: range }] }] : []),
    ],
  };

  const [notes, tasks, projects, topics, people, events] = await Promise.all([
    prisma.note.findMany({
      where: noteWhere,
      select: { id: true, title: true, content: true, type: true, updatedAt: true, project: { select: { tag: true } }, memoryScore: { select: { folder: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    }),
    prisma.task.findMany({
      where: taskWhere,
      select: { id: true, title: true, status: true, dueAt: true, updatedAt: true, project: { select: { tag: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    q.terms.length || q.tags.length
      ? prisma.project.findMany({ where: { userId, OR: [...anyText(['name', 'description']), ...(q.tags.length ? [{ tag: { in: q.tags } }] : []), ...q.terms.map((w) => ({ tag: w }))] }, select: { id: true, name: true, tag: true, updatedAt: true }, take: 5 })
      : Promise.resolve([]),
    q.terms.length ? prisma.topic.findMany({ where: { userId, OR: anyText(['name']) }, select: { id: true, name: true, createdAt: true, _count: { select: { notes: true } } }, take: 5 }) : Promise.resolve([]),
    q.terms.length ? prisma.person.findMany({ where: { userId, OR: anyText(['name', 'relation']) }, select: { id: true, name: true, relation: true, createdAt: true }, take: 5 }) : Promise.resolve([]),
    prisma.event.findMany({
      where: { userId, ...(q.terms.length ? { OR: anyText(['title', 'location']) } : {}), ...(range ? { startAt: range } : {}) },
      select: { id: true, title: true, startAt: true, location: true },
      orderBy: { startAt: 'desc' },
      take: 10,
    }),
  ]);

  const now = Date.now();
  const terms = q.terms;
  const hits: SearchHit[] = [];

  for (const n of notes) {
    const folder = n.memoryScore?.folder;
    hits.push({
      kind: n.type === 'TASK' ? 'task' : 'note',
      id: n.id,
      title: n.title,
      href: `/notes/${n.id}`,
      snippet: snippet(n.content, terms) || null,
      meta: [n.project?.tag && `#${n.project.tag}`, shortDate(n.updatedAt)].filter(Boolean).join(' · '),
      sunk: folder === 'FORGOTTEN' || folder === 'TIME_CAPSULE',
      score: scoreText(n.title, n.content, terms, n.updatedAt, now) + 0.5,
    });
  }
  // Tugas yang sudah punya catatan kembar (dari tangkap cepat) cukup tampil sekali.
  const noteTitles = new Set(notes.filter((n) => n.type === 'TASK').map((n) => n.title.toLowerCase()));
  for (const t of tasks) {
    if (noteTitles.has(t.title.toLowerCase())) continue;
    hits.push({
      kind: 'task',
      id: t.id,
      title: t.title,
      href: '/tasks',
      snippet: null,
      meta: [t.status === 'DONE' ? 'selesai' : 'tugas', t.project?.tag && `#${t.project.tag}`, t.dueAt && shortDate(t.dueAt)].filter(Boolean).join(' · '),
      score: scoreText(t.title, '', terms, t.updatedAt, now),
    });
  }
  for (const p of projects) hits.push({ kind: 'project', id: p.id, title: p.name, href: '/projects', snippet: null, meta: p.tag ? `#${p.tag}` : 'proyek', score: scoreText(p.name, p.tag ?? '', terms, p.updatedAt, now) + 1 });
  for (const t of topics) hits.push({ kind: 'topic', id: t.id, title: `#${t.name}`, href: '/topics', snippet: null, meta: `${t._count.notes} catatan`, score: scoreText(t.name, '', terms, t.createdAt, now) });
  for (const p of people) hits.push({ kind: 'person', id: p.id, title: p.name, href: '/people', snippet: null, meta: p.relation, score: scoreText(p.name, p.relation ?? '', terms, p.createdAt, now) });
  for (const e of events) hits.push({ kind: 'event', id: e.id, title: e.title, href: '/events', snippet: e.location, meta: shortDate(e.startAt), score: scoreText(e.title, e.location ?? '', terms, e.startAt, now) });

  hits.sort((a, b) => b.score - a.score);
  return { hits: hits.slice(0, 14), when: q.when, terms };
}
