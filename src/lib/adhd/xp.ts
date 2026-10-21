/** XP tidak pernah berkurang. Level naik pelan, bukan kompetitif. */
export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}

export function xpForLevel(level: number): number {
  return 50 * (level - 1) * (level - 1);
}

export const GRID_CELLS = 28; // 7 x 4
export const FREEZE_PER_WEEK = 2;

export const XP = { step: 5, habit: 10, sprint: 15, reset: 10, sweep: 10, task: 8 } as const;
