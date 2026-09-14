/**
 * @fileoverview **Ο ΠΕΛΑΤΗΣ ΤΟΥ NOMINATIM** — πώς γράφεται ένα URL και πώς καταγράφεται μία κλήση.
 * @related ADR-332 D12 · D13 · D22 · D28 · geocoding-ladder · geocoding-engine
 * @module app/api/geocoding/geocoding-nominatim-client
 *
 * 🔑 **Εξήχθη από τη μηχανή (2026-09-14, ADR-332 D28)**, που ήταν 488 γραμμές και χρειαζόταν χώρο
 * για τη βαθμίδα 9 (N.7.1). Η τομή δεν είναι αυθαίρετη — τρεις ερωτήσεις, τρία αρχεία:
 *
 * | Αρχείο | Ερώτηση |
 * |---|---|
 * | **εδώ** | *πώς* ρωτάμε τον πάροχο (URL, κλήση, καταγραφή) |
 * | `geocoding-ladder` | *τι* ρωτάμε και *με ποια σειρά* |
 * | `geocoding-engine` | *τι δεχόμαστε* και *τι σημαίνει* η σιωπή |
 *
 * ⛔ Καμία απόφαση σειράς ή αποδοχής δεν ζει εδώ.
 */

import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  GeocodingRequestBody,
  GeocodingAttempt,
  GeocodingAttemptStatus,
  GeocodingVariant,
} from '@/lib/geocoding/geocoding-types';
import type { NominatimResult } from './geocoding-engine-helpers';
import { composeStreet } from './geocoding-query-variants';

const logger = createModuleLogger('geocoding-api');

const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const USER_AGENT = process.env.GEOCODING_USER_AGENT || 'NestorPagonisApp/1.0 (geocoding)';
const NOMINATIM_TIMEOUT_MS = parseInt(process.env.GEOCODING_TIMEOUT_MS || '8000', 10);
const { GEOCODING } = GEOGRAPHIC_CONFIG;

/**
 * i18n keys (resolved at UI layer — engine never produces raw user-facing strings).
 *
 * ⚠️ **Κλειδί ανά ΤΑΥΤΟΤΗΤΑ παραλλαγής, όχι ανά θέση στη σκάλα** — η 9 εκτελείται πριν από τις
 * 7/8 (ADR-332 D28). Ο αριθμός αποθηκεύεται στο `geocodingMetadata.variantUsed`, άρα δεν
 * επαναριθμείται ποτέ.
 */
const VARIANT_I18N_KEYS: Record<GeocodingVariant, string> = {
  1: 'addresses.geocoding.attempts.osmStyle',
  2: 'addresses.geocoding.attempts.structured',
  3: 'addresses.geocoding.attempts.structuredDehyphenated',
  4: 'addresses.geocoding.attempts.structuredAccentStripped',
  5: 'addresses.geocoding.attempts.structuredGreeklish',
  6: 'addresses.geocoding.attempts.freeformFallback',
  7: 'addresses.geocoding.attempts.globalFreeform',
  8: 'addresses.geocoding.attempts.cityOnlyGlobal',
  9: 'addresses.geocoding.attempts.postcodeAnchored',
};

export interface NominatimFetchOutcome {
  /** Empty array on no-results / error. */
  readonly results: NominatimResult[];
  readonly attempt: GeocodingAttempt;
}

// =============================================================================
// URL BUILDERS
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
export function buildStructuredUrl(params: GeocodingRequestBody, countryCode: string | null): string {
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

export function buildFreeformUrl(query: string, countryCode: string | null): string {
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

export async function fetchNominatim(
  url: string,
  variant: GeocodingVariant,
): Promise<NominatimFetchOutcome> {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
    });
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      logger.warn('Nominatim non-OK response', { data: { status: response.status, variant } });
      return { results: [], attempt: makeAttempt(variant, 'error', durationMs) };
    }

    const data: NominatimResult[] = await response.json();
    return {
      results: data,
      attempt: makeAttempt(variant, data.length > 0 ? 'success' : 'no-results', durationMs),
    };
  } catch (error) {
    logger.warn('Nominatim fetch error', { error: getErrorMessage(error), data: { variant } });
    return { results: [], attempt: makeAttempt(variant, 'error', Date.now() - startedAt) };
  }
}

export function makeAttempt(
  variant: GeocodingVariant,
  status: GeocodingAttemptStatus,
  durationMs: number,
): GeocodingAttempt {
  return { variant, i18nKey: VARIANT_I18N_KEYS[variant], status, durationMs };
}

export function skippedAttempt(variant: GeocodingVariant): GeocodingAttempt {
  return makeAttempt(variant, 'skipped', 0);
}
