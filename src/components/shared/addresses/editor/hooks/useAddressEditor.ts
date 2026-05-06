/**
 * =============================================================================
 * useAddressEditor — Master hook (ADR-332 Phase 1, Layer 4)
 * =============================================================================
 *
 * Integration hook that wires the pure state machine to:
 *   - debounced geocoding (`geocodeAddress` service)
 *   - field-level status derivation (`useAddressFieldStatus`)
 *   - activity log accumulator (`useAddressActivity`)
 *   - conflict diffing (`diffAddressFields`)
 *
 * Phase 1 acceptance: hook compiles + works standalone without UI. Layer 5/6
 * will consume the returned state + actions in Phases 3-5.
 *
 * @module components/shared/addresses/editor/hooks/useAddressEditor
 * @see ADR-332 §3 Architecture, Layer 4
 */

'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { geocodeAddress } from '@/lib/geocoding/geocoding-service';
import type { StructuredGeocodingQuery } from '@/lib/geocoding/geocoding-service';
import {
  DEFAULT_CONFIG,
  INITIAL_STATE,
  reduce,
  type MachineConfig,
} from '../state/addressEditorMachine';
import { diffAddressFields } from '../helpers/diffAddressFields';
import { useAddressActivity } from './useAddressActivity';
import { useAddressFieldStatus, type AddressFieldStatusMap } from './useAddressFieldStatus';
import type {
  ActivityVerbosity,
  AddressEditorErrorReason,
  AddressEditorEvent,
  AddressEditorState,
  AddressFieldConflict,
  GeocodingActivityEvent,
  ResolvedAddressFields,
} from '../types';

const I18N = {
  inputChanged: 'editor.activity.inputChanged',
  requestStarted: 'editor.activity.requestStarted',
  responseSuccess: 'editor.activity.responseSuccess',
  responseEmpty: 'editor.activity.responseEmpty',
  responseError: 'editor.activity.responseError',
  conflictDetected: 'editor.activity.conflictDetected',
  reset: 'editor.activity.reset',
} as const;

export interface UseAddressEditorOptions {
  /** Auto-fire geocode after debounce window when fields change (default: true). */
  autoGeocode?: boolean;
  /** Override machine config (debounce window, freshness thresholds). */
  machineConfig?: Partial<MachineConfig>;
  /** Activity log verbosity (default: 'detailed'). */
  verbosity?: ActivityVerbosity;
}

export interface UseAddressEditorResult {
  state: AddressEditorState;
  fieldStatus: AddressFieldStatusMap;
  activity: {
    events: GeocodingActivityEvent[];
    clear: () => void;
    setVerbosity: (v: ActivityVerbosity) => void;
    verbosity: ActivityVerbosity;
  };
  conflicts: AddressFieldConflict[];
  /** Manually trigger geocoding now (bypassing debounce). */
  triggerGeocode: () => Promise<void>;
  /** Mark current result as stale (e.g. user moved pin). */
  markStale: () => void;
  /** Apply current resolved values as accepted (transitions to success). */
  applyCorrection: () => void;
  /** Reset machine to idle. */
  reset: () => void;
}

function toQuery(input: ResolvedAddressFields): StructuredGeocodingQuery {
  return {
    street: input.street,
    city: input.city,
    neighborhood: input.neighborhood,
    postalCode: input.postalCode,
    county: input.county,
    region: input.region,
    country: input.country,
  };
}

function hasAnyValue(input: ResolvedAddressFields): boolean {
  return Object.values(input).some((v) => typeof v === 'string' && v.trim().length > 0);
}

function mergeConfig(partial?: Partial<MachineConfig>): MachineConfig {
  return { ...DEFAULT_CONFIG, ...(partial ?? {}) };
}

function classifyError(err: unknown): AddressEditorErrorReason {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('timeout')) return 'timeout';
    if (msg.includes('rate')) return 'rate-limit';
    if (msg.includes('network') || msg.includes('fetch')) return 'network';
  }
  return 'network';
}

export function useAddressEditor(
  userInput: ResolvedAddressFields,
  options: UseAddressEditorOptions = {},
): UseAddressEditorResult {
  const config = useMemo(() => mergeConfig(options.machineConfig), [options.machineConfig]);
  const reducer = useCallback(
    (state: AddressEditorState, event: AddressEditorEvent) => reduce(state, event, config),
    [config],
  );
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const activity = useAddressActivity({ verbosity: options.verbosity });
  const fieldStatus = useAddressFieldStatus(state, userInput);

  const inputRef = useRef(userInput);
  inputRef.current = userInput;
  const requestSeqRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const performGeocode = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    const snapshot = inputRef.current;
    if (!hasAnyValue(snapshot)) return;
    dispatch({
      type: 'GEOCODE_STARTED',
      attempt: 1,
      totalAttempts: 1,
      variantI18nKey: 'addresses.geocoding.attempts.engine',
    });
    activity.record({ level: 'info', category: 'request', i18nKey: I18N.requestStarted });
    try {
      const result = await geocodeAddress(toQuery(snapshot));
      if (seq !== requestSeqRef.current) return; // superseded
      if (!result) {
        dispatch({ type: 'GEOCODE_FAILED', reason: 'no-results' });
        activity.record({ level: 'warn', category: 'response', i18nKey: I18N.responseEmpty });
        return;
      }
      dispatch({ type: 'GEOCODE_SUCCESS', result, nowMs: Date.now() });
      activity.record({
        level: 'success',
        category: 'response',
        i18nKey: I18N.responseSuccess,
        i18nParams: { confidence: Math.round(result.confidence * 100) },
      });
      const conflicts = diffAddressFields(snapshot, result.resolvedFields);
      if (conflicts.length > 0) {
        dispatch({ type: 'CONFLICT_DETECTED', conflicts });
        activity.record({
          level: 'warn',
          category: 'conflict',
          i18nKey: I18N.conflictDetected,
          i18nParams: { count: conflicts.length },
        });
      }
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      const reason = classifyError(err);
      dispatch({ type: 'GEOCODE_FAILED', reason });
      activity.record({
        level: 'error',
        category: 'response',
        i18nKey: I18N.responseError,
        i18nParams: { reason },
      });
    }
  }, [activity]);

  const autoGeocode = options.autoGeocode ?? true;
  const debounceWindowMs = config.debounceWindowMs;
  const inputKey = useMemo(
    () =>
      [
        userInput.street,
        userInput.number,
        userInput.postalCode,
        userInput.neighborhood,
        userInput.city,
        userInput.county,
        userInput.region,
        userInput.country,
      ].join('|'),
    [userInput],
  );

  useEffect(() => {
    if (!hasAnyValue(userInput)) {
      dispatch({ type: 'RESET' });
      return;
    }
    const now = Date.now();
    dispatch({ type: 'FIELD_EDITED', field: 'street', value: '', nowMs: now });
    activity.record({ level: 'info', category: 'input', i18nKey: I18N.inputChanged });
    if (!autoGeocode) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      dispatch({ type: 'DEBOUNCE_TICK', nowMs: Date.now() });
      void performGeocode();
    }, debounceWindowMs);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, autoGeocode, debounceWindowMs]);

  const triggerGeocode = useCallback(async () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    await performGeocode();
  }, [performGeocode]);

  const markStale = useCallback(() => {
    dispatch({ type: 'STALE_FLAGGED' });
  }, []);

  const applyCorrection = useCallback(() => {
    dispatch({ type: 'CORRECTION_APPLIED', nowMs: Date.now() });
    activity.record({ level: 'success', category: 'apply', i18nKey: 'editor.activity.applied' });
  }, [activity]);

  const reset = useCallback(() => {
    requestSeqRef.current += 1;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    dispatch({ type: 'RESET' });
    activity.record({ level: 'info', category: 'undo', i18nKey: I18N.reset });
  }, [activity]);

  const conflicts = useMemo<AddressFieldConflict[]>(() => {
    if (state.phase === 'partial' || state.phase === 'conflict') return state.conflicts;
    return [];
  }, [state]);

  return {
    state,
    fieldStatus,
    activity: {
      events: activity.events,
      clear: activity.clear,
      setVerbosity: activity.setVerbosity,
      verbosity: activity.verbosity,
    },
    conflicts,
    triggerGeocode,
    markStale,
    applyCorrection,
    reset,
  };
}
