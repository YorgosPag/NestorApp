/**
 * ADR-583 Φ2.4 — Scale-bar grip SSoT tests.
 *
 * Covers the pure grip layer both grip paths consume (`getScaleBarGrips` +
 * `applyScaleBarGripDrag`): grip positions derive from the DERIVED geometry, and the
 * three drags (move / rotation / length) transform the flat params correctly with the
 * span quantized to nice 1-2-5 numbers.
 */

import {
  getScaleBarGrips,
  applyScaleBarGripDrag,
} from '../scale-bar-grips';
import { buildScaleBarEntity } from '../build-scale-bar-entity';
import { computeScaleBarGeometry } from '../../geometry/scale-bar-geometry';
import { realDistanceToModelMm } from '../../../utils/scene-units';
import type { ScaleBarEntity } from '../../../types/scale-bar';

/** A horizontal 10 m bar at the origin (unit metres → 10 000 canonical-mm span). */
function tenMetreBar(overrides: Partial<ScaleBarEntity> = {}): ScaleBarEntity {
  const base = buildScaleBarEntity({ x: 0, y: 0 }, { x: 10_000, y: 0 }, { layerId: 'L', unit: 'm' });
  return { ...base, ...overrides };
}

describe('getScaleBarGrips — 3 grips from derived geometry', () => {
  it('emits move (midpoint), rotation, length (endPosition) with distinct kinds', () => {
    const e = tenMetreBar();
    const geo = computeScaleBarGeometry(e, 1, 'mm');
    const grips = getScaleBarGrips(e);

    expect(grips).toHaveLength(3);
    expect(grips.map((g) => g.gripKind?.kind)).toEqual([
      'scale-bar-move', 'scale-bar-rotation', 'scale-bar-length',
    ]);
    expect(grips.every((g) => g.gripKind?.on === 'scale-bar')).toBe(true);

    // MOVE @ axis midpoint (movesEntity), LENGTH @ derived endPosition.
    expect(grips[0].movesEntity).toBe(true);
    expect(grips[0].position.x).toBeCloseTo(geo.endPosition.x / 2, 6);
    expect(grips[2].position.x).toBeCloseTo(geo.endPosition.x, 6);
    expect(grips[2].position.y).toBeCloseTo(geo.endPosition.y, 6);
    // Rotation handle sits OFF the axis (perpendicular offset), not on the baseline.
    expect(grips[1].movesEntity).toBe(false);
    expect(Math.abs(grips[1].position.y)).toBeGreaterThan(0);
  });
});

describe('applyScaleBarGripDrag — the three transforms', () => {
  it('move → translates position by delta (span/endPosition follow)', () => {
    const e = tenMetreBar();
    const patch = applyScaleBarGripDrag('scale-bar-move', e, { x: 5_000, y: 0 }, { x: 100, y: 200 });
    expect(patch.position).toEqual({ x: 100, y: 200 });
    expect(patch.angleRad).toBeUndefined();
    expect(patch.length).toBeUndefined();
  });

  it('rotation → writes angleRad only (swept angle, no-op at zero delta)', () => {
    const e = tenMetreBar(); // angleRad = 0
    const grips = getScaleBarGrips(e);
    const handlePos = grips[1].position;

    // Zero delta → no rotation.
    expect(applyScaleBarGripDrag('scale-bar-rotation', e, handlePos, { x: 0, y: 0 }).angleRad)
      .toBeCloseTo(0, 9);

    // Drag the handle a quarter turn (+90°) about the origin: a handle initially at
    // angle θ moves to θ+90°, so angleRad increases by +π/2. length untouched.
    const r = Math.hypot(handlePos.x, handlePos.y);
    const theta0 = Math.atan2(handlePos.y, handlePos.x);
    const rotated = { x: r * Math.cos(theta0 + Math.PI / 2), y: r * Math.sin(theta0 + Math.PI / 2) };
    const patch = applyScaleBarGripDrag(
      'scale-bar-rotation', e, handlePos,
      { x: rotated.x - handlePos.x, y: rotated.y - handlePos.y },
    );
    expect(patch.angleRad).toBeCloseTo(Math.PI / 2, 6);
    expect(patch.length).toBeUndefined();
    expect(patch.position).toBeUndefined();
  });

  it('length → recomputes angleRad + snaps length to a nice 1-2-5 number', () => {
    const e = tenMetreBar();
    const end = computeScaleBarGeometry(e, 1, 'mm').endPosition; // (10 000, 0)

    // Drag the far end out to ~23 m (23 000 mm) along +X → snaps to 20 m.
    const patch = applyScaleBarGripDrag('scale-bar-length', e, end, { x: 13_000, y: 0 });
    expect(patch.angleRad).toBeCloseTo(0, 9);
    expect(patch.length).toBe(20); // 23 → nearest 1-2-5 = 20
    expect(patch.position).toBeUndefined();

    // The rebuilt span is a REAL model distance (scale-invariant), NOT via drawingScale.
    const e2: ScaleBarEntity = { ...e, ...patch };
    expect(computeScaleBarGeometry(e2, 1, 'mm').totalModelLengthMm)
      .toBeCloseTo(realDistanceToModelMm(20, 'm'), 6);
  });

  it('length drag at an angle → new angleRad follows the far point', () => {
    const e = tenMetreBar();
    const end = computeScaleBarGeometry(e, 1, 'mm').endPosition; // (10 000, 0)
    // Move the far end to (0, 10 000) → axis now points +Y (π/2).
    const patch = applyScaleBarGripDrag('scale-bar-length', e, end, { x: -10_000, y: 10_000 });
    expect(patch.angleRad).toBeCloseTo(Math.PI / 2, 6);
    expect(patch.length).toBe(10);
  });
});
