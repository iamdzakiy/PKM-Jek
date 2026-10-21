import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const APP_TZ = 'Asia/Jakarta';
export const APP_LOCALE = 'id-ID';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelative(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);
  const min = Math.round(abs / 60_000);
  const suffix = future ? 'lagi' : 'lalu';
  if (min < 1) return future ? 'sebentar lagi' : 'baru saja';
  if (min < 60) return `${min} menit ${suffix}`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} jam ${suffix}`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} hari ${suffix}`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month} bulan ${suffix}`;
  return `${Math.round(month / 12)} tahun ${suffix}`;
}

export function formatDate(date: Date | string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Date(date).toLocaleDateString(APP_LOCALE, { timeZone: APP_TZ, ...opts });
}

export function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString(APP_LOCALE, { timeZone: APP_TZ, dateStyle: 'medium', timeStyle: 'short' });
}

/** Hour of day in the user's timezone, so server and browser agree on "pagi / malam". */
export function greeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: APP_TZ }).format(now)
  );
  if (hour < 4) return 'Masih terjaga';
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function clamp01(n: number) {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

export function pct(n: number | null | undefined) {
  return Math.round(clamp01(n ?? 0) * 100);
}

/** Parses a datetime-local string as Jakarta wall time (+07:00) instead of the server's timezone. */
export function parseLocalDateTime(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}${value.length === 16 ? ':00' : ''}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
