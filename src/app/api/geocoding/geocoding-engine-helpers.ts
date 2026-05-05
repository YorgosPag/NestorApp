/**
 * Pure helpers for `geocoding-engine.ts`. Extracted to keep the main engine
 * file under the 500-line Google SRP threshold (CLAUDE.md N.7.1).
 *
 * Contains:
 *   - Internal Nominatim DTO shapes (NominatimAddress, NominatimResult)
 *   - Result extraction: accuracy, resolvedFields, confidenceBreakdown,
 *     fieldMatches, partialMatch
 *   - Formatters: formatTopResult, formatAlternative
 *
 * @see ADR-332 §3.2 (type contracts)
 */

import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { normalizeGreekText } from '@/services/ai-pipeline/shared/greek-text-utils';
import type {
  GeocodingRequestBody,
  GeocodingApiResponse,
  GeocodingAlternative,
  GeocodingAttempt,
  GeocodingVariant,
  ResolvedAddressFields,
  FieldMatchKind,
  FieldMatchMap,
  ConfidenceBreakdown,
} from '@/lib/geocoding/geocoding-types';

const { GEOCODING } = GEOGRAPHIC_CONFIG;

// =============================================================================
// INTERNAL NOMINATIM DTOs (shared between engine + helpers)
// =============================================================================

export interface NominatimAddress {
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

export interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
  importance?: number;
  osm_id?: number | string;
  osm_type?: string;
  boundingbox?: string[];
  address?: NominatimAddress;
}

// =============================================================================
// RESULT EXTRACTION
// =============================================================================

export function determineAccuracy(result: NominatimResult): GeocodingApiResponse['accuracy'] {
  const type = result.type ?? result.class ?? '';
  if (type === 'house' || type === 'building') return 'exact';
  if (type === 'street' || type === 'road') return 'interpolated';
  if (type === 'suburb' || type === 'neighbourhood' || type === 'residential') return 'approximate';
  return 'center';
}

/**
 * Map Nominatim's `address` block to ELSTAT-friendly keys used across the app.
 * Powers field-level badge logic downstream.
 */
export function extractResolvedFields(addr: NominatimAddress | undefined): ResolvedAddressFields {
  if (!addr) return {};
  return {
    street: addr.road,
    number: addr.house_number,
    postalCode: addr.postcode,
    neighborhood: addr.suburb,
    city: addr.city || addr.town || addr.village || addr.hamlet,
    county: addr.county,
    region: addr.state,
    country: addr.country,
  };
}

export function computeConfidenceBreakdown(
  result: NominatimResult,
  params: GeocodingRequestBody,
): { breakdown: ConfidenceBreakdown; total: number } {
  const display = normalizeGreekText(result.display_name);
  const breakdown: ConfidenceBreakdown = {
    base: GEOCODING.CONFIDENCE.BASE,
    streetMatch: 0,
    cityMatch: 0,
    postalMatch: 0,
    countyMatch: 0,
    municipalityMatch: 0,
  };

  if (params.street && display.includes(normalizeGreekText(params.street))) {
    breakdown.streetMatch = GEOCODING.CONFIDENCE.STREET_MATCH;
  }
  if (params.neighborhood && display.includes(normalizeGreekText(params.neighborhood))) {
    breakdown.cityMatch = GEOCODING.CONFIDENCE.CITY_MATCH;
  } else if (params.city && display.includes(normalizeGreekText(params.city))) {
    breakdown.cityMatch = GEOCODING.CONFIDENCE.CITY_MATCH;
  }
  if (params.county && display.includes(normalizeGreekText(params.county))) {
    breakdown.countyMatch = GEOCODING.CONFIDENCE.CITY_MATCH * 0.5;
  }
  if (params.municipality && display.includes(normalizeGreekText(params.municipality))) {
    breakdown.municipalityMatch = GEOCODING.CONFIDENCE.CITY_MATCH * 0.3;
  }
  if (params.postalCode && display.includes(params.postalCode)) {
    breakdown.postalMatch = GEOCODING.CONFIDENCE.POSTAL_MATCH;
  }

  const total = Math.min(
    breakdown.base + breakdown.streetMatch + breakdown.cityMatch +
      breakdown.postalMatch + breakdown.countyMatch + breakdown.municipalityMatch,
    1,
  );
  return { breakdown, total };
}

/**
 * Per-field match matrix comparing user input against Nominatim's resolved
 * fields. Case/accent-insensitive comparison.
 */
export function buildFieldMatches(
  params: GeocodingRequestBody,
  resolved: ResolvedAddressFields,
): FieldMatchMap {
  const matchKey = (field: keyof ResolvedAddressFields): FieldMatchKind => {
    const userVal = params[field as keyof GeocodingRequestBody];
    const resolvedVal = resolved[field];
    if (!userVal) return 'not-provided';
    if (!resolvedVal) return 'unknown';
    return normalizeGreekText(String(userVal)) === normalizeGreekText(resolvedVal)
      ? 'match'
      : 'mismatch';
  };

  return {
    street: matchKey('street'),
    number: matchKey('number'),
    postalCode: matchKey('postalCode'),
    neighborhood: matchKey('neighborhood'),
    city: matchKey('city'),
    county: matchKey('county'),
    region: matchKey('region'),
    country: matchKey('country'),
  };
}

export function computePartialMatch(matches: FieldMatchMap): boolean {
  return Object.values(matches).some((m) => m === 'mismatch' || m === 'unknown');
}

// =============================================================================
// FORMATTERS — top result + alternatives
// =============================================================================

export function formatTopResult(
  result: NominatimResult,
  params: GeocodingRequestBody,
  attempts: GeocodingAttempt[],
  alternativeCandidates: NominatimResult[],
  variantUsed: GeocodingVariant,
): GeocodingApiResponse {
  const resolvedFields = extractResolvedFields(result.address);
  const fieldMatches = buildFieldMatches(params, resolvedFields);
  const { breakdown, total: confidence } = computeConfidenceBreakdown(result, params);

  const alternatives: GeocodingAlternative[] = alternativeCandidates.map((alt) =>
    formatAlternative(alt, params, variantUsed),
  );

  return {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    accuracy: determineAccuracy(result),
    confidence,
    displayName: result.display_name,
    resolvedCity: resolvedFields.city,
    resolvedFields,
    partialMatch: computePartialMatch(fieldMatches),
    reasoning: {
      fieldMatches,
      attemptsLog: attempts,
      confidenceBreakdown: breakdown,
    },
    alternatives,
    source: {
      provider: 'nominatim',
      osmType: result.osm_type,
      osmId: result.osm_id != null ? String(result.osm_id) : undefined,
      importance: result.importance,
      variantUsed,
    },
  };
}

export function formatAlternative(
  result: NominatimResult,
  params: GeocodingRequestBody,
  variantUsed: GeocodingVariant,
): GeocodingAlternative {
  const resolvedFields = extractResolvedFields(result.address);
  const fieldMatches = buildFieldMatches(params, resolvedFields);
  const { breakdown, total: confidence } = computeConfidenceBreakdown(result, params);

  return {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    accuracy: determineAccuracy(result),
    confidence,
    displayName: result.display_name,
    resolvedCity: resolvedFields.city,
    resolvedFields,
    partialMatch: computePartialMatch(fieldMatches),
    reasoning: {
      fieldMatches,
      attemptsLog: [],
      confidenceBreakdown: breakdown,
    },
    source: {
      provider: 'nominatim',
      osmType: result.osm_type,
      osmId: result.osm_id != null ? String(result.osm_id) : undefined,
      importance: result.importance,
      variantUsed,
    },
  };
}
