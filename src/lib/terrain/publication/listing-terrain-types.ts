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
import type { SnapshotFrame } from './listing-terrain-frame';

/**
 * Bumped on any breaking change of the snapshot SHAPE; readers refuse versions they do not know.
 * ⛔ Never bump it for a change of CONTENT — every published snapshot would read `unknown-version`. That is
 * {@link LISTING_TERRAIN_BUILDER_REVISION}.
 */
export const LISTING_TERRAIN_SNAPSHOT_VERSION = 2 as const;

/**
 * The previous shape, still READ (ADR-920 §14.11 Ζ2): a v1 snapshot is a v2 snapshot without a plot outline. Published
 * v1 files stay drawable until the shelf re-bakes them (the version is part of its recipe).
 */
export const LISTING_TERRAIN_SNAPSHOT_LEGACY_VERSION = 1 as const;

/**
 * ADR-920 Β6.9 Β — the revision of the builder (`buildListingTerrainSnapshot`): bumped on ANY change to the bytes it
 * produces for the same source (interval rule, simplification, rounding …), with the shape unchanged. It is part of
 * the public shelf's recipe ⇒ a bump re-bakes published snapshots on their next reconciliation, and the nightly pass
 * (ADR-845) finds them. Producer version in the cache key, apart from the schema version (Mapbox MTS recipes ·
 * Cloudinary named transformations · Bazel action keys).
 *
 * History: 1 = up to Β6.7 · 2 = Β6.8 (interval from on-screen density, 8 px minimum spacing) · 3 = Β6.11 Ζ2 (the plot
 * outline, its area and the share of it the relief covers).
 */
export const LISTING_TERRAIN_BUILDER_REVISION = 3 as const;

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

/**
 * ADR-920 §14.11 Π1 — the plot outline DRAWN on the relief. A different idea from {@link ListingTerrainSnapshot.boundary}
 * (= «the surface was CUT to this», Civil 3D outer/data clip): the outline cuts nothing — mesh, contours, slopes and
 * stats are exactly what they would be without it (Civil 3D show/hide).
 */
export interface ListingTerrainPlotOutline {
  /** Flat `[x, y, …]` ring in the snapshot frame (implicitly closed). */
  readonly ring: readonly number[];
  /** Plan area of the outline, m². */
  readonly areaM2: number;
  /** Π6 — the relief covers all of it, or only part (a disjoint outline is never published: see the omission). */
  readonly coverage: 'covered' | 'partial';
  /** Share of the outline's area the published relief covers, in `[0, 1]`, rounded to the hundredth. */
  readonly coveredFraction: number;
}

/**
 * Why no outline is published even though the source has one. Never «hidden by the owner» (Π9): an outline the owner
 * keeps private is simply not part of the PUBLIC input, so the public snapshot has nothing to omit.
 */
export type ListingTerrainPlotOutlineOmission =
  /** Π6 — not one square millimetre in common with the relief: a different system or a different area. */
  | 'outside-surface'
  /** Fewer than three corners, zero area or a self-intersecting ring. */
  | 'degenerate-outline';

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
  /** ADR-920 §14.11 — the plot outline drawn on the relief, or `null` (none, kept private, or omitted — see below). */
  readonly plotOutline: ListingTerrainPlotOutline | null;
  readonly plotOutlineOmission: ListingTerrainPlotOutlineOmission | null;
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
  | {
      readonly ok: true;
      readonly snapshot: ListingTerrainSnapshot;
      /**
       * The frame the snapshot was built in — for a caller that must place a WORLD point on the published picture
       * (the owner's preview marks contradicting survey points, ADR-920 Β4.8). It is NOT part of the snapshot and is
       * never serialised: the ONE world→published conversion stays {@link SnapshotFrame} (Δ3).
       */
      readonly frame: SnapshotFrame;
    }
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
  /**
   * ADR-920 §14.11 — the plot outline to DRAW on the relief (it clips nothing); absent or `null` ⇒ none. Who may see it
   * (Π9) is decided before the builder, by `toListingTerrainInput(source, audience)`.
   */
  readonly plotOutlineWorldMm?: readonly PlanarPoint[] | null;
}
