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
  ReverseGeocodingResult,
} from '@/lib/geocoding/geocoding-types';

const logger = createModuleLogger('geocoding-service');

// =============================================================================
// LEGACY TYPE RE-EXPORTS (consumers continue to import from this module)
// =============================================================================

export type {
  StructuredGeocodingQuery,
  GeocodingServiceResult,
  ReverseGeocodingResult,
} from '@/lib/geocoding/geocoding-types';

// =============================================================================
// CACHE
// =============================================================================

const geocodingCache = new Map<string, GeocodingServiceResult>();
const geocodingInFlight = new Map<string, Promise<GeocodingServiceResult | null>>();

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

async function callGeocodingApi(
  query: StructuredGeocodingQuery,
): Promise<GeocodingServiceResult | null> {
  try {
    const response = await fetch(GEOGRAPHIC_CONFIG.GEOCODING.API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });

    if (response.status === 404) {
      // Address not found — not an error, just no result
      return null;
    }

    if (!response.ok) {
      logger.warn('Geocoding API error', { data: { status: response.status } });
      return null;
    }

    const data: GeocodingServiceResult = await response.json();
    return data;
  } catch (error) {
    logger.error('Geocoding API call failed', { error: String(error) });
    return null;
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Geocode a single structured address. Results are cached in-memory for the
 * session lifetime.
 *
 * @param query - Structured address fields
 * @returns Geocoding result (with alternatives and reasoning) or null if not found
 */
export async function geocodeAddress(
  query: StructuredGeocodingQuery,
): Promise<GeocodingServiceResult | null> {
  const cacheKey = getCacheKey(query);

  const cached = geocodingCache.get(cacheKey);
  if (cached) {
    logger.info('Geocoding cache hit', { data: { key: cacheKey } });
    return cached;
  }

  const inFlight = geocodingInFlight.get(cacheKey);
  if (inFlight) {
    logger.info('Geocoding in-flight dedup', { data: { key: cacheKey } });
    return inFlight;
  }

  const promise = callGeocodingApi(query).then((result) => {
    geocodingInFlight.delete(cacheKey);
    if (result) geocodingCache.set(cacheKey, result);
    return result;
  });

  geocodingInFlight.set(cacheKey, promise);
  return promise;
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
