/**
 * Unit tests for `geocoding-engine.ts` — ADR-332 Phase 0 multi-result behavior.
 *
 * Verifies:
 *   - Top result includes alternatives (up to 4) from the winning variant
 *   - resolvedFields populated from Nominatim address object
 *   - reasoning.attemptsLog tracks variants attempted (success/no-results/skipped)
 *   - reasoning.fieldMatches matrix correctly classifies match/mismatch/unknown/not-provided
 *   - partialMatch flag set when any user-provided field disagrees with Nominatim
 *   - source.variantUsed identifies which strategy produced the hit
 *
 * @see docs/centralized-systems/reference/adrs/ADR-332-enterprise-address-editor-system.md
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

import { geocode } from '../geocoding-engine';

// =============================================================================
// FETCH MOCK HELPERS
// =============================================================================

interface NominatimMockResult {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
  importance?: number;
  osm_id?: number;
  osm_type?: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

const ORIGINAL_FETCH = global.fetch;

function mockFetchOnce(results: NominatimMockResult[], status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(results),
  } as Response);
}

function mockFetchSequence(...batches: NominatimMockResult[][]) {
  let i = 0;
  return jest.fn().mockImplementation(() => {
    const batch = batches[i] ?? [];
    i++;
    return mockFetchOnce(batch);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  // Speed-up: collapse the 1.2s NOMINATIM_DELAY_MS between variants
  jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
    fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  global.fetch = ORIGINAL_FETCH;
});

// =============================================================================
// FIXTURES
// =============================================================================

function fixtureSamothraki16Top(): NominatimMockResult {
  return {
    lat: '40.6234',
    lon: '22.9456',
    display_name: 'Σαμοθράκης 16, Θεσσαλονίκη 54635, Ελλάδα',
    type: 'building',
    class: 'building',
    importance: 0.42,
    osm_id: 12345678,
    osm_type: 'way',
    address: {
      road: 'Σαμοθράκης',
      house_number: '16',
      city: 'Θεσσαλονίκη',
      postcode: '54635',
      country: 'Ελλάδα',
      state: 'Κεντρική Μακεδονία',
    },
  };
}

function fixtureSamothraki16Alt(postalCode: string, importance: number): NominatimMockResult {
  return {
    lat: '40.6300',
    lon: '22.9500',
    display_name: `Σαμοθράκης 16, Θεσσαλονίκη ${postalCode}, Ελλάδα`,
    type: 'street',
    class: 'highway',
    importance,
    osm_id: 99999000 + Number(postalCode),
    osm_type: 'way',
    address: {
      road: 'Σαμοθράκης',
      house_number: '16',
      city: 'Θεσσαλονίκη',
      postcode: postalCode,
      country: 'Ελλάδα',
      state: 'Κεντρική Μακεδονία',
    },
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('geocode() — ADR-332 Phase 0 multi-result behavior', () => {
  it('returns top result + up to 4 alternatives from the winning variant', async () => {
    global.fetch = mockFetchSequence([
      fixtureSamothraki16Top(),
      fixtureSamothraki16Alt('54249', 0.35),
      fixtureSamothraki16Alt('54100', 0.30),
      fixtureSamothraki16Alt('54622', 0.28),
      fixtureSamothraki16Alt('54006', 0.25),
    ]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης 16',
      city: 'Θεσσαλονίκη',
      postalCode: '54635',
      country: 'Ελλάδα',
    });

    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(40.6234);
    expect(result!.lng).toBeCloseTo(22.9456);
    expect(result!.alternatives).toHaveLength(4);
    expect(result!.alternatives[0].displayName).toContain('54249');
    expect(result!.alternatives[3].displayName).toContain('54006');
  });

  it('populates resolvedFields from Nominatim address block', async () => {
    global.fetch = mockFetchSequence([fixtureSamothraki16Top()]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης 16',
      city: 'Θεσσαλονίκη',
      postalCode: '54635',
    });

    expect(result!.resolvedFields).toEqual({
      street: 'Σαμοθράκης',
      number: '16',
      postalCode: '54635',
      neighborhood: undefined,
      city: 'Θεσσαλονίκη',
      county: undefined,
      region: 'Κεντρική Μακεδονία',
      country: 'Ελλάδα',
    });
  });

  it('builds fieldMatches matrix correctly (match / mismatch / unknown / not-provided)', async () => {
    global.fetch = mockFetchSequence([fixtureSamothraki16Top()]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης',         // matches resolved 'Σαμοθράκης'
      city: 'Καλαμαριά',             // mismatch — resolved is 'Θεσσαλονίκη'
      postalCode: '54635',           // matches
      neighborhood: 'Ξηροκρήνη',     // unknown — Nominatim returned no neighborhood
      // county not provided
    });

    const matches = result!.reasoning.fieldMatches;
    expect(matches.street).toBe('match');
    expect(matches.city).toBe('mismatch');
    expect(matches.postalCode).toBe('match');
    expect(matches.neighborhood).toBe('unknown');
    expect(matches.county).toBe('not-provided');
  });

  it('flags partialMatch=true when any user field disagrees with resolved', async () => {
    global.fetch = mockFetchSequence([fixtureSamothraki16Top()]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης',
      city: 'Καλαμαριά',         // mismatch
      postalCode: '54635',
    });

    expect(result!.partialMatch).toBe(true);
  });

  it('flags partialMatch=false when all user fields match resolved', async () => {
    global.fetch = mockFetchSequence([fixtureSamothraki16Top()]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης',
      city: 'Θεσσαλονίκη',
      postalCode: '54635',
    });

    expect(result!.partialMatch).toBe(false);
  });

  it('records attemptsLog with success on the winning variant (variant 1 OSM-style)', async () => {
    global.fetch = mockFetchSequence([fixtureSamothraki16Top()]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης 16',
      city: 'Θεσσαλονίκη',
      postalCode: '54635',
    });

    const log = result!.reasoning.attemptsLog;
    expect(log).toHaveLength(1);
    expect(log[0].variant).toBe(1);
    expect(log[0].status).toBe('success');
    expect(log[0].i18nKey).toBe('addresses.geocoding.attempts.osmStyle');
  });

  it('records attemptsLog with no-results then success when variant 1 fails and variant 2 hits', async () => {
    global.fetch = mockFetchSequence(
      [],                            // variant 1 — no results
      [fixtureSamothraki16Top()],    // variant 2 — structured success
    ) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης 16',
      city: 'Θεσσαλονίκη',
      postalCode: '54635',
    });

    const log = result!.reasoning.attemptsLog;
    expect(log.length).toBeGreaterThanOrEqual(2);
    expect(log[0].variant).toBe(1);
    expect(log[0].status).toBe('no-results');
    expect(log[1].variant).toBe(2);
    expect(log[1].status).toBe('success');
  });

  it('source.variantUsed reports which variant produced the top result', async () => {
    global.fetch = mockFetchSequence(
      [],                            // 1 fail
      [fixtureSamothraki16Top()],    // 2 success
    ) as typeof fetch;

    const result = await geocode({ street: 'Σαμοθράκης', city: 'Θεσσαλονίκη' });
    expect(result!.source.variantUsed).toBe(2);
    expect(result!.source.provider).toBe('nominatim');
  });

  it('returns null when ALL variants exhausted with no results', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    } as Response) as typeof fetch;

    const result = await geocode({
      street: 'Δεν Υπάρχει 999',
      city: 'Πουθενά',
      postalCode: '99999',
      country: 'Ελλάδα',
    });

    expect(result).toBeNull();
  });

  it('confidence breakdown reflects per-field contribution', async () => {
    global.fetch = mockFetchSequence([fixtureSamothraki16Top()]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης',
      city: 'Θεσσαλονίκη',
      postalCode: '54635',
    });

    const breakdown = result!.reasoning.confidenceBreakdown;
    expect(breakdown.base).toBeGreaterThan(0);
    expect(breakdown.streetMatch).toBeGreaterThan(0);
    expect(breakdown.cityMatch).toBeGreaterThan(0);
    expect(breakdown.postalMatch).toBeGreaterThan(0);
    expect(result!.confidence).toBeGreaterThan(0);
    expect(result!.confidence).toBeLessThanOrEqual(1);
  });

  it('alternatives carry their own resolvedFields and reasoning (with empty attemptsLog)', async () => {
    global.fetch = mockFetchSequence([
      fixtureSamothraki16Top(),
      fixtureSamothraki16Alt('54249', 0.35),
    ]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης',
      city: 'Θεσσαλονίκη',
      postalCode: '54635',
    });

    expect(result!.alternatives).toHaveLength(1);
    const alt = result!.alternatives[0];
    expect(alt.resolvedFields.postalCode).toBe('54249');
    expect(alt.reasoning.attemptsLog).toEqual([]);
    expect(alt.partialMatch).toBe(true); // user postal 54635 ≠ alt 54249
  });
});
