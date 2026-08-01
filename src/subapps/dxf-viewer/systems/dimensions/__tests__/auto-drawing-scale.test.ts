/**
 * ADR-375 Phase B.4 — fit-to-paper auto drawing-scale SSoT tests.
 */

import {
  computeAutoDrawingScale,
  computeFitToPaperScale,
  MAX_AUTO_DRAWING_SCALE,
  niceScaleAtLeast,
} from '../auto-drawing-scale';
import {
  DRAWING_SCALE_MIN,
  DRAWING_SCALE_MAX,
  DRAWING_SCALE_PRESETS,
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

// ADR-739 §20.8 — the ceiling on the SILENT guess. See the module header for the
// measured incident (a 1.9 km survey ⇒ 1:5000 ⇒ a 600 m table, 12.5 m text).
describe('computeAutoDrawingScale — ceiling on the silent guess', () => {
  it('MAX_AUTO_DRAWING_SCALE is DERIVED from the preset ladder, not hardcoded', () => {
    // The widget's coarsest offer is the guess's competence limit. If someone
    // extends the ladder, the ceiling must follow it — that is the whole point.
    expect(MAX_AUTO_DRAWING_SCALE).toBe(DRAWING_SCALE_PRESETS[DRAWING_SCALE_PRESETS.length - 1]);
    expect(DRAWING_SCALE_PRESETS).toContain(MAX_AUTO_DRAWING_SCALE);
  });

  it('agrees with the honest fit for every drawing-sized scene', () => {
    // Inside the ladder the ceiling must be invisible — no behaviour change for
    // the ordinary building drawings ADR-375 Φ.B.4 was built for.
    for (const [w, h] of [[5000, 3000], [20000, 12000], [60000, 40000], [100000, 60000]]) {
      expect(computeAutoDrawingScale(bounds(w, h))).toBe(computeFitToPaperScale(bounds(w, h)));
    }
  });

  it('passes a scene sitting EXACTLY on the ceiling (boundary is inclusive)', () => {
    // 1:500 is a scale the widget offers ⇒ the guess is still competent.
    const onCeiling = bounds(200000, 138500); // max(200000/400, 138500/277) = 500
    expect(computeFitToPaperScale(onCeiling)).toBe(MAX_AUTO_DRAWING_SCALE);
    expect(computeAutoDrawingScale(onCeiling)).toBe(MAX_AUTO_DRAWING_SCALE);
  });

  it('stands down one step ABOVE the ceiling', () => {
    // 1:1000 is off the ladder ⇒ site extent, not drawing extent.
    const overCeiling = bounds(200001, 138500);
    expect(computeFitToPaperScale(overCeiling)).toBeGreaterThan(MAX_AUTO_DRAWING_SCALE);
    expect(computeAutoDrawingScale(overCeiling)).toBeNull();
  });

  it('THE MEASURED SCENE: 817 m × 1915 m survey → honest 1:5000, silent guess NONE', () => {
    // Live measurement 2026-08-01, level lvl_dabeb3bb: entity extent 816.533 ×
    // 1.915.132 mm. The honest fit is 5000 and the app WROTE it, which is how a
    // 120 sheet-mm table was born 600 m wide. The guess must now stay silent so
    // the level keeps its 1:100 default.
    const survey = bounds(816533, 1915132);
    expect(computeFitToPaperScale(survey)).toBe(5000);
    expect(computeAutoDrawingScale(survey)).toBeNull();
  });

  it('delegates the degenerate-scene contract instead of re-deciding it', () => {
    expect(computeAutoDrawingScale(bounds(0, 0))).toBeNull();
  });

  it('applies the ceiling against the CUSTOM paper too, not just A3', () => {
    // A4 pushes the same scene past the ladder ⇒ the ceiling must bite there too.
    const a4 = { long: 277, short: 190 } as const;
    const scene = bounds(150000, 95000); // A3 → 1:500 (on ceiling), A4 → 1:1000
    expect(computeAutoDrawingScale(scene)).toBe(MAX_AUTO_DRAWING_SCALE);
    expect(computeFitToPaperScale(scene, a4)).toBeGreaterThan(MAX_AUTO_DRAWING_SCALE);
    expect(computeAutoDrawingScale(scene, a4)).toBeNull();
  });
});
