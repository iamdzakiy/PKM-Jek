/** Reverse planning: dari tanggal serah terima ke milestone mundur. */
const DAY = 86_400_000;

export interface Milestone {
  label: string;
  dueAt: Date;
}

export interface DeadlinePlan {
  daysLeft: number;
  leadDays: number;
  milestones: Milestone[];
}

/** Jam 17:00 WIB (UTC+7) pada tanggal kalender WIB dari `d`. */
export function at1700Jakarta(d: Date): Date {
  const jakarta = new Date(d.getTime() + 7 * 3600_000);
  const y = jakarta.getUTCFullYear();
  const m = jakarta.getUTCMonth();
  const day = jakarta.getUTCDate();
  return new Date(Date.UTC(y, m, day, 10, 0, 0)); // 17:00 WIB = 10:00 UTC
}

export function planDeadline(handover: Date, now: Date = new Date()): DeadlinePlan {
  const daysLeft = Math.max(0, Math.ceil((handover.getTime() - now.getTime()) / DAY));
  const leadDays = Math.max(1, Math.ceil(daysLeft / 3));

  if (daysLeft < 3) {
    return { daysLeft, leadDays, milestones: [{ label: 'Mulai hari ini', dueAt: at1700Jakarta(now) }] };
  }

  const span = handover.getTime() - now.getTime();
  const points: [string, number][] = [
    ['Mulai dan rangka awal', 0.3],
    ['Draf tengah', 0.6],
    ['Rapikan dan periksa', 0.85],
  ];
  return {
    daysLeft,
    leadDays,
    milestones: points.map(([label, frac]) => ({ label, dueAt: at1700Jakarta(new Date(now.getTime() + span * frac)) })),
  };
}
