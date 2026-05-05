/**
 * Nominatim geocoding engine — multi-variant search strategy with full
 * transparency reporting (ADR-332 Phase 0).
 *
 * Returns top result + up to 4 alternatives from the winning variant,
 * per-field match matrix, attempts log, confidence breakdown, source
 * provenance. Pure helpers (formatters, extractors) live in
 * `geocoding-engine-helpers.ts` to keep this file under 500 LOC.
 *
 * Backward compatibility: top-level fields (lat, lng, accuracy, confidence,
 * displayName, resolvedCity) preserved for legacy AddressMap consumers.
 *
 * @see ADR-332 §3.2 (type contracts), §3.4 (suggestion triggers)
 * @see geocoding-engine-helpers.ts — formatters and result extractors
 * @see geocoding-types.ts — shared types
 */

import { sleep } from '@/lib/async-utils';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { normalizeGreekText } from '@/services/ai-pipeline/shared/greek-text-utils';
import { transliterateGreeklish, containsGreek } from '@/services/ai-pipeline/shared/greek-nlp';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  GeocodingRequestBody,
  GeocodingApiResponse,
  GeocodingAttempt,
  GeocodingAttemptStatus,
  GeocodingVariant,
} from '@/lib/geocoding/geocoding-types';
import {
  formatTopResult,
  type NominatimResult,
} from './geocoding-engine-helpers';

const logger = createModuleLogger('geocoding-api');

// Re-export shared types so existing route.ts barrel re-export keeps working.
export type { GeocodingRequestBody, GeocodingApiResponse } from '@/lib/geocoding/geocoding-types';

// =============================================================================
// FETCH OUTCOME (file-private)
// =============================================================================

interface NominatimFetchOutcome {
  /** Empty array on no-results / error. */
  results: NominatimResult[];
  attempt: GeocodingAttempt;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const USER_AGENT = process.env.GEOCODING_USER_AGENT || 'NestorPagonisApp/1.0 (geocoding)';
const NOMINATIM_TIMEOUT_MS = parseInt(process.env.GEOCODING_TIMEOUT_MS || '8000', 10);
const { GEOCODING } = GEOGRAPHIC_CONFIG;

const COUNTRY_CODE_MAP: Record<string, string> = {
  gr: 'gr', bg: 'bg', cy: 'cy', al: 'al', mk: 'mk', ro: 'ro',
  de: 'de', it: 'it', fr: 'fr', gb: 'gb', uk: 'gb', tr: 'tr', rs: 'rs',
  greece: 'gr', 'ελλάδα': 'gr', 'ελλας': 'gr', hellas: 'gr',
  bulgaria: 'bg', 'βουλγαρία': 'bg', 'βουλγαρια': 'bg',
  cyprus: 'cy', 'κύπρος': 'cy', 'κυπρος': 'cy',
  albania: 'al', 'αλβανία': 'al', 'north macedonia': 'mk', 'βόρεια μακεδονία': 'mk',
  romania: 'ro', 'ρουμανία': 'ro', germany: 'de', 'γερμανία': 'de',
  italy: 'it', 'ιταλία': 'it', france: 'fr', 'γαλλία': 'fr',
  'united kingdom': 'gb', turkey: 'tr', 'τουρκία': 'tr', serbia: 'rs',
};

// i18n keys (resolved at UI layer — engine never produces raw user-facing strings).
const VARIANT_I18N_KEYS: Record<GeocodingVariant, string> = {
  1: 'addresses.geocoding.attempts.osmStyle',
  2: 'addresses.geocoding.attempts.structured',
  3: 'addresses.geocoding.attempts.structuredDehyphenated',
  4: 'addresses.geocoding.attempts.structuredAccentStripped',
  5: 'addresses.geocoding.attempts.structuredGreeklish',
  6: 'addresses.geocoding.attempts.freeformFallback',
  7: 'addresses.geocoding.attempts.globalFreeform',
  8: 'addresses.geocoding.attempts.cityOnlyGlobal',
};

function countryNameToCode(country: string | undefined): string | null {
  if (!country) return null;
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
  if (params.neighborhood) searchParams.set('city', params.neighborhood);
  else if (params.city) searchParams.set('city', params.city);
  if (params.county) searchParams.set('county', params.county);
  if (params.region) searchParams.set('state', params.region);
  if (params.postalCode) searchParams.set('postalcode', params.postalCode);
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

// =============================================================================
// FETCH (multi-result, instrumented)
// =============================================================================

async function fetchNominatim(
  url: string,
  variant: GeocodingVariant,
): Promise<NominatimFetchOutcome> {
  const startedAt = Date.now();
  const i18nKey = VARIANT_I18N_KEYS[variant];

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
    });
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      logger.warn('Nominatim non-OK response', { data: { status: response.status, variant } });
      return {
        results: [],
        attempt: makeAttempt(variant, i18nKey, 'error', durationMs),
      };
    }

    const data: NominatimResult[] = await response.json();
    return {
      results: data,
      attempt: makeAttempt(variant, i18nKey, data.length > 0 ? 'success' : 'no-results', durationMs),
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.warn('Nominatim fetch error', { error: getErrorMessage(error), data: { variant } });
    return {
      results: [],
      attempt: makeAttempt(variant, i18nKey, 'error', durationMs),
    };
  }
}

function makeAttempt(
  variant: GeocodingVariant,
  i18nKey: string,
  status: GeocodingAttemptStatus,
  durationMs: number,
): GeocodingAttempt {
  return { variant, i18nKey, status, durationMs };
}

function skippedAttempt(variant: GeocodingVariant): GeocodingAttempt {
  return { variant, i18nKey: VARIANT_I18N_KEYS[variant], status: 'skipped', durationMs: 0 };
}

// =============================================================================
// SEARCH VARIANTS (query builders)
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
// MAIN — multi-variant geocoding (instrumented)
// =============================================================================

/**
 * Geocode a structured address using up to 8 Nominatim variants. Returns the
 * top result with up to 4 alternatives + per-field match matrix + attempts log.
 *
 * @returns null when ALL variants returned no results (true hard fail).
 */
export async function geocode(rawParams: GeocodingRequestBody): Promise<GeocodingApiResponse | null> {
  const params = sanitizeQuery(rawParams);
  const cc = countryNameToCode(params.country);
  const attempts: GeocodingAttempt[] = [];

  const osmQuery = toOsmStyleQuery(params);
  if (osmQuery.trim()) {
    logger.info('Geocoding attempt 1: OSM-style free-form', { data: { query: osmQuery } });
    const out = await fetchNominatim(buildFreeformUrl(osmQuery, cc), 1);
    attempts.push(out.attempt);
    if (out.results.length > 0) {
      return formatTopResult(out.results[0], params, attempts, out.results.slice(1, 5), 1);
    }
  } else {
    attempts.push(skippedAttempt(1));
  }

  await sleep(GEOCODING.NOMINATIM_DELAY_MS);
  logger.info('Geocoding attempt 2: structured (original)');
  const v2 = await fetchNominatim(buildStructuredUrl(params, cc), 2);
  attempts.push(v2.attempt);
  if (v2.results.length > 0) {
    return formatTopResult(v2.results[0], params, attempts, v2.results.slice(1, 5), 2);
  }

  if (params.city?.includes('-') || params.neighborhood?.includes('-')) {
    const dh: GeocodingRequestBody = {
      ...params,
      city: params.city?.replace(/-/g, ' '),
      neighborhood: params.neighborhood?.replace(/-/g, ' '),
    };
    logger.info('Geocoding attempt 3: structured (dehyphenated)');
    await sleep(GEOCODING.NOMINATIM_DELAY_MS);
    const v3 = await fetchNominatim(buildStructuredUrl(dh, cc), 3);
    attempts.push(v3.attempt);
    if (v3.results.length > 0) {
      return formatTopResult(v3.results[0], params, attempts, v3.results.slice(1, 5), 3);
    }
  } else {
    attempts.push(skippedAttempt(3));
  }

  logger.info('Geocoding attempt 4: structured (accent-stripped)');
  await sleep(GEOCODING.NOMINATIM_DELAY_MS);
  const v4 = await fetchNominatim(buildStructuredUrl(createAccentStrippedVariant(params), cc), 4);
  attempts.push(v4.attempt);
  if (v4.results.length > 0) {
    return formatTopResult(v4.results[0], params, attempts, v4.results.slice(1, 5), 4);
  }

  if (!params.country || cc === 'gr') {
    const gv = createGreeklishVariant(params);
    if (gv) {
      logger.info('Geocoding attempt 5: structured (greeklish→greek)');
      await sleep(GEOCODING.NOMINATIM_DELAY_MS);
      const v5 = await fetchNominatim(buildStructuredUrl(gv, cc), 5);
      attempts.push(v5.attempt);
      if (v5.results.length > 0) {
        return formatTopResult(v5.results[0], params, attempts, v5.results.slice(1, 5), 5);
      }
    } else {
      attempts.push(skippedAttempt(5));
    }
  } else {
    attempts.push(skippedAttempt(5));
  }

  const freeformQuery = toFreeformQuery(params);
  if (freeformQuery.trim() && freeformQuery !== osmQuery) {
    logger.info('Geocoding attempt 6: free-form fallback', { data: { query: freeformQuery } });
    await sleep(GEOCODING.NOMINATIM_DELAY_MS);
    const v6 = await fetchNominatim(buildFreeformUrl(freeformQuery, cc), 6);
    attempts.push(v6.attempt);
    if (v6.results.length > 0) {
      return formatTopResult(v6.results[0], params, attempts, v6.results.slice(1, 5), 6);
    }
  } else {
    attempts.push(skippedAttempt(6));
  }

  if (cc !== null) {
    const globalQuery = toFreeformQuery(params);
    if (globalQuery.trim() && globalQuery !== osmQuery) {
      logger.info('Geocoding attempt 7: global free-form (country restriction lifted)');
      await sleep(GEOCODING.NOMINATIM_DELAY_MS);
      const v7 = await fetchNominatim(buildFreeformUrl(globalQuery, null), 7);
      attempts.push(v7.attempt);
      if (v7.results.length > 0) {
        return formatTopResult(v7.results[0], params, attempts, v7.results.slice(1, 5), 7);
      }
    } else {
      attempts.push(skippedAttempt(7));
    }

    const cityOnly = params.city || params.neighborhood;
    if (cityOnly) {
      logger.info('Geocoding attempt 8: city-only global fallback');
      await sleep(GEOCODING.NOMINATIM_DELAY_MS);
      const v8 = await fetchNominatim(buildFreeformUrl(cityOnly, null), 8);
      attempts.push(v8.attempt);
      if (v8.results.length > 0) {
        return formatTopResult(v8.results[0], params, attempts, v8.results.slice(1, 5), 8);
      }
    } else {
      attempts.push(skippedAttempt(8));
    }
  } else {
    attempts.push(skippedAttempt(7));
    attempts.push(skippedAttempt(8));
  }

  logger.warn('All geocoding variants failed', { data: { params, attemptsCount: attempts.length } });
  return null;
}
