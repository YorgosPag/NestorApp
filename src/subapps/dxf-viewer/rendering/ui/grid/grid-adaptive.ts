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

import { clamp01 } from '../../../utils/scalar-math';

export interface AdaptiveLevelInputs {
  /** World-space base step (settings.size). */
  readonly worldStep: number;
  /** Current view scale (px per world unit). */
  readonly scale: number;
  /** Number of minor subdivisions per major (settings.majorInterval ≥ 2). */
  readonly subDivisions: number;
  /**
   * The ONLY density knob: the cascade band's low edge, in MINOR screen px.
   * Below it the grid coarsens. The band's high edge and the cross-fade window
   * are DERIVED from it — see `computeAdaptiveLevels` for why they cannot be
   * independent inputs.
   */
  readonly minSpacingPx: number;
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
  /** Sole density knob — the cascade band floor. Band top + cross-fade derive from it. */
  readonly minSpacingPx: number;
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
    minSpacingPx: input.minSpacingPx,
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
  const alpha = clamp01(dtMs / durationMs);
  return previous + (target - previous) * alpha;
}

/**
 * Compute on-screen minor + major spacings and the minor opacity factor.
 *
 * ## Cascading semantics
 *
 *  - The user's `settings.size` is the BASE step — the cascade's anchor.
 *  - At any zoom the renderer picks the cascade level whose MINOR on-screen
 *    spacing lands inside `[minSpacingPx, minSpacingPx * subDivisions]`
 *    (default 10-50 px, so major lands at 50-250 px with 5 subdivisions —
 *    the AutoCAD `GRIDDISPLAY` / Fusion 360 feel). The band tracks the MINOR
 *    level because that is the finer of the two drawn levels and therefore
 *    the one that sets perceived density.
 *  - Role assignments are stable: the FINER active level is always the
 *    "minor" (`minorColor` / `minorWeight`), the COARSER always the "major"
 *    (`majorColor` / `majorWeight`). Colors NEVER swap at zoom — they follow
 *    the role, not the absolute level.
 *
 * ## Cross-fade — why the band top and the fade window are DERIVED
 *
 * Mirrored verbatim from this repo's MAXON/Cinema 4D grid SSoT
 * (`bim-3d/scene/grid/cinema4d-grid-material.ts`, ADR-558 — Giorgio's
 * "do it like C4D"), whose fragment shader reads:
 *
 * ```glsl
 * float lodFade = lod - lodFloor;   // 0 just after a step, ->1 just before
 * float minorC = lineCoverage(...) * (1.0 - lodFade);   // minor cross-fades
 * float majorC = lineCoverage(...);                     // major stays full
 * ```
 *
 * `lodFade` is the fractional position inside the cascade period, measured in
 * LOG space because the cascade is geometric (ratio `subDivisions`). The 2D
 * equivalent is `log_subDivisions(bandTop / minorScreenPx)`.
 *
 * This makes the level change invisible, and the proof is arithmetic:
 *
 *  - minor at the band TOP  → `lodFade = 0` → opacity 1 (sparsest, fully drawn)
 *  - minor at the band FLOOR → `lodFade = 1` → opacity 0 (densest, invisible)
 *
 * So the instant before the cascade coarsens, the minor level has already
 * faded to nothing and the only lines on screen are the major ones. The step
 * then promotes that very major level to "minor" at the identical spacing and
 * full opacity. Visible line spacing before the step == after the step ⇒ no
 * density pop.
 *
 * That continuity holds ONLY when the band spans exactly one cascade period,
 * i.e. `bandTop === minSpacingPx * subDivisions`. A band ratio above that
 * leaves the minor still partly visible when the step fires (residual pop);
 * below it, the minor is dead over part of the band. The band top is therefore
 * a STRUCTURAL CONSEQUENCE of the cascade, not a preference — so it is derived
 * here rather than accepted as an input, exactly as C4D exposes a single
 * `uMinCellPx` knob and derives the rest.
 *
 * The same reasoning retires the old independent `[fadeMinPx, fadeMaxPx]`
 * window. Shipped as `[2,10]` while the minor lived in `[10,50]`, its
 * smoothstep saturated at 1 for every reachable zoom — the cross-fade was
 * dead code and the ×`subDivisions` density jump was fully exposed on every
 * wheel click (measured 2026-07-20: minor 10.48px → 44.56px between two
 * consecutive wheel clicks, opacity 1.0 on both sides).
 *
 * Pure function — safe inside hot render paths.
 */
export function computeAdaptiveLevels(input: AdaptiveLevelInputs): AdaptiveLevels {
  const { worldStep, scale, subDivisions, minSpacingPx } = input;

  // A cascade needs a real geometric period; `log(1)` is 0 and would make the
  // fade term divide by zero. GridRenderer routes `majorInterval <= 1` to the
  // legacy path, but keep the math total for direct callers.
  if (!(subDivisions > 1) || !(scale > 0) || !(worldStep > 0) || !(minSpacingPx > 0)) {
    const flatPx = worldStep * scale;
    return { majorScreenPx: flatPx, minorScreenPx: flatPx, minorOpacity: 1 };
  }

  // DERIVED — one cascade period above the floor. See the doc block above:
  // any other value reintroduces the pop this function exists to remove.
  const maxSpacingPx = minSpacingPx * subDivisions;

  let minorWorldStep = worldStep;
  // Defensive bounds prevent runaway loops when scale is denormal / NaN.
  let safety = 64;
  while (minorWorldStep * scale < minSpacingPx && safety-- > 0) {
    minorWorldStep *= subDivisions;
  }
  safety = 64;
  while (minorWorldStep * scale > maxSpacingPx && safety-- > 0) {
    minorWorldStep /= subDivisions;
  }

  const minorScreenPx = minorWorldStep * scale;
  const majorScreenPx = minorScreenPx * subDivisions;

  // C4D `1.0 - lodFade`, in log space over the cascade period.
  const lodFade = clamp01(Math.log(maxSpacingPx / minorScreenPx) / Math.log(subDivisions));

  return { majorScreenPx, minorScreenPx, minorOpacity: 1 - lodFade };
}
