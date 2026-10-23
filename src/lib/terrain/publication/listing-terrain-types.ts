/**
 * ADR-920 Β2 — the contract of the terrain a plot listing publishes (`ListingTerrainSnapshot`).
 *
 * The listing does NOT carry the survey. It carries a DERIVED, frozen picture of it (the ADR-909
 * pattern): the surveyor's TIN clipped to the plot, its contours, a slope class per triangle and an
 * indicative building envelope. Three rules shape every field:
 *
 *   1. **No world coordinates.** Plan positions are metres relative to the centre of the surface
 *      (ADR-920 Δ3: the exact location is the owner's choice, never a side effect of the 3D model).
 *      Elevations stay ABSOLUTE metres — the buyer reads «υψόμετρο 124 m», and an altitude alone
 *      does not locate a plot.
 *   2. **No invented measurements.** The surveyor's vertices are kept as measured (no mesh
 *      simplification — survey-grade input is already thin; point clouds are decimated in the viewer
 *      before they become survey points). A height nobody declared stays `null`.
 *   3. **Serialisable as-is.** Flat number arrays, rounded to the centimetre — the snapshot is a JSON
 *      file in Storage, read by the 2D and the 3D viewer alike.
 *
 * Types only (no logic).
 *
 * @module lib/terrain/publication/listing-terrain-types
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import type { Breakline, TopoPoint } from '@/lib/terrain/terrain-types';

/** Bumped on any breaking change of the snapshot shape; readers refuse versions they do not know. */
export const LISTING_TERRAIN_SNAPSHOT_VERSION = 1 as const;

/** The terrain mesh, in the snapshot frame (see module doc). */
export interface ListingTerrainMesh {
  /** Flat `[x, y, z, x, y, z, …]` — x east / y north in metres from the surface centre, z absolute metres. */
  readonly positions: readonly number[];
  /** Flat `[i, j, k, …]` vertex indices, counter-clockwise seen from above. */
  readonly triangles: readonly number[];
  /** One entry per triangle: index into the slope bands (`0` = flattest). */
  readonly slopeClass: readonly number[];
}

/** One finished contour line. */
export interface ListingTerrainContour {
  /** Absolute elevation of the line, metres. */
  readonly levelM: number;
  /** Index contour (every N-th interval) — drawn heavier and labelled. */
  readonly major: boolean;
  readonly closed: boolean;
  /** Flat `[x, y, x, y, …]` in the snapshot frame. */
  readonly points: readonly number[];
}

/** What the buyer reads at a glance. */
export interface ListingTerrainStats {
  /** Plan area of the published surface, m². */
  readonly planAreaM2: number;
  readonly minElevationM: number;
  readonly maxElevationM: number;
  /** `max − min`, metres. */
  readonly reliefM: number;
  /** Area-weighted mean slope, percent. */
  readonly meanSlopePct: number;
  readonly maxSlopePct: number;
  /**
   * Direction the ground falls towards, degrees clockwise from north (0 = falls to the north).
   * `null` on flat ground, where a direction would be noise.
   */
  readonly downslopeAzimuthDeg: number | null;
}

/**
 * Indicative building envelope — the footprint the setbacks allow, standing on the ground.
 * The top follows the terrain (`groundM[i] + maxHeightM`), because the Greek ΝΟΚ measures the
 * height from the ground at every point, not from one datum.
 */
export interface ListingTerrainEnvelope {
  /** Flat `[x, y, …]` footprint ring in the snapshot frame (implicitly closed). */
  readonly footprint: readonly number[];
  /** Ground elevation under each footprint vertex, absolute metres. */
  readonly groundM: readonly number[];
  /** Declared numeric maximum height, metres — `null` ⇒ show the footprint only, never a guessed prism. */
  readonly maxHeightM: number | null;
}

/** Why no envelope is published even though one was requested. */
export type ListingTerrainEnvelopeOmission = 'outside-surface' | 'degenerate-footprint';

export interface ListingTerrainSnapshot {
  readonly version: typeof LISTING_TERRAIN_SNAPSHOT_VERSION;
  readonly mesh: ListingTerrainMesh;
  readonly contours: readonly ListingTerrainContour[];
  readonly contourIntervalM: number;
  readonly contourMajorEvery: number;
  /** Upper bounds (percent) of every slope class but the last — the classes the mesh indexes into. */
  readonly slopeBandsPct: readonly number[];
  /** Plot boundary ring in the snapshot frame, or `null` when the surface was not clipped. */
  readonly boundary: readonly number[] | null;
  readonly stats: ListingTerrainStats;
  readonly envelope: ListingTerrainEnvelope | null;
  readonly envelopeOmission: ListingTerrainEnvelopeOmission | null;
}

/** Why a snapshot cannot be built — surfaced to the person publishing, never swallowed. */
export type ListingTerrainRejection =
  /** Fewer than three points with a measured elevation: there is no surface. */
  | 'insufficient-surface'
  /** The boundary does not overlap the surface. */
  | 'empty-after-clip'
  /** More triangles than a listing should carry — decimate in the viewer first. */
  | 'too-dense';

export type ListingTerrainBuildResult =
  | { readonly ok: true; readonly snapshot: ListingTerrainSnapshot }
  | { readonly ok: false; readonly reason: ListingTerrainRejection };

/** The builder's input. All plan coordinates WORLD canonical mm (the survey's own frame). */
export interface ListingTerrainInput {
  readonly points: readonly TopoPoint[];
  readonly breaklines?: readonly Breakline[];
  /** Plot boundary to clip the surface to; `null` publishes the surface as surveyed. */
  readonly boundaryWorldMm: readonly PlanarPoint[] | null;
  /** Buildable footprint (from the setback engine) + declared height; `null` ⇒ no envelope. */
  readonly envelope: {
    readonly footprintWorldMm: readonly PlanarPoint[];
    readonly maxHeightM: number | null;
  } | null;
}
