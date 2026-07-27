/**
 * SCALE DIMENSION — ADR-348 SSoT, dimension branch.
 *
 * Extracted from `scale-entity-transform.ts` (N.7.1 file-size ceiling) because a dimension is the
 * only entity whose geometry lives in a *variant-dependent* point list plus a set of cached
 * scalars, so its scale rule is longer than every other branch.
 *
 * ⚠️ WHY THIS EXISTS (ADR-716 Φ7, live verification 2026-07-27):
 * the dimension model migrated to the canonical `defPoints` / `textMidpoint` fields, but the
 * scale branch kept transforming ONLY the deprecated `startPoint` / `endPoint` / `textPosition`
 * mirrors. The builders (`linear-aligned-builder`, `radial-builder`, …) read `defPoints`, so on
 * any non-mm import the canonical-mm pass (`applyCanonicalMmScale`, ×1000 for a metre survey)
 * moved the legacy mirrors and left the drawn geometry behind — every dimension rendered 1000×
 * small, parked near the world origin, far outside the sheet. Invisible in mm files (factor 1),
 * which is why it survived: it only fires for the very class of drawing ADR-716 unlocked.
 *
 * Rule of thumb for this file: a POINT or a LENGTH scales, an ANGLE never does.
 *
 * @see ADR-348 §Entity Transform · ADR-716 §Φ7 · types/dimension.ts (defPoints semantics)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { DimensionManualBreaks } from '../../types/dimension';

/** Shape this module reads — the geometric surface of `DimensionEntityCommon` + variant extras. */
type ScalableDimension = Entity & { type: 'dimension' } & {
  dimensionType?: string;
  defPoints?: readonly Point2D[];
  textMidpoint?: Point2D;
  datum?: Point2D;
  leaderLength?: number;
  measurementValue?: number;
  manualBreaks?: DimensionManualBreaks;
};

/**
 * Angular variants measure an ANGLE in degrees, not a distance — their `measurementValue` is
 * scale-invariant (a 90° corner stays 90° under any uniform scale).
 */
const ANGULAR_DIMENSION_TYPES: ReadonlySet<string> = new Set(['angular2L', 'angular3P']);

/** The four DIMBREAK point sets — world-space, so each scales with the line it interrupts. */
const BREAK_KEYS = ['dimLinePoints', 'extLine1Points', 'extLine2Points', 'leaderPoints'] as const;

function scaleManualBreaks(
  breaks: DimensionManualBreaks,
  scalePoint: (p: Point2D) => Point2D,
): DimensionManualBreaks {
  const out: { -readonly [K in typeof BREAK_KEYS[number]]?: readonly Point2D[] } = {};
  for (const key of BREAK_KEYS) {
    const pts = breaks[key];
    if (pts) out[key] = pts.map(scalePoint);
  }
  return out;
}

/**
 * Resolve the cached `measurementValue` after a scale.
 *
 * - angular → returned unchanged (degrees).
 * - uniform scale → multiplied by the single length factor.
 * - non-uniform scale → a length is NOT recoverable from one factor, so the cache is dropped
 *   (`undefined`). The type documents it as "recomputed on geometry change" and the builders do
 *   exactly that from the freshly scaled `defPoints`, so the drawing stays correct; the DXF
 *   writer already treats an absent value as `0`, its "recompute me" convention.
 */
function scaledMeasurement(
  e: ScalableDimension,
  sx: number,
  sy: number,
): { measurementValue?: number } | Record<string, never> {
  if (e.measurementValue === undefined) return {};
  if (ANGULAR_DIMENSION_TYPES.has(e.dimensionType ?? '')) return {};
  const absSx = Math.abs(sx);
  if (absSx !== Math.abs(sy)) return { measurementValue: undefined };
  return { measurementValue: e.measurementValue * absSx };
}

/**
 * Scale every geometric field of a dimension around `base`.
 *
 * Canonical fields (`defPoints`, `textMidpoint`, `datum`, `leaderLength`, `manualBreaks`) are what
 * the renderers read; the deprecated `startPoint` / `endPoint` / `textPosition` mirrors are kept in
 * step so nothing that still reads them diverges from what is drawn.
 */
export function scaleDimension(
  entity: Entity & { type: 'dimension' },
  base: Point2D,
  sx: number,
  sy: number,
) {
  const e = entity as ScalableDimension;
  const at = (p: Point2D): Point2D => ({
    x: base.x + (p.x - base.x) * sx,
    y: base.y + (p.y - base.y) * sy,
  });
  return {
    ...(e.defPoints && { defPoints: e.defPoints.map(at) }),
    ...(e.textMidpoint && { textMidpoint: at(e.textMidpoint) }),
    ...(e.datum && { datum: at(e.datum) }),
    ...(e.leaderLength !== undefined && { leaderLength: e.leaderLength * Math.abs(sx) }),
    ...(e.manualBreaks && { manualBreaks: scaleManualBreaks(e.manualBreaks, at) }),
    ...scaledMeasurement(e, sx, sy),
    ...(entity.startPoint !== undefined && { startPoint: at(entity.startPoint) }),
    ...(entity.endPoint !== undefined && { endPoint: at(entity.endPoint) }),
    ...(entity.textPosition !== undefined && { textPosition: at(entity.textPosition) }),
  };
}
