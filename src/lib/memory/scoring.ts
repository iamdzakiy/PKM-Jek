import type { Interaction, InteractionType, Note, NoteTopic, NotePerson, Person, Topic } from '@prisma/client';

/**
 * Memory Buoyancy (MB) and Preservation Value (PV), ported from the
 * ForgetIT / cSpaces research this app implements:
 *
 *   MB_raw = Σ w_i · e^(-λ·Δt_i)         (decayed sum of weighted interactions)
 *   MB     = 1 - e^(-MB_raw)              (squash into [0, 1])
 *
 *   PV = 0.25·UI + 0.20·G + 0.15·SG + 0.15·P + 0.15·C + 0.10·Q
 */

export const INTERACTION_WEIGHTS: Record<InteractionType, number> = {
  CREATE: 1.0,
  EDIT: 0.8,
  COMMENT: 0.9,
  VIEW: 0.2,
};

/** Decay constant λ. Higher = faster forgetting. 0.1 ≈ half-life of ~7 days. */
export const DECAY_LAMBDA = 0.1;

export function computeMemoryBuoyancy(
  interactions: Pick<Interaction, 'type' | 'createdAt'>[],
  now: Date = new Date(),
  lambda: number = DECAY_LAMBDA
): number {
  if (interactions.length === 0) return 0;

  const raw = interactions.reduce((sum, i) => {
    const deltaDays = Math.max(0, (now.getTime() - i.createdAt.getTime()) / 86_400_000);
    const w = INTERACTION_WEIGHTS[i.type];
    return sum + w * Math.exp(-lambda * deltaDays);
  }, 0);

  return 1 - Math.exp(-raw);
}

/** Clamp a value into [0, 1]. */
function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

export interface PreservationValueInput {
  note: Pick<Note, 'userInvestment' | 'quality' | 'coverage'>;
  topics: (NoteTopic & { topic: Topic })[];
  people: (NotePerson & { person: Person })[];
  projectLinked: boolean;
  totalInteractionCount: number;
}

export interface PreservationValueBreakdown {
  UI: number;
  G: number;
  SG: number;
  P: number;
  C: number;
  Q: number;
  PV: number;
}

export function computePreservationValue(input: PreservationValueInput): PreservationValueBreakdown {
  const UI = clamp01(input.note.userInvestment);

  // Gravity: how connected this note is in the knowledge graph — topics,
  // people and a project link all count as edges.
  const edgeCount = input.topics.length + input.people.length + (input.projectLinked ? 1 : 0);
  const G = clamp01(edgeCount / 5); // 5 edges ≈ fully "gravitationally" embedded

  // Social Graph: weighted by how important the linked people are (1–5 each).
  const socialWeight = input.people.reduce((sum, np) => sum + np.person.importance, 0);
  const SG = clamp01(socialWeight / 10); // two very-important people ≈ max

  // Popularity: normalized total interaction count across this note's life.
  const P = clamp01(input.totalInteractionCount / 20);

  const C = clamp01(input.note.coverage);
  const Q = clamp01(input.note.quality);

  const PV =
    PV_WEIGHTS.UI * UI + PV_WEIGHTS.G * G + PV_WEIGHTS.SG * SG + PV_WEIGHTS.P * P + PV_WEIGHTS.C * C + PV_WEIGHTS.Q * Q;

  return { UI, G, SG, P, C, Q, PV: clamp01(PV) };
}

export type MemoryFolderBucket = 'LAST_FOCUS' | 'HOT_TOPICS' | 'ACTIVE' | 'TIME_CAPSULE' | 'FORGOTTEN';

/** Folder thresholds, shared with the Pembobotan lab so the UI matches the engine. */
export const THRESHOLDS = {
  // 0.5, not 0.7: one fresh CREATE gives MB = 1 - e^-1 = 0.63, so a brand-new note must qualify.
  // The 3-day window then decides how long it stays in Last Focus.
  focusMB: 0.5,
  focusDays: 3,
  forgottenMB: 0.3,
  capsulePV: 0.6,
} as const;

/** PV term weights, in the order they appear in the formula. */
export const PV_WEIGHTS = { UI: 0.25, G: 0.2, SG: 0.15, P: 0.15, C: 0.15, Q: 0.1 } as const;

export interface FolderInput {
  memoryBuoyancy: number;
  preservationValue: number;
  lastInteractionAt: Date | null;
  hasHotTopic: boolean;
  now?: Date;
}

/**
 * Intelligent Folder Injection: assigns a note to exactly one bucket.
 *
 *   recent + buoyant           -> LAST_FOCUS
 *   linked to a hot topic      -> HOT_TOPICS
 *   buoyancy has sunk:
 *     high Preservation Value  -> TIME_CAPSULE (kept, out of the daily view)
 *     low  Preservation Value  -> FORGOTTEN    (hidden, never deleted)
 *   otherwise                  -> ACTIVE
 */
export function categorizeIntoFolder(input: FolderInput): MemoryFolderBucket {
  const now = input.now ?? new Date();
  const daysSinceLastTouch = input.lastInteractionAt
    ? (now.getTime() - input.lastInteractionAt.getTime()) / 86_400_000
    : Infinity;

  if (daysSinceLastTouch <= THRESHOLDS.focusDays && input.memoryBuoyancy >= THRESHOLDS.focusMB) return 'LAST_FOCUS';
  if (input.hasHotTopic) return 'HOT_TOPICS';
  if (input.memoryBuoyancy < THRESHOLDS.forgottenMB) {
    return input.preservationValue >= THRESHOLDS.capsulePV ? 'TIME_CAPSULE' : 'FORGOTTEN';
  }
  return 'ACTIVE';
}
