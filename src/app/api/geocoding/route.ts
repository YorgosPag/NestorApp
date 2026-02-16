/**
 * =============================================================================
 * 🗺️ GEOCODING API — Server-side Nominatim Structured Search Proxy
 * =============================================================================
 *
 * Server-side geocoding proxy that:
 * - Uses Nominatim STRUCTURED search (not free-form `q=`)
 * - Sends proper User-Agent header (required by Nominatim TOS)
 * - Multi-variant query strategy: original → accent-stripped → greeklish→greek
 * - Falls back to free-form search if structured fails
 * - Rate limited: withHeavyRateLimit (10 req/min)
 *
 * @module app/api/geocoding/route
 * @see ADR-080 (AI Pipeline), geographic-config.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { normalizeGreekText } from '@/services/ai-pipeline/shared/greek-text-utils';
import { transliterateGreeklish, containsGreek } from '@/services/ai-pipeline/shared/greek-nlp';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('geocoding-api');

// Vercel serverless timeout — structured search + retries can take time
export const maxDuration = 30;

// =============================================================================
// TYPES
// =============================================================================

interface GeocodingRequestBody {
  street?: string;
  city?: string;
  neighborhood?: string;
  postalCode?: string;
  region?: string;
  country?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
  importance?: number;
  boundingbox?: string[];
}

interface GeocodingApiResponse {
  lat: number;
  lng: number;
  accuracy: 'exact' | 'interpolated' | 'approximate' | 'center';
  confidence: number;
  displayName: string;
}

// =============================================================================
// CONFIGURATION (from environment variables)
// =============================================================================

const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const USER_AGENT = process.env.GEOCODING_USER_AGENT || 'NestorPagonisApp/1.0 (geocoding)';
const NOMINATIM_TIMEOUT_MS = parseInt(process.env.GEOCODING_TIMEOUT_MS || '8000', 10);
const DEFAULT_COUNTRY_CODE = GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY_CODE;
const { GEOCODING } = GEOGRAPHIC_CONFIG;

// =============================================================================
// NOMINATIM QUERY HELPERS
// =============================================================================

/**
 * Build Nominatim structured search URL.
 * Uses separate fields (`street`, `city`, `state`, `postalcode`, `country`)
 * instead of a single `q=` parameter for much better accuracy.
 */
function buildStructuredUrl(params: GeocodingRequestBody): string {
  const searchParams = new URLSearchParams({
    format: 'json',
    limit: GEOCODING.NOMINATIM_RESULT_LIMIT,
    countrycodes: DEFAULT_COUNTRY_CODE,
    'accept-language': GEOCODING.ACCEPT_LANGUAGE,
  });

  if (params.street) {
    searchParams.set('street', params.street);
  }
  // If neighborhood is set, use it as the Nominatim `city` parameter.
  // Greek neighborhoods (Εύοσμος, Καλαμαριά, Μαρούσι) are indexed as
  // separate cities/towns in OSM, so this gives precise results.
  // The broader city (Θεσσαλονίκη, Αθήνα) is too wide for disambiguation.
  if (params.neighborhood) {
    searchParams.set('city', params.neighborhood);
  } else if (params.city) {
    searchParams.set('city', params.city);
  }
  if (params.region) {
    searchParams.set('state', params.region);
  }
  if (params.postalCode) {
    searchParams.set('postalcode', params.postalCode);
  }
  // NOTE: Do NOT pass `country` to structured search — Nominatim's structured
  // `country` param requires "Greece" (English/ISO), but we receive "Ελλάδα".
  // The `countrycodes=gr` filter already restricts results to Greece.

  return `${NOMINATIM_BASE_URL}/search?${searchParams.toString()}`;
}

/**
 * Build Nominatim free-form search URL (fallback).
 */
function buildFreeformUrl(query: string): string {
  const searchParams = new URLSearchParams({
    q: query,
    format: 'json',
    limit: GEOCODING.NOMINATIM_RESULT_LIMIT,
    countrycodes: DEFAULT_COUNTRY_CODE,
    'accept-language': GEOCODING.ACCEPT_LANGUAGE,
  });

  return `${NOMINATIM_BASE_URL}/search?${searchParams.toString()}`;
}

/**
 * Fetch from Nominatim with proper User-Agent and timeout.
 */
async function fetchNominatim(url: string): Promise<NominatimResult | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn('Nominatim non-OK response', { data: { status: response.status } });
      return null;
    }

    const data: NominatimResult[] = await response.json();
    return data.length > 0 ? data[0] : null;
  } catch (error) {
    logger.warn('Nominatim fetch error', { error: String(error) });
    return null;
  }
}

/**
 * Determine geocoding accuracy from Nominatim result type.
 */
function determineAccuracy(result: NominatimResult): GeocodingApiResponse['accuracy'] {
  const type = result.type ?? result.class ?? '';
  if (type === 'house' || type === 'building') return 'exact';
  if (type === 'street' || type === 'road') return 'interpolated';
  if (type === 'suburb' || type === 'neighbourhood' || type === 'residential') return 'approximate';
  return 'center';
}

/**
 * Calculate confidence score based on how many of our search terms appear
 * in the Nominatim display_name.
 */
function calculateConfidence(
  result: NominatimResult,
  params: GeocodingRequestBody
): number {
  let score = GEOCODING.CONFIDENCE.BASE;
  const display = normalizeGreekText(result.display_name);

  if (params.street && display.includes(normalizeGreekText(params.street))) {
    score += GEOCODING.CONFIDENCE.STREET_MATCH;
  }
  if (params.neighborhood && display.includes(normalizeGreekText(params.neighborhood))) {
    score += GEOCODING.CONFIDENCE.CITY_MATCH;
  } else if (params.city && display.includes(normalizeGreekText(params.city))) {
    score += GEOCODING.CONFIDENCE.CITY_MATCH;
  }
  if (params.postalCode && display.includes(params.postalCode)) {
    score += GEOCODING.CONFIDENCE.POSTAL_MATCH;
  }

  return Math.min(score, 1);
}

/**
 * Build a free-form query string from structured params.
 * Omits `country` — `countrycodes=gr` already restricts to Greece,
 * and "Ελλάδα" can confuse Nominatim's free-form parser.
 */
function toFreeformQuery(params: GeocodingRequestBody): string {
  // Prefer neighborhood over city for free-form (more specific locality)
  const locality = params.neighborhood || params.city;
  return [params.street, locality, params.postalCode, params.region]
    .filter(Boolean)
    .join(', ');
}

/**
 * Create accent-stripped variant of the search parameters.
 */
function createAccentStrippedVariant(params: GeocodingRequestBody): GeocodingRequestBody {
  return {
    street: params.street ? normalizeGreekText(params.street) : undefined,
    city: params.city ? normalizeGreekText(params.city) : undefined,
    neighborhood: params.neighborhood ? normalizeGreekText(params.neighborhood) : undefined,
    postalCode: params.postalCode,
    region: params.region ? normalizeGreekText(params.region) : undefined,
    country: params.country,
  };
}

/**
 * If input contains Greeklish, transliterate to Greek.
 */
function createGreeklishVariant(params: GeocodingRequestBody): GeocodingRequestBody | null {
  const hasNonGreek =
    (params.street && !containsGreek(params.street)) ||
    (params.city && !containsGreek(params.city)) ||
    (params.neighborhood && !containsGreek(params.neighborhood));

  if (!hasNonGreek) return null;

  return {
    street: params.street && !containsGreek(params.street)
      ? transliterateGreeklish(params.street)
      : params.street,
    city: params.city && !containsGreek(params.city)
      ? transliterateGreeklish(params.city)
      : params.city,
    neighborhood: params.neighborhood && !containsGreek(params.neighborhood)
      ? transliterateGreeklish(params.neighborhood)
      : params.neighborhood,
    postalCode: params.postalCode,
    region: params.region && !containsGreek(params.region)
      ? transliterateGreeklish(params.region)
      : params.region,
    country: params.country,
  };
}

// =============================================================================
// MAIN GEOCODING LOGIC
// =============================================================================

/**
 * Multi-variant geocoding strategy:
 * 1. Structured search (original)
 * 2. Structured search (accent-stripped)
 * 3. Structured search (greeklish→greek)
 * 4. Free-form fallback (original query string)
 */
async function geocode(params: GeocodingRequestBody): Promise<GeocodingApiResponse | null> {
  // --- Variant 1: Original structured search ---
  const structuredUrl = buildStructuredUrl(params);
  logger.info('Geocoding attempt 1: structured (original)', { data: { url: structuredUrl } });
  let result = await fetchNominatim(structuredUrl);

  if (result) {
    return formatResult(result, params);
  }

  // --- Variant 1b: Hyphen-normalized city/neighborhood ---
  // Greek compound names use hyphens (e.g. "Ελευθέριο-Κορδελιό") but
  // Nominatim may store them with spaces.
  const hasHyphen =
    (params.city && params.city.includes('-')) ||
    (params.neighborhood && params.neighborhood.includes('-'));
  if (hasHyphen) {
    const dehyphenated: GeocodingRequestBody = {
      ...params,
      city: params.city?.replace(/-/g, ' '),
      neighborhood: params.neighborhood?.replace(/-/g, ' '),
    };
    const dehyphenUrl = buildStructuredUrl(dehyphenated);
    logger.info('Geocoding attempt 1b: structured (dehyphenated)');
    await sleep(GEOCODING.NOMINATIM_DELAY_MS);
    result = await fetchNominatim(dehyphenUrl);

    if (result) {
      return formatResult(result, params);
    }
  }

  // --- Variant 2: Accent-stripped structured search ---
  const stripped = createAccentStrippedVariant(params);
  const strippedUrl = buildStructuredUrl(stripped);
  logger.info('Geocoding attempt 2: structured (accent-stripped)');
  await sleep(GEOCODING.NOMINATIM_DELAY_MS);
  result = await fetchNominatim(strippedUrl);

  if (result) {
    return formatResult(result, params);
  }

  // --- Variant 3: Greeklish→Greek ---
  const greeklishVariant = createGreeklishVariant(params);
  if (greeklishVariant) {
    const greeklishUrl = buildStructuredUrl(greeklishVariant);
    logger.info('Geocoding attempt 3: structured (greeklish→greek)');
    await sleep(GEOCODING.NOMINATIM_DELAY_MS);
    result = await fetchNominatim(greeklishUrl);

    if (result) {
      return formatResult(result, params);
    }
  }

  // --- Variant 4: Free-form fallback ---
  const freeformQuery = toFreeformQuery(params);
  if (freeformQuery.trim()) {
    const freeformUrl = buildFreeformUrl(freeformQuery);
    logger.info('Geocoding attempt 4: free-form fallback', { data: { query: freeformQuery } });
    await sleep(GEOCODING.NOMINATIM_DELAY_MS);
    result = await fetchNominatim(freeformUrl);

    if (result) {
      return formatResult(result, params);
    }
  }

  logger.warn('All geocoding variants failed', { data: { params } });
  return null;
}

function formatResult(result: NominatimResult, params: GeocodingRequestBody): GeocodingApiResponse {
  return {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    accuracy: determineAccuracy(result),
    confidence: calculateConfidence(result, params),
    displayName: result.display_name,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// VALIDATION
// =============================================================================

function validateRequestBody(body: unknown): body is GeocodingRequestBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;

  // At least one of street/city/postalCode must be present
  const hasSearchField =
    (typeof b.street === 'string' && b.street.trim().length > 0) ||
    (typeof b.city === 'string' && b.city.trim().length > 0) ||
    (typeof b.postalCode === 'string' && b.postalCode.trim().length > 0);

  if (!hasSearchField) return false;

  // All fields must be string or undefined
  for (const key of ['street', 'city', 'neighborhood', 'postalCode', 'region', 'country']) {
    if (b[key] !== undefined && typeof b[key] !== 'string') return false;
  }

  return true;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

async function handlePost(request: NextRequest): Promise<Response> {
  try {
    const body: unknown = await request.json();

    if (!validateRequestBody(body)) {
      return NextResponse.json(
        { error: 'Invalid request. At least one of street, city, or postalCode is required.' },
        { status: 400 }
      );
    }

    const result = await geocode(body);

    if (!result) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Geocoding API error', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withHeavyRateLimit(handlePost);
