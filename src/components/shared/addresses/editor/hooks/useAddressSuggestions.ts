/**
 * =============================================================================
 * useAddressSuggestions — Suggestions Pattern C hook (ADR-332 Phase 2, Layer 4)
 * =============================================================================
 *
 * Pure-state orchestration hook for the Suggestions Panel:
 *   - decides which `SuggestionTrigger` (if any) currently applies
 *   - exposes ranked candidates (top + alternatives) with proximity bonus
 *   - tracks which omit-fields have been retried and what the next one is
 *   - signals `retryExhausted` once every priority entry has been tried
 *
 * The hook itself does NOT issue geocoding calls — the orchestrator
 * (`useAddressEditor` or coordinator in Phase 5) calls
 * `recordOmitAttempt(field)` after each engine retry returns. Keeping the
 * geocoding side-effect outside this hook lets it stay pure logic + React state.
 *
 * Resetting on fresh result: when `result` flips back to non-null, the attempt
 * stack auto-clears so a successful follow-up clears the retry state.
 *
 * @module components/shared/addresses/editor/hooks/useAddressSuggestions
 * @see ADR-332 §3.4 Suggestion trigger algorithm
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeSuggestionTrigger,
  nextOmitField as computeNextOmit,
  SUGGESTION_DEFAULTS,
} from '../helpers/computeSuggestionTriggers';
import {
  rankSuggestions,
  type MapCenter,
} from '../helpers/rankSuggestions';
import type {
  GeocodingApiResponse,
  ResolvedAddressFields,
  SuggestionRanking,
  SuggestionTrigger,
} from '../types';

export interface UseAddressSuggestionsOptions {
  /** Confidence below which the `low-confidence` trigger fires. Default 0.7. */
  lowConfidenceThreshold?: number;
  /** Top-vs-next confidence delta below which the `multiple-candidates-similar` trigger fires. Default 0.15. */
  ambiguousConfidenceGap?: number;
  /** Current map center for proximity-aware ranking. */
  mapCenter?: MapCenter;
  /** Distance cap (m) above which proximity bonus = 0. Default 5000. */
  proximityCapM?: number;
  /** Weight for the confidence component (0..1). Default 0.7. */
  confidenceWeight?: number;
}

export interface UseAddressSuggestionsResult {
  trigger: SuggestionTrigger | null;
  candidates: SuggestionRanking[];
  /** Field that the orchestrator should drop on the next retry call, or null when exhausted. */
  nextOmitField: keyof ResolvedAddressFields | null;
  retryExhausted: boolean;
  attempts: ReadonlyArray<keyof ResolvedAddressFields>;
  /** Call after a retry geocoding attempt completes (regardless of result) to mark the field as tried. */
  recordOmitAttempt: (field: keyof ResolvedAddressFields) => void;
  /** Reset the attempt stack — typically when the user edits the form anew. */
  resetRetries: () => void;
}

export function useAddressSuggestions(
  result: GeocodingApiResponse | null,
  options: UseAddressSuggestionsOptions = {},
): UseAddressSuggestionsResult {
  const [attempts, setAttempts] = useState<Array<keyof ResolvedAddressFields>>([]);

  // A non-null result means we are no longer in the retry sequence — clear the stack.
  useEffect(() => {
    if (result !== null) setAttempts([]);
  }, [result]);

  const nextOmit = useMemo(() => computeNextOmit(attempts), [attempts]);
  const retryExhausted = result === null && nextOmit === null;

  const lowConfidenceThreshold =
    options.lowConfidenceThreshold ?? SUGGESTION_DEFAULTS.lowConfidenceThreshold;
  const ambiguousConfidenceGap =
    options.ambiguousConfidenceGap ?? SUGGESTION_DEFAULTS.ambiguousConfidenceGap;

  const trigger = useMemo(
    () =>
      computeSuggestionTrigger({
        result,
        retryExhausted,
        lowConfidenceThreshold,
        ambiguousConfidenceGap,
      }),
    [result, retryExhausted, lowConfidenceThreshold, ambiguousConfidenceGap],
  );

  const { mapCenter, proximityCapM, confidenceWeight } = options;
  const candidates = useMemo<SuggestionRanking[]>(
    () =>
      result
        ? rankSuggestions(result, { mapCenter, proximityCapM, confidenceWeight })
        : [],
    [result, mapCenter, proximityCapM, confidenceWeight],
  );

  const recordOmitAttempt = useCallback(
    (field: keyof ResolvedAddressFields) => {
      setAttempts((prev) => (prev.includes(field) ? prev : [...prev, field]));
    },
    [],
  );

  const resetRetries = useCallback(() => setAttempts([]), []);

  return {
    trigger,
    candidates,
    nextOmitField: nextOmit,
    retryExhausted,
    attempts,
    recordOmitAttempt,
    resetRetries,
  };
}
