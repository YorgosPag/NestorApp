/**
 * Unit tests for `geocoding-engine.ts` — query shaping + country integrity.
 *
 * These pin behaviour that was measured against live Nominatim on 2026-07-26,
 * where the previous shaping produced empty or foreign results for real Greek
 * addresses:
 *   - the house number must reach the provider (without it, `accuracy: 'exact'`
 *     is unreachable — the best possible answer is the street centreline)
 *   - `postalcode` must NOT be a structured parameter: as a filter it only ever
 *     subtracts (`street=Τσιμισκή 43 & city=Θεσσαλονίκη` matches; adding
 *     `postalcode` in either `54623` or `546 23` form returns an empty set)
 *   - a candidate outside the user's declared country must never read as
 *     verified (`{Ονειροπόλων, 54624, Ελλάδα}` returned Wisconsin at 0.55)
 *
 * @see ADR-332 D12 (country integrity), D13 (postal code out of structured params),
 *      D14 (house number reaches the provider)
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

import { geocode } from '../geocoding-engine';

// =============================================================================
// MOCK HARNESS
// =============================================================================

interface NominatimMockResult {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

const ORIGINAL_FETCH = global.fetch;

/** Every variant returns the same batch — enough to assert on URL shape. */
function mockFetchAlways(results: NominatimMockResult[]): jest.Mock {
  return jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(results),
    } as Response),
  );
}

/**
 * Requested URLs, readable. `URLSearchParams` encodes spaces as `+`, which
 * `decodeURIComponent` leaves alone — so assertions on human-shaped queries
 * ("Τσιμισκή 43") need the plus restored first.
 */
function requestedUrls(fetchMock: jest.Mock): string[] {
  return fetchMock.mock.calls.map((call) =>
    decodeURIComponent(String(call[0]).replace(/\+/g, ' ')),
  );
}

beforeEach(() => {
  // Collapse the inter-variant courtesy delay so the suite stays fast.
  jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
    fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout);
});

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = ORIGINAL_FETCH;
});

// =============================================================================
// FIXTURES
// =============================================================================

function greekHit(): NominatimMockResult {
  return {
    lat: '40.6308',
    lon: '22.9430',
    display_name: 'Ιωάννη Τσιμισκή 43, Θεσσαλονίκη, 546 23, Ελλάδα',
    type: 'building',
    class: 'building',
    address: {
      road: 'Ιωάννη Τσιμισκή',
      house_number: '43',
      city: 'Θεσσαλονίκη',
      postcode: '546 23',
      country: 'Ελλάδα',
      country_code: 'gr',
    },
  };
}

/** The Wisconsin postcode that a lifted country restriction actually surfaced. */
function foreignHit(): NominatimMockResult {
  return {
    lat: '43.4604057',
    lon: '-91.160649',
    display_name: '54624, Town of Wheatland, Vernon County, Wisconsin, USA',
    type: 'postcode',
    class: 'place',
    address: {
      postcode: '54624',
      city: 'Town of Wheatland',
      country: 'Ηνωμένες Πολιτείες της Αμερικής',
      country_code: 'us',
    },
  };
}

const GREEK_QUERY = {
  street: 'Τσιμισκή',
  number: '43',
  city: 'Θεσσαλονίκη',
  postalCode: '54623',
  country: 'Ελλάδα',
};

// =============================================================================
// HOUSE NUMBER REACHES THE PROVIDER
// =============================================================================

describe('house number', () => {
  it('reaches the free-form query in Greek written order, comma separated', async () => {
    const fetchMock = mockFetchAlways([greekHit()]);
    global.fetch = fetchMock as unknown as typeof fetch;

    await geocode(GREEK_QUERY);

    const first = requestedUrls(fetchMock)[0];
    expect(first).toContain('Τσιμισκή 43');
    expect(first).toContain('Τσιμισκή 43, Θεσσαλονίκη');
  });

  it('reaches the structured query in Nominatim slot order (number first)', async () => {
    // Force the run past variant 1 so a structured URL is actually built.
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) } as Response),
      )
      .mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([greekHit()]),
        } as Response),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    await geocode(GREEK_QUERY);

    const structured = requestedUrls(fetchMock)[1];
    expect(structured).toContain('street=43 Τσιμισκή');
  });

  it('leaves the street bare when no number was entered', async () => {
    const fetchMock = mockFetchAlways([greekHit()]);
    global.fetch = fetchMock as unknown as typeof fetch;

    await geocode({ ...GREEK_QUERY, number: undefined });

    const first = requestedUrls(fetchMock)[0];
    expect(first).toContain('Τσιμισκή, Θεσσαλονίκη');
    expect(first).not.toContain('Τσιμισκή 43');
  });
});

// =============================================================================
// POSTAL CODE IS NOT A STRUCTURED FILTER
// =============================================================================

describe('postal code', () => {
  it('is never sent as a structured `postalcode` parameter', async () => {
    const fetchMock = mockFetchAlways([]);
    global.fetch = fetchMock as unknown as typeof fetch;

    await geocode(GREEK_QUERY);

    for (const url of requestedUrls(fetchMock)) {
      expect(url).not.toContain('postalcode=');
    }
  });

  it('still participates in free-form queries, where it helps', async () => {
    const fetchMock = mockFetchAlways([greekHit()]);
    global.fetch = fetchMock as unknown as typeof fetch;

    await geocode(GREEK_QUERY);

    expect(requestedUrls(fetchMock)[0]).toContain('54623');
  });
});

// =============================================================================
// COUNTRY INTEGRITY
// =============================================================================

describe('country integrity', () => {
  it('flags a result outside the declared country and zeroes its confidence', async () => {
    global.fetch = mockFetchAlways([foreignHit()]) as unknown as typeof fetch;

    const result = await geocode({
      street: 'Ονειροπόλων',
      postalCode: '54624',
      country: 'Ελλάδα',
    });

    expect(result).not.toBeNull();
    expect(result?.outOfDeclaredCountry).toBe(true);
    expect(result?.confidence).toBe(0);
  });

  it('leaves a result inside the declared country untouched', async () => {
    global.fetch = mockFetchAlways([greekHit()]) as unknown as typeof fetch;

    const result = await geocode(GREEK_QUERY);

    expect(result?.outOfDeclaredCountry).toBeUndefined();
    expect(result?.confidence).toBeGreaterThan(0);
  });

  it.each([
    ['accented (NFC)', 'Ελλάδα'],
    ['all caps, unaccented', 'ΕΛΛΑΔΑ'],
    ['lowercase, unaccented', 'ελλαδα'],
    ['archaic', 'ΕΛΛΑΣ'],
    ['English', 'Greece'],
    ['ISO code', 'gr'],
    ['padded', '  Ελλάδα  '],
    // α + U+0301 combining acute — what macOS and iOS put on the clipboard.
    ['decomposed (NFD)', 'Ελλάδα'],
  ])('resolves %s country name, so the restriction is applied', async (_label, country) => {
    const fetchMock = mockFetchAlways([greekHit()]);
    global.fetch = fetchMock as unknown as typeof fetch;

    await geocode({ ...GREEK_QUERY, country });

    expect(requestedUrls(fetchMock)[0]).toContain('countrycodes=gr');
  });

  it('leaves an unrecognised country name unrestricted rather than guessing', async () => {
    const fetchMock = mockFetchAlways([greekHit()]);
    global.fetch = fetchMock as unknown as typeof fetch;

    await geocode({ ...GREEK_QUERY, country: 'Ατλαντίδα' });

    expect(requestedUrls(fetchMock)[0]).not.toContain('countrycodes=');
  });

  it('stays silent when the user declared no country — nothing to contradict', async () => {
    global.fetch = mockFetchAlways([foreignHit()]) as unknown as typeof fetch;

    const result = await geocode({ street: 'Ονειροπόλων', postalCode: '54624' });

    expect(result?.outOfDeclaredCountry).toBeUndefined();
  });
});
