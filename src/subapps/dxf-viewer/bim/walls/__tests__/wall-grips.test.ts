/**
 * ADR-363 Phase 1C — `wall-grips` pure handlers tests.
 *
 * Coverage:
 *   - `getWallGrips()` returns the right grip set per kind:
 *       straight  → thickness + length edges + 4 corners + rotation (ADR-363
 *                   Slice D; only start/end/midpoint suppressed)
 *       curved    → start / end / thickness + curve control
 *       polyline  → start / end / thickness + N interior vertices
 *   - `applyWallGripDrag()` produces correct `WallParams` per grip kind:
 *       wall-start / wall-end translate the respective endpoint
 *       wall-midpoint translates both endpoints by delta
 *       wall-thickness clamps within [min, max] (scene-unit-aware) and drops dna
 *       wall-curve seeds + offsets the curveControl point
 *       wall-vertex-N translates the N-th interior polyline vertex
 */

import { applyWallGripDrag, getWallGrips, translateWallParams, wallGripGlyphShape } from '../wall-grips';
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

  // ADR-363 Φ1G.5 Slice 2 — the central MOVE marker (`wall-midpoint`) is no longer
  // emitted on any kind (Alt+drag moves the whole wall). It is still PUSHED then
  // filtered, so the `applyWallGripDrag('wall-midpoint', …)` transform tests below
  // (drag math retained) keep passing.
  it('1. straight wall → 7 VISIBLE grips (thickness + length edges + 4 corners + rotation; ADR-363 Slice D)', () => {
    const entity = makeStraight();
    const grips = getWallGrips(entity);
    // Slice D: straight wall now exposes the shared 7-grip rect set. Only the
    // endpoint translates (wall-start/wall-end) + central move (wall-midpoint)
    // stay suppressed; the thickness + length edge midpoints are first-class.
    expect(grips.map((g) => g.wallGripKind)).toEqual([
      'wall-thickness',
      'wall-edge-length',
      'wall-corner-start-pos',
      'wall-corner-start-neg',
      'wall-corner-end-pos',
      'wall-corner-end-neg',
      'wall-rotation',
    ]);
  });

  it('2. curved wall → 4 grips (start/end/thickness + curve control; midpoint removed)', () => {
    const entity = makeCurved();
    const grips = getWallGrips(entity);
    expect(grips).toHaveLength(4);
    expect(grips[3].wallGripKind).toBe('wall-curve');
  });

  it('3. polyline wall → 3 + N-2 grips (interior vertices only; midpoint removed)', () => {
    const entity = makePolyline();
    const grips = getWallGrips(entity);
    // 3 base (start/end/thickness) + 2 interior vertices (idx 1, 2 of 4).
    expect(grips).toHaveLength(5);
    expect(grips[3].wallGripKind).toBe('wall-vertex-1');
    expect(grips[4].wallGripKind).toBe('wall-vertex-2');
  });

  it('4. straight wall hides wall-start / wall-end but SHOWS thickness + length edges (Slice D)', () => {
    const kinds = getWallGrips(makeStraight()).map((g) => g.wallGripKind);
    expect(kinds).not.toContain('wall-start');
    expect(kinds).not.toContain('wall-end');
    expect(kinds).toContain('wall-thickness');
    expect(kinds).toContain('wall-edge-length');
  });

  it('5. central move grip (wall-midpoint) is NOT emitted (Slice 2 declutter)', () => {
    const grips = getWallGrips(makeStraight());
    expect(grips.map((g) => g.wallGripKind)).not.toContain('wall-midpoint');
    // First visible grip is now the thickness edge handle (Slice D).
    expect(grips[0].wallGripKind).toBe('wall-thickness');
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

  it('9. wall-thickness edge drag grows thickness by delta (opposite edge fixed) + drops dna', () => {
    const entity = makeStraight();
    const t = entity.params.thickness;
    // exterior default DNA present in initial params
    expect(entity.params.dna).toBeDefined();
    // ADR-363 Slice D — the thickness edge now uses the rect-grip-engine
    // (relative, opposite-edge-fixed): a +perp drag of Δy grows thickness by Δy.
    const next = applyWallGripDrag('wall-thickness', {
      originalParams: entity.params,
      delta: { x: 0, y: 150 },
      currentPos: { x: 500, y: 150 },
    });
    expect(next.dna).toBeUndefined();
    expect(next.thickness).toBeCloseTo(t + 150, 6);
  });

  it('10. wall-thickness clamps to minimum (50 mm) on large shrink', () => {
    const entity = makeStraight();
    const next = applyWallGripDrag('wall-thickness', {
      originalParams: entity.params,
      delta: { x: 0, y: -10000 },
      currentPos: { x: 500, y: -10000 },
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
    const at = (k: string) => grips.find((g) => g.wallGripKind === k)!.position;
    // axis along +X → perpUnit (CCW 90°) = +Y. Order is now thickness/length
    // edges first (Slice D), so find corners by kind rather than index.
    expect(at('wall-corner-start-pos')).toMatchObject({ x: 0 });
    expect(at('wall-corner-start-pos').y).toBeCloseTo(halfT, 6);
    expect(at('wall-corner-start-neg').y).toBeCloseTo(-halfT, 6);
    expect(at('wall-corner-end-pos').x).toBeCloseTo(1000, 6);
    expect(at('wall-corner-end-pos').y).toBeCloseTo(halfT, 6);
    expect(at('wall-corner-end-neg').y).toBeCloseTo(-halfT, 6);
  });

  it('15b. curved wall still exposes its single thickness handle (suppression is straight-only)', () => {
    const kinds = getWallGrips(makeCurved()).map((g) => g.wallGripKind);
    expect(kinds).toContain('wall-thickness');
    expect(kinds).toContain('wall-start');
    expect(kinds).toContain('wall-end');
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

  it('23. meters scene → corner positions scale by 0.001 (match footprint)', () => {
    const entity = makeStraightMeters();
    expect(entity.params.sceneUnits).toBe('m');
    const grips = getWallGrips(entity);
    const halfTCanvas = (entity.params.thickness / 2) * 0.001;
    const at = (k: string) => grips.find((g) => g.wallGripKind === k)!.position;
    expect(at('wall-corner-start-pos').y).toBeCloseTo(halfTCanvas, 6);
    expect(at('wall-corner-start-neg').y).toBeCloseTo(-halfTCanvas, 6);
    expect(at('wall-corner-end-pos').x).toBeCloseTo(1000, 6);
    expect(at('wall-corner-end-pos').y).toBeCloseTo(halfTCanvas, 6);
    expect(at('wall-corner-end-neg').y).toBeCloseTo(-halfTCanvas, 6);
    // Offsets must NOT be the raw mm value (the pre-fix bug).
    expect(Math.abs(at('wall-corner-start-pos').y)).toBeLessThan(1);
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

  it('25. meters scene → wall-thickness edge drag converts canvas delta → mm (relative)', () => {
    const entity = makeStraightMeters();
    const t = entity.params.thickness;
    // ADR-363 Slice D — relative edge drag: Δy 0.15 canvas (m) → +150 mm thickness.
    const next = applyWallGripDrag('wall-thickness', {
      originalParams: entity.params,
      delta: { x: 0, y: 0.15 },
      currentPos: { x: 500, y: 0.15 },
    });
    expect(next.thickness).toBeCloseTo(t + 150, 6);
  });

  it('25b. wall-edge-length drag grows length from the END edge (start fixed), via rect-engine', () => {
    const entity = makeStraight();
    const t = entity.params.thickness;
    const next = applyWallGripDrag('wall-edge-length', {
      originalParams: entity.params,
      delta: { x: 200, y: 0 },
      currentPos: { x: 1200, y: 0 },
    });
    expect(next.start.x).toBeCloseTo(0, 6);
    expect(next.end.x).toBeCloseTo(1200, 6);
    expect(next.start.y).toBeCloseTo(0, 6);
    expect(next.end.y).toBeCloseTo(0, 6);
    expect(next.thickness).toBeCloseTo(t, 6);
  });

  // ─── Phase 1C-ter: move/rotation glyphs + wall-rotation grip ──────────────

  it('26. wallGripGlyphShape — midpoint→move, rotation→rotation, others→square', () => {
    expect(wallGripGlyphShape('wall-midpoint')).toBe('move');
    expect(wallGripGlyphShape('wall-rotation')).toBe('rotation');
    expect(wallGripGlyphShape('wall-corner-start-pos')).toBe('square');
    expect(wallGripGlyphShape('wall-thickness')).toBe('square');
    expect(wallGripGlyphShape(undefined)).toBe('square');
  });

  it('27. wall-rotation handle sits at the +perp face midpoint (on the wall, centre of length, between the 2 +perp corners)', () => {
    const grips = getWallGrips(makeStraight());
    const rot = grips.find((g) => g.wallGripKind === 'wall-rotation');
    expect(rot).toBeDefined();
    // Read from geometry: midpoint of the two +perp corner handles (not a raw-mm
    // offset beyond the end edge). Centre of length (x≈500), on the +perp face.
    const posStart = grips.find((g) => g.wallGripKind === 'wall-corner-start-pos')!.position;
    const posEnd = grips.find((g) => g.wallGripKind === 'wall-corner-end-pos')!.position;
    expect(rot!.position.x).toBeCloseTo((posStart.x + posEnd.x) / 2, 6);
    expect(rot!.position.y).toBeCloseTo((posStart.y + posEnd.y) / 2, 6);
    expect(rot!.position.x).toBeCloseTo(500, 6); // centre of the 0→1000 length
  });

  it('28. wall-rotation spins both endpoints 90° CCW about the midpoint', () => {
    const entity = makeStraight(); // start (0,0) end (1000,0), midpoint (500,0)
    // anchor = currentPos − delta = (1200,0) (handle, angle 0 about midpoint);
    // currentPos relative to midpoint = (0,700) → swept = +90°.
    const next = applyWallGripDrag('wall-rotation', {
      originalParams: entity.params,
      delta: { x: -700, y: 700 },
      currentPos: { x: 500, y: 700 },
    });
    expect(next.start.x).toBeCloseTo(500, 6);
    expect(next.start.y).toBeCloseTo(-500, 6);
    expect(next.end.x).toBeCloseTo(500, 6);
    expect(next.end.y).toBeCloseTo(500, 6);
    // Midpoint + length invariant under rotation.
    expect((next.start.x + next.end.x) / 2).toBeCloseTo(500, 6);
    expect(Math.hypot(next.end.x - next.start.x, next.end.y - next.start.y)).toBeCloseTo(1000, 6);
  });

  it('29. wall-rotation no-op when cursor sits on the pivot (degenerate)', () => {
    const entity = makeStraight();
    const next = applyWallGripDrag('wall-rotation', {
      originalParams: entity.params,
      delta: { x: 0, y: 0 },
      currentPos: { x: 500, y: 0 }, // == midpoint → zero-length vector
    });
    expect(next).toBe(entity.params);
  });

  // ─── Phase 1G: wall-rotation around an arbitrary picked pivot ──────────────
  it('30. wall-rotation spins about a picked pivot (start point), not the midpoint', () => {
    const entity = makeStraight(); // start (0,0) end (1000,0)
    // Pivot = start (0,0). anchor (currentPos − delta) = (100,0) (angle 0 about
    // pivot); currentPos = (0,100) (angle 90) → swept = +90° CCW about (0,0).
    const next = applyWallGripDrag('wall-rotation', {
      originalParams: entity.params,
      delta: { x: -100, y: 100 },
      currentPos: { x: 0, y: 100 },
      pivot: { x: 0, y: 0 },
    });
    expect(next.start.x).toBeCloseTo(0, 6);
    expect(next.start.y).toBeCloseTo(0, 6);
    expect(next.end.x).toBeCloseTo(0, 6);
    expect(next.end.y).toBeCloseTo(1000, 6);
    // Length invariant; pivot (start) stays fixed.
    expect(Math.hypot(next.end.x - next.start.x, next.end.y - next.start.y)).toBeCloseTo(1000, 6);
  });

  it('31. wall-rotation degenerate when cursor sits on the picked pivot', () => {
    const entity = makeStraight();
    const next = applyWallGripDrag('wall-rotation', {
      originalParams: entity.params,
      delta: { x: 0, y: 0 },
      currentPos: { x: 250, y: 0 },
      pivot: { x: 250, y: 0 }, // currentPos == pivot → zero-length vector
    });
    expect(next).toBe(entity.params);
  });

  // ─── translateWallParams SSoT ──────────────────────────────────────────────

  it('32. translateWallParams — translates all world-coord fields atomically', () => {
    const params: WallParams = {
      ...buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 }),
      curveControl: { x: 500, y: 200, z: 0 },
      polylineVertices: [
        { x: 0, y: 0, z: 0 },
        { x: 500, y: 0, z: 0 },
        { x: 1000, y: 0, z: 0 },
      ],
      startMiter: { outer: { x: -5, y: 10 }, inner: { x: -5, y: -10 } },
      endMiter: { outer: { x: 1005, y: 10 }, inner: { x: 1005, y: -10 } },
    };
    const delta = { x: 200, y: 300 };
    const next = translateWallParams(params, delta);

    expect(next.start).toEqual({ x: 200, y: 300, z: 0 });
    expect(next.end).toEqual({ x: 1200, y: 300, z: 0 });
    expect(next.curveControl).toEqual({ x: 700, y: 500, z: 0 });
    expect(next.polylineVertices?.[1]).toEqual({ x: 700, y: 300, z: 0 });
    expect(next.startMiter?.outer).toEqual({ x: 195, y: 310 });
    expect(next.startMiter?.inner).toEqual({ x: 195, y: 290 });
    expect(next.endMiter?.outer).toEqual({ x: 1205, y: 310 });
    expect(next.endMiter?.inner).toEqual({ x: 1205, y: 290 });
    // Non-geometric fields preserved
    expect(next.thickness).toBe(params.thickness);
    expect(next.height).toBe(params.height);
  });

  // ─── Miter cache handling (preview ghost correctness) ──────────────────────

  it('33. wall-midpoint (via translateWallParams SSoT) — startMiter + endMiter translated', () => {
    const entity = makeStraight();
    const paramsWithMiter: typeof entity.params = {
      ...entity.params,
      startMiter: { outer: { x: -5, y: 10 }, inner: { x: -5, y: -10 } },
      endMiter: { outer: { x: 1005, y: 10 }, inner: { x: 1005, y: -10 } },
    };
    const delta = { x: 200, y: 300 };
    const next = applyWallGripDrag('wall-midpoint', {
      originalParams: paramsWithMiter,
      delta,
      currentPos: { x: 700, y: 300 },
    });
    expect(next.startMiter?.outer).toEqual({ x: -5 + 200, y: 10 + 300 });
    expect(next.startMiter?.inner).toEqual({ x: -5 + 200, y: -10 + 300 });
    expect(next.endMiter?.outer).toEqual({ x: 1005 + 200, y: 10 + 300 });
    expect(next.endMiter?.inner).toEqual({ x: 1005 + 200, y: -10 + 300 });
  });

  it('34. wall-start clears startMiter (junction broken), keeps endMiter', () => {
    const entity = makeStraight();
    const paramsWithMiter: typeof entity.params = {
      ...entity.params,
      startMiter: { outer: { x: -5, y: 10 }, inner: { x: -5, y: -10 } },
      endMiter: { outer: { x: 1005, y: 10 }, inner: { x: 1005, y: -10 } },
    };
    const next = applyWallGripDrag('wall-start', {
      originalParams: paramsWithMiter,
      delta: { x: 50, y: 0 },
      currentPos: { x: 50, y: 0 },
    });
    expect(next.startMiter).toBeUndefined();
    expect(next.endMiter).toEqual(paramsWithMiter.endMiter);
  });

  it('35. wall-end clears endMiter (junction broken), keeps startMiter', () => {
    const entity = makeStraight();
    const paramsWithMiter: typeof entity.params = {
      ...entity.params,
      startMiter: { outer: { x: -5, y: 10 }, inner: { x: -5, y: -10 } },
      endMiter: { outer: { x: 1005, y: 10 }, inner: { x: 1005, y: -10 } },
    };
    const next = applyWallGripDrag('wall-end', {
      originalParams: paramsWithMiter,
      delta: { x: -100, y: 0 },
      currentPos: { x: 900, y: 0 },
    });
    expect(next.endMiter).toBeUndefined();
    expect(next.startMiter).toEqual(paramsWithMiter.startMiter);
  });
});
