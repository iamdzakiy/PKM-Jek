import { prisma } from '@/lib/prisma';
import { dayAsDate } from '@/lib/adhd/progress';
import { createNoteRecord } from '@/lib/notes-service';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(s: unknown): s is string {
  return typeof s === 'string' && YMD.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

export function shiftYmd(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function dailyTitle(ymd: string): string {
  const label = new Date(`${ymd}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `Harian · ${label}`;
}

const TEMPLATE = (ymd: string) =>
  [`Kemarin: [[${dailyTitle(shiftYmd(ymd, -1))}]]`, '', '## Fokus hari ini', '- ', '', '## Catatan', '', '## Ide & pikiran lepas', ''].join('\n');

/** Catatan harian untuk tanggal WIB `ymd`; dibuat dari template kalau belum ada. */
export async function dailyNote(userId: string, ymd: string) {
  const dailyFor = dayAsDate(ymd);
  const found = await prisma.note.findUnique({ where: { userId_dailyFor: { userId, dailyFor } } });
  if (found) return found;
  const note = await createNoteRecord({ userId, title: dailyTitle(ymd), content: TEMPLATE(ymd), type: 'NOTE', topicNames: ['harian'] });
  try {
    return await prisma.note.update({ where: { id: note.id }, data: { dailyFor } });
  } catch {
    // Dibuat bersamaan di tab lain: pakai yang sudah ada, buang duplikatnya.
    await prisma.note.delete({ where: { id: note.id } });
    return prisma.note.findUniqueOrThrow({ where: { userId_dailyFor: { userId, dailyFor } } });
  }
}

/** Tambahkan bagian ke catatan harian (dipakai Tutup Hari). */
export async function appendToDaily(userId: string, ymd: string, heading: string, body: string) {
  const note = await dailyNote(userId, ymd);
  const block = `## ${heading}\n${body}`;
  const re = new RegExp(`\\n## ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n[\\s\\S]*?(?=\\n## |$)`);
  const content = re.test(`\n${note.content}`) ? `\n${note.content}`.replace(re, `\n${block}\n`).slice(1) : `${note.content.trimEnd()}\n\n${block}\n`;
  await prisma.note.update({ where: { id: note.id }, data: { content } });
}
