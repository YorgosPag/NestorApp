/**
 * =============================================================================
 * ADDRESS EDITOR — Suggestion Ranking Helper (ADR-332 Phase 2)
 * =============================================================================
 *
 * Combines the top geocoding hit with its alternatives into a single ranked
 * `SuggestionRanking[]` consumed by `<AddressSuggestionsPanel>` (Phase 4).
 *
 * Ranking score blends two signals:
 *   - **confidence** (0..1) from the engine's per-field match scoring
 *   - **proximity** (0..1) inverse of distance to the current map center,
 *     capped at `proximityCapM` (default 5 km)
 *
 * Without a `mapCenter` the score collapses to plain confidence and the order
 * is preserved (top first, then alternatives in their original Nominatim rank).
 *
 * @module components/shared/addresses/editor/helpers/rankSuggestions
 * @see ADR-332 §3.4 Suggestion trigger algorithm
 */

import type {
  GeocodingAlternative,
  GeocodingApiResponse,
  SuggestionRanking,
} from '../types';

export interface MapCenter {
  lat: number;
  lng: number;
}

export interface RankSuggestionsOptions {
  /** Current map center — drives the proximity component of the rank score. */
  mapCenter?: MapCenter;
  /** Distance (m) at and above which the proximity bonus is 0. Default 5000. */
  proximityCapM?: number;
  /** Weight assigned to confidence (0..1). Proximity weight is `1 - confidenceWeight`. Default 0.7. */
  confidenceWeight?: number;
}

const DEFAULTS = {
  proximityCapM: 5000,
  confidenceWeight: 0.7,
} as const;

const EARTH_RADIUS_M = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in meters via the Haversine formula. */
export function haversineDistanceM(a: MapCenter, b: MapCenter): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Coerces a flat `GeocodingAlternative` (no nested alternatives) into the full
 * `GeocodingApiResponse` shape so it can be rendered uniformly with the top hit.
 */
function alternativeToFullResponse(alt: GeocodingAlternative): GeocodingApiResponse {
  return { ...alt, alternatives: [] };
}

interface ScoreOptions {
  mapCenter?: MapCenter;
  proximityCapM: number;
  confidenceWeight: number;
}

function scoreCandidate(
  candidate: GeocodingApiResponse,
  opts: ScoreOptions,
): { rankScore: number; distanceFromCenterM: number | null } {
  if (!opts.mapCenter) {
    return { rankScore: candidate.confidence, distanceFromCenterM: null };
  }
  const distance = haversineDistanceM(opts.mapCenter, {
    lat: candidate.lat,
    lng: candidate.lng,
  });
  const proximity = 1 - clamp(distance / opts.proximityCapM, 0, 1);
  const rankScore =
    opts.confidenceWeight * candidate.confidence +
    (1 - opts.confidenceWeight) * proximity;
  return { rankScore, distanceFromCenterM: distance };
}

/**
 * Returns top + alternatives ranked by combined score (descending). Each entry
 * carries its `originalRank` so the UI can show a "(best match)" hint on the
 * Nominatim winner even when proximity reorders the list.
 */
export function rankSuggestions(
  result: GeocodingApiResponse,
  options: RankSuggestionsOptions = {},
): SuggestionRanking[] {
  const proximityCapM = options.proximityCapM ?? DEFAULTS.proximityCapM;
  const confidenceWeight = clamp(
    options.confidenceWeight ?? DEFAULTS.confidenceWeight,
    0,
    1,
  );
  const scoreOpts: ScoreOptions = {
    mapCenter: options.mapCenter,
    proximityCapM,
    confidenceWeight,
  };

  const candidates: GeocodingApiResponse[] = [
    result,
    ...result.alternatives.map(alternativeToFullResponse),
  ];

  const ranked: SuggestionRanking[] = candidates.map((candidate, originalRank) => {
    const { rankScore, distanceFromCenterM } = scoreCandidate(candidate, scoreOpts);
    return { candidate, originalRank, distanceFromCenterM, rankScore };
  });

  ranked.sort((a, b) => b.rankScore - a.rankScore);
  return ranked;
}
