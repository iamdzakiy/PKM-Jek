/**
 * Logika murni layar Hari Ini: kapan sebuah habit jatuh tempo dan seberapa
 * mendesak chores yang berbasis interval. Tanpa Prisma, aman di client.
 */

/** ISO weekday WIB untuk tanggal YYYY-MM-DD: 1 = Senin ... 7 = Minggu. */
export function isoWeekday(ymd: string): number {
  const d = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function daysBetween(later: string, earlier: string): number {
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000);
}

export type HabitHeat = 'calm' | 'due' | 'warm' | 'hot';

export interface HabitDue {
  /** Tampil di daftar hari ini */
  due: boolean;
  heat: HabitHeat;
  /** Label lembut, mis. "Udah 4 hari" */
  label: string | null;
  daysSince: number | null;
}

/**
 * Habit mingguan jatuh tempo di hari yang dipilih. Chores (intervalDays) jatuh
 * tempo bila sudah N hari sejak terakhir selesai, dan makin "panas" semakin
 * lama dibiarkan: 1x interval = waktunya, 1.5x = hangat, 2x = panas.
 * Habit yang sudah selesai hari ini tetap tampil supaya centangnya kelihatan.
 */
export function habitDue(
  h: { daysOfWeek: number[]; intervalDays: number | null },
  today: string,
  lastDone: string | null,
  doneToday: boolean
): HabitDue {
  if (h.intervalDays && h.intervalDays > 0) {
    const since = lastDone ? daysBetween(today, lastDone) : null;
    if (doneToday) return { due: true, heat: 'calm', label: null, daysSince: 0 };
    if (since === null) return { due: true, heat: 'due', label: 'Belum pernah', daysSince: null };
    const ratio = since / h.intervalDays;
    if (ratio < 1) return { due: false, heat: 'calm', label: `Lagi ${h.intervalDays - since} hari`, daysSince: since };
    const heat: HabitHeat = ratio >= 2 ? 'hot' : ratio >= 1.5 ? 'warm' : 'due';
    return { due: true, heat, label: `Udah ${since} hari`, daysSince: since };
  }
  const days = h.daysOfWeek.length ? h.daysOfWeek : [1, 2, 3, 4, 5, 6, 7];
  return { due: days.includes(isoWeekday(today)), heat: 'due', label: null, daysSince: null };
}

const HEAT_RANK: Record<HabitHeat, number> = { hot: 0, warm: 1, due: 2, calm: 3 };
export function heatRank(h: HabitHeat) {
  return HEAT_RANK[h];
}

/** "HH:MM" → menit sejak tengah malam; null bila format tidak valid. */
export function minutesOfDay(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function hhmm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const WEEKDAY_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const;

/** Menit sejak tengah malam WIB untuk sebuah waktu. */
export function jakartaMinutes(d: Date | string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).formatToParts(new Date(d));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}
