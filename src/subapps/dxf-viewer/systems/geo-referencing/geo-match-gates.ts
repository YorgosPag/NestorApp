/**
 * ADR-650 §M10e — THE ACCEPTANCE CONTRACT. What «matched» is allowed to mean.
 *
 * This file exists separately from the orchestrator on purpose. A threshold that lives inside
 * the code that wants to pass it gets relaxed — a little, for a good reason, to make one test
 * green — and nobody notices that the tool now offers guesses as answers. Here the contract
 * is one small, independently tested unit, and changing it is a visible act.
 *
 * 🔴 DO NOT LOOSEN A THRESHOLD TO MAKE A TEST PASS. A failing acceptance test is the gate
 * doing its job: either the matcher is wrong, or the fixture genuinely should not match.
 *
 * ## The three gates, and what each one stops
 *   - COUNT — enough drawing points landed on distinct survey points. Stops a fit that is
 *     technically perfect over four points and meaningless over the site.
 *   - RESIDUAL — those landings are tight. Stops a fit that is «roughly» right, which for a
 *     geo-reference means every quantity downstream is roughly wrong.
 *   - UNIQUENESS — no materially different transform explains the data nearly as well. This
 *     is the one that stops the failure mode a symmetric survey actually has: a rectangular
 *     grid of points matches itself under 90° and 180° rotations, and every one of those fits
 *     passes the first two gates. If two answers are close, there is no answer.
 *
 * ## Why the count is measured against `min(drawing, survey)`
 * The verifier's one-to-one rule caps inliers at the SMALLER of the two sets: 93 survey points
 * can never explain more than 93 drawing points, however many the drawing has. Taking a
 * percentage of the drawing's own total would therefore demand 450 inliers out of a possible
 * 93 on the reference file — a gate no correct match could ever pass, which is a gate that
 * only ever reports failure. The achievable maximum is the honest denominator.
 *
 * Pure module — zero deps beyond types, fully deterministic.
 *
 * @see ./geo-point-index.ts — where the one-to-one rule that caps the maximum lives
 */

/** Absolute floor on inliers — below this, no percentage makes a match credible. */
export const MIN_INLIERS = 8;
/** Fraction of the ACHIEVABLE maximum (see the header) that must be inliers. */
export const MIN_INLIER_RATIO = 0.3;
/** Worst tolerated RMS residual of the accepted fit, canonical mm. */
export const MAX_RMS_MM = 50;
/** The winner must beat a materially different runner-up by at least this factor. */
export const UNIQUENESS_FACTOR = 1.5;
/** Beyond this relative deviation from 1, the two files are in different units, not misaligned. */
export const MAX_SCALE_DEVIATION = 0.002;

/**
 * Unit ratios worth NAMING when a scale mismatch is detected, as «canonical mm per unit».
 * Ordered most to least common in Greek practice. A ratio that matches none of these is still
 * reported as a mismatch — just without a suggestion, which is honest.
 */
const KNOWN_UNIT_SCALES: readonly number[] = [1000, 10, 304.8, 25.4];

/** Relative window for recognising a scale as one of the known unit ratios (0.5 %). */
const UNIT_SCALE_TOLERANCE = 0.005;

/** The most inliers this pairing could possibly produce — see the header. */
export function matchableTotal(localCount: number, worldCount: number): number {
  return Math.min(localCount, worldCount);
}

/** Inliers required for `matchable` achievable correspondences. */
export function requiredInliers(matchable: number): number {
  return Math.max(MIN_INLIERS, Math.ceil(MIN_INLIER_RATIO * matchable));
}

export interface GateInput {
  readonly inliers: number;
  readonly matchable: number;
  readonly rmsMm: number;
  /** Inliers of the best materially different rival. `0` when the search found none. */
  readonly secondBestInliers: number;
}

/** Why a candidate was refused — `null` in {@link GateVerdict.reason} means it was accepted. */
export type GateFailure = 'too-few-inliers' | 'residual-too-large' | 'ambiguous';

export interface GateVerdict {
  readonly accepted: boolean;
  readonly reason: GateFailure | null;
  /** The count this candidate had to reach — surfaced so the UI can explain the refusal. */
  readonly required: number;
}

/**
 * Apply all three gates, in the order that yields the most useful explanation: a match with
 * too few inliers is described that way even if it is also ambiguous, because raising the
 * evidence is the user's next step either way.
 */
export function applyAcceptanceGates(input: GateInput): GateVerdict {
  const required = requiredInliers(input.matchable);

  if (input.inliers < required) return { accepted: false, reason: 'too-few-inliers', required };
  if (input.rmsMm > MAX_RMS_MM) return { accepted: false, reason: 'residual-too-large', required };
  if (input.secondBestInliers * UNIQUENESS_FACTOR > input.inliers) {
    return { accepted: false, reason: 'ambiguous', required };
  }
  return { accepted: true, reason: null, required };
}

/** `true` when `scaleEstimate` is far enough from 1 to be a unit problem rather than noise. */
export function isUnitMismatch(scaleEstimate: number): boolean {
  return Number.isFinite(scaleEstimate) && Math.abs(scaleEstimate - 1) > MAX_SCALE_DEVIATION;
}

/**
 * The unit ratio `scaleEstimate` looks like (e.g. 1000 for a drawing authored in metres read
 * as millimetres), or `null` when it resembles none of them.
 *
 * Both the ratio and its reciprocal are tested, because which file is «wrong» depends on
 * which one the user re-imports — and the suggestion is only a hint for the existing
 * `unitsOverride` escape hatch, never something applied automatically.
 */
export function suggestUnitScale(scaleEstimate: number): number | null {
  if (!Number.isFinite(scaleEstimate) || scaleEstimate <= 0) return null;

  for (const scale of KNOWN_UNIT_SCALES) {
    for (const candidate of [scale, 1 / scale]) {
      if (Math.abs(scaleEstimate / candidate - 1) <= UNIT_SCALE_TOLERANCE) return candidate;
    }
  }
  return null;
}
