/**
 * ADR-397 §12 D3 — shared `grip-math` SSoT tests.
 *
 * Coverage:
 *   - project2D drops Z.
 *   - perpUnit CCW 90°.
 *   - unitVector normalizes + null on degenerate.
 *   - rotateVector / projectToLocalFrame (local-frame rotation, delegate to
 *     canonical rotatePoint — shared by column + mep-fixture grips).
 *   - sweptAngleDegAboutPivot (6-click ROTATE→Reference, shared by wall/column/fixture).
 */

import {
  project2D,
  perpUnit,
  unitVector,
  rotateVector,
  projectToLocalFrame,
  sweptAngleDegAboutPivot,
  rotateAxisPointsAboutPivot,
} from '../grip-math';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe('project2D', () => {
  it('drops the Z component', () => {
    expect(project2D({ x: 3, y: 4, z: 9 })).toEqual({ x: 3, y: 4 });
  });
});

describe('perpUnit', () => {
  it('CCW 90°: (1,0) → (0,1)', () => {
    const a = perpUnit({ x: 1, y: 0 });
    expect(near(a.x, 0)).toBe(true);
    expect(near(a.y, 1)).toBe(true);
    const b = perpUnit({ x: 0, y: 1 });
    expect(near(b.x, -1)).toBe(true);
    expect(near(b.y, 0)).toBe(true);
  });
});

describe('unitVector', () => {
  it('normalizes from → to', () => {
    const u = unitVector({ x: 0, y: 0 }, { x: 0, y: 5 });
    expect(u).not.toBeNull();
    expect(near(u!.x, 0)).toBe(true);
    expect(near(u!.y, 1)).toBe(true);
  });

  it('null on coincident (degenerate) points', () => {
    expect(unitVector({ x: 2, y: 2 }, { x: 2, y: 2 })).toBeNull();
  });
});

describe('rotateVector (local-frame → world, about origin)', () => {
  it('rotates (1,0) by +90° → (0,1)', () => {
    const r = rotateVector({ x: 1, y: 0 }, 90);
    expect(near(r.x, 0)).toBe(true);
    expect(near(r.y, 1)).toBe(true);
  });

  it('rotates (0,1) by +90° → (-1,0)', () => {
    const r = rotateVector({ x: 0, y: 1 }, 90);
    expect(near(r.x, -1)).toBe(true);
    expect(near(r.y, 0)).toBe(true);
  });

  it('0° is identity', () => {
    expect(rotateVector({ x: 3, y: 7 }, 0)).toEqual({ x: 3, y: 7 });
  });
});

describe('projectToLocalFrame (world → local axes, inverse rotation)', () => {
  it('is the inverse of rotateVector', () => {
    const v = { x: 4, y: -2 };
    const back = projectToLocalFrame(rotateVector(v, 37), 37);
    expect(near(back.x, v.x)).toBe(true);
    expect(near(back.y, v.y)).toBe(true);
  });

  it('projects a +Y world delta onto local +X when the frame is rotated +90°', () => {
    // Frame rotated +90°: local +X points to world +Y → a world (0,1) delta is pure local +X.
    const local = projectToLocalFrame({ x: 0, y: 1 }, 90);
    expect(near(local.x, 1)).toBe(true);
    expect(near(local.y, 0)).toBe(true);
  });
});

describe('sweptAngleDegAboutPivot (6-click ROTATE→Reference)', () => {
  const pivot = { x: 0, y: 0 };

  it('measures the CCW swept angle from anchor to current', () => {
    // anchor along +X, current along +Y → +90°.
    expect(sweptAngleDegAboutPivot(pivot, { x: 10, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90, 6);
  });

  it('is sign-aware (CW → negative)', () => {
    expect(sweptAngleDegAboutPivot(pivot, { x: 0, y: 10 }, { x: 10, y: 0 })).toBeCloseTo(-90, 6);
  });

  it('returns null when the current vector is degenerate (cursor on pivot)', () => {
    expect(sweptAngleDegAboutPivot(pivot, { x: 10, y: 0 }, { x: 0, y: 0 })).toBeNull();
  });

  it('returns null when the anchor vector is degenerate', () => {
    expect(sweptAngleDegAboutPivot(pivot, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeNull();
  });
});

describe('rotateAxisPointsAboutPivot (shared axis-rotation SSoT — wall + beam)', () => {
  const pivot = { x: 2000, y: 0 };

  it('rotates every point by the anchor→current swept angle (90° CCW)', () => {
    // anchor at pivot+(1,0) → 0°, current at pivot+(0,1) → +90°.
    const out = rotateAxisPointsAboutPivot(
      [{ x: 0, y: 0 }, { x: 4000, y: 0 }],
      { pivot, anchor: { x: 2001, y: 0 }, currentPos: { x: 2000, y: 1 } },
    );
    expect(out).not.toBeNull();
    // (0,0) rel (−2000,0) → (0,−2000) → (2000,−2000); (4000,0) → (2000,2000).
    expect(near(out![0].x, 2000)).toBe(true);
    expect(near(out![0].y, -2000)).toBe(true);
    expect(near(out![1].x, 2000)).toBe(true);
    expect(near(out![1].y, 2000)).toBe(true);
  });

  it('preserves point count + distance to pivot (rigid rotation)', () => {
    const pts = [{ x: 100, y: 200 }, { x: -50, y: 80 }, { x: 300, y: -90 }];
    const out = rotateAxisPointsAboutPivot(pts, {
      pivot, anchor: { x: 2010, y: 5 }, currentPos: { x: 2003, y: 17 },
    })!;
    expect(out).toHaveLength(3);
    for (let i = 0; i < pts.length; i++) {
      const d0 = Math.hypot(pts[i].x - pivot.x, pts[i].y - pivot.y);
      const d1 = Math.hypot(out[i].x - pivot.x, out[i].y - pivot.y);
      expect(near(d0, d1, 1e-6)).toBe(true);
    }
  });

  it('returns null on a degenerate swept angle (cursor on pivot) → caller no-ops', () => {
    expect(
      rotateAxisPointsAboutPivot([{ x: 0, y: 0 }], {
        pivot, anchor: { x: 2010, y: 0 }, currentPos: { x: 2000, y: 0 },
      }),
    ).toBeNull();
  });
});
