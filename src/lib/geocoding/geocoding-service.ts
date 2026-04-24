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
  /** Neighborhood / area — more specific than city (e.g. "Εύοσμος" within "Θεσσαλονίκη") */
  neighborhood?: string;
  postalCode?: string;
  /** Regional Unit / Π.Ε. — maps to Nominatim `county` (e.g. "Π.Ε. Θεσσαλονίκης") */
  county?: string;
  /** Municipality / Δήμος (e.g. "Δήμος Καλαμαριάς") — used for free-form fallback */
  municipality?: string;
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
  /** City/town/village resolved by Nominatim — for auto-fill */
  resolvedCity?: string;
}

/**
 * Reverse geocoding result — structured address data from coordinates.
 * Returned by the /api/geocoding/reverse endpoint.
 */
export interface ReverseGeocodingResult {
  street: string;
  number: string;
  city: string;
  neighborhood: string;
  postalCode: string;
  region: string;
  country: string;
  displayName: string;
  lat: number;
  lng: number;
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
 * Reverse geocode coordinates to a structured address.
 * Calls the server-side /api/geocoding/reverse endpoint.
 * No caching — drag positions are unique.
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Structured address or null if not found
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
    });

    const response = await fetch(
      `${GEOGRAPHIC_CONFIG.GEOCODING.API_ENDPOINT}/reverse?${params.toString()}`
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
