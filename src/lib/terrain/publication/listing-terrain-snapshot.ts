/**
 * ADR-920 Β2 — build the terrain a plot listing publishes, from the survey. Pure, deterministic.
 *
 *   survey points + breaklines ─buildTin─▶ TIN ─clipTinToBoundary─▶ plot surface
 *        ├─ chooseContourConfig + generateContoursFromSurface ─▶ contours
 *        ├─ slopeClasses / summariseSlope ─▶ slope map + stats
 *        └─ placeEnvelope ─▶ indicative building envelope
 *   everything ─frameOf─▶ metres from the surface centre (no world coordinates leave)
 *
 * Every step is the SAME code the DXF Viewer runs (ADR-920 Α1): one TIN, one clip, one contour
 * generator. The server door (Β3) calls this; so can a preview in the browser — same input, same bytes.
 *
 * @module lib/terrain/publication/listing-terrain-snapshot
 */

import { buildTin } from '@/lib/terrain/tin-builder';
import { clipTinToBoundary } from '@/lib/terrain/tin-clip-to-boundary';
import { generateContoursFromSurface } from '@/lib/terrain/contour-generator';
import type { ContourLine, TinSurface } from '@/lib/terrain/terrain-types';
import { chooseContourConfig } from './contour-interval';
import { slopeClasses, summariseSlope } from './terrain-slope';
import { LISTING_TERRAIN_MAX_TRIANGLES, LISTING_TERRAIN_SLOPE_BANDS_PCT } from './listing-terrain-config';
import {
  frameOf,
  meshPositions,
  placeEnvelope,
  ringToFrame,
  roundPublished,
  type SnapshotFrame,
} from './listing-terrain-frame';
import {
  LISTING_TERRAIN_SNAPSHOT_VERSION,
  type ListingTerrainBuildResult,
  type ListingTerrainContour,
  type ListingTerrainInput,
  type ListingTerrainMesh,
  type ListingTerrainStats,
} from './listing-terrain-types';

export interface ListingTerrainBuildOptions {
  /** Override of {@link LISTING_TERRAIN_MAX_TRIANGLES} (tests). */
  readonly maxTriangles?: number;
}

/** The published terrain of a plot, or the reason it cannot be published. */
export function buildListingTerrainSnapshot(
  input: ListingTerrainInput,
  options: ListingTerrainBuildOptions = {},
): ListingTerrainBuildResult {
  const surveyed = buildTin(input.points, input.breaklines ?? []);
  if (surveyed.triangles.length === 0) return { ok: false, reason: 'insufficient-surface' };

  const tin = input.boundaryWorldMm ? clipTinToBoundary(surveyed, input.boundaryWorldMm) : surveyed;
  if (tin.triangles.length === 0) return { ok: false, reason: 'empty-after-clip' };
  if (tin.triangles.length > (options.maxTriangles ?? LISTING_TERRAIN_MAX_TRIANGLES)) {
    return { ok: false, reason: 'too-dense' };
  }

  const frame = frameOf(tin);
  const contourConfig = chooseContourConfig(tin.bounds.maxZ - tin.bounds.minZ);
  const { contours } = generateContoursFromSurface(tin, contourConfig);
  const placed = input.envelope
    ? placeEnvelope(tin, frame, input.envelope.footprintWorldMm, input.envelope.maxHeightM)
    : { envelope: null, omission: null };

  return {
    ok: true,
    snapshot: {
      version: LISTING_TERRAIN_SNAPSHOT_VERSION,
      mesh: meshOf(tin, frame),
      contours: contours.map((line) => contourToFrame(line, frame)),
      contourIntervalM: contourConfig.intervalMm / 1000,
      contourMajorEvery: contourConfig.majorEvery,
      slopeBandsPct: LISTING_TERRAIN_SLOPE_BANDS_PCT,
      boundary: input.boundaryWorldMm ? ringToFrame(frame, input.boundaryWorldMm) : null,
      stats: statsOf(tin),
      envelope: placed.envelope,
      envelopeOmission: placed.omission,
    },
  };
}

/** The plot surface as a flat mesh, with its slope map. */
function meshOf(tin: TinSurface, frame: SnapshotFrame): ListingTerrainMesh {
  return {
    positions: meshPositions(tin, frame),
    triangles: tin.triangles.flatMap(([i, j, k]) => [i, j, k]),
    slopeClass: slopeClasses(tin, LISTING_TERRAIN_SLOPE_BANDS_PCT),
  };
}

/** A WORLD mm contour line → the snapshot frame. */
function contourToFrame(line: ContourLine, frame: SnapshotFrame): ListingTerrainContour {
  return {
    levelM: frame.elevationM(line.level),
    major: line.isMajor,
    closed: line.closed,
    points: ringToFrame(frame, line.vertices),
  };
}

/** What the buyer reads at a glance. */
function statsOf(tin: TinSurface): ListingTerrainStats {
  const slope = summariseSlope(tin);
  const minM = tin.bounds.minZ / 1000;
  const maxM = tin.bounds.maxZ / 1000;
  return {
    planAreaM2: roundPublished(slope.planAreaMm2 / 1e6),
    minElevationM: roundPublished(minM),
    maxElevationM: roundPublished(maxM),
    reliefM: roundPublished(maxM - minM),
    meanSlopePct: roundPublished(slope.meanSlopePct),
    maxSlopePct: roundPublished(slope.maxSlopePct),
    downslopeAzimuthDeg: slope.downslopeAzimuthDeg === null ? null : roundPublished(slope.downslopeAzimuthDeg),
  };
}
