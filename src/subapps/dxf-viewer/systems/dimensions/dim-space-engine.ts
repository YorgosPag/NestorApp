/**
 * ADR-362 Phase K2 — DIMSPACE engine.
 *
 * Computes new definition-point positions so that a set of parallel/concentric
 * linear/aligned dimensions are evenly spaced (or aligned) relative to a base
 * dimension. Mirrors AutoCAD's DIMSPACE command.
 *
 * Modes:
 *   - 'auto'   — spacing = 2 × resolvedStyle.paperTextHeight (DIMSPACE default)
 *   - 'custom' — caller-supplied spacing value (mm paper)
 *   - 'align'  — spacing = 0 (collapse all dim lines to the base dim line)
 *
 * Supported: LINEAR + ALIGNED dimension types. Angular/radial are not supported
 * (returns an empty map — the caller should filter to supported types before invoking).
 *
 * Output: a map of `dimensionId → new defPoints array`. The caller creates an
 * undo-able `UpdateEntityCommand` (or `UpdateWallParamsCommand` pattern) with
 * the returned patches.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md §D12
 */

import type { DimensionEntity, DimStyle } from '../../types/dimension';
import type { Point2D } from '../../rendering/types/Types';

// ── Public types ─────────────────────────────────────────────────────────────

export type DimSpacingMode = 'auto' | 'custom' | 'align';

/**
 * Spacing patches keyed by dimension entity id.
 * Each entry contains only the new `defPoints` — callers merge the rest of the
 * entity unchanged.
 */
export type DimSpacingResult = Map<string, { defPoints: readonly Point2D[] }>;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute dimension spacing adjustments.
 *
 * @param baseDim     - The reference dimension (its dim-line position stays fixed).
 * @param targetDims  - Dimensions to reposition (linear/aligned only).
 * @param style       - Resolved DimStyle of the base dimension.
 * @param mode        - Spacing mode.
 * @param customValue - Spacing in mm paper (only used when mode === 'custom').
 */
export function computeDimSpacing(
  baseDim: DimensionEntity,
  targetDims: readonly DimensionEntity[],
  style: DimStyle,
  mode: DimSpacingMode,
  customValue = 0,
): DimSpacingResult {
  const result: DimSpacingResult = new Map();

  const supported = filterSupportedDims(targetDims);
  if (supported.length === 0) return result;

  const spacing = resolveSpacing(mode, style, customValue);
  const baseInfo = extractDimLineInfo(baseDim);
  if (!baseInfo) return result;

  for (const target of supported) {
    const targetInfo = extractDimLineInfo(target);
    if (!targetInfo) continue;

    const newDefPoints = repositionDim(
      target, baseInfo, targetInfo, spacing,
    );
    if (newDefPoints) {
      result.set(target.id, { defPoints: newDefPoints });
    }
  }

  return result;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function resolveSpacing(
  mode: DimSpacingMode,
  style: DimStyle,
  customValue: number,
): number {
  switch (mode) {
    case 'auto':   return 2 * style.paperTextHeight;
    case 'custom': return Math.max(0, customValue);
    case 'align':  return 0;
  }
}

function filterSupportedDims(dims: readonly DimensionEntity[]): DimensionEntity[] {
  return dims.filter(
    (d) => d.dimensionType === 'linear' || d.dimensionType === 'aligned',
  );
}

/**
 * Information extracted from a linear/aligned dim needed for spacing.
 * `dimLineRef` is defPoints[2] (the reference point on the dim line side).
 * `originA` and `originB` are the two extension-line origin points (defPoints[0], [1]).
 */
interface DimLineInfo {
  originA: Point2D;
  originB: Point2D;
  dimLineRef: Point2D;
  /** Direction along the dim line (unit vector). */
  dimDir: Point2D;
  /** Normal to the dim line (unit vector, points from origins to dim-line side). */
  normal: Point2D;
}

function extractDimLineInfo(dim: DimensionEntity): DimLineInfo | null {
  if (dim.dimensionType !== 'linear' && dim.dimensionType !== 'aligned') {
    return null;
  }
  const pts = dim.defPoints;
  if (pts.length < 3) return null;

  const [originA, originB, dimLineRef] = pts;

  const dx = originB.x - originA.x;
  const dy = originB.y - originA.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) return null;

  const dimDir: Point2D = { x: dx / len, y: dy / len };
  // Normal = perpendicular, oriented toward dimLineRef side
  const rawNx = -dy / len;
  const rawNy = dx / len;
  const toDimLine: Point2D = {
    x: dimLineRef.x - originA.x,
    y: dimLineRef.y - originA.y,
  };
  const sign = rawNx * toDimLine.x + rawNy * toDimLine.y >= 0 ? 1 : -1;
  const normal: Point2D = { x: rawNx * sign, y: rawNy * sign };

  return { originA, originB, dimLineRef, dimDir, normal };
}

/**
 * Compute the signed perpendicular distance from `originA` to `dimLineRef`
 * along the `normal` direction.
 */
function dimLineOffset(info: DimLineInfo): number {
  const dx = info.dimLineRef.x - info.originA.x;
  const dy = info.dimLineRef.y - info.originA.y;
  return dx * info.normal.x + dy * info.normal.y;
}

/**
 * Returns the new defPoints for `target` repositioned at `baseOffset + spacing`.
 * The spacing sign is determined by the target's original side relative to base.
 */
function repositionDim(
  target: DimensionEntity,
  base: DimLineInfo,
  targetInfo: DimLineInfo,
  spacing: number,
): readonly Point2D[] | null {
  const baseOffset = dimLineOffset(base);
  const targetOffset = dimLineOffset(targetInfo);

  // Determine how many "slots" away from base this target should be.
  // For a single invocation (one base + N targets), we simply place each target
  // at `sign(targetOffset - baseOffset) × spacing` from base.
  const sign = targetOffset >= baseOffset ? 1 : -1;
  const newOffset = baseOffset + sign * spacing;
  const delta = newOffset - targetOffset;

  if (Math.abs(delta) < 1e-9) return null;

  // Shift the dimLineRef along the normal by `delta`.
  const pts = [...target.defPoints];
  const dimLineRef = pts[2];
  const newDimLineRef: Point2D = {
    x: dimLineRef.x + delta * base.normal.x,
    y: dimLineRef.y + delta * base.normal.y,
  };
  const result = [...pts] as Point2D[];
  result[2] = newDimLineRef;
  return result;
}
