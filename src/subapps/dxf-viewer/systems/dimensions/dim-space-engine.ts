/**
 * ADR-362 Phase K2 — DIMSPACE engine.
 *
 * Computes new definition-point positions so that a set of parallel/concentric
 * linear/aligned dimensions are evenly spaced (or aligned) relative to a base
 * dimension. Mirrors AutoCAD's DIMSPACE command.
 *
 * Modes:
 *   - 'auto'   — spacing = 2 × resolvedStyle.dimtxt (text height SSoT, DIMSPACE default)
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
// ADR-362 — dim-line frame SSoT (shared with dim-row-detect).
import { extractDimLineInfo, dimLineOffset } from './dim-line-info';

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
  const baseOffset = dimLineOffset(baseInfo);

  // Pair each target with its dim-line frame + signed offset delta from the base.
  const slots: { target: DimensionEntity; signedDelta: number }[] = [];
  for (const target of supported) {
    const info = extractDimLineInfo(target);
    if (!info) continue;
    slots.push({ target, signedDelta: dimLineOffset(info) - baseOffset });
  }

  // Split by side (above / below the base dim line) and order each side by
  // distance from the base, so the nearest dim lands in slot 1, the next in
  // slot 2, … → evenly STACKED. (Fixes the pre-fix bug where every target was
  // placed at the SAME `baseOffset ± spacing`, re-overlapping 3+ rows.)
  const above = slots.filter((s) => s.signedDelta >= 0).sort((a, b) => a.signedDelta - b.signedDelta);
  const below = slots.filter((s) => s.signedDelta < 0).sort((a, b) => b.signedDelta - a.signedDelta);

  const assignSide = (side: typeof slots, sign: 1 | -1): void => {
    side.forEach((s, i) => {
      const targetOffset = baseOffset + s.signedDelta;
      const newOffset = baseOffset + sign * spacing * (i + 1);
      const delta = newOffset - targetOffset;
      if (Math.abs(delta) < 1e-9) return;
      const pts = shiftDimLineRef(s.target, baseInfo.normal, delta);
      if (pts) result.set(s.target.id, { defPoints: pts });
    });
  };
  assignSide(above, 1);
  assignSide(below, -1);

  return result;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function resolveSpacing(
  mode: DimSpacingMode,
  style: DimStyle,
  customValue: number,
): number {
  switch (mode) {
    case 'auto':   return 2 * style.dimtxt;
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
 * Returns `target`'s defPoints with the dim-line reference (defPoints[2]) shifted
 * by `delta` along the base `normal` — i.e. re-offsets the whole dim line while
 * keeping its extension origins. `null` never returned (kept for symmetry with
 * the previous signature; callers already guard `delta`).
 */
function shiftDimLineRef(
  target: DimensionEntity,
  normal: Point2D,
  delta: number,
): readonly Point2D[] | null {
  const pts = [...target.defPoints] as Point2D[];
  const dimLineRef = pts[2];
  pts[2] = {
    x: dimLineRef.x + delta * normal.x,
    y: dimLineRef.y + delta * normal.y,
  };
  return pts;
}
