/**
 * Tests — addressEditorMachine (ADR-332 Phase 1, Layer 3)
 *
 * Pure transition coverage: each event from each meaningful starting phase.
 */

import {
  DEFAULT_CONFIG,
  INITIAL_STATE,
  buildFreshness,
  computeNextState,
  createAddressEditorMachine,
  reduce,
} from '../state/addressEditorMachine';
import type {
  AddressEditorState,
  AddressFieldConflict,
  GeocodingApiResponse,
} from '../types';

const RESULT: GeocodingApiResponse = {
  lat: 40.62,
  lng: 22.95,
  accuracy: 'exact',
  confidence: 0.85,
  displayName: 'Πανεπιστημίου 1, 54635 Θεσσαλονίκη',
  resolvedCity: 'Θεσσαλονίκη',
  resolvedFields: {
    street: 'Πανεπιστημίου',
    number: '1',
    postalCode: '54635',
    city: 'Θεσσαλονίκη',
    region: 'Κεντρική Μακεδονία',
    country: 'Ελλάδα',
  },
  partialMatch: false,
  reasoning: {
    fieldMatches: {
      street: 'match',
      city: 'match',
      postalCode: 'match',
      number: 'match',
      neighborhood: 'not-provided',
      county: 'not-provided',
      region: 'match',
      country: 'match',
    },
    attemptsLog: [],
    confidenceBreakdown: {
      base: 0.5,
      streetMatch: 0.1,
      cityMatch: 0.1,
      postalMatch: 0.1,
      countyMatch: 0,
      municipalityMatch: 0.05,
    },
  },
  alternatives: [],
  source: { provider: 'nominatim', variantUsed: 1 },
};

const PARTIAL_RESULT: GeocodingApiResponse = { ...RESULT, partialMatch: true };

const CONFLICT: AddressFieldConflict = {
  field: 'postalCode',
  userValue: '54600',
  resolvedValue: '54635',
};

describe('addressEditorMachine — initial state', () => {
  it('starts in idle', () => {
    expect(INITIAL_STATE).toEqual({ phase: 'idle' });
  });

  it('reduce alias delegates to computeNextState', () => {
    const out = reduce(INITIAL_STATE, { type: 'RESET' });
    expect(out).toEqual({ phase: 'idle' });
  });
});

describe('RESET', () => {
  it('resets from any phase to idle', () => {
    const state: AddressEditorState = { phase: 'success', result: RESULT, freshness: { verifiedAt: 1, level: 'fresh' } };
    expect(computeNextState(state, { type: 'RESET' })).toEqual({ phase: 'idle' });
  });
});

describe('FIELD_EDITED', () => {
  it('moves idle → typing with lastEditMs', () => {
    const out = computeNextState(INITIAL_STATE, {
      type: 'FIELD_EDITED', field: 'street', value: 'Α', nowMs: 1000,
    });
    expect(out).toEqual({ phase: 'typing', lastEditMs: 1000 });
  });

  it('invalidates success result when user edits', () => {
    const state: AddressEditorState = { phase: 'success', result: RESULT, freshness: { verifiedAt: 1, level: 'fresh' } };
    const out = computeNextState(state, {
      type: 'FIELD_EDITED', field: 'city', value: 'X', nowMs: 2000,
    });
    expect(out).toEqual({ phase: 'typing', lastEditMs: 2000 });
  });
});

describe('DEBOUNCE_TICK', () => {
  it('moves typing → debouncing with eta=0 when window elapsed', () => {
    const state: AddressEditorState = { phase: 'typing', lastEditMs: 0 };
    const out = computeNextState(state, { type: 'DEBOUNCE_TICK', nowMs: 1000 });
    expect(out).toEqual({ phase: 'debouncing', etaMs: 0 });
  });

  it('moves typing → debouncing with eta>0 when within window', () => {
    const state: AddressEditorState = { phase: 'typing', lastEditMs: 100 };
    const out = computeNextState(state, { type: 'DEBOUNCE_TICK', nowMs: 300 });
    if (out.phase !== 'debouncing') throw new Error('expected debouncing');
    expect(out.etaMs).toBe(DEFAULT_CONFIG.debounceWindowMs - 200);
  });

  it('is a no-op when not in typing phase', () => {
    const state: AddressEditorState = { phase: 'idle' };
    const out = computeNextState(state, { type: 'DEBOUNCE_TICK', nowMs: 999 });
    expect(out).toBe(state);
  });
});

describe('GEOCODE_STARTED', () => {
  it('moves to loading with attempt info', () => {
    const out = computeNextState(INITIAL_STATE, {
      type: 'GEOCODE_STARTED', attempt: 2, totalAttempts: 5, variantI18nKey: 'addresses.geocoding.attempts.osmStyle',
    });
    expect(out).toEqual({
      phase: 'loading',
      attempt: 2,
      totalAttempts: 5,
      variantI18nKey: 'addresses.geocoding.attempts.osmStyle',
    });
  });
});

describe('GEOCODE_SUCCESS', () => {
  it('moves to success with fresh freshness', () => {
    const state: AddressEditorState = { phase: 'loading', attempt: 1, totalAttempts: 1, variantI18nKey: 'k' };
    const out = computeNextState(state, { type: 'GEOCODE_SUCCESS', result: RESULT, nowMs: 5000 });
    if (out.phase !== 'success') throw new Error('expected success');
    expect(out.result).toBe(RESULT);
    expect(out.freshness.level).toBe('fresh');
    expect(out.freshness.verifiedAt).toBe(5000);
  });
});

describe('GEOCODE_FAILED', () => {
  it.each([
    ['no-results', false],
    ['timeout', true],
    ['rate-limit', true],
    ['network', true],
  ] as const)('reason=%s → canRetry=%s', (reason, canRetry) => {
    const out = computeNextState(INITIAL_STATE, { type: 'GEOCODE_FAILED', reason });
    expect(out).toEqual({ phase: 'error', reason, canRetry });
  });
});

describe('CONFLICT_DETECTED', () => {
  it('routes to conflict when result is non-partial', () => {
    const state: AddressEditorState = {
      phase: 'success', result: RESULT, freshness: { verifiedAt: 0, level: 'fresh' },
    };
    const out = computeNextState(state, { type: 'CONFLICT_DETECTED', conflicts: [CONFLICT] });
    if (out.phase !== 'conflict') throw new Error('expected conflict');
    expect(out.conflicts).toEqual([CONFLICT]);
  });

  it('routes to partial when result.partialMatch=true', () => {
    const state: AddressEditorState = {
      phase: 'success', result: PARTIAL_RESULT, freshness: { verifiedAt: 0, level: 'fresh' },
    };
    const out = computeNextState(state, { type: 'CONFLICT_DETECTED', conflicts: [CONFLICT] });
    if (out.phase !== 'partial') throw new Error('expected partial');
    expect(out.total).toBeGreaterThan(0);
    expect(out.resolved).toBeGreaterThanOrEqual(0);
    expect(out.conflicts).toEqual([CONFLICT]);
  });

  it('is a no-op when no result is in state', () => {
    const out = computeNextState(INITIAL_STATE, { type: 'CONFLICT_DETECTED', conflicts: [CONFLICT] });
    expect(out).toEqual(INITIAL_STATE);
  });

  it('is a no-op when conflicts is empty', () => {
    const state: AddressEditorState = {
      phase: 'success', result: RESULT, freshness: { verifiedAt: 0, level: 'fresh' },
    };
    const out = computeNextState(state, { type: 'CONFLICT_DETECTED', conflicts: [] });
    expect(out).toBe(state);
  });
});

describe('SUGGESTIONS_TRIGGERED', () => {
  it('moves to suggestions phase from any state', () => {
    const out = computeNextState(INITIAL_STATE, {
      type: 'SUGGESTIONS_TRIGGERED', candidates: [RESULT], reason: 'low-confidence',
    });
    expect(out).toEqual({ phase: 'suggestions', candidates: [RESULT], reason: 'low-confidence' });
  });
});

describe('STALE_FLAGGED', () => {
  it('moves success → stale carrying lastResult', () => {
    const state: AddressEditorState = {
      phase: 'success', result: RESULT, freshness: { verifiedAt: 0, level: 'fresh' },
    };
    const out = computeNextState(state, { type: 'STALE_FLAGGED' });
    expect(out).toEqual({ phase: 'stale', lastResult: RESULT, reason: 'field-changed' });
  });

  it('is a no-op when no result is in state', () => {
    const out = computeNextState(INITIAL_STATE, { type: 'STALE_FLAGGED' });
    expect(out).toEqual(INITIAL_STATE);
  });
});

describe('CORRECTION_APPLIED', () => {
  it('moves conflict → success with fresh freshness', () => {
    const state: AddressEditorState = {
      phase: 'conflict', result: RESULT, conflicts: [CONFLICT],
    };
    const out = computeNextState(state, { type: 'CORRECTION_APPLIED', nowMs: 10000 });
    if (out.phase !== 'success') throw new Error('expected success');
    expect(out.result).toBe(RESULT);
    expect(out.freshness.verifiedAt).toBe(10000);
    expect(out.freshness.level).toBe('fresh');
  });

  it('is a no-op when no result in state', () => {
    const out = computeNextState(INITIAL_STATE, { type: 'CORRECTION_APPLIED', nowMs: 1 });
    expect(out).toEqual(INITIAL_STATE);
  });
});

describe('buildFreshness', () => {
  it('returns never when verifiedAtMs is null', () => {
    expect(buildFreshness(null, 1000, DEFAULT_CONFIG)).toEqual({ verifiedAt: null, level: 'never' });
  });

  it('classifies fresh / recent / aging / stale by age', () => {
    const now = 10_000_000;
    expect(buildFreshness(now - 1000, now, DEFAULT_CONFIG).level).toBe('fresh');
    expect(buildFreshness(now - 2 * 60_000, now, DEFAULT_CONFIG).level).toBe('recent');
    expect(buildFreshness(now - 10 * 60_000, now, DEFAULT_CONFIG).level).toBe('aging');
    expect(buildFreshness(now - 60 * 60_000, now, DEFAULT_CONFIG).level).toBe('stale');
  });
});

describe('createAddressEditorMachine', () => {
  it('emits notifications to subscribers on send', () => {
    const machine = createAddressEditorMachine();
    const seen: string[] = [];
    const unsub = machine.subscribe((s) => seen.push(s.phase));
    machine.send({ type: 'FIELD_EDITED', field: 'street', value: 'Α', nowMs: 1 });
    machine.send({ type: 'GEOCODE_STARTED', attempt: 1, totalAttempts: 1, variantI18nKey: 'k' });
    unsub();
    machine.send({ type: 'RESET' });
    expect(seen).toEqual(['typing', 'loading']);
    expect(machine.getState().phase).toBe('idle');
  });

  it('reset returns machine to idle and notifies', () => {
    const machine = createAddressEditorMachine();
    machine.send({ type: 'FIELD_EDITED', field: 'street', value: 'X', nowMs: 1 });
    let last = '';
    machine.subscribe((s) => { last = s.phase; });
    machine.reset();
    expect(last).toBe('idle');
    expect(machine.getState().phase).toBe('idle');
  });
});
