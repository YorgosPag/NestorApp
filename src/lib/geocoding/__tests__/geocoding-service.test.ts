/**
 * Unit tests for `geocoding-service.ts` — the outcome contract.
 *
 * The service used to return `T | null`, which collapsed "the provider has no
 * such address" and "the request failed" into one value. Downstream that became
 * a single UI state — "Σφάλμα αναζήτησης" — so a working geocoder answering
 * honestly about a fictional street was indistinguishable from an outage, and a
 * real rate-limit was indistinguishable from a typo.
 *
 * @see ADR-332 D11
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

import {
  geocodeAddressDetailed,
  geocodeAddress,
} from '../geocoding-service';
import type { StructuredGeocodingQuery } from '../geocoding-types';

const ORIGINAL_FETCH = global.fetch;

function respondWith(status: number, body: unknown = {}): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response) as unknown as typeof fetch;
}

function rejectWith(error: unknown): void {
  global.fetch = jest.fn().mockRejectedValue(error) as unknown as typeof fetch;
}

/**
 * Successful results are cached for the module lifetime, so every test needs a
 * query no other test has used.
 */
let uniqueSeed = 0;
function freshQuery(): StructuredGeocodingQuery {
  uniqueSeed += 1;
  return { street: `Δοκιμαστική ${uniqueSeed}`, city: 'Θεσσαλονίκη' };
}

const FOUND_BODY = {
  lat: 40.63,
  lng: 22.94,
  accuracy: 'center',
  confidence: 0.8,
  displayName: 'Δοκιμαστική, Θεσσαλονίκη, Ελλάδα',
  resolvedFields: {},
  partialMatch: false,
  reasoning: { fieldMatches: {}, attemptsLog: [], confidenceBreakdown: {} },
  alternatives: [],
  source: { provider: 'nominatim', variantUsed: 1 },
};

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = ORIGINAL_FETCH;
});

// =============================================================================
// NOT FOUND IS NOT AN ERROR
// =============================================================================

describe('geocodeAddressDetailed', () => {
  it('reports 404 as not-found, not as an error', async () => {
    respondWith(404, { error: 'Address not found' });

    const outcome = await geocodeAddressDetailed(freshQuery());

    expect(outcome).toEqual({ kind: 'not-found' });
  });

  it('returns the result on success', async () => {
    respondWith(200, FOUND_BODY);

    const outcome = await geocodeAddressDetailed(freshQuery());

    expect(outcome.kind).toBe('found');
    if (outcome.kind !== 'found') throw new Error('expected found');
    expect(outcome.result.displayName).toBe(FOUND_BODY.displayName);
  });

  it.each([
    [429, 'rate-limit'],
    [500, 'server'],
    [502, 'server'],
    [408, 'timeout'],
    [504, 'timeout'],
    [400, 'network'],
  ] as const)('classifies HTTP %s as %s', async (status, reason) => {
    respondWith(status, { error: 'nope' });

    const outcome = await geocodeAddressDetailed(freshQuery());

    expect(outcome).toEqual({ kind: 'error', reason });
  });

  it('classifies an aborted request as a timeout', async () => {
    rejectWith(new DOMException('aborted', 'AbortError'));

    const outcome = await geocodeAddressDetailed(freshQuery());

    expect(outcome).toEqual({ kind: 'error', reason: 'timeout' });
  });

  it('classifies a thrown fetch as a network failure', async () => {
    rejectWith(new TypeError('Failed to fetch'));

    const outcome = await geocodeAddressDetailed(freshQuery());

    expect(outcome).toEqual({ kind: 'error', reason: 'network' });
  });

  it('never throws — the reason travels in the outcome', async () => {
    rejectWith(new Error('boom'));

    await expect(geocodeAddressDetailed(freshQuery())).resolves.toBeDefined();
  });
});

// =============================================================================
// CACHING — successes only
// =============================================================================

describe('caching', () => {
  it('serves a repeated success from cache without a second request', async () => {
    respondWith(200, FOUND_BODY);
    const query = freshQuery();

    await geocodeAddressDetailed(query);
    await geocodeAddressDetailed(query);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failure — a transient outage must not pin the address', async () => {
    const query = freshQuery();
    respondWith(429, { error: 'slow down' });
    await geocodeAddressDetailed(query);

    respondWith(200, FOUND_BODY);
    const retry = await geocodeAddressDetailed(query);

    expect(retry.kind).toBe('found');
  });

  it('does not cache a not-found either', async () => {
    const query = freshQuery();
    respondWith(404, {});
    await geocodeAddressDetailed(query);

    respondWith(200, FOUND_BODY);
    const retry = await geocodeAddressDetailed(query);

    expect(retry.kind).toBe('found');
  });
});

// =============================================================================
// LEGACY WRAPPER
// =============================================================================

describe('geocodeAddress (legacy)', () => {
  it('still collapses both non-success outcomes to null', async () => {
    respondWith(404, {});
    await expect(geocodeAddress(freshQuery())).resolves.toBeNull();

    respondWith(500, {});
    await expect(geocodeAddress(freshQuery())).resolves.toBeNull();
  });

  it('returns the result on success', async () => {
    respondWith(200, FOUND_BODY);

    await expect(geocodeAddress(freshQuery())).resolves.toMatchObject({
      displayName: FOUND_BODY.displayName,
    });
  });
});
