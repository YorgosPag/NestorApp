/**
 * ADR-336 — Signatory confidence thresholds (SSoT).
 *
 * Per-field confidence band drives the review-panel UI (color + copy + button
 * activation), NOT persistence policy. Persistence is always user-initiated
 * via the commit button — see ADR-336 Q2 (revised after Q3).
 *
 * Bands:
 *   ≥ 85          → high   (green border, primary commit button)
 *   60 – 84       → medium (yellow border, "review & commit" button)
 *   <  60         → low    (red border, button disabled until manual edit)
 *
 * Re-used by:
 *   - openai-quote-analyzer.ts (extraction, no persistence gate)
 *   - SignatoryProposalCard.tsx (per-field color)
 *   - commit-signatory route (allows commit on any band — confidence is UX,
 *     not policy)
 */

export const SIGNATORY_CONFIDENCE_HIGH = 85;
export const SIGNATORY_CONFIDENCE_MEDIUM = 60;

export type SignatoryConfidenceBand = 'high' | 'medium' | 'low';

export function getSignatoryConfidenceBand(confidence: number): SignatoryConfidenceBand {
  if (confidence >= SIGNATORY_CONFIDENCE_HIGH) return 'high';
  if (confidence >= SIGNATORY_CONFIDENCE_MEDIUM) return 'medium';
  return 'low';
}

/**
 * Aggregate band from the worst per-field confidence among the populated
 * signatory fields. Used by SignatoryProposalCard to pick the primary button
 * color: any low-band field downgrades the card to low.
 */
export function aggregateSignatoryBand(confidences: ReadonlyArray<number>): SignatoryConfidenceBand {
  const populated = confidences.filter((c) => c > 0);
  if (populated.length === 0) return 'low';
  const min = Math.min(...populated);
  return getSignatoryConfidenceBand(min);
}
