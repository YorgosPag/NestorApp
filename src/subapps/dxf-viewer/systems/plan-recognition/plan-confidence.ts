/**
 * ADR-929 Φ5 — από βαθμό βεβαιότητας (`PlanConfidence.score`, [0,1]) σε **επίπεδο** και σε **σημάδι**. Ο ΕΝΑΣ
 * αναγνώστης του `PLAN_CONFIDENCE_MARKS`: η επικάλυψη του καμβά και το υπόμνημα του πάνελ ρωτούν εδώ, ώστε ό,τι
 * βλέπει ο άνθρωπος στη λίστα να είναι ό,τι βλέπει πάνω στην εικόνα.
 *
 * @see ../../config/color-config.ts (`PLAN_CONFIDENCE_MARKS`, κρίνεται από το CHECK 3.41)
 */

import { PLAN_CONFIDENCE_MARKS } from '../../config/color-config';

export type PlanConfidenceTier = keyof typeof PLAN_CONFIDENCE_MARKS.tiers;

/** Από το πιο βέβαιο στο λιγότερο: η σειρά του υπομνήματος και της ζωγραφικής (τα αβέβαια από πάνω). */
export const PLAN_CONFIDENCE_ORDER: readonly PlanConfidenceTier[] = ['high', 'medium', 'low'];

export interface PlanConfidenceMark {
  readonly stroke: string;
  /** `strokeDasharray`· κενό = συμπαγής. */
  readonly dash: string;
  readonly strokeWidth: number;
}

/** Το επίπεδο ενός βαθμού. Χωρίς βαθμό (τμήμα που η σύντηξη δεν βαθμολόγησε) ⇒ `low`: ποτέ σιωπηλή εμπιστοσύνη. */
export function planConfidenceTier(score: number | null | undefined): PlanConfidenceTier {
  if (score === null || score === undefined || !Number.isFinite(score)) return 'low';
  return PLAN_CONFIDENCE_ORDER.find((tier) => score >= PLAN_CONFIDENCE_MARKS.tiers[tier].minScore) ?? 'low';
}

/** Φτάνει ο βαθμός το επίπεδο `minTier` ή υψηλότερο; (ADR-929 Φ5.2ε — ποια τμήματα γίνονται είσοδος τοίχων.) */
export function meetsConfidenceTier(score: number | null | undefined, minTier: PlanConfidenceTier): boolean {
  return PLAN_CONFIDENCE_ORDER.indexOf(planConfidenceTier(score)) <= PLAN_CONFIDENCE_ORDER.indexOf(minTier);
}

export function planConfidenceMark(tier: PlanConfidenceTier): PlanConfidenceMark {
  const spec = PLAN_CONFIDENCE_MARKS.tiers[tier];
  return { stroke: spec.hex, dash: PLAN_CONFIDENCE_MARKS.dashPx[spec.dash], strokeWidth: PLAN_CONFIDENCE_MARKS.strokeWidthPx };
}

/** Πλήθη ανά επίπεδο, για το υπόμνημα. */
export function countByConfidenceTier(scores: Iterable<number | null>): Readonly<Record<PlanConfidenceTier, number>> {
  const counts: Record<PlanConfidenceTier, number> = { high: 0, medium: 0, low: 0 };
  for (const score of scores) counts[planConfidenceTier(score)] += 1;
  return counts;
}
