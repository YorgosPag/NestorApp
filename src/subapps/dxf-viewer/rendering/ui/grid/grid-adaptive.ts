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

// ─── Renderer integration helper ────────────────────────────────────────────

export interface AdaptiveLineRenderInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly drawLines: (gridSize: number) => void;
  readonly worldStep: number;
  readonly scale: number;
  readonly subDivisions: number;
  readonly fadeMinPx: number;
  readonly fadeMaxPx: number;
  readonly fadeDurationMs: number;
  readonly minorColor: string;
  readonly minorWeight: number;
  readonly majorColor: string;
  readonly majorWeight: number;
  readonly showMinor: boolean;
  readonly showMajor: boolean;
  readonly previousOpacity: number;
  readonly previousTimestampMs: number;
  readonly markDirty: () => void;
}

export interface AdaptiveLineRenderOutput {
  readonly renderedOpacity: number;
  readonly timestampMs: number;
}

/** Run the adaptive 2-pass minor+major draw with smoothstep + temporal lerp. */
export function renderAdaptiveGridLines(input: AdaptiveLineRenderInput): AdaptiveLineRenderOutput {
  const { ctx } = input;
  const { majorScreenPx, minorScreenPx, minorOpacity: target } = computeAdaptiveLevels({
    worldStep: input.worldStep,
    scale: input.scale,
    subDivisions: input.subDivisions,
    fadeMinPx: input.fadeMinPx,
    fadeMaxPx: input.fadeMaxPx,
  });
  const now = performance.now();
  const dtMs = input.previousTimestampMs > 0 ? now - input.previousTimestampMs : 0;
  const renderedOpacity = lerpOpacityTowards(input.previousOpacity, target, dtMs, input.fadeDurationMs);
  if (Math.abs(target - renderedOpacity) > 0.005) input.markDirty();

  const baseAlpha = ctx.globalAlpha;
  if (input.showMinor && renderedOpacity > 0.001) {
    ctx.globalAlpha = baseAlpha * renderedOpacity;
    ctx.strokeStyle = input.minorColor;
    ctx.lineWidth = input.minorWeight;
    input.drawLines(minorScreenPx);
  }
  if (input.showMajor) {
    ctx.globalAlpha = baseAlpha;
    ctx.strokeStyle = input.majorColor;
    ctx.lineWidth = input.majorWeight;
    input.drawLines(majorScreenPx);
  }
  ctx.globalAlpha = baseAlpha;
  return { renderedOpacity, timestampMs: now };
}

/**
 * Apply a time-based lerp toward a target opacity. Returns the new
 * displayed opacity given the previous frame's value, target, and elapsed
 * time. Duration ≤ 0 → instant (returns target).
 *
 * Formula: per-frame factor `α = clamp(dt / duration, 0, 1)`, lerped via
 * `prev + (target - prev) * α`. This produces an exponential-ish ease that
 * starts fast and asymptotes — visually pleasant for grid fades.
 */
export function lerpOpacityTowards(
  previous: number,
  target: number,
  dtMs: number,
  durationMs: number,
): number {
  if (durationMs <= 0 || dtMs <= 0) return target;
  const alpha = Math.max(0, Math.min(1, dtMs / durationMs));
  return previous + (target - previous) * alpha;
}

/**
 * Compute on-screen minor + major spacings and the minor opacity factor.
 *
 * Cascading semantics (industry pattern — AutoCAD `GRIDDISPLAY`,
 * Fusion 360, tldraw 4-level grid, bgolus log-frac shader, Google Maps
 * tile LOD):
 *
 *  - The user's `settings.size` is the BASE step — the cascade's anchor.
 *  - At any zoom, the renderer picks the cascade level whose major
 *    on-screen spacing fits the target window `[fadeMaxPx, fadeMaxPx *
 *    subDivisions]`. As the user zooms in/out, the cascade level shifts
 *    by powers of `subDivisions` so the visible step always feels
 *    natural (~50-100 px on screen for major lines).
 *  - The role assignments are stable: at any zoom the FINER active
 *    level is the "minor" (rendered with the user-chosen `minorColor`
 *    and `minorWeight`), the COARSER active level is the "major"
 *    (`majorColor` / `majorWeight`). Colors NEVER swap at zoom — they
 *    follow the role, not the absolute level.
 *  - The major level is always at full opacity. The minor level fades
 *    smoothstep over `[fadeMinPx, fadeMaxPx]` based on its own on-screen
 *    spacing, providing a continuous transition at the moment the
 *    cascade is about to step up (when minor would become too dense).
 *
 * Pure function — safe inside hot render paths.
 */
export function computeAdaptiveLevels(input: AdaptiveLevelInputs): AdaptiveLevels {
  const { worldStep, scale, subDivisions, fadeMinPx, fadeMaxPx } = input;

  // Cascade window: the active major's screen spacing should fall within
  // `[fadeMaxPx, fadeMaxPx * subDivisions]`. That guarantees the active
  // minor (= major / subDivisions) lands inside `[fadeMaxPx /
  // subDivisions, fadeMaxPx]` — i.e. visible at full opacity until the
  // lower edge where smoothstep takes over.
  const targetMajorMin = fadeMaxPx;
  const targetMajorMax = fadeMaxPx * subDivisions;

  let majorWorldStep = worldStep;
  // Defensive bounds prevent runaway loops when scale is 0 / NaN.
  let safety = 64;
  while (majorWorldStep * scale < targetMajorMin && safety-- > 0) {
    majorWorldStep *= subDivisions;
  }
  safety = 64;
  while (majorWorldStep * scale > targetMajorMax && safety-- > 0) {
    majorWorldStep /= subDivisions;
  }

  const minorWorldStep = majorWorldStep / subDivisions;
  const minorScreenPx = minorWorldStep * scale;
  const majorScreenPx = majorWorldStep * scale;

  const denom = Math.max(0.001, fadeMaxPx - fadeMinPx);
  const t = Math.max(0, Math.min(1, (minorScreenPx - fadeMinPx) / denom));
  const minorOpacity = t * t * (3 - 2 * t); // smoothstep

  return { majorScreenPx, minorScreenPx, minorOpacity };
}
