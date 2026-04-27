/**
 * Nominatim geocoding engine — multi-variant search strategy.
 * Extracted from route.ts for Google SRP compliance (<300 lines for API routes).
 * @see route.ts — thin handler that calls geocode()
 */

import { sleep } from '@/lib/async-utils';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { normalizeGreekText } from '@/services/ai-pipeline/shared/greek-text-utils';
import { transliterateGreeklish, containsGreek } from '@/services/ai-pipeline/shared/greek-nlp';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('geocoding-api');

// =============================================================================
// TYPES
// =============================================================================

export interface GeocodingRequestBody {
  street?: string;
  city?: string;
  neighborhood?: string;
  postalCode?: string;
  /** Regional Unit / Π.Ε. — maps to Nominatim `county` parameter */
  county?: string;
  /** Municipality / Δήμος — used in free-form fallback for disambiguation */
  municipality?: string;
  region?: string;
  country?: string;
}

export interface GeocodingApiResponse {
  lat: number;
  lng: number;
  accuracy: 'exact' | 'interpolated' | 'approximate' | 'center';
  confidence: number;
  displayName: string;
  /** City/town/village resolved by Nominatim — for auto-fill */
  resolvedCity?: string;
}

interface NominatimAddress {
  road?: string;
  house_number?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
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
  address?: NominatimAddress;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const USER_AGENT = process.env.GEOCODING_USER_AGENT || 'NestorPagonisApp/1.0 (geocoding)';
const NOMINATIM_TIMEOUT_MS = parseInt(process.env.GEOCODING_TIMEOUT_MS || '8000', 10);
const DEFAULT_COUNTRY_CODE = GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY_CODE;
const { GEOCODING } = GEOGRAPHIC_CONFIG;

// Country name (Greek + English variants) → ISO 3166-1 alpha-2 code.
// Unknown country → null → omit countrycodes → global Nominatim search.
const COUNTRY_CODE_MAP: Record<string, string> = {
  // ISO 3166-1 alpha-2 codes (returned by AI as-is)
  gr: 'gr', bg: 'bg', cy: 'cy', al: 'al', mk: 'mk', ro: 'ro',
  de: 'de', it: 'it', fr: 'fr', gb: 'gb', uk: 'gb', tr: 'tr', rs: 'rs',
  // Country names (Greek + English variants)
  greece: 'gr', 'ελλάδα': 'gr', 'ελλας': 'gr', hellas: 'gr',
  bulgaria: 'bg', 'βουλγαρία': 'bg', 'βουλγαρια': 'bg',
  cyprus: 'cy', 'κύπρος': 'cy', 'κυπρος': 'cy',
  albania: 'al', 'αλβανία': 'al', 'north macedonia': 'mk', 'βόρεια μακεδονία': 'mk',
  romania: 'ro', 'ρουμανία': 'ro', germany: 'de', 'γερμανία': 'de',
  italy: 'it', 'ιταλία': 'it', france: 'fr', 'γαλλία': 'fr',
  'united kingdom': 'gb', turkey: 'tr', 'τουρκία': 'tr', serbia: 'rs',
};

function countryNameToCode(country: string | undefined): string | null {
  if (!country) return DEFAULT_COUNTRY_CODE;
  return COUNTRY_CODE_MAP[country.toLowerCase().trim()] ?? null;
}

// =============================================================================
// SANITIZATION
// =============================================================================

function sanitizeStr(v: string | undefined): string | undefined {
  return !v || v === 'null' || v === 'undefined' ? undefined : v;
}

export function sanitizeQuery(body: GeocodingRequestBody): GeocodingRequestBody {
  return {
    street: sanitizeStr(body.street), city: sanitizeStr(body.city),
    neighborhood: sanitizeStr(body.neighborhood), postalCode: sanitizeStr(body.postalCode),
    county: sanitizeStr(body.county), municipality: sanitizeStr(body.municipality),
    region: sanitizeStr(body.region), country: sanitizeStr(body.country),
  };
}

// =============================================================================
// NOMINATIM URL BUILDERS
// =============================================================================

function buildStructuredUrl(params: GeocodingRequestBody, countryCode: string | null): string {
  const searchParams = new URLSearchParams({
    format: 'json', addressdetails: '1',
    limit: GEOCODING.NOMINATIM_RESULT_LIMIT, 'accept-language': GEOCODING.ACCEPT_LANGUAGE,
  });
  if (countryCode) searchParams.set('countrycodes', countryCode);
  if (params.street) searchParams.set('street', params.street);
  // Neighborhood preferred over city — Greek neighborhoods are indexed as distinct OSM cities
  if (params.neighborhood) searchParams.set('city', params.neighborhood);
  else if (params.city) searchParams.set('city', params.city);
  if (params.county) searchParams.set('county', params.county);
  if (params.region) searchParams.set('state', params.region);
  if (params.postalCode) searchParams.set('postalcode', params.postalCode);
  // NOTE: Do NOT pass `country` field — Nominatim structured requires English/ISO,
  // but we receive "Ελλάδα". countrycodes already restricts the search.
  return `${NOMINATIM_BASE_URL}/search?${searchParams.toString()}`;
}

function buildFreeformUrl(query: string, countryCode: string | null): string {
  const searchParams = new URLSearchParams({
    q: query, format: 'json', addressdetails: '1',
    limit: GEOCODING.NOMINATIM_RESULT_LIMIT, 'accept-language': GEOCODING.ACCEPT_LANGUAGE,
  });
  if (countryCode) searchParams.set('countrycodes', countryCode);
  return `${NOMINATIM_BASE_URL}/search?${searchParams.toString()}`;
}

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
    logger.warn('Nominatim fetch error', { error: getErrorMessage(error) });
    return null;
  }
}

// =============================================================================
// RESULT HELPERS
// =============================================================================

function determineAccuracy(result: NominatimResult): GeocodingApiResponse['accuracy'] {
  const type = result.type ?? result.class ?? '';
  if (type === 'house' || type === 'building') return 'exact';
  if (type === 'street' || type === 'road') return 'interpolated';
  if (type === 'suburb' || type === 'neighbourhood' || type === 'residential') return 'approximate';
  return 'center';
}

function calculateConfidence(result: NominatimResult, params: GeocodingRequestBody): number {
  let score = GEOCODING.CONFIDENCE.BASE;
  const display = normalizeGreekText(result.display_name);
  if (params.street && display.includes(normalizeGreekText(params.street))) score += GEOCODING.CONFIDENCE.STREET_MATCH;
  if (params.neighborhood && display.includes(normalizeGreekText(params.neighborhood))) {
    score += GEOCODING.CONFIDENCE.CITY_MATCH;
  } else if (params.city && display.includes(normalizeGreekText(params.city))) {
    score += GEOCODING.CONFIDENCE.CITY_MATCH;
  }
  if (params.county && display.includes(normalizeGreekText(params.county))) score += GEOCODING.CONFIDENCE.CITY_MATCH * 0.5;
  if (params.municipality && display.includes(normalizeGreekText(params.municipality))) score += GEOCODING.CONFIDENCE.CITY_MATCH * 0.3;
  if (params.postalCode && display.includes(params.postalCode)) score += GEOCODING.CONFIDENCE.POSTAL_MATCH;
  return Math.min(score, 1);
}

function formatResult(result: NominatimResult, params: GeocodingRequestBody): GeocodingApiResponse {
  const addr = result.address;
  const resolvedCity = addr?.suburb || addr?.city || addr?.town || addr?.village || addr?.hamlet || undefined;
  return {
    lat: parseFloat(result.lat), lng: parseFloat(result.lon),
    accuracy: determineAccuracy(result), confidence: calculateConfidence(result, params),
    displayName: result.display_name, resolvedCity,
  };
}

// =============================================================================
// SEARCH VARIANTS
// =============================================================================

function toOsmStyleQuery(params: GeocodingRequestBody): string {
  if (params.street) return [params.street, params.postalCode].filter(Boolean).join(' ');
  const locality = params.neighborhood || params.city;
  return [locality?.replace(/-/g, ' '), params.postalCode].filter(Boolean).join(', ');
}

function toFreeformQuery(params: GeocodingRequestBody): string {
  const locality = params.neighborhood || params.city;
  return [params.street, locality, params.municipality, params.county, params.postalCode, params.region]
    .filter(Boolean).join(', ');
}

function createAccentStrippedVariant(params: GeocodingRequestBody): GeocodingRequestBody {
  const n = (v: string | undefined) => v ? normalizeGreekText(v) : undefined;
  return {
    street: n(params.street), city: n(params.city), neighborhood: n(params.neighborhood),
    postalCode: params.postalCode, county: n(params.county),
    municipality: n(params.municipality), region: n(params.region), country: params.country,
  };
}

function createGreeklishVariant(params: GeocodingRequestBody): GeocodingRequestBody | null {
  const hasNonGreek =
    (params.street && !containsGreek(params.street)) ||
    (params.city && !containsGreek(params.city)) ||
    (params.neighborhood && !containsGreek(params.neighborhood));
  if (!hasNonGreek) return null;
  const tr = (v: string | undefined) => v && !containsGreek(v) ? transliterateGreeklish(v) : v;
  return {
    street: tr(params.street), city: tr(params.city), neighborhood: tr(params.neighborhood),
    postalCode: params.postalCode, county: params.county, municipality: params.municipality,
    region: tr(params.region), country: params.country,
  };
}

// =============================================================================
// MAIN — multi-variant geocoding
// =============================================================================

/**
 * Geocode a structured address using 6 Nominatim variants:
 * 1. OSM-style free-form  2. Structured  3. Dehyphenated
 * 4. Accent-stripped      5. Greeklish→Greek (Greek only)  6. Full free-form
 */
export async function geocode(rawParams: GeocodingRequestBody): Promise<GeocodingApiResponse | null> {
  const params = sanitizeQuery(rawParams);
  const cc = countryNameToCode(params.country); // null = unknown → global search

  const osmQuery = toOsmStyleQuery(params);
  if (osmQuery.trim()) {
    logger.info('Geocoding attempt 1: OSM-style free-form', { data: { query: osmQuery } });
    const r = await fetchNominatim(buildFreeformUrl(osmQuery, cc));
    if (r) return formatResult(r, params);
  }

  await sleep(GEOCODING.NOMINATIM_DELAY_MS);
  const structuredUrl = buildStructuredUrl(params, cc);
  logger.info('Geocoding attempt 2: structured (original)', { data: { url: structuredUrl } });
  let result = await fetchNominatim(structuredUrl);
  if (result) return formatResult(result, params);

  if (params.city?.includes('-') || params.neighborhood?.includes('-')) {
    const dh: GeocodingRequestBody = { ...params, city: params.city?.replace(/-/g, ' '), neighborhood: params.neighborhood?.replace(/-/g, ' ') };
    logger.info('Geocoding attempt 3: structured (dehyphenated)');
    await sleep(GEOCODING.NOMINATIM_DELAY_MS);
    result = await fetchNominatim(buildStructuredUrl(dh, cc));
    if (result) return formatResult(result, params);
  }

  logger.info('Geocoding attempt 4: structured (accent-stripped)');
  await sleep(GEOCODING.NOMINATIM_DELAY_MS);
  result = await fetchNominatim(buildStructuredUrl(createAccentStrippedVariant(params), cc));
  if (result) return formatResult(result, params);

  if (!params.country || cc === 'gr') {
    const gv = createGreeklishVariant(params);
    if (gv) {
      logger.info('Geocoding attempt 5: structured (greeklish→greek)');
      await sleep(GEOCODING.NOMINATIM_DELAY_MS);
      result = await fetchNominatim(buildStructuredUrl(gv, cc));
      if (result) return formatResult(result, params);
    }
  }

  const freeformQuery = toFreeformQuery(params);
  if (freeformQuery.trim() && freeformQuery !== osmQuery) {
    logger.info('Geocoding attempt 6: free-form fallback', { data: { query: freeformQuery } });
    await sleep(GEOCODING.NOMINATIM_DELAY_MS);
    result = await fetchNominatim(buildFreeformUrl(freeformQuery, cc));
    if (result) return formatResult(result, params);
  }

  // 7th variant: if we had a country restriction and all failed, try global search.
  // Handles foreign vendor addresses saved with wrong default country (e.g. BG vendor → Greece).
  if (cc !== null) {
    const globalQuery = toFreeformQuery(params);
    if (globalQuery.trim() && globalQuery !== osmQuery) {
      logger.info('Geocoding attempt 7: global free-form (country restriction lifted)');
      await sleep(GEOCODING.NOMINATIM_DELAY_MS);
      result = await fetchNominatim(buildFreeformUrl(globalQuery, null));
      if (result) return formatResult(result, params);
    }
  }

  logger.warn('All geocoding variants failed', { data: { params } });
  return null;
}
