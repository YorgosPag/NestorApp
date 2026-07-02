/**
 * ADR-563 (Auto-Dimension) — Types & defaults for the automatic perimeter
 * dimensioning engine (Revit/ArchiCAD-grade "Automatic Exterior Dimensioning").
 *
 * Config/types file — NO logic (exempt from the 500-line rule). The engine
 * (`auto-dimension-engine.ts`) turns a set of BIM elements + these options into
 * real `LinearDimensionEntity[]` using the existing dimension SSoT.
 *
 * Model of the big players (converged): select elements → choose a reference
 * basis (faces vs axes vs opening-centers) → produce up to 3 parallel chains
 * per side (detail → axes → overall) → offset each chain outward from the model.
 *
 * @see auto-dimension-engine.ts       — orchestrator (extract → plan → factory)
 * @see auto-dimension-reference-extraction.ts — per-type reference points
 * @see auto-dimension-chain-planner.ts — 3-tier chain planning per side
 * @see auto-dimension-entity-factory.ts — ReferencePoint chains → dim entities
 */

import type { Point2D } from '../../../rendering/types/Types';

/** 2D axis-aligned bounds in world mm (plan projection). */
export interface Bounds2D {
  readonly min: Point2D;
  readonly max: Point2D;
}

/**
 * The four sides of the model bounding box. N/S dimension lines are horizontal
 * (measure the X axis); E/W lines are vertical (measure the Y axis).
 */
export type AutoDimSide = 'north' | 'south' | 'east' | 'west';

export const AUTO_DIM_SIDES: readonly AutoDimSide[] = ['south', 'north', 'west', 'east'];

/** True when the side's dimension line measures the world X axis (N/S). */
export function sideMeasuresX(side: AutoDimSide): boolean {
  return side === 'north' || side === 'south';
}

/**
 * The three architectural dimension rows, innermost → outermost:
 *   - `detail`  — openings / individual element edges (finest).
 *   - `axes`    — structural grid: column/foundation centers, wall centerlines.
 *   - `overall` — a single dimension spanning the whole extent.
 */
export type AutoDimTier = 'detail' | 'axes' | 'overall';

export const AUTO_DIM_TIERS: readonly AutoDimTier[] = ['detail', 'axes', 'overall'];

/**
 * Where distances are measured from, per the "smart basis" the big players use.
 *   - `smart` — structural (column/foundation/beam) → axis/center; walls → faces;
 *               openings → center. (default)
 *   - `faces` — every element contributes its outer faces (bbox edges).
 *   - `axes`  — every element contributes its center only (structural grid).
 */
export type AutoDimReferenceBasis = 'smart' | 'faces' | 'axes';

/** User-facing options mirrored by the ArchiCAD-style dialog. */
export interface AutoDimensionOptions {
  /** Which of the 3 tiers to emit (all true by default). */
  readonly tiers: Readonly<Record<AutoDimTier, boolean>>;
  /** Which of the 4 sides to place chains on (all true by default). */
  readonly sides: Readonly<Record<AutoDimSide, boolean>>;
  /** Reference basis for the `detail` / `axes` tiers. */
  readonly referenceBasis: AutoDimReferenceBasis;
  /** Include opening (door/window) centers in the `detail` tier. */
  readonly includeOpenings: boolean;
  /**
   * Φ3 — also place two orthogonal INTERIOR chains (one horizontal measuring X,
   * one vertical measuring Y) running through the plan centroid, dimensioning
   * the structural grid (ArchiCAD "Interior Dimensioning", auto cut-line at
   * center). Opt-in: default off keeps the perimeter-only output.
   */
  readonly interior: boolean;
  /**
   * Φ4-Β — also emit ALIGNED dimensions for SKEWED linear members (walls/beams
   * whose axis is not ~horizontal/vertical), measured parallel to the element's
   * own axis (Revit "Add Aligned Dimensions to Walls"). Axis-aligned members are
   * left to the perimeter/interior chains. Opt-in: default off.
   */
  readonly alignedSkewed: boolean;
  /** Perpendicular distance (mm) between adjacent chains — mirrors DIMDLI. */
  readonly distanceBetweenLines: number;
  /** Perpendicular distance (mm) from the model edge to the first (detail) chain. */
  readonly offsetFromModel: number;
}

/** Google-level sane defaults (Greek residential scale, mm). */
export const AUTO_DIMENSION_DEFAULTS: AutoDimensionOptions = {
  tiers: { detail: true, axes: true, overall: true },
  sides: { south: true, north: true, west: true, east: true },
  referenceBasis: 'smart',
  includeOpenings: true,
  interior: false,
  alignedSkewed: false,
  distanceBetweenLines: 400,
  offsetFromModel: 600,
};

/**
 * Which extent of a host's bbox (on the measured axis) a reference rides.
 * Drives the ADR-563 Φ2 `bimExtent` associativity re-projection.
 */
export type AutoDimEdge = 'min' | 'max' | 'center';

/**
 * A single reference coordinate contributed by one element to one side's chain.
 * `coord` is the scalar along the side's measured axis (X for N/S, Y for E/W).
 */
export interface ReferencePoint {
  /** Scalar coordinate along the measured axis (world mm). */
  readonly coord: number;
  /** Which side chain this belongs to. */
  readonly side: AutoDimSide;
  /** Which tier this belongs to. */
  readonly tier: AutoDimTier;
  /** Host entity id that produced this coordinate (for association tracking). */
  readonly sourceEntityId: string;
  /** Which bbox extent of the host this coord came from (Φ2 follow-on-move). */
  readonly edge: AutoDimEdge;
}

/**
 * A planned linear dimension between two adjacent reference coordinates on a
 * side, already resolved to world def points + rotation. Consumed by the
 * entity factory.
 */
export interface PlannedSegment {
  /**
   * The world axis this segment measures — SSoT for the `bimExtent`
   * associativity re-projection (X for horizontal chains, Y for vertical).
   * Set by both the perimeter chain-planner and the Φ3 interior planner so the
   * factory never has to infer it from `side` (interior segments have no side).
   */
  readonly axis: 'x' | 'y';
  /**
   * Which dimension entity the factory emits. `'linear'` (default) → axis-aligned
   * `LinearDimensionEntity` with `rotation`; `'aligned'` (Φ4-Β) → `AlignedDimensionEntity`
   * whose dim line is parallel to `defPoints[0]→defPoints[1]` (skewed members).
   */
  readonly dimensionType?: 'linear' | 'aligned';
  /** Perimeter-only metadata (which of the 4 sides). Absent for interior chains. */
  readonly side?: AutoDimSide;
  /** Perimeter-only metadata (which of the 3 tiers). Absent for interior chains. */
  readonly tier?: AutoDimTier;
  /** [extOrigin1, extOrigin2, dimLineRef] — LinearDimensionEntity.defPoints. */
  readonly defPoints: readonly [Point2D, Point2D, Point2D];
  /** Dim line angle in degrees (0 = horizontal N/S, 90 = vertical E/W). */
  readonly rotation: number;
  /** Association source for defPoint 0, if any. */
  readonly source1?: { readonly id: string; readonly edge: AutoDimEdge };
  /** Association source for defPoint 1, if any. */
  readonly source2?: { readonly id: string; readonly edge: AutoDimEdge };
}
