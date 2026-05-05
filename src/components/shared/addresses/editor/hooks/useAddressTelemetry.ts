/**
 * =============================================================================
 * useAddressTelemetry — Client telemetry buffer for address corrections
 * =============================================================================
 *
 * Tracks the user's interaction inside an `AddressEditor` instance and emits a
 * single correction event when a finalising action happens (accept top, accept
 * suggestion, keep user, mixed, drag-resolve). Posts to
 * `/api/geocoding/telemetry` (see route handler) which is the only sanctioned
 * write path for the `address_corrections_log/` collection — Firestore rules
 * deny client writes (ADR-332 §3.7 Phase 9).
 *
 * Behaviour:
 *   - `markInputStart()` — call when the form first becomes dirty; resets the
 *     duration timer.
 *   - `markUndoOccurred()` — flips the `undoOccurred` flag for the next emit.
 *   - `flush(action, payload)` — fire-and-forget POST. Errors are swallowed
 *     and surfaced to the activity log (telemetry must never block UX).
 *
 * Design constraints (ADR-332 §3.7, CLAUDE.md N.7.2):
 *   - Proactive: timer starts at the first edit, not at coordinator mount.
 *   - Idempotent: every `flush()` produces a distinct doc id (server-side
 *     `acl_<ulid>`); calling twice → two docs, no de-dup.
 *   - Fire-and-forget: HTTP failure logs but never throws to the caller.
 *
 * @module components/shared/addresses/editor/hooks/useAddressTelemetry
 * @see ADR-332 §3.7 Telemetry schema
 */

'use client';

import { useCallback, useMemo, useRef } from 'react';
import type { ResolvedAddressFields } from '@/lib/geocoding/geocoding-types';
import type {
  CorrectionAction,
  CorrectionContextEntityType,
  FieldActionsMap,
  RecordCorrectionInput,
} from '@/services/geocoding/address-corrections-telemetry.service';

const TELEMETRY_ENDPOINT = '/api/geocoding/telemetry';

export interface UseAddressTelemetryOptions {
  contextEntityType: CorrectionContextEntityType;
  contextEntityId: string;
  /** Disable network posts — useful for storybook/demo pages. */
  disabled?: boolean;
  /** Override fetch (tests). */
  fetchImpl?: typeof fetch;
  /** Override clock (tests). */
  nowMs?: () => number;
}

export interface FlushTelemetryPayload {
  userInput: ResolvedAddressFields;
  nominatimResolved: ResolvedAddressFields;
  confidence: number;
  variantUsed: number;
  partialMatch: boolean;
  acceptedSuggestionRank?: number;
  fieldActions: FieldActionsMap;
  finalAddress: ResolvedAddressFields;
}

export interface UseAddressTelemetryResult {
  markInputStart: () => void;
  markUndoOccurred: () => void;
  flush: (action: CorrectionAction, payload: FlushTelemetryPayload) => Promise<void>;
  /** True once `markInputStart` has fired and the timer is active. */
  isTimingActive: () => boolean;
}

export function useAddressTelemetry(
  options: UseAddressTelemetryOptions,
): UseAddressTelemetryResult {
  const startMsRef = useRef<number | null>(null);
  const undoFlagRef = useRef(false);
  const now = options.nowMs ?? (() => Date.now());
  const doFetch = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);

  const markInputStart = useCallback(() => {
    if (startMsRef.current == null) {
      startMsRef.current = now();
    }
  }, [now]);

  const markUndoOccurred = useCallback(() => {
    undoFlagRef.current = true;
  }, []);

  const isTimingActive = useCallback(() => startMsRef.current != null, []);

  const flush = useCallback(
    async (action: CorrectionAction, payload: FlushTelemetryPayload): Promise<void> => {
      if (options.disabled || !doFetch) return;
      const start = startMsRef.current ?? now();
      const duration = Math.max(0, now() - start);
      const body: RecordCorrectionInput = {
        contextEntityType: options.contextEntityType,
        contextEntityId: options.contextEntityId,
        userInput: payload.userInput,
        nominatimResolved: payload.nominatimResolved,
        confidence: payload.confidence,
        variantUsed: payload.variantUsed,
        partialMatch: payload.partialMatch,
        action,
        acceptedSuggestionRank: payload.acceptedSuggestionRank,
        fieldActions: payload.fieldActions,
        durationFromInputToActionMs: duration,
        undoOccurred: undoFlagRef.current,
        finalAddress: payload.finalAddress,
      };

      // Reset for the next correction cycle — the editor may stay mounted.
      startMsRef.current = null;
      undoFlagRef.current = false;

      try {
        await doFetch(TELEMETRY_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        });
      } catch {
        // Telemetry never throws — silent failure is by design.
      }
    },
    [doFetch, now, options.contextEntityId, options.contextEntityType, options.disabled],
  );

  return useMemo(
    () => ({ markInputStart, markUndoOccurred, flush, isTimingActive }),
    [markInputStart, markUndoOccurred, flush, isTimingActive],
  );
}
