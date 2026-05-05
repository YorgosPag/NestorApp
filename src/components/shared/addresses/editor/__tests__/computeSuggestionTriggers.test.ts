/**
 * Tests — computeSuggestionTriggers (ADR-332 Phase 2)
 *
 * Covers all 4 triggers from ADR §3.4:
 *   1. no-results-after-retry
 *   2. partial-match-flag
 *   3. multiple-candidates-similar
 *   4. low-confidence
 * Plus priority resolution + omit-field retry sequencing.
 */

import {
  OMIT_RETRY_PRIORITY,
  SUGGESTION_DEFAULTS,
  computeAllSuggestionTriggers,
  computeSuggestionTrigger,
  nextOmitField,
} from '../helpers/computeSuggestionTriggers';
import type {
  GeocodingAlternative,
  GeocodingApiResponse,
} from '../types';

function makeBase(overrides: Partial<GeocodingApiResponse> = {}): GeocodingApiResponse {
  return {
    lat: 40.6401,
    lng: 22.9444,
    accuracy: 'exact',
    confidence: 0.9,
    displayName: 'Πανεπιστημίου 1, Θεσσαλονίκη',
    resolvedFields: { street: 'Πανεπιστημίου', city: 'Θεσσαλονίκη' },
    partialMatch: false,
    reasoning: {
      fieldMatches: {},
      attemptsLog: [],
      confidenceBreakdown: {
        base: 0.5,
        streetMatch: 0.1,
        cityMatch: 0.1,
        postalMatch: 0.1,
        countyMatch: 0.05,
        municipalityMatch: 0.05,
      },
    },
    alternatives: [],
    source: { provider: 'nominatim', variantUsed: 1 },
    ...overrides,
  };
}

function makeAlt(confidence: number): GeocodingAlternative {
  const { alternatives: _drop, ...rest } = makeBase({ confidence });
  return rest;
}

describe('computeSuggestionTrigger', () => {
  describe('null result', () => {
    it('returns null when retry has not been exhausted yet', () => {
      expect(
        computeSuggestionTrigger({ result: null, retryExhausted: false }),
      ).toBeNull();
    });

    it('returns "no-results-after-retry" once every omit retry has been tried', () => {
      expect(
        computeSuggestionTrigger({ result: null, retryExhausted: true }),
      ).toBe('no-results-after-retry');
    });
  });

  describe('partialMatch', () => {
    it('fires "partial-match-flag" regardless of confidence', () => {
      const result = makeBase({ partialMatch: true, confidence: 0.95 });
      expect(
        computeSuggestionTrigger({ result, retryExhausted: false }),
      ).toBe('partial-match-flag');
    });

    it('takes priority over ambiguous + low-confidence', () => {
      const result = makeBase({
        partialMatch: true,
        confidence: 0.5,
        alternatives: [makeAlt(0.49), makeAlt(0.48)],
      });
      expect(
        computeSuggestionTrigger({ result, retryExhausted: false }),
      ).toBe('partial-match-flag');
    });
  });

  describe('multiple-candidates-similar', () => {
    it('fires when alternatives.length >= 2 and gap < 0.15', () => {
      const result = makeBase({
        confidence: 0.9,
        alternatives: [makeAlt(0.85), makeAlt(0.82)],
      });
      expect(
        computeSuggestionTrigger({ result, retryExhausted: false }),
      ).toBe('multiple-candidates-similar');
    });

    it('does NOT fire with only 1 alternative even when close', () => {
      const result = makeBase({
        confidence: 0.9,
        alternatives: [makeAlt(0.89)],
      });
      expect(
        computeSuggestionTrigger({ result, retryExhausted: false }),
      ).toBeNull();
    });

    it('does NOT fire when gap >= 0.15', () => {
      const result = makeBase({
        confidence: 0.9,
        alternatives: [makeAlt(0.7), makeAlt(0.6)],
      });
      expect(
        computeSuggestionTrigger({ result, retryExhausted: false }),
      ).toBeNull();
    });

    it('respects custom ambiguousConfidenceGap', () => {
      const result = makeBase({
        confidence: 0.9,
        alternatives: [makeAlt(0.75), makeAlt(0.7)],
      });
      expect(
        computeSuggestionTrigger({
          result,
          retryExhausted: false,
          ambiguousConfidenceGap: 0.2,
        }),
      ).toBe('multiple-candidates-similar');
    });

    it('takes priority over low-confidence', () => {
      const result = makeBase({
        confidence: 0.5,
        alternatives: [makeAlt(0.45), makeAlt(0.43)],
      });
      expect(
        computeSuggestionTrigger({ result, retryExhausted: false }),
      ).toBe('multiple-candidates-similar');
    });
  });

  describe('low-confidence', () => {
    it('fires when confidence < 0.7 default', () => {
      const result = makeBase({ confidence: 0.6 });
      expect(
        computeSuggestionTrigger({ result, retryExhausted: false }),
      ).toBe('low-confidence');
    });

    it('does NOT fire at threshold boundary', () => {
      const result = makeBase({ confidence: 0.7 });
      expect(
        computeSuggestionTrigger({ result, retryExhausted: false }),
      ).toBeNull();
    });

    it('respects custom lowConfidenceThreshold', () => {
      const result = makeBase({ confidence: 0.85 });
      expect(
        computeSuggestionTrigger({
          result,
          retryExhausted: false,
          lowConfidenceThreshold: 0.9,
        }),
      ).toBe('low-confidence');
    });
  });

  describe('clean result', () => {
    it('returns null when high-confidence + no alternatives + no partialMatch', () => {
      const result = makeBase({ confidence: 0.95 });
      expect(
        computeSuggestionTrigger({ result, retryExhausted: false }),
      ).toBeNull();
    });
  });
});

describe('computeAllSuggestionTriggers', () => {
  it('returns every applicable trigger ordered by priority', () => {
    const result = makeBase({
      partialMatch: true,
      confidence: 0.5,
      alternatives: [makeAlt(0.49), makeAlt(0.48)],
    });
    expect(
      computeAllSuggestionTriggers({ result, retryExhausted: false }),
    ).toEqual([
      'partial-match-flag',
      'multiple-candidates-similar',
      'low-confidence',
    ]);
  });

  it('returns empty array on a clean result', () => {
    const result = makeBase({ confidence: 0.95 });
    expect(
      computeAllSuggestionTriggers({ result, retryExhausted: false }),
    ).toEqual([]);
  });

  it('returns single no-results trigger when retry exhausted', () => {
    expect(
      computeAllSuggestionTriggers({ result: null, retryExhausted: true }),
    ).toEqual(['no-results-after-retry']);
  });
});

describe('nextOmitField', () => {
  it('returns priority-1 (postalCode) when nothing tried', () => {
    expect(nextOmitField([])).toBe('postalCode');
  });

  it('returns priority-2 (number) after postalCode tried', () => {
    expect(nextOmitField(['postalCode'])).toBe('number');
  });

  it('returns priority-3 (neighborhood) after first two tried', () => {
    expect(nextOmitField(['postalCode', 'number'])).toBe('neighborhood');
  });

  it('returns null when all priorities exhausted', () => {
    expect(nextOmitField(['postalCode', 'number', 'neighborhood'])).toBeNull();
  });

  it('order of attempted fields does not matter', () => {
    expect(nextOmitField(['neighborhood', 'postalCode'])).toBe('number');
  });
});

describe('OMIT_RETRY_PRIORITY contract', () => {
  it('matches ADR §3.4 priority order', () => {
    expect(OMIT_RETRY_PRIORITY).toEqual([
      'postalCode',
      'number',
      'neighborhood',
    ]);
  });
});

describe('SUGGESTION_DEFAULTS contract', () => {
  it('matches ADR §3.4 thresholds', () => {
    expect(SUGGESTION_DEFAULTS.lowConfidenceThreshold).toBe(0.7);
    expect(SUGGESTION_DEFAULTS.ambiguousConfidenceGap).toBe(0.15);
  });
});
