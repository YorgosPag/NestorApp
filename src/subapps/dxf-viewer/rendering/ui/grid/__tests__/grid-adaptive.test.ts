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
import { computeAdaptiveLevels } from '../grid-adaptive';

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

describe('computeAdaptiveLevels — degenerate inputs', () => {
  it('stays total when there is no cascade period to divide by', () => {
    // `Math.log(subDivisions)` is 0 at subDivisions 1 — the fade term would be
    // Infinity/NaN. GridRenderer routes these to the legacy path, but the pure
    // function must not emit NaN for direct callers.
    for (const bad of [{ subDivisions: 1 }, { subDivisions: 0 }, { scale: 0 }, { worldStep: 0 }, { minSpacingPx: 0 }]) {
      const out = computeAdaptiveLevels({ ...BASE, scale: 2, ...bad });
      expect(Number.isFinite(out.minorScreenPx)).toBe(true);
      expect(Number.isFinite(out.majorScreenPx)).toBe(true);
      expect(out.minorOpacity).toBeGreaterThanOrEqual(0);
      expect(out.minorOpacity).toBeLessThanOrEqual(1);
    }
  });
});
