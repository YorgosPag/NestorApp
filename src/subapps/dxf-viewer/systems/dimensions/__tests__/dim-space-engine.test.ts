/**
 * ADR-362 Phase K2 — dim-space-engine unit tests.
 *
 * Coverage:
 *   computeDimSpacing:
 *     - empty targetDims → empty result map
 *     - unsupported type (angular) → skipped, not in result
 *     - 'align' mode (spacing=0) → collapses target to base dim-line offset
 *     - 'custom' mode → shifts target to baseOffset ± customValue
 *     - 'auto' mode → shifts by 2 × style.paperTextHeight
 *     - target already at correct position → null from repositionDim → not in result
 *     - target above base → positive sign; target below → negative sign
 *     - defPoints[0..1] (originA/B) unchanged after reposition; only defPoints[2] shifts
 *     - insufficient defPoints (<3) → skipped
 *
 * Run: `npx jest dim-space-engine.test --runInBand`
 */

import { computeDimSpacing } from '../dim-space-engine';
import type { DimensionEntity, DimStyle } from '../../../types/dimension';
import { ISO_129_TEMPLATE } from '../dim-style-templates';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeStyle(patch: Partial<DimStyle> = {}): DimStyle {
  return { ...ISO_129_TEMPLATE, ...patch };
}

let _entitySeq = 0;

/**
 * Create a horizontal linear dimension entity.
 * `dimLineY` is the Y of the dim line (the perpendicular offset from origin).
 * defPoints = [{x:0,y:0}, {x:100,y:0}, {x:50, y:dimLineY}]
 */
function makeLinearDim(dimLineY: number, id?: string): DimensionEntity {
  return {
    id: id ?? `dim-${++_entitySeq}`,
    type: 'dimension',
    layerId: 'lyr_0000000000000000000000000000000000000000',
    dimensionType: 'linear',
    defPoints: [
      { x: 0,  y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: dimLineY },
    ],
  } as unknown as DimensionEntity;
}

function makeAngularDim(): DimensionEntity {
  return {
    id: `dim-angular-${++_entitySeq}`,
    type: 'dimension',
    layerId: 'lyr_0000000000000000000000000000000000000000',
    dimensionType: 'angular3P',
    defPoints: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ],
  } as unknown as DimensionEntity;
}

const EPS = 1e-6;
function approx(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS;
}

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('computeDimSpacing — edge cases', () => {
  it('empty targetDims → empty result map', () => {
    const base = makeLinearDim(20);
    const result = computeDimSpacing(base, [], makeStyle(), 'custom', 10);
    expect(result.size).toBe(0);
  });

  it('unsupported dim type (angular) → not in result', () => {
    const base = makeLinearDim(20);
    const angular = makeAngularDim();
    const result = computeDimSpacing(base, [angular], makeStyle(), 'custom', 10);
    expect(result.has(angular.id)).toBe(false);
  });

  it('target with insufficient defPoints (<3) → not in result', () => {
    const base = makeLinearDim(20);
    const badDim = {
      ...makeLinearDim(30),
      defPoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    } as unknown as DimensionEntity;
    const result = computeDimSpacing(base, [badDim], makeStyle(), 'custom', 10);
    expect(result.has(badDim.id)).toBe(false);
  });
});

// ── 'align' mode ──────────────────────────────────────────────────────────────

describe("computeDimSpacing 'align' mode (spacing=0)", () => {
  it('collapses target dim line onto base dim line', () => {
    const base = makeLinearDim(20);   // base dim line at y=20
    const target = makeLinearDim(35); // target currently at y=35

    const result = computeDimSpacing(base, [target], makeStyle(), 'align');
    expect(result.has(target.id)).toBe(true);

    const newPts = result.get(target.id)!.defPoints;
    // defPoints[2].y should now equal base's dimLineRef.y = 20
    expect(approx(newPts[2].y, 20)).toBe(true);
  });

  it('origins (defPoints[0] and [1]) are not shifted', () => {
    const base = makeLinearDim(20);
    const target = makeLinearDim(35);
    const result = computeDimSpacing(base, [target], makeStyle(), 'align');
    const newPts = result.get(target.id)!.defPoints;
    expect(approx(newPts[0].x, 0)).toBe(true);
    expect(approx(newPts[0].y, 0)).toBe(true);
    expect(approx(newPts[1].x, 100)).toBe(true);
  });
});

// ── 'custom' mode ─────────────────────────────────────────────────────────────

describe("computeDimSpacing 'custom' mode", () => {
  it('target above base → placed at baseOffset + spacing', () => {
    const base = makeLinearDim(10);    // base at y=10
    const target = makeLinearDim(30);  // target above (greater y)

    const result = computeDimSpacing(base, [target], makeStyle(), 'custom', 15);
    const newPts = result.get(target.id)!.defPoints;
    // target should be at y = 10 + 15 = 25
    expect(approx(newPts[2].y, 25)).toBe(true);
  });

  it('target between base and origins → moved toward base', () => {
    // base at y=30, target at y=10 (between base and origins y=0)
    // sign = -1 (targetOffset=10 < baseOffset=30), newOffset = 30 - 15 = 15
    // delta = 15 - 10 = 5 → target moves from y=10 to y=15
    const base = makeLinearDim(30);
    const target = makeLinearDim(10);

    const result = computeDimSpacing(base, [target], makeStyle(), 'custom', 15);
    expect(result.has(target.id)).toBe(true);
    const newPts = result.get(target.id)!.defPoints;
    expect(approx(newPts[2].y, 15)).toBe(true);
  });

  it('target already at correct position → not in result (delta ≈ 0)', () => {
    const base = makeLinearDim(10);
    const target = makeLinearDim(25); // 10 + 15 = 25 already correct
    const result = computeDimSpacing(base, [target], makeStyle(), 'custom', 15);
    // Already at correct position → delta < 1e-9 → repositionDim returns null
    expect(result.has(target.id)).toBe(false);
  });
});

// ── 'auto' mode ───────────────────────────────────────────────────────────────

describe("computeDimSpacing 'auto' mode", () => {
  it('spacing = 2 × paperTextHeight', () => {
    const paperTextHeight = 3.5;
    const style = makeStyle({ paperTextHeight });
    const expectedSpacing = 2 * paperTextHeight; // 7

    const base = makeLinearDim(10);
    const target = makeLinearDim(100); // far from base, so will be moved

    const result = computeDimSpacing(base, [target], style, 'auto');
    const newPts = result.get(target.id)!.defPoints;
    // newOffset = 10 + 7 = 17
    expect(approx(newPts[2].y, 10 + expectedSpacing)).toBe(true);
  });
});

// ── Multiple targets ──────────────────────────────────────────────────────────

describe('multiple target dimensions', () => {
  it('stacks multiple targets at INCREMENTAL slots (nearest = slot 1)', () => {
    // base=10, spacing=20. Two same-side targets, unevenly placed at 100 and 200.
    // Incremental fix: nearest (t1) → slot 1 (offset 30), next (t2) → slot 2 (offset 50).
    // (Pre-fix bug placed BOTH at offset 30, re-overlapping them.)
    const base = makeLinearDim(10);
    const t1 = makeLinearDim(100);
    const t2 = makeLinearDim(200);
    const result = computeDimSpacing(base, [t1, t2], makeStyle(), 'custom', 20);
    expect(approx(result.get(t1.id)!.defPoints[2].y, 30)).toBe(true);
    expect(approx(result.get(t2.id)!.defPoints[2].y, 50)).toBe(true);
  });

  it('already-evenly-spaced targets are left untouched (zero delta)', () => {
    const base = makeLinearDim(10);
    const t1 = makeLinearDim(30); // slot 1 = 10 + 20
    const t2 = makeLinearDim(50); // slot 2 = 10 + 40
    const result = computeDimSpacing(base, [t1, t2], makeStyle(), 'custom', 20);
    expect(result.has(t1.id)).toBe(false);
    expect(result.has(t2.id)).toBe(false);
  });

  it('angular dims in mixed list are filtered out', () => {
    const base = makeLinearDim(10);
    const linear = makeLinearDim(40);
    const angular = makeAngularDim();
    const result = computeDimSpacing(base, [linear, angular], makeStyle(), 'custom', 15);
    expect(result.has(angular.id)).toBe(false);
  });
});
