/**
 * ADR-358 Phase 5b — `stair-grips` pure handlers tests.
 *
 * Coverage:
 *   - `getStairGrips()` returns 4 grips for straight/spiral/winder (no split)
 *     and 5 grips for l-shape/u-shape/gamma (with split).
 *   - `applyStairGripDrag()` produces correct `StairParams` for each of the
 *     5 grip kinds (base / direction / width / length / split).
 */

import {
  buildDefaultStairParams,
  buildStairEntity,
} from '../../../hooks/drawing/stair-completion';
import { applyStairGripDrag, getStairGrips } from '../stair-grips';
import type { StairEntity, StairParams } from '../../../bim/types/stair-types';

describe('stair-grips (Phase 5b)', () => {
  const basePoint = { x: 0, y: 0 };

  function makeStraight(): StairEntity {
    const params = buildDefaultStairParams(basePoint, 0);
    return buildStairEntity(params, '0');
  }

  function makeLShape(): StairEntity {
    const base = buildDefaultStairParams(basePoint, 0);
    const params: StairParams = {
      ...base,
      variant: {
        kind: 'l-shape',
        cornerStyle: 'landing',
        turnDirection: 'right',
        landingDepth: 'auto',
        flightSplit: [6, 6],
      },
    };
    return buildStairEntity(params, '0');
  }

  // ─── getStairGrips ────────────────────────────────────────────────────

  it('1. straight stair → 4 grips (no split)', () => {
    const entity = makeStraight();
    const grips = getStairGrips(entity);
    expect(grips).toHaveLength(4);
    expect(grips.map((g) => g.stairGripKind)).toEqual([
      'stair-base',
      'stair-direction',
      'stair-width',
      'stair-length',
    ]);
  });

  it('2. l-shape stair → 5 grips (with split)', () => {
    const entity = makeLShape();
    const grips = getStairGrips(entity);
    expect(grips).toHaveLength(5);
    expect(grips[4].stairGripKind).toBe('stair-split');
  });

  it('3. basePoint grip at entity.params.basePoint', () => {
    const entity = makeStraight();
    const grips = getStairGrips(entity);
    const base = grips[0];
    expect(base.position.x).toBeCloseTo(entity.params.basePoint.x, 6);
    expect(base.position.y).toBeCloseTo(entity.params.basePoint.y, 6);
  });

  it('4. direction grip at basePoint + 100mm·u', () => {
    const entity = makeStraight();
    const grips = getStairGrips(entity);
    const dir = grips[1];
    // direction=0 → unit vector (1,0) → handle at base + (100, 0).
    expect(dir.position.x).toBeCloseTo(entity.params.basePoint.x + 100, 6);
    expect(dir.position.y).toBeCloseTo(entity.params.basePoint.y, 6);
  });

  // ─── applyStairGripDrag ───────────────────────────────────────────────

  it('5. stair-base drag → translates basePoint by delta', () => {
    const entity = makeStraight();
    const newParams = applyStairGripDrag('stair-base', {
      originalParams: entity.params,
      delta: { x: 50, y: 30 },
      currentPos: { x: 50, y: 30 },
    });
    expect(newParams.basePoint.x).toBe(entity.params.basePoint.x + 50);
    expect(newParams.basePoint.y).toBe(entity.params.basePoint.y + 30);
    expect(newParams.basePoint.z).toBe(entity.params.basePoint.z);
  });

  it('6. stair-direction drag → recomputes direction via atan2', () => {
    const entity = makeStraight();
    const newParams = applyStairGripDrag('stair-direction', {
      originalParams: entity.params,
      delta: { x: 0, y: 100 },
      currentPos: { x: 0, y: 100 },
    });
    // atan2(100, 0) = π/2 = 90°
    expect(newParams.direction).toBeCloseTo(90, 4);
  });

  it('7. stair-width drag → updates width to 2·|projection on perp|', () => {
    const entity = makeStraight();
    // direction = 0 → perp unit = (0, 1). Cursor at y = 600 → width = 1200.
    const newParams = applyStairGripDrag('stair-width', {
      originalParams: entity.params,
      delta: { x: 0, y: 600 },
      currentPos: { x: 0, y: 600 },
    });
    expect(newParams.width).toBeCloseTo(1200, 4);
  });

  it('8. stair-length drag → derives stepCount from projection / tread', () => {
    const entity = makeStraight();
    // tread = 280. projection = 1000 → stepCount = floor(1000/280)+1 = 4.
    const newParams = applyStairGripDrag('stair-length', {
      originalParams: entity.params,
      delta: { x: 1000, y: 0 },
      currentPos: { x: 1000, y: 0 },
    });
    expect(newParams.stepCount).toBe(4);
    expect(newParams.totalRun).toBeCloseTo(280 * 3, 4);
  });

  it('9. stair-split drag on l-shape → updates flightSplit to integer step counts summing to stepCount', () => {
    // ADR-358 Phase 3d hotfix — `flightSplit` carries integer step counts
    // (consumed by `new Array(n_i)` in flight builders), not ratios. Pushing
    // the split far past the end clamps the ratio to MAX_FLIGHT_SPLIT_RATIO
    // and then rounds to step counts that satisfy `n1 + n2 === stepCount`
    // and `n_i >= 1`.
    const entity = makeLShape();
    const newParams = applyStairGripDrag('stair-split', {
      originalParams: entity.params,
      delta: { x: 100000, y: 0 },
      currentPos: { x: 100000, y: 0 },
    });
    expect(newParams.variant.kind).toBe('l-shape');
    if (newParams.variant.kind === 'l-shape') {
      const [a, b] = newParams.variant.flightSplit;
      expect(Number.isInteger(a)).toBe(true);
      expect(Number.isInteger(b)).toBe(true);
      expect(a).toBeGreaterThanOrEqual(1);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(newParams.stepCount - 1);
      // ADR-358 Phase 3f — l-shape landing: n1 + 1(landing) + n2 = stepCount
      // ⇒ split sum = stepCount - 1 (γ count conservation, fixes Phase 3e regression).
      const expectedTotal =
        newParams.variant.cornerStyle === 'winders'
          ? newParams.stepCount - newParams.variant.winderCount
          : newParams.stepCount - 1;
      expect(a + b).toBe(expectedTotal);
    }
  });

  it('10. stair-split on straight → returns originalParams unchanged (no split)', () => {
    const entity = makeStraight();
    const newParams = applyStairGripDrag('stair-split', {
      originalParams: entity.params,
      delta: { x: 100, y: 0 },
      currentPos: { x: 100, y: 0 },
    });
    expect(newParams).toBe(entity.params);
  });
});
