/**
 * ADR-363 Phase 1C — `wall-grips` pure handlers tests.
 *
 * Coverage:
 *   - `getWallGrips()` returns the right grip set per kind:
 *       straight  → start / end / midpoint / thickness
 *       curved    → + curve control (when params.curveControl set)
 *       polyline  → + N interior vertex grips (skips endpoints)
 *   - `applyWallGripDrag()` produces correct `WallParams` per grip kind:
 *       wall-start / wall-end translate the respective endpoint
 *       wall-midpoint translates both endpoints by delta
 *       wall-thickness clamps within [min, max] (scene-unit-aware) and drops dna
 *       wall-curve seeds + offsets the curveControl point
 *       wall-vertex-N translates the N-th interior polyline vertex
 */

import { applyWallGripDrag, getWallGrips } from '../wall-grips';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import type { WallEntity, WallParams } from '../../types/wall-types';

function unwrap(entity: ReturnType<typeof buildWallEntity>): WallEntity {
  if (!entity.ok) throw new Error('expected ok wall entity, got hardErrors: ' + entity.hardErrors.join(','));
  return entity.entity;
}

describe('wall-grips (Phase 1C)', () => {
  const start = { x: 0, y: 0 };
  const end = { x: 1000, y: 0 };

  function makeStraight(): WallEntity {
    const params = buildDefaultWallParams(start, end);
    return unwrap(buildWallEntity(params, '0', 'straight'));
  }

  function makeCurved(): WallEntity {
    const params: WallParams = {
      ...buildDefaultWallParams(start, end),
      curveControl: { x: 500, y: 200, z: 0 },
    };
    return unwrap(buildWallEntity(params, '0', 'curved'));
  }

  function makePolyline(): WallEntity {
    const params: WallParams = {
      ...buildDefaultWallParams(start, { x: 2000, y: 0 }),
      polylineVertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1000, y: 0, z: 0 },
        { x: 1500, y: 500, z: 0 },
        { x: 2000, y: 0, z: 0 },
      ],
    };
    return unwrap(buildWallEntity(params, '0', 'polyline'));
  }

  // ─── getWallGrips ──────────────────────────────────────────────────────

  it('1. straight wall → 4 grips (start / end / midpoint / thickness)', () => {
    const entity = makeStraight();
    const grips = getWallGrips(entity);
    expect(grips.map((g) => g.wallGripKind)).toEqual([
      'wall-start',
      'wall-end',
      'wall-midpoint',
      'wall-thickness',
    ]);
  });

  it('2. curved wall → 5 grips (adds curve control)', () => {
    const entity = makeCurved();
    const grips = getWallGrips(entity);
    expect(grips).toHaveLength(5);
    expect(grips[4].wallGripKind).toBe('wall-curve');
  });

  it('3. polyline wall → 4 + N-2 grips (interior vertices only)', () => {
    const entity = makePolyline();
    const grips = getWallGrips(entity);
    // 4 base (start/end/mid/thickness) + 2 interior vertices (idx 1, 2 of 4).
    expect(grips).toHaveLength(6);
    expect(grips[4].wallGripKind).toBe('wall-vertex-1');
    expect(grips[5].wallGripKind).toBe('wall-vertex-2');
  });

  it('4. start grip position equals params.start (2D projection)', () => {
    const entity = makeStraight();
    const grips = getWallGrips(entity);
    expect(grips[0].position).toEqual({ x: 0, y: 0 });
  });

  it('5. midpoint grip position is axis midpoint', () => {
    const entity = makeStraight();
    const grips = getWallGrips(entity);
    expect(grips[2].position).toEqual({ x: 500, y: 0 });
  });

  // ─── applyWallGripDrag ─────────────────────────────────────────────────

  it('6. wall-start drag translates params.start by delta', () => {
    const entity = makeStraight();
    const next = applyWallGripDrag('wall-start', {
      originalParams: entity.params,
      delta: { x: 50, y: 20 },
      currentPos: { x: 50, y: 20 },
    });
    expect(next.start).toEqual({ x: 50, y: 20, z: 0 });
    expect(next.end).toEqual(entity.params.end);
  });

  it('7. wall-end drag translates params.end by delta', () => {
    const entity = makeStraight();
    const next = applyWallGripDrag('wall-end', {
      originalParams: entity.params,
      delta: { x: -100, y: 0 },
      currentPos: { x: 900, y: 0 },
    });
    expect(next.end).toEqual({ x: 900, y: 0, z: 0 });
    expect(next.start).toEqual(entity.params.start);
  });

  it('8. wall-midpoint drag translates BOTH endpoints by delta', () => {
    const entity = makeStraight();
    const next = applyWallGripDrag('wall-midpoint', {
      originalParams: entity.params,
      delta: { x: 0, y: 300 },
      currentPos: { x: 500, y: 300 },
    });
    expect(next.start.y).toBe(300);
    expect(next.end.y).toBe(300);
    // X unchanged for both
    expect(next.start.x).toBe(0);
    expect(next.end.x).toBe(1000);
  });

  it('9. wall-thickness drag updates thickness and drops dna', () => {
    const entity = makeStraight();
    // exterior default DNA present in initial params
    expect(entity.params.dna).toBeDefined();
    // Drag perpendicular (axis is along +X, perp is +Y).
    const next = applyWallGripDrag('wall-thickness', {
      originalParams: entity.params,
      delta: { x: 0, y: 150 },
      currentPos: { x: 500, y: 150 },
    });
    expect(next.dna).toBeUndefined();
    // thickness = |proj| * 2 = 150 * 2 = 300 (within bounds)
    expect(next.thickness).toBeCloseTo(300, 1);
  });

  it('10. wall-thickness clamps to minimum (50 mm) on shrink', () => {
    const entity = makeStraight();
    const next = applyWallGripDrag('wall-thickness', {
      originalParams: entity.params,
      delta: { x: 0, y: 0.001 },
      currentPos: { x: 500, y: 0.001 },
    });
    expect(next.thickness).toBeGreaterThanOrEqual(50);
  });

  it('11. wall-curve drag offsets existing curveControl', () => {
    const entity = makeCurved();
    const next = applyWallGripDrag('wall-curve', {
      originalParams: entity.params,
      delta: { x: 100, y: -50 },
      currentPos: { x: 600, y: 150 },
    });
    expect(next.curveControl).toEqual({ x: 600, y: 150, z: 0 });
  });

  it('12. wall-curve drag seeds curveControl from axis midpoint when missing', () => {
    const entity = makeStraight(); // no curveControl
    const next = applyWallGripDrag('wall-curve', {
      originalParams: entity.params,
      delta: { x: 0, y: 200 },
      currentPos: { x: 500, y: 200 },
    });
    expect(next.curveControl).toEqual({ x: 500, y: 200, z: 0 });
  });

  it('13. wall-vertex-N drag translates polyline interior vertex N', () => {
    const entity = makePolyline();
    const next = applyWallGripDrag('wall-vertex-2', {
      originalParams: entity.params,
      delta: { x: 0, y: -200 },
      currentPos: { x: 1500, y: 300 },
    });
    expect(next.polylineVertices?.[2]).toEqual({ x: 1500, y: 300, z: 0 });
    // Other vertices untouched.
    expect(next.polylineVertices?.[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(next.polylineVertices?.[3]).toEqual({ x: 2000, y: 0, z: 0 });
  });

  it('14. wall-vertex-N out-of-range returns originalParams', () => {
    const entity = makePolyline();
    const next = applyWallGripDrag('wall-vertex-99', {
      originalParams: entity.params,
      delta: { x: 100, y: 0 },
      currentPos: { x: 100, y: 0 },
    });
    expect(next).toEqual(entity.params);
  });
});
