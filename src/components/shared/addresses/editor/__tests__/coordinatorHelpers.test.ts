/**
 * Unit tests for coordinatorHelpers (ADR-332 Phase 10)
 *
 * Pure functions — no React, no network, no Firestore.
 */

import {
  extractResult,
  buildFieldActionsMap,
  resolveReconciliationAction,
} from '../helpers/coordinatorHelpers';
import type { AddressEditorState, GeocodingApiResponse } from '../types';

// Minimal fixture — only fields inspected by extractResult matter.
const MOCK_RESULT = {
  lat: 37.9838,
  lng: 23.7275,
  accuracy: 'exact' as const,
  confidence: 0.92,
  displayName: 'Αθήνα, Ελλάδα',
  resolvedFields: { city: 'Αθήνα', country: 'Ελλάδα' },
  partialMatch: false,
  reasoning: {
    fieldMatches: {},
    attemptsLog: [],
    confidenceBreakdown: {
      base: 0.8,
      streetMatch: 0,
      cityMatch: 0.1,
      postalMatch: 0,
      countyMatch: 0,
      municipalityMatch: 0,
    },
  },
  alternatives: [],
  source: { provider: 'nominatim' as const, variantUsed: 1 as const },
} as GeocodingApiResponse;

// =============================================================================
// extractResult
// =============================================================================

describe('extractResult', () => {
  it('returns result for success phase', () => {
    const state: AddressEditorState = {
      phase: 'success',
      result: MOCK_RESULT,
      freshness: { verifiedAt: Date.now(), level: 'fresh' },
    };
    expect(extractResult(state)).toBe(MOCK_RESULT);
  });

  it('returns result for partial phase', () => {
    const state: AddressEditorState = {
      phase: 'partial',
      result: MOCK_RESULT,
      conflicts: [],
      resolved: 0,
      total: 2,
    };
    expect(extractResult(state)).toBe(MOCK_RESULT);
  });

  it('returns result for conflict phase', () => {
    const state: AddressEditorState = {
      phase: 'conflict',
      result: MOCK_RESULT,
      conflicts: [],
    };
    expect(extractResult(state)).toBe(MOCK_RESULT);
  });

  it('returns lastResult for stale phase', () => {
    const state: AddressEditorState = {
      phase: 'stale',
      lastResult: MOCK_RESULT,
      reason: 'field-changed',
    };
    expect(extractResult(state)).toBe(MOCK_RESULT);
  });

  it('returns null for idle phase', () => {
    expect(extractResult({ phase: 'idle' })).toBeNull();
  });

  it('returns null for loading phase', () => {
    const state: AddressEditorState = {
      phase: 'loading',
      attempt: 1,
      totalAttempts: 3,
      variantI18nKey: 'addresses.geocoding.attempts.osmStyle',
    };
    expect(extractResult(state)).toBeNull();
  });

  it('returns null for error phase', () => {
    expect(extractResult({ phase: 'error', reason: 'no-results', canRetry: true })).toBeNull();
  });
});

// =============================================================================
// buildFieldActionsMap
// =============================================================================

describe('buildFieldActionsMap', () => {
  it('maps apply decisions to corrected-to-resolved', () => {
    const result = buildFieldActionsMap({ street: 'apply', city: 'apply' });
    expect(result).toEqual({ street: 'corrected-to-resolved', city: 'corrected-to-resolved' });
  });

  it('maps keep decisions to kept', () => {
    const result = buildFieldActionsMap({ postalCode: 'keep', region: 'keep' });
    expect(result).toEqual({ postalCode: 'kept', region: 'kept' });
  });

  it('handles mixed decisions', () => {
    const result = buildFieldActionsMap({ street: 'apply', city: 'keep', postalCode: 'apply' });
    expect(result).toEqual({
      street: 'corrected-to-resolved',
      city: 'kept',
      postalCode: 'corrected-to-resolved',
    });
  });

  it('returns empty map for empty decisions', () => {
    expect(buildFieldActionsMap({})).toEqual({});
  });
});

// =============================================================================
// resolveReconciliationAction
// =============================================================================

describe('resolveReconciliationAction', () => {
  it('returns kept-user when all decisions are keep', () => {
    expect(resolveReconciliationAction({ street: 'keep', city: 'keep' })).toBe('kept-user');
  });

  it('returns mixed-correction when at least one apply', () => {
    expect(resolveReconciliationAction({ street: 'apply', city: 'keep' })).toBe('mixed-correction');
  });

  it('returns mixed-correction when all decisions are apply', () => {
    expect(resolveReconciliationAction({ street: 'apply', city: 'apply' })).toBe('mixed-correction');
  });

  it('returns kept-user for empty decisions (vacuous all-keep)', () => {
    expect(resolveReconciliationAction({})).toBe('kept-user');
  });

  it('returns mixed-correction for single apply decision', () => {
    expect(resolveReconciliationAction({ postalCode: 'apply' })).toBe('mixed-correction');
  });
});
