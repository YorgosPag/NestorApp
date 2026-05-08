/**
 * 🌊 ADAPTIVE GRID — multi-level smooth fade math (pure helpers).
 *
 * Industry pattern (AutoCAD / Fusion 360 / OnShape / Figma / Miro): instead
 * of snapping the grid step to a discrete level when zoom crosses a
 * threshold, render minor + major simultaneously and smoothly fade the minor
 * level in/out as a function of its on-screen spacing.
 *
 * Extracted from GridRenderer to keep the renderer file under the
 * Google-level 500-line limit (CLAUDE.md SOS. N.7.1).
 *
 * @module rendering/ui/grid/grid-adaptive
 */

export interface AdaptiveLevelInputs {
  /** World-space base step (settings.size). */
  readonly worldStep: number;
  /** Current view scale (px per world unit). */
  readonly scale: number;
  /** Number of minor subdivisions per major (settings.majorInterval ≥ 2). */
  readonly subDivisions: number;
  /** Screen px below which the minor level is invisible. */
  readonly fadeMinPx: number;
  /** Screen px above which the minor level is fully visible. */
  readonly fadeMaxPx: number;
}

export interface AdaptiveLevels {
  readonly majorScreenPx: number;
  readonly minorScreenPx: number;
  readonly minorOpacity: number;
}

/**
 * Compute the active major + minor screen spacings and the minor opacity
 * factor (smoothstep over `[fadeMinPx, fadeMaxPx]`). Pure function — safe
 * to call inside hot render paths.
 */
export function computeAdaptiveLevels(input: AdaptiveLevelInputs): AdaptiveLevels {
  const { worldStep, scale, subDivisions, fadeMinPx, fadeMaxPx } = input;

  const minSpacing = fadeMinPx;
  const maxSpacing = fadeMaxPx * subDivisions;

  let majorWorldStep = worldStep;
  while (majorWorldStep * scale < minSpacing) majorWorldStep *= subDivisions;
  while (majorWorldStep * scale > maxSpacing) majorWorldStep /= subDivisions;

  const majorScreenPx = majorWorldStep * scale;
  const minorScreenPx = majorScreenPx / subDivisions;

  const denom = Math.max(0.001, fadeMaxPx - fadeMinPx);
  const t = Math.max(0, Math.min(1, (minorScreenPx - fadeMinPx) / denom));
  const minorOpacity = t * t * (3 - 2 * t); // smoothstep

  return { majorScreenPx, minorScreenPx, minorOpacity };
}
