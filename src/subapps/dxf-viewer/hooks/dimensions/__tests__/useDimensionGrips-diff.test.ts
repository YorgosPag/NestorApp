/**
 * ADR-362 Round 22 — `diffDimEntity` tests (undoable grip-patch diff).
 *
 * Verifies the minimal symmetric patch produced for a dimension grip drag:
 *   - only changed fields appear (value-compare, not reference)
 *   - zero-delta → empty patch (no undo-stack pollution)
 *   - apply(patch) then apply(previous) round-trips each grip kind
 */

import { applyDimensionGripDrag, diffDimEntity } from '../useDimensionGrips';
import type { DimensionEntity, AlignedDimensionEntity, LinearDimensionEntity, OrdinateDimensionEntity } from '../../../types/dimension';
import type { Point2D } from '../../../rendering/types/Types';

function aligned(defPoints: Point2D[], textMidpoint?: Point2D): AlignedDimensionEntity {
  return { id: 'd', type: 'dimension', dimensionType: 'aligned', styleId: 's', layerId: 'L', defPoints, textMidpoint } as unknown as AlignedDimensionEntity;
}
function linear(defPoints: Point2D[], rotation = 0): LinearDimensionEntity {
  return { id: 'd', type: 'dimension', dimensionType: 'linear', styleId: 's', layerId: 'L', defPoints, rotation } as unknown as LinearDimensionEntity;
}
function ordinate(defPoints: Point2D[], datum: Point2D): OrdinateDimensionEntity {
  return { id: 'd', type: 'dimension', dimensionType: 'ordinate', styleId: 's', layerId: 'L', defPoints, datum, axis: 'x' } as unknown as OrdinateDimensionEntity;
}

const PTS: Point2D[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 20 }];
const DELTA: Point2D = { x: 5, y: 7 };
const ZERO: Point2D = { x: 0, y: 0 };

describe('diffDimEntity', () => {
  it('dim-line-ref drag → only defPoints changed', () => {
    const prev = aligned(PTS);
    const next = applyDimensionGripDrag('dim-line-ref', prev, DELTA, PTS[2]);
    const { patch, previous } = diffDimEntity(prev, next);
    expect(Object.keys(patch)).toEqual(['defPoints']);
    expect(patch.defPoints).toBe(next.defPoints);
    expect(previous.defPoints).toBe(prev.defPoints);
  });

  it('dim-text drag → only textMidpoint changed', () => {
    const prev = aligned(PTS);
    const next = applyDimensionGripDrag('dim-text', prev, DELTA, PTS[0]);
    const { patch, previous } = diffDimEntity(prev, next);
    expect(Object.keys(patch)).toEqual(['textMidpoint']);
    expect(patch.textMidpoint).toEqual(next.textMidpoint);
    expect(previous.textMidpoint).toBeUndefined(); // was unset before
  });

  it('linear dim-extra (rotation handle) → only rotation changed', () => {
    const prev = linear(PTS, 0);
    const next = applyDimensionGripDrag('dim-extra', prev, DELTA, { x: 50, y: 50 });
    const { patch, previous } = diffDimEntity(prev, next);
    expect(Object.keys(patch)).toEqual(['rotation']);
    expect(typeof patch.rotation).toBe('number');
    expect(previous.rotation).toBe(0);
  });

  it('ordinate dim-extra (datum) → only datum changed', () => {
    const prev = ordinate([{ x: 10, y: 10 }], { x: 0, y: 0 });
    const next = applyDimensionGripDrag('dim-extra', prev, DELTA, { x: 0, y: 0 });
    const { patch, previous } = diffDimEntity(prev, next);
    expect(Object.keys(patch)).toEqual(['datum']);
    expect(patch.datum).toEqual({ x: 5, y: 7 });
    expect(previous.datum).toEqual({ x: 0, y: 0 });
  });

  it('zero-delta drag → empty patch (no-op)', () => {
    const prev = aligned(PTS);
    const next = applyDimensionGripDrag('dim-defpoint-0', prev, ZERO, PTS[0]);
    const { patch } = diffDimEntity(prev, next);
    expect(Object.keys(patch).length).toBe(0);
  });

  it('patch is symmetric — applying previous after patch round-trips', () => {
    const prev = aligned(PTS);
    const next = applyDimensionGripDrag('dim-defpoint-1', prev, DELTA, PTS[1]);
    const { patch, previous } = diffDimEntity(prev, next);
    // forward: prev + patch == next
    const forward = { ...prev, ...patch } as DimensionEntity;
    expect(forward.defPoints).toEqual(next.defPoints);
    // backward: next + previous == prev
    const backward = { ...next, ...previous } as DimensionEntity;
    expect(backward.defPoints).toEqual(prev.defPoints);
  });
});
