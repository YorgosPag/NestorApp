/**
 * Tests — rankSuggestions (ADR-332 Phase 2)
 *
 * Covers:
 *   - top + alternatives merged
 *   - default scoring (confidence-only when no mapCenter)
 *   - proximity-aware reorder when mapCenter provided
 *   - haversineDistanceM accuracy
 *   - distance is null when no mapCenter
 *   - originalRank preserved
 *   - confidenceWeight + proximityCapM honored
 */

import {
  haversineDistanceM,
  rankSuggestions,
} from '../helpers/rankSuggestions';
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

function makeAlt(overrides: Partial<GeocodingAlternative>): GeocodingAlternative {
  const base = makeBase();
  const { alternatives: _drop, ...rest } = base;
  return { ...rest, ...overrides };
}

describe('haversineDistanceM', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceM({ lat: 40, lng: 22 }, { lat: 40, lng: 22 })).toBe(0);
  });

  it('approximates Athens → Thessaloniki distance (~300 km)', () => {
    const athens = { lat: 37.9838, lng: 23.7275 };
    const thessaloniki = { lat: 40.6401, lng: 22.9444 };
    const d = haversineDistanceM(athens, thessaloniki);
    expect(d).toBeGreaterThan(290_000);
    expect(d).toBeLessThan(310_000);
  });

  it('is symmetric', () => {
    const a = { lat: 40.0, lng: 22.0 };
    const b = { lat: 41.0, lng: 23.0 };
    expect(haversineDistanceM(a, b)).toBeCloseTo(haversineDistanceM(b, a), 5);
  });
});

describe('rankSuggestions — without mapCenter', () => {
  it('returns top + alternatives in confidence-desc order', () => {
    const result = makeBase({
      confidence: 0.9,
      alternatives: [makeAlt({ confidence: 0.7 }), makeAlt({ confidence: 0.85 })],
    });
    const ranked = rankSuggestions(result);
    expect(ranked).toHaveLength(3);
    expect(ranked.map((r) => r.candidate.confidence)).toEqual([0.9, 0.85, 0.7]);
  });

  it('preserves originalRank from input order', () => {
    const result = makeBase({
      confidence: 0.9,
      alternatives: [makeAlt({ confidence: 0.7 }), makeAlt({ confidence: 0.85 })],
    });
    const ranked = rankSuggestions(result);
    const top = ranked.find((r) => r.candidate.confidence === 0.9);
    const second = ranked.find((r) => r.candidate.confidence === 0.85);
    const third = ranked.find((r) => r.candidate.confidence === 0.7);
    expect(top?.originalRank).toBe(0);
    expect(third?.originalRank).toBe(1); // first alternative input
    expect(second?.originalRank).toBe(2);
  });

  it('distanceFromCenterM is null without mapCenter', () => {
    const result = makeBase({
      alternatives: [makeAlt({ confidence: 0.8 })],
    });
    const ranked = rankSuggestions(result);
    expect(ranked.every((r) => r.distanceFromCenterM === null)).toBe(true);
  });

  it('rankScore equals confidence without mapCenter', () => {
    const result = makeBase({
      confidence: 0.92,
      alternatives: [makeAlt({ confidence: 0.65 })],
    });
    const ranked = rankSuggestions(result);
    expect(ranked[0].rankScore).toBeCloseTo(0.92, 5);
    expect(ranked[1].rankScore).toBeCloseTo(0.65, 5);
  });

  it('coerces alternatives to full GeocodingApiResponse with empty alternatives[]', () => {
    const result = makeBase({
      alternatives: [makeAlt({ confidence: 0.6 })],
    });
    const ranked = rankSuggestions(result);
    const fromAlt = ranked.find((r) => r.candidate.confidence === 0.6);
    expect(fromAlt?.candidate.alternatives).toEqual([]);
  });

  it('returns single entry when no alternatives', () => {
    const result = makeBase({ alternatives: [] });
    const ranked = rankSuggestions(result);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].originalRank).toBe(0);
  });
});

describe('rankSuggestions — with mapCenter', () => {
  it('lower-confidence candidate can outrank top when much closer', () => {
    // Top hit far away (~200 km), alternative right next to map center.
    const top = makeBase({
      lat: 37.9838,
      lng: 23.7275, // Athens
      confidence: 0.9,
      alternatives: [
        makeAlt({ lat: 40.6401, lng: 22.9444, confidence: 0.6 }), // Thessaloniki
      ],
    });
    const ranked = rankSuggestions(top, {
      mapCenter: { lat: 40.6401, lng: 22.9444 },
      proximityCapM: 5_000,
      confidenceWeight: 0.5,
    });
    expect(ranked[0].candidate.confidence).toBe(0.6);
    expect(ranked[1].candidate.confidence).toBe(0.9);
  });

  it('distanceFromCenterM populated for every entry', () => {
    const result = makeBase({
      lat: 40.6401,
      lng: 22.9444,
      alternatives: [makeAlt({ lat: 40.65, lng: 22.95, confidence: 0.7 })],
    });
    const ranked = rankSuggestions(result, {
      mapCenter: { lat: 40.6401, lng: 22.9444 },
    });
    expect(ranked.every((r) => typeof r.distanceFromCenterM === 'number')).toBe(true);
    expect(ranked.find((r) => r.candidate.confidence === 0.9)?.distanceFromCenterM).toBe(0);
  });

  it('proximity bonus is 0 when distance >= proximityCapM', () => {
    const result = makeBase({
      lat: 40.0,
      lng: 22.0,
      confidence: 0.5,
      alternatives: [],
    });
    const ranked = rankSuggestions(result, {
      mapCenter: { lat: 41.0, lng: 23.0 }, // way beyond 5 km cap
      proximityCapM: 5_000,
      confidenceWeight: 0.7,
    });
    // proximity = 0 → rankScore = 0.7 * 0.5 + 0.3 * 0 = 0.35
    expect(ranked[0].rankScore).toBeCloseTo(0.35, 5);
  });

  it('proximity bonus = 1 when distance = 0 (rankScore = full mix)', () => {
    const result = makeBase({
      confidence: 0.6,
      alternatives: [],
    });
    const ranked = rankSuggestions(result, {
      mapCenter: { lat: result.lat, lng: result.lng },
      confidenceWeight: 0.7,
    });
    // 0.7 * 0.6 + 0.3 * 1 = 0.42 + 0.3 = 0.72
    expect(ranked[0].rankScore).toBeCloseTo(0.72, 5);
  });

  it('confidenceWeight = 1 collapses to confidence-only ranking', () => {
    const result = makeBase({
      lat: 40.0,
      lng: 22.0,
      confidence: 0.9,
      alternatives: [makeAlt({ lat: 40.0001, lng: 22.0001, confidence: 0.6 })],
    });
    const ranked = rankSuggestions(result, {
      mapCenter: { lat: 40.0001, lng: 22.0001 },
      confidenceWeight: 1,
    });
    expect(ranked[0].candidate.confidence).toBe(0.9);
    expect(ranked[1].candidate.confidence).toBe(0.6);
  });

  it('clamps confidenceWeight outside 0..1 range', () => {
    const result = makeBase({ confidence: 0.5, alternatives: [] });
    // confidenceWeight = 5 → clamps to 1 → rankScore = confidence
    const ranked = rankSuggestions(result, {
      mapCenter: { lat: result.lat, lng: result.lng },
      confidenceWeight: 5,
    });
    expect(ranked[0].rankScore).toBeCloseTo(0.5, 5);
  });
});
