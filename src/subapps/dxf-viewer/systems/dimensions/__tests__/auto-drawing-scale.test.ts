/**
 * ADR-375 Phase B.4 — fit-to-paper auto drawing-scale SSoT tests.
 */

import {
  computeFitToPaperScale,
  niceScaleAtLeast,
} from '../auto-drawing-scale';
import {
  DRAWING_SCALE_MIN,
  DRAWING_SCALE_MAX,
} from '../../../config/bim-render-settings-types';
import type { Bounds } from '../../../utils/bounds-utils';

/** Build a Bounds spanning `w × h` mm from the origin. */
function bounds(w: number, h: number): Bounds {
  return { min: { x: 0, y: 0 }, max: { x: w, y: h } };
}

describe('niceScaleAtLeast', () => {
  it('snaps up to the nearest 1-2-5 standard scale', () => {
    expect(niceScaleAtLeast(12.5)).toBe(20);
    expect(niceScaleAtLeast(48)).toBe(50);
    expect(niceScaleAtLeast(50)).toBe(50); // exact preset stays
    expect(niceScaleAtLeast(51)).toBe(100);
    expect(niceScaleAtLeast(150)).toBe(200);
  });

  it('extends the 1-2-5 ladder past the presets', () => {
    expect(niceScaleAtLeast(600)).toBe(1000);
    expect(niceScaleAtLeast(1500)).toBe(2000);
  });

  it('clamps sub-unit and non-finite input to the minimum', () => {
    expect(niceScaleAtLeast(0.5)).toBe(DRAWING_SCALE_MIN);
    expect(niceScaleAtLeast(0)).toBe(DRAWING_SCALE_MIN);
    expect(niceScaleAtLeast(Number.NaN)).toBe(DRAWING_SCALE_MIN);
  });

  it('clamps oversize input to the maximum', () => {
    expect(niceScaleAtLeast(99999)).toBe(DRAWING_SCALE_MAX);
  });
});

describe('computeFitToPaperScale (A3 usable 400×277)', () => {
  it('20 m × 12 m plan → 1:50', () => {
    // max(20000/400, 12000/277) = max(50, 43.3) = 50 → 50
    expect(computeFitToPaperScale(bounds(20000, 12000))).toBe(50);
  });

  it('5 m × 3 m plan → 1:20', () => {
    // max(5000/400, 3000/277) = max(12.5, 10.8) = 12.5 → 20
    expect(computeFitToPaperScale(bounds(5000, 3000))).toBe(20);
  });

  it('60 m × 40 m plan → 1:200', () => {
    // max(60000/400, 40000/277) = max(150, 144) = 150 → 200
    expect(computeFitToPaperScale(bounds(60000, 40000))).toBe(200);
  });

  it('is orientation-agnostic (portrait matches landscape sheet)', () => {
    expect(computeFitToPaperScale(bounds(12000, 20000))).toBe(
      computeFitToPaperScale(bounds(20000, 12000)),
    );
  });

  it('returns null for a degenerate (zero-span) scene', () => {
    expect(computeFitToPaperScale(bounds(0, 0))).toBeNull();
  });

  it('honours a custom paper size', () => {
    // A4 usable ~277×190 → same 20×12 scene binds tighter → larger scale.
    const a4 = { long: 277, short: 190 } as const;
    expect(computeFitToPaperScale(bounds(20000, 12000), a4)).toBe(100);
  });
});
