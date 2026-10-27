/**
 * Recall ASAP tanpa AI: pertanyaan bahasa sehari-hari dipecah jadi kata kunci
 * plus rentang waktu ("minggu lalu", "kemarin"), lalu dicocokkan ke semua
 * catatan, termasuk yang sudah tenggelam ke Forgotten.
 */

import { isoWeekday } from '@/lib/adhd/today';

const STOP = new Set(
  'apa apakah yang di ke dari tentang soal poin penting aku gue gw saya kamu itu ini dan atau untuk buat dengan ada kapan gimana bagaimana siapa mana dong sih ya yg aja kok kah nya the a of to in on about what is are was were catatan cari tolong lagi udah sudah pernah tadi nih deh'.split(' ')
);

const DAY = 86_400_000;

export interface ParsedQuery {
  terms: string[];
  tags: string[];
  from: Date | null;
  to: Date | null;
  /** label rentang waktu yang terbaca, untuk ditampilkan */
  when: string | null;
}

export function parseQuery(raw: string, now = new Date()): ParsedQuery {
  let q = ` ${raw.toLowerCase()} `;
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
  const today = new Date(`${ymd}T00:00:00+07:00`);
  const monday = new Date(today.getTime() - (isoWeekday(ymd) - 1) * DAY);
  const ranges: [RegExp, () => [Date, Date], string][] = [
    [/\bhari ini\b/, () => [today, new Date(today.getTime() + DAY)], 'hari ini'],
    [/\b(minggu|pekan) (lalu|kemarin)\b/, () => [new Date(monday.getTime() - 7 * DAY), monday], 'minggu lalu'],
    [/\b(minggu|pekan) ini\b/, () => [monday, new Date(monday.getTime() + 7 * DAY)], 'minggu ini'],
    [/\bbulan (lalu|kemarin)\b/, () => [new Date(today.getTime() - 60 * DAY), new Date(today.getTime() - 25 * DAY)], 'bulan lalu'],
    [/\bbulan ini\b/, () => [new Date(today.getTime() - 31 * DAY), new Date(today.getTime() + DAY)], 'bulan ini'],
    [/\bkemarin\b/, () => [new Date(today.getTime() - DAY), today], 'kemarin'],
  ];
  let from: Date | null = null;
  let to: Date | null = null;
  let when: string | null = null;
  for (const [re, range, label] of ranges) {
    if (re.test(q)) {
      [from, to] = range();
      when = label;
      q = q.replace(re, ' ');
      break;
    }
  }

  const tags: string[] = [];
  q = q.replace(/#([\p{L}\p{N}_-]+)/gu, (_, t: string) => {
    tags.push(t.toLowerCase());
    return ' ';
  });

  const terms = Array.from(new Set(q.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !STOP.has(w)))).slice(0, 6);
  return { terms, tags, from, to, when };
}

/** Skor sederhana: judul bernilai 3, isi 1 per kata, plus sedikit bonus kebaruan. */
export function scoreText(title: string, body: string, terms: string[], updatedAt: Date, now = Date.now()): number {
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  let s = 0;
  for (const w of terms) {
    if (t.includes(w)) s += 3;
    if (b.includes(w)) s += 1;
  }
  const ageDays = (now - updatedAt.getTime()) / DAY;
  return s + Math.max(0, 1 - ageDays / 60);
}

/** Potongan isi di sekitar kata pertama yang cocok. */
export function snippet(body: string, terms: string[], len = 110): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  const lower = flat.toLowerCase();
  const at = terms.map((w) => lower.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, at - 30);
  const cut = flat.slice(start, start + len);
  return `${start > 0 ? '…' : ''}${cut}${start + len < flat.length ? '…' : ''}`;
}
