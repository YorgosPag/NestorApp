/**
 * @fileoverview **Survey points → the exact bytes the door will receive, with the door's own verdict** (ADR-920 §13.3).
 * @related ../publication/listing-terrain-judge (THE verdict) · ../publication/listing-terrain-source (the wire shape) ·
 *   ../publication/terrain-publication-contract (the codes the screen translates)
 *
 * The owner's preview must never promise what the server will refuse. So this runs, in the browser, the very checks
 * the door runs — the size of the encoded body (`TERRAIN_SOURCE_TOO_LARGE`), the shape and limits
 * (`TERRAIN_SOURCE_MALFORMED`), the surface (`TERRAIN_INSUFFICIENT_SURFACE` / `_TOO_DENSE`) — and speaks the same codes,
 * so one i18n table (`property-market:terrainPublication.refusals`) explains both.
 *
 * It ALSO reports what the big tools resolve silently. The TIN keeps the FIRST of two points that share a position
 * (Revit keeps the highest); the owner is told how many coincide, and how many coincide with a DIFFERENT elevation —
 * that is a contradiction in the measurement, not a formatting detail.
 */

import { LISTING_TERRAIN_SOURCE_MAX_BYTES } from '../publication/listing-terrain-config';
import { judgeListingTerrainSource } from '../publication/listing-terrain-judge';
import {
  encodeListingTerrainSource,
  LISTING_TERRAIN_SOURCE_VERSION,
  type ListingTerrainSource,
  type TerrainSourcePoint,
} from '../publication/listing-terrain-source';
import type { TerrainRefusalCode } from '../publication/terrain-publication-contract';
import type { ListingTerrainSnapshot } from '../publication/listing-terrain-types';
import type { TopoPoint } from '../terrain-types';

/** What the owner is told about the points, refused or not. Counts are over the CANONICAL (integer-mm) points. */
export interface SurveyFacts {
  readonly points: number;
  /** Points carrying a measured elevation — only these shape the surface (ADR-720). */
  readonly withElevation: number;
  /** Extra points sitting on an already-taken position: the surface keeps the first. */
  readonly coincident: number;
  /** Of those, the ones whose elevation DIFFERS from the kept point — a contradiction in the survey. */
  readonly conflictingElevations: number;
}

export type SurveyUploadPreparation =
  | {
      readonly ok: true;
      readonly source: ListingTerrainSource;
      /** The canonical body, byte-for-byte what is sent — and what the door re-derives everything from. */
      readonly encoded: string;
      readonly snapshot: ListingTerrainSnapshot;
      readonly facts: SurveyFacts;
    }
  | { readonly ok: false; readonly code: TerrainRefusalCode; readonly facts: SurveyFacts | null };

/** A parsed survey point → the wire tuple. A point without elevation stays `[x, y]` — never `z = 0` (ADR-720). */
export function sourcePointOf(point: TopoPoint): TerrainSourcePoint {
  return point.z === undefined ? [point.x, point.y] : [point.x, point.y, point.z];
}

/** The survey as a source v1: points only — boundary and envelope arrive with later steps of the form. */
export function surveySourceOf(points: readonly TopoPoint[]): ListingTerrainSource {
  return {
    version: LISTING_TERRAIN_SOURCE_VERSION,
    points: points.map(sourcePointOf),
    breaklines: [],
    boundary: null,
    envelope: null,
  };
}

/** Facts over canonical points: integer mm, so «same position» is exactly what the TIN merges. */
export function surveyFactsOf(points: readonly TerrainSourcePoint[]): SurveyFacts {
  const firstElevation = new Map<string, number | undefined>();
  let withElevation = 0;
  let coincident = 0;
  let conflictingElevations = 0;
  for (const point of points) {
    const z = point.length === 3 ? point[2] : undefined;
    if (z !== undefined) withElevation++;
    const key = `${point[0]}:${point[1]}`;
    if (!firstElevation.has(key)) { firstElevation.set(key, z); continue; }
    coincident++;
    if (firstElevation.get(key) !== z) conflictingElevations++;
  }
  return { points: points.length, withElevation, coincident, conflictingElevations };
}

/** UTF-8 length of the body — what the door compares with its limit (`file.size`). */
function byteLengthOf(encoded: string): number {
  return new TextEncoder().encode(encoded).length;
}

/**
 * Points (WORLD mm) → the body to send, judged exactly as the door will judge it. The point limit is the contract's
 * own (`TERRAIN_SOURCE_MALFORMED`, refused by the shape check before the builder runs); the byte limit is checked on
 * the canonical body — a points-only source reaches it only past the point limit, but the door checks it, so do we.
 */
export function prepareSurveyUpload(points: readonly TopoPoint[]): SurveyUploadPreparation {
  const verdict = judgeListingTerrainSource(surveySourceOf(points));
  if (!verdict.ok) return { ok: false, code: verdict.code, facts: null };

  const facts = surveyFactsOf(verdict.source.points);
  const encoded = encodeListingTerrainSource(verdict.source);
  if (byteLengthOf(encoded) > LISTING_TERRAIN_SOURCE_MAX_BYTES) return { ok: false, code: 'TERRAIN_SOURCE_TOO_LARGE', facts };

  return { ok: true, source: verdict.source, encoded, snapshot: verdict.snapshot, facts };
}
