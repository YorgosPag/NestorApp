/**
 * =============================================================================
 * GEOCODING SERVICE — Client-side Service Layer
 * =============================================================================
 *
 * Client-side wrapper around the server-side `/api/geocoding` endpoint.
 * Provides in-memory caching, in-flight deduplication, and reverse-geocoding
 * helpers for the drag-end flow.
 *
 * ADR-332 Phase 0: types extracted to `geocoding-types.ts` (SSoT). The
 * service-level result shape (`GeocodingServiceResult`) is now an alias of
 * the full `GeocodingApiResponse`, so consumers automatically gain access
 * to the new transparency fields (resolvedFields, alternatives, partialMatch,
 * reasoning, source) without any breaking change to existing reads.
 *
 * @module lib/geocoding/geocoding-service
 */

import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { normalizeGreekText } from '@/services/ai-pipeline/shared/greek-text-utils';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  StructuredGeocodingQuery,
  GeocodingServiceResult,
  GeocodingOutcome,
  GeocodingFailureReason,
  ReverseGeocodingResult,
} from '@/lib/geocoding/geocoding-types';

const logger = createModuleLogger('geocoding-service');

// =============================================================================
// LEGACY TYPE RE-EXPORTS (consumers continue to import from this module)
// =============================================================================

export type {
  StructuredGeocodingQuery,
  GeocodingServiceResult,
  GeocodingOutcome,
  GeocodingFailureReason,
  ReverseGeocodingResult,
} from '@/lib/geocoding/geocoding-types';

// =============================================================================
// CACHE
// =============================================================================

/**
 * Only `found` outcomes are cached. A transient 429 or network blip must not
 * pin a permanent "failure" onto an address that would resolve on retry, and a
 * `not-found` is cheap enough to re-ask that caching it would only add a stale
 * negative to invalidate.
 */
const geocodingCache = new Map<string, GeocodingServiceResult>();
const geocodingInFlight = new Map<string, Promise<GeocodingOutcome>>();

function getCacheKey(query: StructuredGeocodingQuery): string {
  return [
    query.street,
    query.city,
    query.county,
    query.municipality,
    query.postalCode,
    query.region,
    query.country,
  ]
    .map(p => (p ? normalizeGreekText(p.trim()) : ''))
    .join('_');
}

// =============================================================================
// API CALL
// =============================================================================

/** Map a non-OK HTTP status onto the failure taxonomy the UI reasons about. */
function classifyStatus(status: number): GeocodingFailureReason {
  if (status === 429) return 'rate-limit';
  if (status === 408 || status === 504) return 'timeout';
  if (status >= 500) return 'server';
  return 'network';
}

/** Map a thrown fetch rejection onto the same taxonomy. */
function classifyThrown(error: unknown): GeocodingFailureReason {
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'timeout';
  if (error instanceof DOMException && error.name === 'AbortError') return 'timeout';
  return 'network';
}

async function callGeocodingApi(
  query: StructuredGeocodingQuery,
): Promise<GeocodingOutcome> {
  try {
    const response = await fetch(GEOGRAPHIC_CONFIG.GEOCODING.API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });

    // 404 is the provider answering "this address is not in my data" — a real
    // answer, not a fault. Everything else non-OK is a genuine malfunction.
    if (response.status === 404) {
      return { kind: 'not-found' };
    }

    if (!response.ok) {
      const reason = classifyStatus(response.status);
      logger.warn('Geocoding API error', { data: { status: response.status, reason } });
      return { kind: 'error', reason };
    }

    const data: GeocodingServiceResult = await response.json();
    return { kind: 'found', result: data };
  } catch (error) {
    const reason = classifyThrown(error);
    logger.error('Geocoding API call failed', { error: String(error), data: { reason } });
    return { kind: 'error', reason };
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Geocode a single structured address, preserving *why* a call produced no
 * result. Successful results are cached in-memory for the session lifetime;
 * in-flight calls for the same key are deduplicated.
 *
 * Prefer this over {@link geocodeAddress} in new code — the boolean-ish `null`
 * contract cannot distinguish "no such address" from "rate limited".
 *
 * @param query - Structured address fields
 * @returns Discriminated outcome: found / not-found / error
 * @see ADR-332 D10
 */
export async function geocodeAddressDetailed(
  query: StructuredGeocodingQuery,
): Promise<GeocodingOutcome> {
  const cacheKey = getCacheKey(query);

  const cached = geocodingCache.get(cacheKey);
  if (cached) {
    logger.info('Geocoding cache hit', { data: { key: cacheKey } });
    return { kind: 'found', result: cached };
  }

  const inFlight = geocodingInFlight.get(cacheKey);
  if (inFlight) {
    logger.info('Geocoding in-flight dedup', { data: { key: cacheKey } });
    return inFlight;
  }

  const promise = callGeocodingApi(query).then((outcome) => {
    geocodingInFlight.delete(cacheKey);
    if (outcome.kind === 'found') geocodingCache.set(cacheKey, outcome.result);
    return outcome;
  });

  geocodingInFlight.set(cacheKey, promise);
  return promise;
}

/**
 * Legacy shape: collapses every non-success outcome to `null`.
 *
 * Retained for consumers that only need coordinates (`useAddressMapGeocoding`,
 * `AddressWithHierarchy`) and share the same cache and in-flight dedup as
 * {@link geocodeAddressDetailed}. New call sites should use the detailed form.
 *
 * @returns Geocoding result, or null when not found *or* the call failed
 */
export async function geocodeAddress(
  query: StructuredGeocodingQuery,
): Promise<GeocodingServiceResult | null> {
  const outcome = await geocodeAddressDetailed(query);
  return outcome.kind === 'found' ? outcome.result : null;
}

/**
 * Reverse geocode coordinates to a structured address. No caching — drag
 * positions are unique per gesture.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
    });

    const response = await fetch(
      `${GEOGRAPHIC_CONFIG.GEOCODING.API_ENDPOINT}/reverse?${params.toString()}`,
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      logger.warn('Reverse geocoding API error', { data: { status: response.status } });
      return null;
    }

    const data: ReverseGeocodingResult = await response.json();
    return data;
  } catch (error) {
    logger.error('Reverse geocoding API call failed', { error: String(error) });
    return null;
  }
}
