/**
 * ADR-362 Phase B1 — Dimension geometry builder (orchestrator).
 *
 * Pure entry-point: maps a `DimensionEntity` + resolved `DimStyle` to the
 * renderer-facing `DimGeometry` (dim line, ext lines, arrow anchors/directions,
 * text anchor/rotation, measurement). No React, no Firestore, no stores.
 *
 * Phase B1 scope: `linear` + `aligned`. Other variants throw with the sentinel
 * `[dim-geometry-builder]` prefix; Phase B2/B3 will plug them in via the same
 * switch (radial/angular/ordinate/chained).
 *
 * Per-variant calc lives in `./builders/*` to keep each file focused (Google
 * SRP, ≤500 LOC) and to allow Phase B2/B3 to add files without touching this
 * orchestrator beyond a new `case` line.
 */

import type { DimensionEntity, DimStyle } from '../../types/dimension';
import type { Point2D } from '../../rendering/types/Types';
import {
  buildAlignedGeometry,
  buildLinearGeometry,
} from './builders/linear-aligned-builder';

/** A line segment defined by two endpoints. */
export interface DimLineSegment {
  start: Point2D;
  end: Point2D;
}

/**
 * Pure geometric payload produced by `buildDimensionGeometry`.
 * The renderer consumes these fields directly — no further computation needed
 * beyond style-driven styling (color, line dash) and arrowhead block rotation.
 *
 * Conventions:
 *   - `arrowAnchor*` = tip of the arrowhead (lies on the dim line at the foot
 *     of the corresponding extension line).
 *   - `arrowDirection*` = UNIT vector pointing OUTWARD from the dim line span
 *     (i.e. from foot2 → foot1 for arrow 1). Renderer rotates the arrowhead
 *     block so its native `-X` apex (ADR-150) aligns with this vector.
 *   - `extLine*` = `null` when the corresponding `DimStyle.suppressExtLine*`
 *     flag is set OR when the geometry is degenerate (ext origin coincides
 *     with its foot).
 *   - `textAnchor` honours `entity.textMidpoint` override when present,
 *     otherwise = midpoint of the dim line span (foot1 ↔ foot2).
 *   - `textRotation` = radians, `0` for horizontal text (DIMTIH=true), else
 *     the dim-line angle normalised to the readability range (-π/2, π/2].
 *   - `measurementValue` = raw measured distance in world units (mm for
 *     linear/aligned). Caller applies DIMLFAC etc. via `dim-text-formatter`.
 */
export interface DimGeometry {
  dimLine: DimLineSegment;
  extLine1: DimLineSegment | null;
  extLine2: DimLineSegment | null;
  arrowAnchor1: Point2D;
  arrowAnchor2: Point2D;
  arrowDirection1: Point2D;
  arrowDirection2: Point2D;
  textAnchor: Point2D;
  textRotation: number;
  measurementValue: number;
}

/**
 * Dispatch to the per-variant builder. Throws for variants not yet implemented
 * (Phase B2/B3 will extend the switch).
 */
export function buildDimensionGeometry(
  entity: DimensionEntity,
  style: DimStyle,
): DimGeometry {
  switch (entity.dimensionType) {
    case 'linear':
      return buildLinearGeometry(entity, style);
    case 'aligned':
      return buildAlignedGeometry(entity, style);
    default:
      throw new Error(
        `[dim-geometry-builder] dimensionType '${entity.dimensionType}' not implemented in Phase B1 (Linear+Aligned only).`,
      );
  }
}
