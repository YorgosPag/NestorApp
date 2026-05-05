/**
 * =============================================================================
 * ADDRESS EDITOR — Suggestion Trigger Helper (ADR-332 Phase 2)
 * =============================================================================
 *
 * Pure helper that decides whether the Suggestions Panel (Pattern C) should
 * surface, and which of the four canonical trigger types applies.
 *
 * Per ADR-332 §3.4 the panel fires when AT LEAST ONE of:
 *   1. `no-results-after-retry`     — engine produced 0 hits after every
 *                                     omit-field retry has been exhausted
 *   2. `partial-match-flag`         — Nominatim flagged `partialMatch: true`
 *   3. `multiple-candidates-similar` — alternatives.length >= 2 AND
 *                                     `top.confidence - alternatives[0].confidence < 0.15`
 *   4. `low-confidence`             — top confidence < 0.7
 *
 * If multiple conditions match, priority resolution favours the most
 * informative reason: no-results > partial-match > ambiguous > low-confidence.
 *
 * Cost control (ADR §3.4): triggers 2/3/4 require ZERO extra Nominatim calls
 * (data already in the `limit=5` response). Trigger 1 is consumed only after
 * the orchestrating hook has run the documented omit-field retry sequence.
 *
 * @module components/shared/addresses/editor/helpers/computeSuggestionTriggers
 * @see ADR-332 §3.4 Suggestion trigger algorithm
 */

import type {
  GeocodingApiResponse,
  ResolvedAddressFields,
  SuggestionTrigger,
} from '../types';

/** Default threshold values from ADR-332 §3.4. */
export const SUGGESTION_DEFAULTS = {
  lowConfidenceThreshold: 0.7,
  ambiguousConfidenceGap: 0.15,
} as const;

/**
 * Retry priority for the orchestrating hook (`useAddressSuggestions`). When
 * the engine returns 0 hits, the hook re-issues the geocode call after
 * stripping fields in this order until a hit is produced or all are tried.
 */
export const OMIT_RETRY_PRIORITY: ReadonlyArray<keyof ResolvedAddressFields> = [
  'postalCode',
  'number',
  'neighborhood',
];

export interface SuggestionTriggerInput {
  result: GeocodingApiResponse | null;
  /** True when every entry in `OMIT_RETRY_PRIORITY` has been attempted with no result. */
  retryExhausted: boolean;
  lowConfidenceThreshold?: number;
  ambiguousConfidenceGap?: number;
}

function isAmbiguous(result: GeocodingApiResponse, gap: number): boolean {
  if (result.alternatives.length < 2) return false;
  const next = result.alternatives[0]?.confidence ?? 0;
  return result.confidence - next < gap;
}

/**
 * Returns the highest-priority trigger applicable to the given result, or
 * `null` when the panel should NOT surface.
 */
export function computeSuggestionTrigger(
  input: SuggestionTriggerInput,
): SuggestionTrigger | null {
  const { result, retryExhausted } = input;
  if (result === null) {
    return retryExhausted ? 'no-results-after-retry' : null;
  }
  if (result.partialMatch) return 'partial-match-flag';
  const ambiguousGap =
    input.ambiguousConfidenceGap ?? SUGGESTION_DEFAULTS.ambiguousConfidenceGap;
  if (isAmbiguous(result, ambiguousGap)) return 'multiple-candidates-similar';
  const lowThreshold =
    input.lowConfidenceThreshold ?? SUGGESTION_DEFAULTS.lowConfidenceThreshold;
  if (result.confidence < lowThreshold) return 'low-confidence';
  return null;
}

/**
 * Returns every trigger that currently applies (no priority filtering) — useful
 * for telemetry / UI multi-badging. Order preserved as priority order so a
 * UI showing only the first element behaves identically to
 * `computeSuggestionTrigger`.
 */
export function computeAllSuggestionTriggers(
  input: SuggestionTriggerInput,
): SuggestionTrigger[] {
  const triggers: SuggestionTrigger[] = [];
  const { result, retryExhausted } = input;
  if (result === null) {
    if (retryExhausted) triggers.push('no-results-after-retry');
    return triggers;
  }
  if (result.partialMatch) triggers.push('partial-match-flag');
  const ambiguousGap =
    input.ambiguousConfidenceGap ?? SUGGESTION_DEFAULTS.ambiguousConfidenceGap;
  if (isAmbiguous(result, ambiguousGap)) triggers.push('multiple-candidates-similar');
  const lowThreshold =
    input.lowConfidenceThreshold ?? SUGGESTION_DEFAULTS.lowConfidenceThreshold;
  if (result.confidence < lowThreshold) triggers.push('low-confidence');
  return triggers;
}

/**
 * Given the set of omit-fields already attempted in the retry sequence,
 * returns the next field to omit, or `null` when every priority entry has
 * already been tried.
 */
export function nextOmitField(
  attempted: ReadonlyArray<keyof ResolvedAddressFields>,
): keyof ResolvedAddressFields | null {
  for (const field of OMIT_RETRY_PRIORITY) {
    if (!attempted.includes(field)) return field;
  }
  return null;
}
