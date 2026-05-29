/**
 * ADR-397 §12 D3 — shared `grip-math` SSoT tests.
 *
 * Coverage:
 *   - project2D drops Z.
 *   - perpUnit CCW 90°.
 *   - unitVector normalizes + null on degenerate.
 *   (Point rotation lives in utils/rotation-math.rotatePoint — ADR-188 SSoT.)
 */

import { project2D, perpUnit, unitVector } from '../grip-math';

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
