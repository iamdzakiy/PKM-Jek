/**
 * Label tugas yang aman dipakai di client: tenaga (1–3, skala sama dengan
 * check-in energi di Hari Ini) dan usaha (estimasi menit).
 */

export const NEED = [
  { value: 1, emoji: '🪫', label: 'Ringan', hint: 'Bisa pas lagi habis' },
  { value: 2, emoji: '😐', label: 'Sedang', hint: 'Butuh sedikit fokus' },
  { value: 3, emoji: '🔋', label: 'Berat', hint: 'Pas lagi penuh' },
] as const;

export const EFFORT = [15, 30, 60, 90, 120] as const;

export function needOf(v: number | null | undefined) {
  return NEED.find((n) => n.value === v) ?? null;
}

export function effortLabel(min: number | null | undefined): string | null {
  if (!min) return null;
  return min < 60 ? `${min}m` : `${Math.round((min / 60) * 10) / 10}j`.replace('.', ',');
}

/** Ukuran kasar untuk filter: kecil ≤ 30m, sedang ≤ 60m, besar > 60m. */
export type EffortSize = 'kecil' | 'sedang' | 'besar';
export function sizeOf(min: number | null | undefined): EffortSize | null {
  if (!min) return null;
  return min <= 30 ? 'kecil' : min <= 60 ? 'sedang' : 'besar';
}

/** Putar ke nilai berikutnya (lalu kosong), dipakai chip yang bisa diketuk. */
export function cycle<T>(list: readonly T[], current: T | null): T | null {
  if (current === null) return list[0];
  const i = list.indexOf(current);
  return i < 0 || i === list.length - 1 ? null : list[i + 1];
}
