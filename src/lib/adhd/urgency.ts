import type { Tone } from '@/components/ui/badge';

export interface Urgency {
  label: string;
  tone: Tone;
  /** true bila perlu tawaran geser satu klik */
  offerShift: boolean;
}

const HOUR = 3_600_000;

/**
 * Bahasa urgensi tanpa rasa bersalah. Tidak ada kata "terlambat" atau "overdue",
 * dan tidak ada hitungan hari negatif.
 */
export function urgencyOf(dueAt: string | Date | null, opts: { done?: boolean; started?: boolean } = {}, now: Date = new Date()): Urgency {
  if (opts.done) return { label: 'Selesai', tone: 'mint', offerShift: false };
  if (!dueAt) return { label: 'Kapan saja', tone: 'neutral', offerShift: false };

  const due = new Date(dueAt).getTime();
  const diff = due - now.getTime();

  if (diff < 0) return { label: 'Sudah lewat, geser ke hari ini?', tone: 'cream', offerShift: true };

  const sameDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(due)) === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
  if (sameDay) return { label: 'Hari ini', tone: 'brand', offerShift: false };

  if (diff < 72 * HOUR && !opts.started) return { label: 'Sebaiknya mulai sebentar lagi', tone: 'warn', offerShift: false };
  if (diff < 48 * HOUR) return { label: 'Besok', tone: 'brand', offerShift: false };
  return { label: 'Masih lega', tone: 'mint', offerShift: false };
}

/** Hitung mundur lembut untuk Radar peluang. */
export function radarLabel(handover: string | Date, now: Date = new Date()): { label: string; tone: Tone } {
  const days = Math.ceil((new Date(handover).getTime() - now.getTime()) / (24 * HOUR));
  if (days < 0) return { label: 'Sudah lewat, tinjau ulang?', tone: 'cream' };
  if (days === 0) return { label: 'Hari ini', tone: 'brand' };
  if (days <= 3) return { label: 'Sudah dekat', tone: 'warn' };
  if (days <= 14) return { label: `Sisa ${days} hari`, tone: 'brand' };
  return { label: `Sisa ${days} hari`, tone: 'mint' };
}
