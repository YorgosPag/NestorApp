/**
 * @fileoverview **Survey points → the exact bytes the door will receive, with the door's own verdict** (ADR-920 §13.3).
 * @related ../publication/listing-terrain-judge (THE verdict) · ../publication/listing-terrain-source (the wire shape) ·
 *   ../publication/terrain-publication-contract (the codes the screen translates)
 *
 * The owner's preview must never promise what the server will refuse. So this runs, in the browser, the very checks
 * the door runs — the size of the encoded body (`TERRAIN_SOURCE_TOO_LARGE`), the shape and limits
 * (`TERRAIN_SOURCE_MALFORMED`), the surface (`TERRAIN_INSUFFICIENT_SURFACE` / `_TOO_DENSE`) — and speaks the same codes,
 * so one i18n table (`terrain-survey:publish.refusals`) explains both.
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
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

import type { SnapshotFrame } from '../publication/listing-terrain-frame';
import type { TopoPoint } from '../terrain-types';
import { censusOf, surveyFactsOf, type SurveyFacts } from './survey-position-census';

// The census lives in its own module (shared with the column sniffer, ADR-920 §13.10 Α); importers keep this path.
export { surveyFactsOf, type SurveyFacts };

/**
 * A survey position the owner should look at, ON the preview map (ADR-920 Β4.8) — never on the wire or in the snapshot:
 * the published picture carries no survey points (Δ2). `conflicting` = a repeated position with a DIFFERENT elevation
 * (a contradiction in the measurement — it wins over a plain repeat); `coincident` = repeated, same elevation.
 */
export interface SurveyPointMark {
  /** Snapshot frame, metres from the surface centre — the SAME conversion the published picture went through. */
  readonly x: number;
  readonly y: number;
  readonly kind: 'conflicting' | 'coincident';
}

export type SurveyUploadPreparation =
  | {
      readonly ok: true;
      readonly source: ListingTerrainSource;
      /** The canonical body, byte-for-byte what is sent — and what the door re-derives everything from. */
      readonly encoded: string;
      readonly snapshot: ListingTerrainSnapshot;
      readonly facts: SurveyFacts;
      /** One mark per repeated position, in source order. */
      readonly marks: readonly SurveyPointMark[];
      /**
       * ADR-920 §14.10 — the WORLD position (mm) of the snapshot's centre, for the owner's point inspector (survey
       * coordinates of the point under the cursor). Never on the wire: `encoded` is built from `source` alone (Δ3).
       */
      readonly centreWorldMm: PlanarPoint;
    }
  | { readonly ok: false; readonly code: TerrainRefusalCode; readonly facts: SurveyFacts | null };

/** A parsed survey point → the wire tuple. A point without elevation stays `[x, y]` — never `z = 0` (ADR-720). */
export function sourcePointOf(point: TopoPoint): TerrainSourcePoint {
  return point.z === undefined ? [point.x, point.y] : [point.x, point.y, point.z];
}

/** The survey as a source: points only — boundary, envelope and plot outline (ADR-920 §14.11) arrive with later steps. */
export function surveySourceOf(points: readonly TopoPoint[]): ListingTerrainSource {
  return {
    version: LISTING_TERRAIN_SOURCE_VERSION,
    points: points.map(sourcePointOf),
    breaklines: [],
    boundary: null,
    envelope: null,
    plotOutline: null,
  };
}

/** The repeated positions, placed on the preview through the snapshot's own frame. */
export function surveyMarksOf(points: readonly TerrainSourcePoint[], frame: SnapshotFrame): SurveyPointMark[] {
  const marks: SurveyPointMark[] = [];
  for (const position of censusOf(points).positions.values()) {
    if (position.repeats === 0) continue;
    const [x, y] = frame.planM(position.x, position.y);
    marks.push({ x, y, kind: position.conflicts > 0 ? 'conflicting' : 'coincident' });
  }
  return marks;
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

  const marks = surveyMarksOf(verdict.source.points, verdict.frame);
  return { ok: true, source: verdict.source, encoded, snapshot: verdict.snapshot, facts, marks, centreWorldMm: verdict.frame.centreWorldMm };
}
