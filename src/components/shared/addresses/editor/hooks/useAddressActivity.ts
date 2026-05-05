/**
 * =============================================================================
 * useAddressActivity — Activity log accumulator hook (ADR-332 Phase 1, Layer 4)
 * =============================================================================
 *
 * Append-only ring buffer of `GeocodingActivityEvent`s with verbosity filter.
 * Pure logic + React state — no UI here. Layer 5 `<AddressActivityLog>`
 * (Phase 4) consumes the returned `events` and renders.
 *
 * Verbosity filter applied at append time (events below threshold are
 * dropped, not just hidden) to keep memory bounded on long sessions.
 *
 * @module components/shared/addresses/editor/hooks/useAddressActivity
 * @see ADR-332 §3.6 Activity Log specification
 */

'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  ActivityCategory,
  ActivityLevel,
  ActivityVerbosity,
  GeocodingActivityEvent,
} from '../types';

const DEFAULT_MAX_EVENTS = 200;

const VERBOSITY_RANK: Record<ActivityVerbosity, number> = {
  basic: 0,
  detailed: 1,
  debug: 2,
};

const LEVEL_MIN_VERBOSITY: Record<ActivityLevel, ActivityVerbosity> = {
  error: 'basic',
  warn: 'basic',
  success: 'basic',
  info: 'detailed',
};

const CATEGORY_MIN_VERBOSITY: Record<ActivityCategory, ActivityVerbosity> = {
  input: 'detailed',
  request: 'detailed',
  response: 'detailed',
  conflict: 'basic',
  suggestion: 'detailed',
  apply: 'basic',
  drag: 'detailed',
  undo: 'detailed',
};

function shouldRecord(
  level: ActivityLevel,
  category: ActivityCategory,
  verbosity: ActivityVerbosity,
): boolean {
  if (verbosity === 'debug') return true;
  const minByLevel = VERBOSITY_RANK[LEVEL_MIN_VERBOSITY[level]];
  const minByCategory = VERBOSITY_RANK[CATEGORY_MIN_VERBOSITY[category]];
  const min = Math.max(minByLevel, minByCategory);
  return VERBOSITY_RANK[verbosity] >= min;
}

export interface UseAddressActivityOptions {
  verbosity?: ActivityVerbosity;
  maxEvents?: number;
}

export interface AddEventInput {
  level: ActivityLevel;
  category: ActivityCategory;
  i18nKey: string;
  i18nParams?: Record<string, string | number>;
}

export interface UseAddressActivityResult {
  events: GeocodingActivityEvent[];
  add: (input: AddEventInput) => void;
  clear: () => void;
  setVerbosity: (verbosity: ActivityVerbosity) => void;
  verbosity: ActivityVerbosity;
}

/**
 * Monotonic-ish identifier — `${timestamp}-${counter}` keeps activity events
 * chronologically sortable without an external ULID dep.
 */
function makeEventId(seqRef: { current: number }): string {
  seqRef.current += 1;
  return `evt_${Date.now().toString(36)}_${seqRef.current.toString(36)}`;
}

export function useAddressActivity(
  options: UseAddressActivityOptions = {},
): UseAddressActivityResult {
  const maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
  const [verbosity, setVerbosity] = useState<ActivityVerbosity>(
    options.verbosity ?? 'detailed',
  );
  const [events, setEvents] = useState<GeocodingActivityEvent[]>([]);
  const seqRef = useRef(0);

  const add = useCallback(
    (input: AddEventInput) => {
      if (!shouldRecord(input.level, input.category, verbosity)) return;
      const event: GeocodingActivityEvent = {
        id: makeEventId(seqRef),
        timestamp: Date.now(),
        level: input.level,
        category: input.category,
        i18nKey: input.i18nKey,
        i18nParams: input.i18nParams,
      };
      setEvents((prev) => {
        const next = prev.length >= maxEvents ? prev.slice(prev.length - maxEvents + 1) : prev;
        return [...next, event];
      });
    },
    [verbosity, maxEvents],
  );

  const clear = useCallback(() => setEvents([]), []);

  return useMemo(
    () => ({ events, add, clear, setVerbosity, verbosity }),
    [events, add, clear, verbosity],
  );
}

export const __test__ = { shouldRecord };
