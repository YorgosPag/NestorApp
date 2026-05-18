/**
 * ADR-362 Phase L1 — Center mark geometry builder.
 *
 * Pure computation: given a circle center, radius, and DIMCEN value, produces
 * the line segments that form the center mark cross and optional extension lines.
 *
 * DIMCEN sign convention (mirrors AutoCAD):
 *   > 0  → short cross at center only (arm half-length = dimcen × dimscale)
 *   < 0  → cross at center + four extension lines beyond the circle boundary
 *   = 0  → nothing rendered
 *
 * All output coordinates are in world space (mm). The caller (renderer) converts
 * to screen via `CoordinateTransforms.worldToScreen`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md §D13
 */

import type { DimLineSegment } from './dim-geometry-builder';
import type { Point2D } from '../../rendering/types/Types';

// ── Public types ─────────────────────────────────────────────────────────────

export interface CenterMarkGeometry {
  /** Cross lines at center (present for dimcen !== 0). */
  readonly crossLines: readonly DimLineSegment[];
  /** Extension lines beyond circle boundary (present only for dimcen < 0). */
  readonly extLines: readonly DimLineSegment[];
}

const EMPTY: CenterMarkGeometry = { crossLines: [], extLines: [] };

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute center mark geometry for a radial dimension.
 *
 * @param center   - Circle/arc center in world coordinates.
 * @param radius   - Circle radius in world mm.
 * @param dimcen   - DIMSTYLE DIMCEN value (signed, raw paper mm).
 * @param dimscale - DIMSTYLE DIMSCALE (unitless annotation scale factor).
 */
export function computeCenterMarkGeometry(
  center: Point2D,
  radius: number,
  dimcen: number,
  dimscale: number,
): CenterMarkGeometry {
  if (dimcen === 0) return EMPTY;

  const e = Math.abs(dimcen) * dimscale;
  const { x: cx, y: cy } = center;

  const crossLines: DimLineSegment[] = [
    { start: { x: cx - e, y: cy }, end: { x: cx + e, y: cy } },
    { start: { x: cx, y: cy - e }, end: { x: cx, y: cy + e } },
  ];

  if (dimcen > 0) {
    return { crossLines, extLines: [] };
  }

  // dimcen < 0: four extensions from circle edge outward by e
  const extLines: DimLineSegment[] = [
    { start: { x: cx + radius, y: cy }, end: { x: cx + radius + e, y: cy } },
    { start: { x: cx - radius, y: cy }, end: { x: cx - radius - e, y: cy } },
    { start: { x: cx, y: cy + radius }, end: { x: cx, y: cy + radius + e } },
    { start: { x: cx, y: cy - radius }, end: { x: cx, y: cy - radius - e } },
  ];

  return { crossLines, extLines };
}
