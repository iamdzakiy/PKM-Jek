/**
 * SM-2-lite spaced repetition scheduler for the Active Recall loop
 * (H+1 / H+7 / H+30-style intervals described in the research doc).
 */
export function nextInterval(previousIntervalDays: number, wasCorrect: boolean): number {
  if (!wasCorrect) return 1; // failed recall — reset to daily
  if (previousIntervalDays <= 1) return 7;
  if (previousIntervalDays <= 7) return 30;
  if (previousIntervalDays <= 30) return 90;
  return Math.round(previousIntervalDays * 2); // keep doubling beyond that
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
