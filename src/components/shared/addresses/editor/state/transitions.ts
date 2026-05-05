/**
 * =============================================================================
 * ADDRESS EDITOR — State Machine Transitions (ADR-332 Phase 1, Layer 3)
 * =============================================================================
 *
 * Pure transition function. Given (state, event, config) → next state.
 * No side effects, no React, no Date.now() — fully deterministic and testable.
 *
 * @module components/shared/addresses/editor/state/transitions
 * @see ADR-332 §3 Architecture, Layer 3
 */

import type {
  AddressEditorEvent,
  AddressEditorState,
  AddressFreshness,
  AddressFreshnessLevel,
  GeocodingApiResponse,
  ResolvedAddressFields,
} from '../types';

export interface MachineConfig {
  debounceWindowMs: number;
  freshnessFreshMs: number;
  freshnessAgingMs: number;
  freshnessStaleMs: number;
}

export const DEFAULT_CONFIG: MachineConfig = {
  debounceWindowMs: 600,
  freshnessFreshMs: 60_000,
  freshnessAgingMs: 5 * 60_000,
  freshnessStaleMs: 30 * 60_000,
};

const PHASES_WITH_RESULT = new Set([
  'success',
  'partial',
  'conflict',
  'stale',
] as const);

function extractResult(state: AddressEditorState): GeocodingApiResponse | null {
  switch (state.phase) {
    case 'success':
    case 'partial':
    case 'conflict':
      return state.result;
    case 'stale':
      return state.lastResult;
    default:
      return null;
  }
}

function freshnessLevelFor(ageMs: number, config: MachineConfig): AddressFreshnessLevel {
  if (ageMs < config.freshnessFreshMs) return 'fresh';
  if (ageMs < config.freshnessAgingMs) return 'recent';
  if (ageMs < config.freshnessStaleMs) return 'aging';
  return 'stale';
}

export function buildFreshness(
  verifiedAtMs: number | null,
  nowMs: number,
  config: MachineConfig,
): AddressFreshness {
  if (verifiedAtMs == null) return { verifiedAt: null, level: 'never' };
  return {
    verifiedAt: verifiedAtMs,
    level: freshnessLevelFor(nowMs - verifiedAtMs, config),
  };
}

function countNonEmptyFields(fields: ResolvedAddressFields): number {
  return Object.values(fields).filter((v) => typeof v === 'string' && v.length > 0).length;
}

function reduceFieldEdited(
  state: AddressEditorState,
  event: Extract<AddressEditorEvent, { type: 'FIELD_EDITED' }>,
): AddressEditorState {
  if (PHASES_WITH_RESULT.has(state.phase as 'success')) {
    return { phase: 'typing', lastEditMs: event.nowMs };
  }
  return { phase: 'typing', lastEditMs: event.nowMs };
}

function reduceDebounceTick(
  state: AddressEditorState,
  event: Extract<AddressEditorEvent, { type: 'DEBOUNCE_TICK' }>,
  config: MachineConfig,
): AddressEditorState {
  if (state.phase !== 'typing') return state;
  const elapsed = event.nowMs - state.lastEditMs;
  const eta = Math.max(0, config.debounceWindowMs - elapsed);
  return { phase: 'debouncing', etaMs: eta };
}

function reduceGeocodeStarted(
  event: Extract<AddressEditorEvent, { type: 'GEOCODE_STARTED' }>,
): AddressEditorState {
  return {
    phase: 'loading',
    attempt: event.attempt,
    totalAttempts: event.totalAttempts,
    variantI18nKey: event.variantI18nKey,
  };
}

function reduceGeocodeSuccess(
  event: Extract<AddressEditorEvent, { type: 'GEOCODE_SUCCESS' }>,
  config: MachineConfig,
): AddressEditorState {
  return {
    phase: 'success',
    result: event.result,
    freshness: buildFreshness(event.nowMs, event.nowMs, config),
  };
}

function reduceConflictDetected(
  state: AddressEditorState,
  event: Extract<AddressEditorEvent, { type: 'CONFLICT_DETECTED' }>,
): AddressEditorState {
  const result = extractResult(state);
  if (!result) return state;
  const conflicts = event.conflicts;
  if (conflicts.length === 0) return state;
  if (result.partialMatch) {
    const total = countNonEmptyFields(result.resolvedFields);
    const resolved = Math.max(0, total - conflicts.length);
    return { phase: 'partial', result, conflicts, resolved, total };
  }
  return { phase: 'conflict', result, conflicts };
}

function reduceStaleFlagged(state: AddressEditorState): AddressEditorState {
  const result = extractResult(state);
  if (!result) return state;
  return { phase: 'stale', lastResult: result, reason: 'field-changed' };
}

function reduceCorrectionApplied(
  state: AddressEditorState,
  event: Extract<AddressEditorEvent, { type: 'CORRECTION_APPLIED' }>,
  config: MachineConfig,
): AddressEditorState {
  const result = extractResult(state);
  if (!result) return state;
  return {
    phase: 'success',
    result,
    freshness: buildFreshness(event.nowMs, event.nowMs, config),
  };
}

export function computeNextState(
  state: AddressEditorState,
  event: AddressEditorEvent,
  config: MachineConfig = DEFAULT_CONFIG,
): AddressEditorState {
  switch (event.type) {
    case 'RESET':
      return { phase: 'idle' };
    case 'FIELD_EDITED':
      return reduceFieldEdited(state, event);
    case 'DEBOUNCE_TICK':
      return reduceDebounceTick(state, event, config);
    case 'GEOCODE_STARTED':
      return reduceGeocodeStarted(event);
    case 'GEOCODE_SUCCESS':
      return reduceGeocodeSuccess(event, config);
    case 'GEOCODE_FAILED':
      return {
        phase: 'error',
        reason: event.reason,
        canRetry: event.reason !== 'no-results',
      };
    case 'CONFLICT_DETECTED':
      return reduceConflictDetected(state, event);
    case 'SUGGESTIONS_TRIGGERED':
      return {
        phase: 'suggestions',
        candidates: event.candidates,
        reason: event.reason,
      };
    case 'STALE_FLAGGED':
      return reduceStaleFlagged(state);
    case 'CORRECTION_APPLIED':
      return reduceCorrectionApplied(state, event, config);
  }
}
