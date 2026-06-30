/**
 * overlay-label-layout — SSoT anti-collision tests (ADR-508 §wall-hud / §label-layout).
 *
 * Επαληθεύει το ΣΥΜΒΟΛΑΙΟ μη-επικάλυψης: η box-aware απόσταση κρατά την ΚΟΝΤΙΝΗ ακμή ενός
 * κεντραρισμένου label ΑΚΡΙΒΩΣ `baseClearPx` πέρα από τον άξονα — ανεξάρτητα γωνίας (κάθετος/
 * οριζόντιος/λοξός). Έτσι ένα πλατύ spec-text δεν διασχίζει ποτέ τον άξονα → ΜΗΔΕΝ overlap με τη
 * διάσταση μήκους της αντίθετης πλευράς (το vertical-wall collapse).
 */

import {
  measureOverlayLabelBox,
  boxHalfExtentAlong,
  clearanceForBox,
  snapLabelTop,
  SNAP_LABEL_BASELINE_LIFT_PX,
  EMPTY_LABEL_BOX,
  type LabelBox,
} from '../overlay-label-layout';

/** ctx stub: measureText → fixed width· font setter is a no-op. */
function fakeCtx(width = 150): CanvasRenderingContext2D {
  const noop = () => {};
  return new Proxy(
    { measureText: () => ({ width }) } as unknown as CanvasRenderingContext2D,
    {
      get(target, prop) {
        if (prop in target) return (target as Record<string, unknown>)[prop as string];
        return noop;
      },
      set() { return true; },
    },
  );
}

describe('measureOverlayLabelBox', () => {
  it('empty text → EMPTY_LABEL_BOX (no measure)', () => {
    expect(measureOverlayLabelBox(fakeCtx(), '')).toBe(EMPTY_LABEL_BOX);
  });

  it('non-empty → width from measureText, height from the font px-prefix (11)', () => {
    const box = measureOverlayLabelBox(fakeCtx(150), 'πάχος 0,210 m · ύψος 3,000 m');
    expect(box.w).toBe(150);
    expect(box.h).toBe(11); // OVERLAY_TEXT_FONT = "11px ..."
  });

  it('honours an explicit font px-prefix for height', () => {
    expect(measureOverlayLabelBox(fakeCtx(40), '2,600 m', '20px sans-serif').h).toBe(20);
  });
});

describe('boxHalfExtentAlong — projection of the box onto a unit direction', () => {
  const BOX: LabelBox = { w: 150, h: 11 };

  it('horizontal direction (1,0) → half WIDTH', () => {
    expect(boxHalfExtentAlong(1, 0, BOX)).toBeCloseTo(75);
  });

  it('vertical direction (0,1) → half HEIGHT', () => {
    expect(boxHalfExtentAlong(0, 1, BOX)).toBeCloseTo(5.5);
  });

  it('sign-agnostic (uses |components|)', () => {
    expect(boxHalfExtentAlong(-1, 0, BOX)).toBeCloseTo(75);
    expect(boxHalfExtentAlong(0, -1, BOX)).toBeCloseTo(5.5);
  });

  it('diagonal blends width + height by |component|', () => {
    const r = Math.SQRT1_2; // 45° unit
    expect(boxHalfExtentAlong(r, r, BOX)).toBeCloseTo(r * 75 + r * 5.5);
  });
});

describe('clearanceForBox — no-overlap invariant (near edge stays baseClearPx beyond the axis)', () => {
  const BASE = 16;
  const SPEC: LabelBox = { w: 150, h: 11 }; // wide identity label
  const LEN: LabelBox = { w: 50, h: 11 };   // narrow length number

  /** Near edge of a centred box placed at `dist` along a unit dir, measured from the axis. */
  const nearEdge = (nx: number, ny: number, box: LabelBox): number =>
    clearanceForBox(nx, ny, box, BASE) - boxHalfExtentAlong(nx, ny, box);

  it('VERTICAL wall (perp ≈ horizontal): wide spec near edge = baseClearPx — never crosses axis', () => {
    // perp horizontal → clearance includes half WIDTH (75) so the box edge clears the axis.
    expect(clearanceForBox(1, 0, SPEC, BASE)).toBeCloseTo(BASE + 75);
    expect(nearEdge(1, 0, SPEC)).toBeCloseTo(BASE);
  });

  it('HORIZONTAL wall (perp ≈ vertical): near edge = baseClearPx (half height only)', () => {
    expect(clearanceForBox(0, 1, SPEC, BASE)).toBeCloseTo(BASE + 5.5);
    expect(nearEdge(0, 1, SPEC)).toBeCloseTo(BASE);
  });

  it('SLANTED wall: near edge invariant holds at any angle', () => {
    for (const deg of [10, 30, 45, 60, 75, 89]) {
      const a = (deg * Math.PI) / 180;
      const nx = Math.cos(a), ny = Math.sin(a);
      expect(nearEdge(nx, ny, SPEC)).toBeCloseTo(BASE);
      expect(nearEdge(nx, ny, LEN)).toBeCloseTo(BASE);
    }
  });

  it('spec (−side) and length number (+side) never overlap on a vertical wall', () => {
    // Spec centred at −distSpec, length number centred at +distLen (opposite sides of the axis).
    const distSpec = clearanceForBox(1, 0, SPEC, BASE); // left of axis
    const distLen = clearanceForBox(1, 0, LEN, BASE);   // right of axis
    const specRightEdge = -distSpec + boxHalfExtentAlong(1, 0, SPEC); // = −BASE
    const lenLeftEdge = distLen - boxHalfExtentAlong(1, 0, LEN);      // = +BASE
    expect(specRightEdge).toBeLessThan(lenLeftEdge);              // gap exists
    expect(lenLeftEdge - specRightEdge).toBeCloseTo(2 * BASE);    // = 2·baseClear
  });
});

describe('snapLabelTop — Case A separate-baseline (snap label above its glyph)', () => {
  const GLYPH_HALF = 6;

  it('lifts the label ABOVE the glyph by the baseline-lift constant', () => {
    expect(snapLabelTop(100, GLYPH_HALF)).toBe(100 - GLYPH_HALF - SNAP_LABEL_BASELINE_LIFT_PX);
  });

  it('the label top is strictly above the glyph top (so it never shares a below-centre pill band)', () => {
    const glyphTop = 100 - GLYPH_HALF;
    expect(snapLabelTop(100, GLYPH_HALF)).toBeLessThan(glyphTop);
  });
});
