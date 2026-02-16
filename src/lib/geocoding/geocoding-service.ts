/**
 * =============================================================================
 * 🗺️ GEOCODING SERVICE — Client-side Service Layer
 * =============================================================================
 *
 * Client-side service that calls the server-side `/api/geocoding` endpoint.
 * Provides in-memory caching and batch geocoding with rate-limit awareness.
 *
 * Features:
 * - Structured geocoding via server-side Nominatim proxy
 * - In-memory cache with normalized keys (accent-insensitive)
 * - Batch geocoding with sequential 1.2s delays (Nominatim TOS)
 * - Reuses normalizeGreekText for cache key generation
 *
 * @module lib/geocoding/geocoding-service
 */

import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { normalizeGreekText } from '@/services/ai-pipeline/shared/greek-text-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('geocoding-service');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Structured geocoding query — used by formatAddressForGeocoding()
 * and the /api/geocoding endpoint.
 */
export interface StructuredGeocodingQuery {
  street?: string;
  city?: string;
  postalCode?: string;
  region?: string;
  country?: string;
}

/**
 * Geocoding result returned by the service.
 */
export interface GeocodingServiceResult {
  lat: number;
  lng: number;
  accuracy: 'exact' | 'interpolated' | 'approximate' | 'center';
  confidence: number;
  displayName: string;
}

// =============================================================================
// CACHE
// =============================================================================

const geocodingCache = new Map<string, GeocodingServiceResult>();

/**
 * Generate a cache key from a structured query.
 * Uses normalizeGreekText for accent-insensitive matching.
 */
function getCacheKey(query: StructuredGeocodingQuery): string {
  return [
    query.street,
    query.city,
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

/**
 * Call the server-side geocoding endpoint.
 */
async function callGeocodingApi(
  query: StructuredGeocodingQuery
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
 * Geocode a single structured address.
 * Results are cached in-memory for the session.
 *
 * @param query - Structured address fields
 * @returns Geocoding result or null if not found
 */
export async function geocodeAddress(
  query: StructuredGeocodingQuery
): Promise<GeocodingServiceResult | null> {
  const cacheKey = getCacheKey(query);

  // Check cache
  const cached = geocodingCache.get(cacheKey);
  if (cached) {
    logger.info('Geocoding cache hit', { data: { key: cacheKey } });
    return cached;
  }

  // Call API
  const result = await callGeocodingApi(query);

  // Cache successful results
  if (result) {
    geocodingCache.set(cacheKey, result);
  }

  return result;
}

/**
 * Geocode multiple addresses sequentially with delay.
 * Respects Nominatim's 1 req/s rate limit by spacing requests 1.2s apart.
 *
 * @param queries - Array of structured address queries
 * @returns Array of results (null for failed lookups)
 */
export async function geocodeAddressBatch(
  queries: StructuredGeocodingQuery[]
): Promise<(GeocodingServiceResult | null)[]> {
  const results: (GeocodingServiceResult | null)[] = [];

  for (let i = 0; i < queries.length; i++) {
    // Delay between requests (except the first one)
    // Note: Cache hits don't trigger API calls, so delay is only for actual requests
    if (i > 0) {
      const prevCacheKey = getCacheKey(queries[i - 1]);
      const wasCacheHit = geocodingCache.has(prevCacheKey);
      if (!wasCacheHit) {
        await new Promise(resolve => setTimeout(resolve, GEOGRAPHIC_CONFIG.GEOCODING.BATCH_DELAY_MS));
      }
    }

    results.push(await geocodeAddress(queries[i]));
  }

  return results;
}

/**
 * Clear the in-memory geocoding cache.
 */
export function clearGeocodingCache(): void {
  geocodingCache.clear();
}

/**
 * Get geocoding cache statistics.
 */
export function getGeocodingCacheStats(): { size: number; keys: string[] } {
  return {
    size: geocodingCache.size,
    keys: Array.from(geocodingCache.keys()),
  };
}
