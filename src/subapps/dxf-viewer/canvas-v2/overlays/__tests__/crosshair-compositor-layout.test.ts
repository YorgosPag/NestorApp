/**
 * ADR-040 — crosshair compositor layout geometry tests.
 *
 * Pure-function coverage for the AutoCAD/Revit-grade compositor crosshair: arm
 * length, fixed segment boxes (gap preserved via translate offset), area-local
 * conversion, margin clipping, and dash backgrounds.
 */

import {
  computeArmLength,
  computeSegmentBoxes,
  computeCenterGap,
  computeBadgeOffset,
  toAreaLocal,
  isWithinArea,
  translate3d,
  segmentBackground,
  CENTER_SQUARE_GAP_CLEARANCE,
} from '../crosshair-compositor-layout';

describe('computeArmLength', () => {
  it('spans the larger dimension at 100% (full-screen cross reaches every edge)', () => {
    expect(computeArmLength(1920, 1080, 100)).toBe(1920);
    expect(computeArmLength(800, 1200, 100)).toBe(1200);
  });

  it('is a fixed fraction of the smaller dimension below 100% (equal arms)', () => {
    // min(1000,600)/2 * 50/100 = 300 * 0.5 = 150
    expect(computeArmLength(1000, 600, 50)).toBe(150);
  });

  it('clamps negative percentages to zero', () => {
    expect(computeArmLength(1000, 600, -10)).toBe(0);
  });
});

describe('computeSegmentBoxes', () => {
  it('positions left/top segments before the origin and right/bottom at it (no gap)', () => {
    const b = computeSegmentBoxes(200, 2);
    // Horizontal arms: width = arm, height = lineWidth, centred vertically.
    expect(b.left).toEqual({ width: 200, height: 2, left: -200, top: -1 });
    expect(b.right).toEqual({ width: 200, height: 2, left: 0, top: -1 });
    // Vertical arms: width = lineWidth, height = arm, centred horizontally.
    expect(b.top).toEqual({ width: 2, height: 200, left: -1, top: -200 });
    expect(b.bottom).toEqual({ width: 2, height: 200, left: -1, top: 0 });
  });

  it('bakes the centre gap into the static positions (inner edges pulled back by gap)', () => {
    const b = computeSegmentBoxes(200, 2, 12);
    // Left/top inner edge lands at -gap; right/bottom start at +gap.
    expect(b.left).toEqual({ width: 200, height: 2, left: -212, top: -1 });
    expect(b.right).toEqual({ width: 200, height: 2, left: 12, top: -1 });
    expect(b.top).toEqual({ width: 2, height: 200, left: -1, top: -212 });
    expect(b.bottom).toEqual({ width: 2, height: 200, left: -1, top: 12 });
  });
});

describe('computeBadgeOffset', () => {
  it('keeps the badge at least clear of the cross centre (floor of 4 + 2)', () => {
    expect(computeBadgeOffset(0)).toBe(6);
    expect(computeBadgeOffset(3)).toBe(6);
  });

  it('rides outside a larger gap', () => {
    expect(computeBadgeOffset(12)).toBe(14);
  });
});

describe('computeCenterGap', () => {
  it('stops the arms at the centre square faces + clearance (always a hole inside it)', () => {
    // apertureSize/2 + clearance = 10/2 + 2 = 7. Independent of useCursorGap.
    expect(
      computeCenterGap({ showCenterSquare: true, centerSquareSize: 10, useCursorGap: false, centerGapPx: 5 }),
    ).toBe(10 / 2 + CENTER_SQUARE_GAP_CLEARANCE);
    // Larger square ⇒ larger hole; still ignores the cursor-gap settings.
    expect(
      computeCenterGap({ showCenterSquare: true, centerSquareSize: 20, useCursorGap: true, centerGapPx: 3 }),
    ).toBe(20 / 2 + CENTER_SQUARE_GAP_CLEARANCE);
  });

  it('falls back to no gap with no centre square and cursor gap disabled', () => {
    expect(
      computeCenterGap({ showCenterSquare: false, centerSquareSize: 0, useCursorGap: false, centerGapPx: 20 }),
    ).toBe(0);
  });

  it('falls back to the configured cursor gap when there is no centre square', () => {
    expect(
      computeCenterGap({ showCenterSquare: false, centerSquareSize: 0, useCursorGap: true, centerGapPx: 12 }),
    ).toBe(12);
    // Empty/zero centerGapPx defaults to 5.
    expect(
      computeCenterGap({ showCenterSquare: false, centerSquareSize: 0, useCursorGap: true, centerGapPx: 0 }),
    ).toBe(5);
  });
});

describe('toAreaLocal + isWithinArea', () => {
  it('subtracts ruler margins to get area-local coords', () => {
    expect(toAreaLocal({ x: 100, y: 60 }, { left: 40, top: 24 })).toEqual({ x: 60, y: 36 });
  });

  it('flags positions over the rulers (negative local) as outside the area', () => {
    const margins = { left: 40, top: 24 };
    const overRuler = toAreaLocal({ x: 10, y: 60 }, margins); // x < left
    expect(isWithinArea(overRuler, 800, 600)).toBe(false);
    const inside = toAreaLocal({ x: 100, y: 60 }, margins);
    expect(isWithinArea(inside, 800, 600)).toBe(true);
  });

  it('flags positions past the area bounds as outside', () => {
    expect(isWithinArea({ x: 900, y: 100 }, 800, 600)).toBe(false);
    expect(isWithinArea({ x: 100, y: 700 }, 800, 600)).toBe(false);
  });
});

describe('translate3d', () => {
  it('emits a GPU-composited translate string', () => {
    expect(translate3d(12.5, -4)).toBe('translate3d(12.5px, -4px, 0)');
  });
});

describe('segmentBackground', () => {
  it('uses a solid background colour for solid lines', () => {
    expect(segmentBackground('horizontal', 'solid', '#0ff')).toEqual({ backgroundColor: '#0ff' });
  });

  it('uses a repeating gradient for dashed/dotted, oriented per axis', () => {
    const h = segmentBackground('horizontal', 'dashed', '#0ff');
    expect(h.backgroundImage).toContain('90deg');
    expect(h.backgroundImage).toContain('#0ff');
    const v = segmentBackground('vertical', 'dotted', '#0ff');
    expect(v.backgroundImage).toContain('180deg');
  });
});
