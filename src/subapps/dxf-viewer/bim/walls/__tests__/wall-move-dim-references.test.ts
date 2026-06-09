/**
 * ADR-363 Φ1G.5 Slice 2h — resolveWallMoveDimReferences (Revit temporary dimensions for
 * a wall dragged laterally: perpendicular clearance to the nearest PARALLEL reference
 * wall on each side). Fixtures use `sceneUnits: 'mm'` (scene scale 1) unless noted, so
 * every coordinate is already in millimetres.
 */

import { resolveWallMoveDimReferences, type MovingWallAxis } from '../wall-move-dim-references';
import type { WallEntity } from '../../types/wall-types';
import type { SceneUnits } from '../../../utils/scene-units';

/** Straight wall fixture: axis start→end, given units (default mm). */
const wall = (
  id: string,
  start: readonly [number, number],
  end: readonly [number, number],
  sceneUnits: SceneUnits = 'mm',
): WallEntity =>
  ({
    id,
    kind: 'straight',
    params: {
      start: { x: start[0], y: start[1], z: 0 },
      end: { x: end[0], y: end[1], z: 0 },
      thickness: 200,
      sceneUnits,
    },
  }) as unknown as WallEntity;

/**
 * Moving axis: a 4 m horizontal wall along +X at y = 0, thickness 200 mm (mm scene).
 * Its CCW normal = +Y. Fixtures all use thickness 200 → each half-face = 100 mm, so a
 * 2000 mm centreline gap becomes a 1800 mm FACE-to-FACE clear gap (2000 − 100 − 100).
 */
const moving: MovingWallAxis = { id: 'moving', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thicknessMm: 200, sceneUnits: 'mm' };

describe('resolveWallMoveDimReferences', () => {
  it('measures the face-to-face clear gap to a parallel wall on each side', () => {
    const above = wall('above', [0, 2000], [4000, 2000]); // +Y side, 2000 mm centreline
    const below = wall('below', [0, -3000], [4000, -3000]); // −Y side, 3000 mm centreline
    const { references } = resolveWallMoveDimReferences(moving, [above, below]);

    expect(references).toHaveLength(2);
    const pos = references.find((r) => r.side === 'positive');
    const neg = references.find((r) => r.side === 'negative');
    expect(pos?.referenceWallId).toBe('above');
    expect(pos?.distanceMm).toBeCloseTo(1800, 6); // 2000 − 100 − 100
    expect(neg?.referenceWallId).toBe('below');
    expect(neg?.distanceMm).toBeCloseTo(2800, 6); // 3000 − 100 − 100
    // Witness endpoints sit on the two near FACES, not the centrelines.
    expect(pos?.fromPlan).toEqual({ x: 2000, y: 100 }); // moving near face (+half)
    expect(pos?.toPlan).toEqual({ x: 2000, y: 1900 }); // reference near face (centre − half)
  });

  it('picks the NEAREST parallel wall when several lie on the same side', () => {
    const near = wall('near', [0, 1500], [4000, 1500]);
    const far = wall('far', [0, 5000], [4000, 5000]);
    const { references } = resolveWallMoveDimReferences(moving, [far, near]);

    expect(references).toHaveLength(1);
    expect(references[0].side).toBe('positive');
    expect(references[0].referenceWallId).toBe('near');
    expect(references[0].distanceMm).toBeCloseTo(1300, 6); // 1500 − 100 − 100
  });

  it('skips a parallel wall that overlaps/touches the moving wall (no positive gap)', () => {
    const touching = wall('touch', [0, 150], [4000, 150]); // centreline 150 < 100+100 → faces overlap
    expect(resolveWallMoveDimReferences(moving, [touching]).references).toHaveLength(0);
  });

  it('ignores PERPENDICULAR (non-parallel) walls', () => {
    const cross = wall('cross', [2000, -2000], [2000, 2000]); // vertical → perpendicular
    expect(resolveWallMoveDimReferences(moving, [cross]).references).toHaveLength(0);
  });

  it('ignores a parallel wall whose perpendicular misses its extent (no overlap)', () => {
    const offAxis = wall('off', [8000, 2000], [12000, 2000]); // parallel but past the +X end
    expect(resolveWallMoveDimReferences(moving, [offAxis]).references).toHaveLength(0);
  });

  it('ignores a collinear wall on the same centreline', () => {
    const collinear = wall('col', [5000, 0], [9000, 0]);
    expect(resolveWallMoveDimReferences(moving, [collinear]).references).toHaveLength(0);
  });

  it('returns no references when there are no candidates', () => {
    expect(resolveWallMoveDimReferences(moving, []).references).toHaveLength(0);
    expect(resolveWallMoveDimReferences(moving, [wall('moving', [0, 9], [4000, 9])]).references).toHaveLength(0); // self
  });

  it('returns no references for a degenerate (< 1 mm) moving wall', () => {
    const dot: MovingWallAxis = { id: 'm', start: { x: 0, y: 0 }, end: { x: 0.5, y: 0 }, thicknessMm: 200, sceneUnits: 'mm' };
    expect(resolveWallMoveDimReferences(dot, [wall('a', [0, 2000], [4000, 2000])]).references).toHaveLength(0);
  });

  it('reports the face-to-face gap in mm regardless of the scene unit (metres)', () => {
    const movingM: MovingWallAxis = { id: 'm', start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, thicknessMm: 200, sceneUnits: 'm' };
    const above = wall('above', [0, 2], [4, 2], 'm'); // 2 m centreline, both 200 mm thick
    const { references } = resolveWallMoveDimReferences(movingM, [above]);
    expect(references).toHaveLength(1);
    expect(references[0].distanceMm).toBeCloseTo(1800, 3); // (2 m − 100 − 100 mm) → 1800 mm
  });
});
