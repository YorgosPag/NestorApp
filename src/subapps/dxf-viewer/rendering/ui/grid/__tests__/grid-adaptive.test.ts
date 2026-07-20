/**
 * 🪜 ADAPTIVE GRID CASCADE — regression anchors.
 *
 * These pin ONE invariant, which three separate 2026-07-20 defects all
 * violated in different places: **quantities that are coupled by the cascade
 * geometry must be DERIVED, never configured side by side.**
 *
 *  1. (fixed earlier that day) the cascade band was derived from `fadeMaxPx`,
 *     pinning minor lines to a 2-10px carpet;
 *  2. (same) the band constrained the MAJOR level, letting minor collapse
 *     below it;
 *  3. (this suite's subject) the fade window `[2,10]` and the cascade band
 *     `[10,50]` were independent inputs that no longer overlapped, so the
 *     smoothstep saturated at 1 for every reachable zoom. The cross-fade was
 *     dead code and the ×subDivisions density jump was fully exposed on each
 *     mouse-wheel click — measured on Giorgio's two screenshots as minor
 *     10.48px → 44.56px with opacity 1.0 on both sides.
 *
 * The fix mirrors this repo's MAXON/Cinema 4D grid SSoT
 * (`bim-3d/scene/grid/cinema4d-grid-material.ts`, ADR-558): a single density
 * anchor, with the band top and the fade window derived from it in log space.
 *
 * @see ../grid-adaptive.ts
 */
import { computeAdaptiveLevels, renderAdaptiveGrid } from '../grid-adaptive';

/** Shipped defaults: 10px cascade anchor, 5 subdivisions ⇒ derived band 10-50px. */
const BASE = {
  worldStep: 10,
  subDivisions: 5,
  minSpacingPx: 10,
} as const;

/** Derived band top — one full cascade period above the anchor. */
const BAND_TOP = BASE.minSpacingPx * BASE.subDivisions;

/**
 * Perceived ink density (lines per screen px) actually produced by the 2-pass
 * renderer: every major position is drawn opaque, every other minor position
 * is drawn at `minorOpacity`.
 *
 * This is the quantity Giorgio's complaint is about ("από ξεκούραστη οθόνη σε
 * πάρα πολλές γραμμές"), so it — not opacity in isolation — is what the
 * continuity anchors assert.
 */
function perceivedDensity(levels: {
  minorScreenPx: number;
  majorScreenPx: number;
  minorOpacity: number;
}): number {
  const majorDensity = 1 / levels.majorScreenPx;
  const minorDensity = 1 / levels.minorScreenPx;
  return majorDensity + (minorDensity - majorDensity) * levels.minorOpacity;
}

describe('computeAdaptiveLevels — cascade band', () => {
  it('keeps MINOR spacing inside the derived band across 6 zoom decades', () => {
    // The band tracks the minor level: it is the finer of the two drawn levels
    // and therefore the one the user perceives as density. Asserting the major
    // instead would pass even when minor collapses to a 1-5px carpet — that is
    // exactly how defect (2) survived unnoticed.
    for (let exp = -3; exp <= 3; exp += 0.25) {
      const { minorScreenPx } = computeAdaptiveLevels({ ...BASE, scale: Math.pow(10, exp) });
      expect(minorScreenPx).toBeGreaterThanOrEqual(BASE.minSpacingPx - 1e-6);
      expect(minorScreenPx).toBeLessThanOrEqual(BAND_TOP + 1e-6);
    }
  });

  it('holds major exactly subDivisions above minor (no silent level desync)', () => {
    for (let exp = -2; exp <= 2; exp += 0.5) {
      const { minorScreenPx, majorScreenPx } = computeAdaptiveLevels({ ...BASE, scale: Math.pow(10, exp) });
      expect(majorScreenPx / minorScreenPx).toBeCloseTo(BASE.subDivisions, 9);
    }
  });

  it('derives the band top from the anchor — both edges move together', () => {
    // Proves the anchor is genuinely wired, so the band assertions above pass
    // for the right reason rather than because the input is ignored.
    const scale = 0.4;
    const tight = computeAdaptiveLevels({ ...BASE, scale, minSpacingPx: 4 });
    const loose = computeAdaptiveLevels({ ...BASE, scale, minSpacingPx: 40 });
    expect(loose.minorScreenPx).toBeGreaterThan(tight.minorScreenPx);
    expect(tight.minorScreenPx).toBeLessThanOrEqual(4 * BASE.subDivisions + 1e-6);
    expect(loose.minorScreenPx).toBeGreaterThanOrEqual(40 - 1e-6);
  });
});

describe('computeAdaptiveLevels — cross-fade is live', () => {
  it('does NOT report a constant opacity across the zoom range (the shipped bug)', () => {
    // THE anchor for defect (3). With the retired `[fadeMinPx, fadeMaxPx]`
    // window sitting entirely below the band, this returned 1.0 for all 61
    // samples and every other assertion still passed.
    const seen = new Set<string>();
    for (let exp = -3; exp <= 3; exp += 0.1) {
      const { minorOpacity } = computeAdaptiveLevels({ ...BASE, scale: Math.pow(10, exp) });
      seen.add(minorOpacity.toFixed(3));
    }
    expect(seen.size).toBeGreaterThan(10);
  });

  it('fades minor to 0 at the band floor and to 1 at the band top', () => {
    // Drive the minor spacing to each band edge by choosing the scale: at
    // worldStep 10, scale 1 lands minor exactly on the 10px floor, and a hair
    // below that lands it on the 50px top.
    const atFloor = computeAdaptiveLevels({ ...BASE, scale: 1 });
    expect(atFloor.minorScreenPx).toBeCloseTo(BASE.minSpacingPx, 6);
    expect(atFloor.minorOpacity).toBeCloseTo(0, 6);

    const atTop = computeAdaptiveLevels({ ...BASE, scale: 1 - 1e-9 });
    expect(atTop.minorScreenPx).toBeCloseTo(BAND_TOP, 4);
    expect(atTop.minorOpacity).toBeCloseTo(1, 4);
  });

  it('fades at a UNIFORM rate per wheel click (log space, not linear)', () => {
    // Why log space and not a plain linear ramp across the band: a wheel click
    // is a MULTIPLICATIVE zoom step, so only a log-space fade advances opacity
    // by the same amount on every click. Measured across one band at 1.1x per
    // click: log gives a flat 0.059 each time; a linear ramp drifts 0.114 →
    // 0.064 (43.6% spread), so the fade visibly races then drags.
    //
    // This anchor exists because a mutation to linear survived every other
    // test in this file — both shapes are continuous at the band edges, so
    // only the RATE distinguishes them.
    const deltas: number[] = [];
    let previous: number | null = null;
    for (let click = 0; click < 8; click++) {
      const { minorOpacity } = computeAdaptiveLevels({ ...BASE, scale: 0.999 / Math.pow(1.1, click) });
      if (previous !== null) deltas.push(Math.abs(minorOpacity - previous));
      previous = minorOpacity;
    }
    const spread = (Math.max(...deltas) - Math.min(...deltas)) / Math.max(...deltas);
    expect(spread).toBeLessThan(0.02);
  });

  it('returns opacity within [0,1] across the zoom sweep', () => {
    for (let exp = -3; exp <= 3; exp += 0.25) {
      const { minorOpacity } = computeAdaptiveLevels({ ...BASE, scale: Math.pow(10, exp) });
      expect(minorOpacity).toBeGreaterThanOrEqual(0);
      expect(minorOpacity).toBeLessThanOrEqual(1);
    }
  });
});

describe('computeAdaptiveLevels — perceived density is continuous', () => {
  it('does not jump across a cascade step (Giorgio 2026-07-20)', () => {
    // The user-visible contract: two adjacent zoom levels must look alike.
    // Straddle the exact cascade boundary at three different decades.
    for (const boundary of [0.2, 1, 5]) {
      const before = perceivedDensity(computeAdaptiveLevels({ ...BASE, scale: boundary * 0.9999 }));
      const after = perceivedDensity(computeAdaptiveLevels({ ...BASE, scale: boundary * 1.0001 }));
      const relativeJump = Math.abs(after - before) / before;
      // Measured 0.0098% with the C4D cross-fade; 397.7% without it.
      expect(relativeJump).toBeLessThan(0.01);
    }
  });

  it('stays smooth across a 4-decade zoom sweep at wheel-click granularity', () => {
    // A mouse-wheel click is ~1.02-1.2x. Sample finer than that: no single
    // step may change perceived density by more than a few percent.
    let previous: number | null = null;
    let worst = 0;
    for (let exp = -2; exp <= 2; exp += 0.002) {
      const density = perceivedDensity(computeAdaptiveLevels({ ...BASE, scale: Math.pow(10, exp) }));
      if (previous !== null) worst = Math.max(worst, Math.abs(density - previous) / previous);
      previous = density;
    }
    // Measured 0.68% with the fix, 397.7% before it — the threshold sits in
    // the vast gap between the two, so this cannot flake.
    expect(worst).toBeLessThan(0.05);
  });
});

/**
 * The four render passes, expressed as the effective alpha each LINE SET ends
 * up with. Mirrors `renderAdaptiveGridLines` exactly, including the fact that
 * coarser sets sit ON TOP of finer ones (their positions coincide), so the
 * passes COMPOSITE — `1-(1-a)(1-b)` — rather than add.
 *
 * Modelling this additively is the trap: it reports a spurious `minorWeight`
 * of discontinuity at every step and would send the next reader chasing a bug
 * that is not there.
 */
function composite(a: number, b: number): number {
  return 1 - (1 - a) * (1 - b);
}

interface SetInk {
  readonly minorAlpha: number;
  readonly majorAlpha: number;
}

/**
 * Ink of ONE PHYSICAL line set — the lines at world step `worldStepM` — at a
 * given zoom.
 *
 * Tracking a world-anchored set is the whole point: a slot-indexed profile
 * looks discontinuous at every step purely because the slots are re-filled,
 * which says nothing about what the user sees. The user's eye follows the line
 * on the glass, not the renderer's array index.
 */
function inkOfWorldStep(worldStepM: number, scale: number): SetInk {
  const { minorScreenPx, minorOpacity: e } = computeAdaptiveLevels({ ...BASE, scale });
  const minorWorldStep = minorScreenPx / scale;
  // Which cascade slot this set currently occupies (0 = finest drawn).
  const k = Math.round(Math.log(worldStepM / minorWorldStep) / Math.log(BASE.subDivisions));
  if (k < 0) return { minorAlpha: 0, majorAlpha: 0 };          // finer than the finest drawn
  if (k === 0) return { minorAlpha: e, majorAlpha: 0 };        // pass 1
  if (k === 1) return { minorAlpha: composite(e, 1), majorAlpha: e }; // + pass 2, pass 3
  // k >= 2: coincident with the coarse set's positions, so it inherits its ink.
  return { minorAlpha: composite(e, 1), majorAlpha: composite(e, 1 - e) };
}

describe('renderAdaptiveGridLines — emphasis pattern is continuous (Giorgio 2026-07-20)', () => {
  it('holds the coarse level exactly one period above the major', () => {
    for (let exp = -2; exp <= 2; exp += 0.5) {
      const { majorScreenPx, coarseScreenPx } = computeAdaptiveLevels({ ...BASE, scale: Math.pow(10, exp) });
      expect(coarseScreenPx / majorScreenPx).toBeCloseTo(BASE.subDivisions, 9);
    }
  });

  it('carries every physical line across a cascade step with an UNCHANGED draw state', () => {
    // THE anchor. Two-level rendering failed here: the surviving level flipped
    // major→minor and the coarse rhythm appeared from nothing (bright lines
    // every 53.5px → every 227.5px = x4.25 on Giorgio's screenshot pair).
    //
    // Straddle the boundary at three decades, and check the SAME world-anchored
    // sets on both sides — including the one that is about to be promoted.
    for (const boundary of [0.2, 1, 5]) {
      for (const k of [-1, 0, 1, 2, 3]) {
        const worldStepM = BASE.worldStep * Math.pow(BASE.subDivisions, k);
        const before = inkOfWorldStep(worldStepM, boundary * 0.9999);
        const after = inkOfWorldStep(worldStepM, boundary * 1.0001);
        expect(after.minorAlpha).toBeCloseTo(before.minorAlpha, 3);
        expect(after.majorAlpha).toBeCloseTo(before.majorAlpha, 3);
      }
    }
  });

  it('never lets a drawn line go dark mid-cascade (the pass-2 base is load-bearing)', () => {
    // Drop pass 2 and the surviving level dims to `e` as its majorness fades,
    // which is the very pop this render exists to remove. Every set coarser
    // than the finest must stay fully inked at EVERY zoom, not just at the
    // band edges.
    for (let exp = -2; exp <= 2; exp += 0.02) {
      const scale = Math.pow(10, exp);
      const minorWorldStep = computeAdaptiveLevels({ ...BASE, scale }).minorScreenPx / scale;
      for (const k of [1, 2, 3]) {
        const ink = inkOfWorldStep(minorWorldStep * Math.pow(BASE.subDivisions, k), scale);
        expect(ink.minorAlpha).toBeCloseTo(1, 9);
      }
    }
  });

  it('sweeps a single line through 4 decades with no jump a wheel click could reveal', () => {
    // Continuity BETWEEN steps, not just across them. Follow one world-anchored
    // line set through the whole sweep, sampling finer than a wheel click
    // (~1.02-1.2x). Under two-level rendering this scored 1.00 — a full
    // major→minor flip in a single sample.
    for (const worldStepM of [BASE.worldStep, BASE.worldStep * BASE.subDivisions]) {
      let previous: SetInk | null = null;
      let worst = 0;
      for (let exp = -2; exp <= 2; exp += 0.002) {
        const ink = inkOfWorldStep(worldStepM, Math.pow(10, exp));
        if (previous !== null) {
          worst = Math.max(
            worst,
            Math.abs(ink.minorAlpha - previous.minorAlpha),
            Math.abs(ink.majorAlpha - previous.majorAlpha),
          );
        }
        previous = ink;
      }
      expect(worst).toBeLessThan(0.01);
    }
  });

  it('keeps a real hierarchy — coarser is never less emphasised than finer', () => {
    // The whole point of paying for a third pass is that the major stays
    // legible as a measuring reference (ratio 1.5 retained, not lowered to the
    // ~1.13 that would have hidden the step by abolishing the hierarchy).
    for (let exp = -2; exp <= 2; exp += 0.05) {
      const scale = Math.pow(10, exp);
      const minorWorldStep = computeAdaptiveLevels({ ...BASE, scale }).minorScreenPx / scale;
      const ink = (k: number) => inkOfWorldStep(minorWorldStep * Math.pow(BASE.subDivisions, k), scale);
      expect(ink(1).majorAlpha).toBeGreaterThanOrEqual(ink(0).majorAlpha - 1e-9);
      expect(ink(2).majorAlpha).toBeGreaterThanOrEqual(ink(1).majorAlpha - 1e-9);
    }
  });
});

// ─── Real-renderer anchors ──────────────────────────────────────────────────

const MINOR_COLOR = '#b0b0b0';
const MAJOR_COLOR = '#989898';

interface Stroke {
  readonly spacingPx: number;
  readonly alpha: number;
  readonly color: string;
}

/**
 * Drive the REAL `renderAdaptiveGrid` against a recording context and return
 * the strokes it actually issued.
 *
 * The block above pins the cascade maths; this pins the four passes that
 * consume it. Without it a mutation to the render — dropping the coarse pass,
 * un-fading the major pass — leaves every other test in this file green,
 * because those tests model the passes rather than execute them.
 *
 * Since §5.9 the mechanism is style-agnostic: it sets `globalAlpha` and hands
 * the caller a `{spacingPx, major}` pass. `drawMarks` below therefore applies
 * colour exactly as `GridRenderer.renderGridLines` does, so these anchors keep
 * measuring the end-to-end result (which colour, at which alpha, at which
 * spacing) rather than the mechanism's internals.
 */
function strokesAt(scale: number, show: { minor: boolean; major: boolean } = { minor: true, major: true }): readonly Stroke[] {
  const strokes: Stroke[] = [];
  const ctx = { globalAlpha: 1, strokeStyle: '', lineWidth: 0 } as unknown as CanvasRenderingContext2D;
  renderAdaptiveGrid({
    ctx,
    drawMarks: ({ spacingPx, major }) => {
      ctx.strokeStyle = major ? MAJOR_COLOR : MINOR_COLOR;
      ctx.lineWidth = major ? 0.75 : 0.5;
      strokes.push({ spacingPx, alpha: ctx.globalAlpha, color: String(ctx.strokeStyle) });
    },
    worldStep: BASE.worldStep,
    scale,
    subDivisions: BASE.subDivisions,
    minSpacingPx: BASE.minSpacingPx,
    fadeDurationMs: 0, // instant — take the target opacity, no temporal lerp
    showMinor: show.minor,
    showMajor: show.major,
    previousOpacity: 0,
    previousTimestampMs: 0,
    markDirty: () => undefined,
  });
  return strokes;
}

/**
 * Effective ink a line set of screen spacing `targetPx` ends up with, given the
 * strokes issued. A pass at spacing `P` paints this set whenever `targetPx` is
 * an integer multiple of `P` — coarse sets sit on top of finer ones, so the
 * contributions COMPOSITE.
 */
function inkFromStrokes(strokes: readonly Stroke[], targetPx: number): SetInk {
  let minorAlpha = 0;
  let majorAlpha = 0;
  for (const s of strokes) {
    const ratio = targetPx / s.spacingPx;
    if (Math.abs(ratio - Math.round(ratio)) > 1e-6 || Math.round(ratio) < 1) continue;
    if (s.color === MINOR_COLOR) minorAlpha = composite(minorAlpha, s.alpha);
    else majorAlpha = composite(majorAlpha, s.alpha);
  }
  return { minorAlpha, majorAlpha };
}

describe('renderAdaptiveGridLines — the passes actually issued', () => {
  it('draws a THIRD level, one period above the major', () => {
    // Pins the pass that fixes defect (2): the coarse rhythm must already be on
    // screen BEFORE the step promotes it, never born from nothing.
    const { majorScreenPx, coarseScreenPx } = computeAdaptiveLevels({ ...BASE, scale: 0.6 });
    const spacings = strokesAt(0.6).map((s) => s.spacingPx);
    expect(spacings).toContain(coarseScreenPx);
    expect(coarseScreenPx).not.toBeCloseTo(majorScreenPx, 6);
  });

  it('keeps every physical line identical across a cascade step (end to end)', () => {
    // The same contract as the model-level anchor above, but measured on the
    // renderer's own output — so it survives only while the render agrees with
    // the maths.
    for (const boundary of [0.2, 1, 5]) {
      const before = strokesAt(boundary * 0.9999);
      const after = strokesAt(boundary * 1.0001);
      for (const k of [0, 1, 2, 3]) {
        const worldStepM = BASE.worldStep * Math.pow(BASE.subDivisions, k);
        const inkBefore = inkFromStrokes(before, worldStepM * boundary * 0.9999);
        const inkAfter = inkFromStrokes(after, worldStepM * boundary * 1.0001);
        expect(inkAfter.minorAlpha).toBeCloseTo(inkBefore.minorAlpha, 3);
        expect(inkAfter.majorAlpha).toBeCloseTo(inkBefore.majorAlpha, 3);
      }
    }
  });

  it('fades the major pass out rather than holding it opaque', () => {
    // The pre-fix renderer drew the major level at full alpha always. This is
    // the anchor for that exact regression, so it must be sampled MID-PERIOD:
    // at either band edge `emphasis` is ~0 or ~1, where `alpha * emphasis` and
    // a hardcoded `alpha` coincide and the mutation hides. (It also hid behind
    // the pass-3 guard when sampled at the floor — the loop below ran zero
    // times and the test passed vacuously. Hence the explicit count assertion.)
    const scale = 0.4; // lands mid-band
    const { minorOpacity: emphasis, majorScreenPx } = computeAdaptiveLevels({ ...BASE, scale });
    expect(emphasis).toBeGreaterThan(0.1);
    expect(emphasis).toBeLessThan(0.9); // genuinely mid-period, not an edge

    const onSurvivor = strokesAt(scale).filter(
      (s) => s.color === MAJOR_COLOR && Math.abs(s.spacingPx - majorScreenPx) < 1e-6,
    );
    expect(onSurvivor).toHaveLength(1); // the anchor has a subject
    expect(onSurvivor[0].alpha).toBeCloseTo(emphasis, 6);
  });

  it('sweeps one line through the renderer with no visible jump, mid-period included', () => {
    // The strongest anchor in the file: it drives the REAL passes across a full
    // zoom sweep, so it sees regressions the boundary-straddling tests are
    // blind to by construction. A mutation restoring the opaque major pass
    // survives every other test here and dies on this one.
    for (const worldStepM of [BASE.worldStep, BASE.worldStep * BASE.subDivisions]) {
      let previous: SetInk | null = null;
      let worst = 0;
      for (let exp = -2; exp <= 2; exp += 0.002) {
        const scale = Math.pow(10, exp);
        const ink = inkFromStrokes(strokesAt(scale), worldStepM * scale);
        if (previous !== null) {
          worst = Math.max(
            worst,
            Math.abs(ink.minorAlpha - previous.minorAlpha),
            Math.abs(ink.majorAlpha - previous.majorAlpha),
          );
        }
        previous = ink;
      }
      // The pass-3 and pass-4 guards clip the last 0.4% of each fade, so a
      // sub-1% residue is expected; the pre-fix render scored 1.00 here.
      expect(worst).toBeLessThan(0.01);
    }
  });

  it('respects showMajor / showMinor without reintroducing a step', () => {
    // The toggles must gate whole style classes, not individual passes — a
    // half-gated render would pop again for users who turn one level off.
    const strokes = strokesAt(0.6, { minor: true, major: false });
    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes.every((s) => s.color === MINOR_COLOR)).toBe(true);
  });
});

describe('computeAdaptiveLevels — degenerate inputs', () => {
  it('stays total when there is no cascade period to divide by', () => {
    // `Math.log(subDivisions)` is 0 at subDivisions 1 — the fade term would be
    // Infinity/NaN. GridRenderer routes these to the legacy path, but the pure
    // function must not emit NaN for direct callers.
    for (const bad of [{ subDivisions: 1 }, { subDivisions: 0 }, { scale: 0 }, { worldStep: 0 }, { minSpacingPx: 0 }]) {
      const out = computeAdaptiveLevels({ ...BASE, scale: 2, ...bad });
      expect(Number.isFinite(out.minorScreenPx)).toBe(true);
      expect(Number.isFinite(out.majorScreenPx)).toBe(true);
      expect(Number.isFinite(out.coarseScreenPx)).toBe(true);
      expect(out.minorOpacity).toBeGreaterThanOrEqual(0);
      expect(out.minorOpacity).toBeLessThanOrEqual(1);
    }
  });
});
