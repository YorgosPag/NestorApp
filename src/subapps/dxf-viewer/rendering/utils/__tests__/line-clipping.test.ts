import { clipParametricLine } from '../line-clipping';

const VP = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

function approxPoint(p: { x: number; y: number }, ex: number, ey: number, tol = 1e-6) {
  expect(p.x).toBeCloseTo(ex, 6);
  expect(p.y).toBeCloseTo(ey, 6);
}

describe('clipParametricLine — Liang-Barsky', () => {
  // 1. Horizontal xline through center → clips to full width
  it('horizontal xline inside viewport', () => {
    const r = clipParametricLine({ x: 50, y: 50 }, { x: 1, y: 0 }, { min: -Infinity, max: Infinity }, VP);
    expect(r).not.toBeNull();
    approxPoint(r!.start, 0, 50);
    approxPoint(r!.end, 100, 50);
  });

  // 2. Vertical xline through center
  it('vertical xline inside viewport', () => {
    const r = clipParametricLine({ x: 50, y: 50 }, { x: 0, y: 1 }, { min: -Infinity, max: Infinity }, VP);
    expect(r).not.toBeNull();
    approxPoint(r!.start, 50, 0);
    approxPoint(r!.end, 50, 100);
  });

  // 3. Diagonal 45° xline through center
  it('diagonal 45° xline through center', () => {
    const sq2 = Math.SQRT2 / 2;
    const r = clipParametricLine({ x: 50, y: 50 }, { x: sq2, y: sq2 }, { min: -Infinity, max: Infinity }, VP);
    expect(r).not.toBeNull();
    approxPoint(r!.start, 0, 0);
    approxPoint(r!.end, 100, 100);
  });

  // 4. Xline parallel to X, above viewport → null
  it('horizontal xline above viewport → null', () => {
    const r = clipParametricLine({ x: 50, y: 150 }, { x: 1, y: 0 }, { min: -Infinity, max: Infinity }, VP);
    expect(r).toBeNull();
  });

  // 5. Xline parallel to Y, left of viewport → null
  it('vertical xline left of viewport → null', () => {
    const r = clipParametricLine({ x: -10, y: 50 }, { x: 0, y: 1 }, { min: -Infinity, max: Infinity }, VP);
    expect(r).toBeNull();
  });

  // 6. Ray with base inside viewport, pointing right
  it('ray base inside viewport → clipped at right edge', () => {
    const r = clipParametricLine({ x: 50, y: 50 }, { x: 1, y: 0 }, { min: 0, max: Infinity }, VP);
    expect(r).not.toBeNull();
    approxPoint(r!.start, 50, 50);
    approxPoint(r!.end, 100, 50);
  });

  // 7. Ray base outside viewport but direction points inward
  it('ray base outside viewport, direction inward → clipped', () => {
    const r = clipParametricLine({ x: -50, y: 50 }, { x: 1, y: 0 }, { min: 0, max: Infinity }, VP);
    expect(r).not.toBeNull();
    approxPoint(r!.start, 0, 50);
    approxPoint(r!.end, 100, 50);
  });

  // 8. Ray base outside and direction points away → null
  it('ray base outside viewport, direction outward → null', () => {
    const r = clipParametricLine({ x: -50, y: 50 }, { x: -1, y: 0 }, { min: 0, max: Infinity }, VP);
    expect(r).toBeNull();
  });

  // 9. Degenerate direction (0,0) → null
  it('degenerate direction → null', () => {
    const r = clipParametricLine({ x: 50, y: 50 }, { x: 0, y: 0 }, { min: -Infinity, max: Infinity }, VP);
    expect(r).toBeNull();
  });

  // 10. tRange min=0, max=Infinity (ray semantics) — base at edge, points in
  it('ray semantics — base on left edge, points right', () => {
    const r = clipParametricLine({ x: 0, y: 50 }, { x: 1, y: 0 }, { min: 0, max: Infinity }, VP);
    expect(r).not.toBeNull();
    approxPoint(r!.start, 0, 50);
    approxPoint(r!.end, 100, 50);
  });

  // 11. tRange min=-Infinity, max=Infinity (xline semantics) — base off-viewport
  it('xline semantics — base outside, line crosses viewport', () => {
    const r = clipParametricLine({ x: -200, y: 50 }, { x: 1, y: 0 }, { min: -Infinity, max: Infinity }, VP);
    expect(r).not.toBeNull();
    approxPoint(r!.start, 0, 50);
    approxPoint(r!.end, 100, 50);
  });

  // 12. Line tangent to top edge (t_enter ≈ t_exit)
  it('xline tangent to top edge → degenerate segment', () => {
    const r = clipParametricLine({ x: 50, y: 100 }, { x: 1, y: 0 }, { min: -Infinity, max: Infinity }, VP);
    expect(r).not.toBeNull();
    expect(r!.start.y).toBeCloseTo(100, 6);
    expect(r!.end.y).toBeCloseTo(100, 6);
  });

  // 13. Viewport zero-width (minX === maxX) → null (parallel to vertical edge and outside)
  it('zero-width viewport → null', () => {
    const zeroVP = { minX: 50, minY: 0, maxX: 50, maxY: 100 };
    const r = clipParametricLine({ x: 0, y: 50 }, { x: 0, y: 1 }, { min: -Infinity, max: Infinity }, zeroVP);
    expect(r).toBeNull();
  });

  // 14. Direction negative X (pointing left) — should still clip correctly
  it('xline pointing left (-x direction) → clipped same as +x', () => {
    const r = clipParametricLine({ x: 50, y: 50 }, { x: -1, y: 0 }, { min: -Infinity, max: Infinity }, VP);
    expect(r).not.toBeNull();
    // start = base + tEnter*dir = base + (-50)*(-1,0) = (100,50)
    // end   = base + tExit *dir = base + (-50)*(-1,0) ... actually tEnter < tExit
    // With dir=(-1,0): left edge q=50 p=1 → t=50 (exit), right q=50 p=-1 → t=-50 (enter)
    // tEnter=-50 (clamped from -T_BOUND), tExit=50... no:
    // Actually for dir=(-1,0): ps=[-(-1), -1, 0, 0] = [1, -1, 0, 0]
    // qs=[50, 50, 50, 50]
    // p=1,q=50 → p>0 → exit t=50; p=-1,q=50 → p<0 → enter t=-50
    // tEnter=max(-T_BOUND, -50)=-50, tExit=min(T_BOUND,50)=50
    // start=(50+(-50)*(-1), 50)=(100,50), end=(50+50*(-1),50)=(0,50)
    approxPoint(r!.start, 100, 50);
    approxPoint(r!.end, 0, 50);
  });

  // 15. Large base coordinates, small viewport
  it('large base coordinates, small viewport → clipped correctly', () => {
    const smallVP = { minX: 9990, minY: 9990, maxX: 10010, maxY: 10010 };
    const r = clipParametricLine({ x: 10000, y: 10000 }, { x: 1, y: 0 }, { min: -Infinity, max: Infinity }, smallVP);
    expect(r).not.toBeNull();
    approxPoint(r!.start, 9990, 10000);
    approxPoint(r!.end, 10010, 10000);
  });

  // 16. Ray completely inside viewport (both ends within tRange and viewport)
  it('ray pointing up inside viewport, base at bottom edge', () => {
    const r = clipParametricLine({ x: 50, y: 0 }, { x: 0, y: 1 }, { min: 0, max: Infinity }, VP);
    expect(r).not.toBeNull();
    approxPoint(r!.start, 50, 0);
    approxPoint(r!.end, 50, 100);
  });

  // 17. Xline at angle not aligned to axes, base outside
  it('xline diagonal from outside corner covers viewport', () => {
    // 45° line through (0,0) with base at (-10,-10)
    const sq2 = Math.SQRT2 / 2;
    const r = clipParametricLine({ x: -10, y: -10 }, { x: sq2, y: sq2 }, { min: -Infinity, max: Infinity }, VP);
    expect(r).not.toBeNull();
    approxPoint(r!.start, 0, 0);
    approxPoint(r!.end, 100, 100);
  });
});
