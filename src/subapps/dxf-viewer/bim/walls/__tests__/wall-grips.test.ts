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

  it('1. straight wall → 9 grips (start / end / midpoint / 2 thickness faces + 4 corners)', () => {
    const entity = makeStraight();
    const grips = getWallGrips(entity);
    expect(grips.map((g) => g.wallGripKind)).toEqual([
      'wall-start',
      'wall-end',
      'wall-midpoint',
      'wall-thickness',      // +perp face edge-midpoint
      'wall-thickness',      // -perp face edge-midpoint (symmetric, AutoCAD parity)
      'wall-corner-start-pos',
      'wall-corner-start-neg',
      'wall-corner-end-pos',
      'wall-corner-end-neg',
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

  // ─── Phase 1C-bis: asymmetric corner grips + axis recenter ───────────────

  it('15. corner positions equal footprint vertices (read from geometry.outer/inner)', () => {
    const entity = makeStraight();
    const grips = getWallGrips(entity);
    const halfT = entity.params.thickness / 2; // mm scene → s=1, canvas == mm.
    // axis along +X → perpUnit (CCW 90°) = +Y. Corners now at indices 5..8.
    expect(grips[5].wallGripKind).toBe('wall-corner-start-pos');
    expect(grips[5].position).toMatchObject({ x: 0 });
    expect(grips[5].position.y).toBeCloseTo(halfT, 6);
    expect(grips[6].wallGripKind).toBe('wall-corner-start-neg');
    expect(grips[6].position.y).toBeCloseTo(-halfT, 6);
    expect(grips[7].wallGripKind).toBe('wall-corner-end-pos');
    expect(grips[7].position.x).toBeCloseTo(1000, 6);
    expect(grips[7].position.y).toBeCloseTo(halfT, 6);
    expect(grips[8].wallGripKind).toBe('wall-corner-end-neg');
    expect(grips[8].position.y).toBeCloseTo(-halfT, 6);
  });

  it('15b. two thickness handles at opposite face edge-midpoints', () => {
    const entity = makeStraight();
    const grips = getWallGrips(entity);
    const halfT = entity.params.thickness / 2;
    expect(grips[3].wallGripKind).toBe('wall-thickness');
    expect(grips[3].position.x).toBeCloseTo(500, 6); // mid of long edge
    expect(grips[3].position.y).toBeCloseTo(halfT, 6);
    expect(grips[4].wallGripKind).toBe('wall-thickness');
    expect(grips[4].position.x).toBeCloseTo(500, 6);
    expect(grips[4].position.y).toBeCloseTo(-halfT, 6); // opposite face
  });

  it('16. corner-start-pos axial drag moves only params.start (thickness unchanged)', () => {
    const entity = makeStraight();
    const t = entity.params.thickness;
    const next = applyWallGripDrag('wall-corner-start-pos', {
      originalParams: entity.params,
      delta: { x: 100, y: 0 },
      currentPos: { x: 100, y: t / 2 },
    });
    expect(next.start.x).toBeCloseTo(100, 6);
    expect(next.start.y).toBeCloseTo(0, 6);
    expect(next.end).toEqual(entity.params.end);
    expect(next.thickness).toBeCloseTo(t, 6);
  });

  it('17. corner-end-pos perp drag (+Y) grows thickness, axis shifts +Y by Δ/2', () => {
    const entity = makeStraight();
    const t = entity.params.thickness;
    const dy = 100;
    const next = applyWallGripDrag('wall-corner-end-pos', {
      originalParams: entity.params,
      delta: { x: 0, y: dy },
      currentPos: { x: 1000, y: t / 2 + dy },
    });
    expect(next.thickness).toBeCloseTo(t + dy, 6);
    expect(next.start.y).toBeCloseTo(dy / 2, 6);
    expect(next.end.y).toBeCloseTo(dy / 2, 6);
    expect(next.start.x).toBeCloseTo(0, 6);
    expect(next.end.x).toBeCloseTo(1000, 6);
    expect(next.dna).toBeUndefined(); // manual override drops DNA
  });

  it('18. corner-start-neg perp drag (-Y) grows thickness, axis shifts -Y by Δ/2', () => {
    const entity = makeStraight();
    const t = entity.params.thickness;
    const dy = -80;
    const next = applyWallGripDrag('wall-corner-start-neg', {
      originalParams: entity.params,
      delta: { x: 0, y: dy },
      currentPos: { x: 0, y: -t / 2 + dy },
    });
    expect(next.thickness).toBeCloseTo(t + Math.abs(dy), 6);
    expect(next.start.y).toBeCloseTo(dy / 2, 6);
    expect(next.end.y).toBeCloseTo(dy / 2, 6);
  });

  it('19. corner-end-neg diagonal drag — axial + perp simultaneously', () => {
    const entity = makeStraight();
    const t = entity.params.thickness;
    const dx = 50;
    const dy = -60; // outward for -perp corner
    const next = applyWallGripDrag('wall-corner-end-neg', {
      originalParams: entity.params,
      delta: { x: dx, y: dy },
      currentPos: { x: 1000 + dx, y: -t / 2 + dy },
    });
    expect(next.end.x).toBeCloseTo(1000 + dx, 6);
    expect(next.start.x).toBeCloseTo(0, 6);
    expect(next.thickness).toBeCloseTo(t + Math.abs(dy), 6);
    expect(next.start.y).toBeCloseTo(dy / 2, 6);
    expect(next.end.y).toBeCloseTo(dy / 2, 6);
  });

  it('20. corner perp drag clamps thickness at scene-unit min floor', () => {
    const entity = makeStraight();
    const t = entity.params.thickness;
    const next = applyWallGripDrag('wall-corner-start-pos', {
      originalParams: entity.params,
      delta: { x: 0, y: -10000 },
      currentPos: { x: 0, y: t / 2 - 10000 },
    });
    const minT = t < 10 ? 0.05 : t < 100 ? 5 : 50;
    expect(next.thickness).toBeGreaterThanOrEqual(minT);
    expect(next.thickness).toBeLessThanOrEqual(t);
  });

  it('21. corner drag preserves axis direction (parallel faces invariant)', () => {
    const entity = makeStraight();
    const next = applyWallGripDrag('wall-corner-end-pos', {
      originalParams: entity.params,
      delta: { x: 75, y: 120 },
      currentPos: { x: 1075, y: entity.params.thickness / 2 + 120 },
    });
    const axisDx = next.end.x - next.start.x;
    const axisDy = next.end.y - next.start.y;
    expect(axisDy).toBeCloseTo(0, 6); // axis stays horizontal
    expect(axisDx).toBeGreaterThan(0);
  });

  it('22. corner-end-pos drag does NOT move opposite face (-perp face Y unchanged)', () => {
    const entity = makeStraight();
    const t = entity.params.thickness;
    const dy = 200;
    const next = applyWallGripDrag('wall-corner-end-pos', {
      originalParams: entity.params,
      delta: { x: 0, y: dy },
      currentPos: { x: 1000, y: t / 2 + dy },
    });
    // -perp face Y = axis_y_new - new_thickness/2. Must equal original -t/2.
    const oppositeFaceY = next.start.y - next.thickness / 2;
    expect(oppositeFaceY).toBeCloseTo(-t / 2, 6);
  });

  // ─── sceneUnits scaling (regression: ADR-363 Phase 1C-bis render hotfix) ──
  // thickness is always mm; start/end are canvas coords. Perpendicular grip
  // offsets MUST scale by mmToSceneUnits(sceneUnits) so handles land on the
  // rendered footprint. The mm-only suite above (s=1) never exercised this; a
  // meters scene (s=0.001) caught corners drawn 1000× off-screen in production.

  function makeStraightMeters(): WallEntity {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 }, {}, 'm');
    return unwrap(buildWallEntity(params, '0', 'straight', 'm'));
  }

  it('23. meters scene → thickness + corner positions scale by 0.001 (match footprint)', () => {
    const entity = makeStraightMeters();
    expect(entity.params.sceneUnits).toBe('m');
    const grips = getWallGrips(entity);
    const halfTCanvas = (entity.params.thickness / 2) * 0.001;
    // grips 3+4 thickness handles at long-edge midpoints (±perp · halfTCanvas)
    expect(grips[3].wallGripKind).toBe('wall-thickness');
    expect(grips[3].position.x).toBeCloseTo(500, 6);
    expect(grips[3].position.y).toBeCloseTo(halfTCanvas, 6);
    expect(grips[4].wallGripKind).toBe('wall-thickness');
    expect(grips[4].position.y).toBeCloseTo(-halfTCanvas, 6);
    // corners (5..8) at endpoints ± perp · halfTCanvas
    expect(grips[5].position.y).toBeCloseTo(halfTCanvas, 6);   // start-pos
    expect(grips[6].position.y).toBeCloseTo(-halfTCanvas, 6);  // start-neg
    expect(grips[7].position.x).toBeCloseTo(1000, 6);          // end-pos x
    expect(grips[7].position.y).toBeCloseTo(halfTCanvas, 6);
    expect(grips[8].position.y).toBeCloseTo(-halfTCanvas, 6);  // end-neg
    // Offsets must NOT be the raw mm value (the pre-fix bug).
    expect(Math.abs(grips[5].position.y)).toBeLessThan(1);
  });

  it('24. meters scene → corner perp drag converts canvas delta → mm thickness', () => {
    const entity = makeStraightMeters();
    const t = entity.params.thickness;
    // 0.1 canvas (m) perpendicular drag → 100 mm thickness growth.
    const next = applyWallGripDrag('wall-corner-end-pos', {
      originalParams: entity.params,
      delta: { x: 0, y: 0.1 },
      currentPos: { x: 1000, y: t / 2 * 0.001 + 0.1 },
    });
    expect(next.thickness).toBeCloseTo(t + 100, 6);
    // axis recenter = actualPerp(100mm) → canvas (100·0.001)/2 = 0.05.
    expect(next.start.y).toBeCloseTo(0.05, 6);
    expect(next.end.y).toBeCloseTo(0.05, 6);
  });

  it('25. meters scene → wall-thickness drag converts canvas proj → mm', () => {
    const entity = makeStraightMeters();
    // proj = currentPos.y - mid.y = 0.15 canvas → thickness = 0.15·2 / 0.001 = 300 mm.
    const next = applyWallGripDrag('wall-thickness', {
      originalParams: entity.params,
      delta: { x: 0, y: 0.15 },
      currentPos: { x: 500, y: 0.15 },
    });
    expect(next.thickness).toBeCloseTo(300, 6);
  });
});
