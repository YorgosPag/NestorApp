/**
 * ADR-507 S2-fix-3 — hatch grip-drag transform tests.
 */

import {
  applyHatchGripDrag, decodeHatchVertexGripKind,
  applyHatchOriginGripDrag, isHatchOriginGripKind, hatchBounds, hatchBoundsCenter,
  HATCH_GRADIENT_ORIGIN_KIND,
  isHatchAngleGripKind, hatchGradientAngleGripPos, applyHatchAngleGripDrag,
  HATCH_GRADIENT_ANGLE_KIND,
} from '../hatch-grips';
import type { Point2D } from '../../../rendering/types/Types';
import type { HatchGripKind } from '../../../hooks/grip-types';

const OUTER: Point2D[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
];
const ISLAND: Point2D[] = [
  { x: 400, y: 400 },
  { x: 600, y: 400 },
  { x: 600, y: 600 },
];

describe('decodeHatchVertexGripKind', () => {
  it('decodes path + vertex indices', () => {
    expect(decodeHatchVertexGripKind('hatch-vertex-0-2')).toEqual([0, 2]);
    expect(decodeHatchVertexGripKind('hatch-vertex-1-0')).toEqual([1, 0]);
  });

  it('returns null on a malformed kind', () => {
    expect(decodeHatchVertexGripKind('hatch-vertex-0' as HatchGripKind)).toBeNull();
  });
});

describe('applyHatchGripDrag', () => {
  it('translates the targeted outer-ring vertex only', () => {
    const result = applyHatchGripDrag('hatch-vertex-0-1', {
      originalBoundaryPaths: [OUTER],
      delta: { x: 50, y: -30 },
    });
    expect(result[0][1]).toEqual({ x: 1050, y: -30 });
    // Other vertices untouched.
    expect(result[0][0]).toEqual({ x: 0, y: 0 });
    expect(result[0][2]).toEqual({ x: 1000, y: 1000 });
  });

  it('translates a vertex on an island ring (multi-ring decode)', () => {
    const result = applyHatchGripDrag('hatch-vertex-1-0', {
      originalBoundaryPaths: [OUTER, ISLAND],
      delta: { x: 10, y: 10 },
    });
    expect(result[1][0]).toEqual({ x: 410, y: 410 });
    // Outer ring shared untouched.
    expect(result[0]).toEqual(OUTER);
  });

  it('returns the original reference (no-op) on out-of-range index', () => {
    const original = [OUTER];
    expect(applyHatchGripDrag('hatch-vertex-0-9', { originalBoundaryPaths: original, delta: { x: 5, y: 5 } })).toBe(original);
    expect(applyHatchGripDrag('hatch-vertex-3-0', { originalBoundaryPaths: original, delta: { x: 5, y: 5 } })).toBe(original);
  });

  it('returns the original reference on zero delta', () => {
    const original = [OUTER];
    expect(applyHatchGripDrag('hatch-vertex-0-0', { originalBoundaryPaths: original, delta: { x: 0, y: 0 } })).toBe(original);
  });

  it('quantizes to the dominant axis when rectilinear', () => {
    const result = applyHatchGripDrag('hatch-vertex-0-0', {
      originalBoundaryPaths: [OUTER],
      delta: { x: 80, y: 20 },
      rectilinear: true,
    });
    // |dx| > |dy| → y component dropped.
    expect(result[0][0]).toEqual({ x: 80, y: 0 });
  });

  it('does not mutate the input boundaryPaths', () => {
    const original = [OUTER.map((p) => ({ ...p }))];
    const snapshot = JSON.stringify(original);
    applyHatchGripDrag('hatch-vertex-0-1', { originalBoundaryPaths: original, delta: { x: 50, y: 50 } });
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

// ── ADR-507 Φ5 A3 — gradient origin/seed grip ────────────────────────────────

describe('hatchBounds / hatchBoundsCenter', () => {
  it('computes the axis-aligned bbox + center over all rings', () => {
    expect(hatchBounds([OUTER, ISLAND])).toEqual({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 });
    expect(hatchBoundsCenter([OUTER])).toEqual({ x: 500, y: 500 });
  });

  it('returns null on empty boundary', () => {
    expect(hatchBounds([])).toBeNull();
    expect(hatchBoundsCenter([])).toBeNull();
  });
});

describe('isHatchOriginGripKind', () => {
  it('matches only the gradient-origin kind', () => {
    expect(isHatchOriginGripKind(HATCH_GRADIENT_ORIGIN_KIND)).toBe(true);
    expect(isHatchOriginGripKind('hatch-vertex-0-0')).toBe(false);
  });
});

describe('applyHatchOriginGripDrag', () => {
  it('translates the origin by the delta', () => {
    expect(applyHatchOriginGripDrag({ x: 500, y: 500 }, { delta: { x: 30, y: -20 } }))
      .toEqual({ x: 530, y: 480 });
  });

  it('quantizes to the dominant axis when rectilinear', () => {
    // |dx| > |dy| → y component dropped.
    expect(applyHatchOriginGripDrag({ x: 0, y: 0 }, { delta: { x: 80, y: 20 }, rectilinear: true }))
      .toEqual({ x: 80, y: 0 });
  });

  it('does not mutate the input origin', () => {
    const origin = { x: 10, y: 10 };
    applyHatchOriginGripDrag(origin, { delta: { x: 5, y: 5 } });
    expect(origin).toEqual({ x: 10, y: 10 });
  });
});

// ── ADR-507 Φ5 A4 — gradient-angle βραχίονας ──────────────────────────────────

describe('isHatchAngleGripKind', () => {
  it('matches only the gradient-angle kind', () => {
    expect(isHatchAngleGripKind(HATCH_GRADIENT_ANGLE_KIND)).toBe(true);
    expect(isHatchAngleGripKind(HATCH_GRADIENT_ORIGIN_KIND)).toBe(false);
    expect(isHatchAngleGripKind('hatch-vertex-0-0')).toBe(false);
  });
});

describe('hatchGradientAngleGripPos', () => {
  // OUTER = 1000×1000 → R = 0.5·hypot(1000,1000) ≈ 707.107.
  const R = 0.5 * Math.hypot(1000, 1000);

  it('places the handle along +X at angle 0', () => {
    const pos = hatchGradientAngleGripPos({ x: 500, y: 500 }, 0, [OUTER]);
    expect(pos?.x).toBeCloseTo(500 + R, 3);
    expect(pos?.y).toBeCloseTo(500, 3);
  });

  it('places the handle along +Y at angle 90', () => {
    const pos = hatchGradientAngleGripPos({ x: 500, y: 500 }, 90, [OUTER]);
    expect(pos?.x).toBeCloseTo(500, 3);
    expect(pos?.y).toBeCloseTo(500 + R, 3);
  });

  it('returns null on empty boundary (degenerate bbox)', () => {
    expect(hatchGradientAngleGripPos({ x: 0, y: 0 }, 0, [])).toBeNull();
  });
});

describe('applyHatchAngleGripDrag', () => {
  const origin: Point2D = { x: 500, y: 500 };

  it('maps cardinal cursor directions to [0,360) degrees', () => {
    expect(applyHatchAngleGripDrag(origin, { x: 600, y: 500 })).toBeCloseTo(0, 6);
    expect(applyHatchAngleGripDrag(origin, { x: 500, y: 600 })).toBeCloseTo(90, 6);
    expect(applyHatchAngleGripDrag(origin, { x: 400, y: 500 })).toBeCloseTo(180, 6);
    // -90° → normalized 270°.
    expect(applyHatchAngleGripDrag(origin, { x: 500, y: 400 })).toBeCloseTo(270, 6);
  });

  it('does not mutate the input origin', () => {
    const o = { x: 1, y: 2 };
    applyHatchAngleGripDrag(o, { x: 5, y: 6 });
    expect(o).toEqual({ x: 1, y: 2 });
  });

  it('snaps to 15° increments when snap=true (Shift)', () => {
    // dx=100, dy=30 → 16.7° → 15°.
    expect(applyHatchAngleGripDrag(origin, { x: 600, y: 530 }, true)).toBeCloseTo(15, 6);
    // dx=100, dy=80 → 38.66° → 45°.
    expect(applyHatchAngleGripDrag(origin, { x: 600, y: 580 }, true)).toBeCloseTo(45, 6);
    // exact axis stays at 0°.
    expect(applyHatchAngleGripDrag(origin, { x: 600, y: 500 }, true)).toBeCloseTo(0, 6);
    // snap=false leaves the raw angle.
    expect(applyHatchAngleGripDrag(origin, { x: 600, y: 530 }, false)).toBeCloseTo(16.699, 2);
  });
});
