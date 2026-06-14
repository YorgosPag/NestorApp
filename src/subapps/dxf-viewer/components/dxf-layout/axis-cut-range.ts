/**
 * ADR-455 — vertical section-cut slider range (PURE, no React).
 *
 * Unlike the horizontal cut (FFL-relative, 0…storeyHeight), the X/Y vertical cuts
 * are absolute world plan positions: the slider spans the loaded model's world
 * extent along that axis (`scene.bounds.min/max`, scene/canvas units — metres for
 * BIM scenes). Split from any hook so it is unit-testable without React.
 */

export interface AxisCutRange {
  /** Model min along the axis (scene/canvas units). */
  readonly min: number;
  /** Model max along the axis (scene/canvas units). */
  readonly max: number;
  /** Default cut position when the user first enables — model midpoint. */
  readonly default: number;
}

/**
 * Build the slider range for one world axis from the model's bounds along it.
 * Returns `null` when the extent is unknown/degenerate (no file loaded) — the
 * slider then hides, matching the horizontal cut's no-storey behaviour.
 */
export function computeAxisCutRange(
  min: number | null | undefined,
  max: number | null | undefined,
): AxisCutRange | null {
  if (
    typeof min !== 'number' || !Number.isFinite(min) ||
    typeof max !== 'number' || !Number.isFinite(max) ||
    max <= min
  ) {
    return null;
  }
  return { min, max, default: (min + max) / 2 };
}
