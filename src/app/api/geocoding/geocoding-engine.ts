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
import { countryNameToCode } from '@/utils/address/country-codes';
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

/**
 * Ο χάρτης χωρών + το accent-insensitive ευρετήριο μετακόμισαν στο
 * `@/utils/address/country-codes`.
 *
 * ΓΙΑΤΙ: το ίδιο ερώτημα το έκανε και το UI (`AddressWithHierarchy`) με **inline
 * αλυσίδα `||`** έξι τιμών. Δύο απαντήσεις για το «είναι ελληνική;» σημαίνει ότι
 * μια νέα ορθογραφία («ΕΛΛΑΣ», NFD από clipboard) διορθωνόταν στη μία πλευρά και
 * όχι στην άλλη — ο engine περιόριζε τη χώρα, το UI όχι.
 *
 * Η αστοχία δεν ήταν καλλωπιστική: ένα άλυτο όνομα έριχνε το `countrycodes` από
 * κάθε variant, και μια ανεξέλεγκτη αναζήτηση απαντούσε ελληνική διεύθυνση με
 * ξένη — μετρημένο 2026-07-26: «Τσιμισκή 43, Θεσσαλονίκη, 54623» επέστρεφε Viale
 * Ungheria, Μιλάνο χωρίς τον περιορισμό.
 */

// =============================================================================
// SANITIZATION
// =============================================================================

function sanitizeStr(v: string | undefined): string | undefined {
  return !v || v === 'null' || v === 'undefined' ? undefined : v;
}

export function sanitizeQuery(body: GeocodingRequestBody): GeocodingRequestBody {
  return {
    street: sanitizeStr(body.street), number: sanitizeStr(body.number),
    city: sanitizeStr(body.city),
    neighborhood: sanitizeStr(body.neighborhood), postalCode: sanitizeStr(body.postalCode),
    county: sanitizeStr(body.county), municipality: sanitizeStr(body.municipality),
    region: sanitizeStr(body.region), country: sanitizeStr(body.country),
  };
}

/**
 * Join street name and house number. Nominatim's structured `street` slot wants
 * "<number> <name>", while free-form text follows the local written convention —
 * in Greek, "<name> <number>" («Τσιμισκή 43»). One composer so the two orders
 * cannot drift apart.
 *
 * Kept out of the caller's `street` field, which must stay the bare street name.
 */
function composeStreet(
  params: GeocodingRequestBody,
  order: 'number-first' | 'number-last',
): string | undefined {
  if (!params.street) return undefined;
  if (!params.number) return params.street;
  return order === 'number-first'
    ? `${params.number} ${params.street}`
    : `${params.street} ${params.number}`;
}

// =============================================================================
// NOMINATIM URL BUILDERS
// =============================================================================

/**
 * Structured search URL.
 *
 * `postalcode` is deliberately **omitted**. Measured against live Nominatim
 * (2026-07-26): `street=Τσιμισκή 43 & city=Θεσσαλονίκη` returns a match, and
 * adding `postalcode` — in either `54623` or the Greek-canonical `546 23` form —
 * returns an empty set. As a structured filter it only ever subtracts, so the
 * postal code is used for free-form queries and for verifying the answer
 * instead. See ADR-332 D13.
 */
function buildStructuredUrl(params: GeocodingRequestBody, countryCode: string | null): string {
  const searchParams = new URLSearchParams({
    format: 'json', addressdetails: '1',
    limit: GEOCODING.NOMINATIM_RESULT_LIMIT, 'accept-language': GEOCODING.ACCEPT_LANGUAGE,
  });
  if (countryCode) searchParams.set('countrycodes', countryCode);
  const street = composeStreet(params, 'number-first');
  if (street) searchParams.set('street', street);
  if (params.neighborhood) searchParams.set('city', params.neighborhood);
  else if (params.city) searchParams.set('city', params.city);
  if (params.county) searchParams.set('county', params.county);
  if (params.region) searchParams.set('state', params.region);
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
// RESULT FINALIZATION — country integrity (ADR-332 D12)
// =============================================================================

/**
 * The late variants drop the country restriction to rescue typo'd input, which
 * can surface a same-named place on another continent. Measured (2026-07-26):
 * `{street: "Ονειροπόλων", postalCode: "54624", country: "Ελλάδα"}` returned
 * Town of Wheatland, Wisconsin, USA at confidence 0.55.
 *
 * Such a candidate is still worth showing — it explains what the provider
 * matched — but it must never read as verified, so it is flagged and its
 * confidence is zeroed.
 */
function enforceCountryIntegrity(
  response: GeocodingApiResponse,
  result: NominatimResult,
  declaredCountryCode: string | null,
): GeocodingApiResponse {
  if (!declaredCountryCode) return response;
  const resolved = result.address?.country_code?.toLowerCase();
  if (!resolved || resolved === declaredCountryCode) return response;
  logger.warn('Geocoding result outside declared country', {
    data: { declared: declaredCountryCode, resolved, variant: response.source.variantUsed },
  });
  return { ...response, outOfDeclaredCountry: true, confidence: 0 };
}

/** Single exit path for every variant — one place that formats and validates. */
function finishWith(
  results: NominatimResult[],
  params: GeocodingRequestBody,
  attempts: GeocodingAttempt[],
  variant: GeocodingVariant,
  declaredCountryCode: string | null,
): GeocodingApiResponse {
  const top = results[0];
  return enforceCountryIntegrity(
    formatTopResult(top, params, attempts, results.slice(1, 5), variant),
    top,
    declaredCountryCode,
  );
}

// =============================================================================
// SEARCH VARIANTS (query builders)
// =============================================================================

/**
 * Tight first-pass query: street + number, locality, postal code — comma
 * separated. Measured (2026-07-26): space-joining these, as this builder used to
 * do, returns an empty set where the comma-separated form matches.
 */
function toOsmStyleQuery(params: GeocodingRequestBody): string {
  const locality = (params.neighborhood || params.city)?.replace(/-/g, ' ');
  return [composeStreet(params, 'number-last'), locality, params.postalCode]
    .filter(Boolean).join(', ');
}

/** Widest query: the full administrative chain, for when the tight one misses. */
function toFreeformQuery(params: GeocodingRequestBody): string {
  const locality = params.neighborhood || params.city;
  return [
    composeStreet(params, 'number-last'), locality, params.municipality,
    params.county, params.postalCode, params.region,
  ].filter(Boolean).join(', ');
}

function createAccentStrippedVariant(params: GeocodingRequestBody): GeocodingRequestBody {
  const n = (v: string | undefined) => v ? normalizeGreekText(v) : undefined;
  return {
    street: n(params.street), number: params.number,
    city: n(params.city), neighborhood: n(params.neighborhood),
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
    street: tr(params.street), number: params.number,
    city: tr(params.city), neighborhood: tr(params.neighborhood),
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
      return finishWith(out.results, params, attempts, 1, cc);
    }
  } else {
    attempts.push(skippedAttempt(1));
  }

  await sleep(GEOCODING.NOMINATIM_DELAY_MS);
  logger.info('Geocoding attempt 2: structured (original)');
  const v2 = await fetchNominatim(buildStructuredUrl(params, cc), 2);
  attempts.push(v2.attempt);
  if (v2.results.length > 0) {
    return finishWith(v2.results, params, attempts, 2, cc);
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
      return finishWith(v3.results, params, attempts, 3, cc);
    }
  } else {
    attempts.push(skippedAttempt(3));
  }

  logger.info('Geocoding attempt 4: structured (accent-stripped)');
  await sleep(GEOCODING.NOMINATIM_DELAY_MS);
  const v4 = await fetchNominatim(buildStructuredUrl(createAccentStrippedVariant(params), cc), 4);
  attempts.push(v4.attempt);
  if (v4.results.length > 0) {
    return finishWith(v4.results, params, attempts, 4, cc);
  }

  if (!params.country || cc === 'gr') {
    const gv = createGreeklishVariant(params);
    if (gv) {
      logger.info('Geocoding attempt 5: structured (greeklish→greek)');
      await sleep(GEOCODING.NOMINATIM_DELAY_MS);
      const v5 = await fetchNominatim(buildStructuredUrl(gv, cc), 5);
      attempts.push(v5.attempt);
      if (v5.results.length > 0) {
        return finishWith(v5.results, params, attempts, 5, cc);
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
      return finishWith(v6.results, params, attempts, 6, cc);
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
        return finishWith(v7.results, params, attempts, 7, cc);
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
        return finishWith(v8.results, params, attempts, 8, cc);
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
