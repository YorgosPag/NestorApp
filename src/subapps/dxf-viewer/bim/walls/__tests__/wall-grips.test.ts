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
import { gripKindOf } from '../../../hooks/grip-kinds';
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

  // Column-parity completion (Giorgio 2026-06-20): the straight wall now emits the
  // full 10-grip set — the shared axis-box 7 (thickness + length edge + 4 corners +
  // rotation) PLUS the 2 OPPOSITE mid-edges (`wall-thickness-far`,
  // `wall-edge-length-start`) and the centre 4-arrow MOVE glyph (`wall-midpoint`),
  // exactly like the column/beam.
  it('1. straight wall → 10 column-parity grips (thickness + length edges + 4 corners + rotation + 2 far mid-edges + centre move)', () => {
    const entity = makeStraight();
    const grips = getWallGrips(entity);
    expect(grips.map((g) => gripKindOf(g, 'wall'))).toEqual([
      'wall-thickness',
      'wall-edge-length',
      'wall-corner-start-pos',
      'wall-corner-start-neg',
      'wall-corner-end-pos',
      'wall-corner-end-neg',
      'wall-rotation',
      'wall-thickness-far',
      'wall-edge-length-start',
      'wall-midpoint',
    ]);
  });

  it('2. curved wall → 5 grips (start/end/thickness + curve control + centre move)', () => {
    const entity = makeCurved();
    const grips = getWallGrips(entity);
    expect(grips).toHaveLength(5);
    expect(gripKindOf(grips[3], 'wall')).toBe('wall-curve');
    expect(gripKindOf(grips[4], 'wall')).toBe('wall-midpoint'); // appended last (stable indices)
  });

  it('3. polyline wall → 3 base + N-2 interior vertices + centre move', () => {
    const entity = makePolyline();
    const grips = getWallGrips(entity);
    // 3 base (start/end/thickness) + 2 interior vertices (idx 1, 2 of 4) + midpoint.
    expect(grips).toHaveLength(6);
    expect(gripKindOf(grips[3], 'wall')).toBe('wall-vertex-1');
    expect(gripKindOf(grips[4], 'wall')).toBe('wall-vertex-2');
    expect(gripKindOf(grips[5], 'wall')).toBe('wall-midpoint');
  });

  it('4. straight wall hides wall-start / wall-end but SHOWS thickness + length edges (Slice D)', () => {
    const kinds = getWallGrips(makeStraight()).map((g) => gripKindOf(g, 'wall'));
    expect(kinds).not.toContain('wall-start');
    expect(kinds).not.toContain('wall-end');
    expect(kinds).toContain('wall-thickness');
    expect(kinds).toContain('wall-edge-length');
  });

  it('5. central move grip (wall-midpoint) IS emitted with movesEntity:true (column parity, Giorgio 2026-06-20)', () => {
    const grips = getWallGrips(makeStraight());
    const move = grips.find((g) => gripKindOf(g, 'wall') === 'wall-midpoint');
    expect(move).toBeDefined();
    expect(move!.movesEntity).toBe(true);
    expect(move!.type).toBe('center');
    expect(move!.position).toEqual({ x: 500, y: 0 }); // axis midpoint
    // First grip is still the thickness edge handle (axis-box set leads).
    expect(gripKindOf(grips[0], 'wall')).toBe('wall-thickness');
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
    const at = (k: string) => grips.find((g) => gripKindOf(g, 'wall') === k)!.position;
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
    const kinds = getWallGrips(makeCurved()).map((g) => gripKindOf(g, 'wall'));
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
    const at = (k: string) => grips.find((g) => gripKindOf(g, 'wall') === k)!.position;
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

  // ─── Column-parity mid-edges: all 4 faces + far/start drag + flip ──────────

  it('25c. straight wall exposes a midpoint handle on ALL 4 faces (column parity)', () => {
    const entity = makeStraight(); // (0,0)→(1000,0), thickness t (mm scene, s=1)
    const grips = getWallGrips(entity);
    const t = entity.params.thickness;
    const at = (k: string) => grips.find((g) => gripKindOf(g, 'wall') === k)!.position;
    // +perp / −perp long faces at the axial midpoint, opposite Y signs.
    expect(at('wall-thickness')).toEqual({ x: 500, y: t / 2 });
    expect(at('wall-thickness-far')).toEqual({ x: 500, y: -t / 2 });
    // END / START short edges at the perpendicular centre, opposite X.
    expect(at('wall-edge-length')).toEqual({ x: 1000, y: 0 });
    expect(at('wall-edge-length-start')).toEqual({ x: 0, y: 0 });
  });

  it('25d. wall-thickness-far drag grows thickness with the NEAR (+perp) face fixed + drops dna', () => {
    const entity = makeStraight();
    const t = entity.params.thickness;
    expect(entity.params.dna).toBeDefined();
    // Dragging the −perp face −150 (further from axis) holds the +perp face →
    // thickness grows by 150, axis recenters by −75 (half the displacement).
    const next = applyWallGripDrag('wall-thickness-far', {
      originalParams: entity.params,
      delta: { x: 0, y: -150 },
      currentPos: { x: 500, y: -t / 2 - 150 },
    });
    expect(next.thickness).toBeCloseTo(t + 150, 6);
    expect(next.start.y).toBeCloseTo(-75, 6);
    expect(next.end.y).toBeCloseTo(-75, 6);
    expect(next.dna).toBeUndefined(); // manual override drops DNA
    // +perp face stays put: axis_y_new + thickness_new/2 == original +t/2.
    expect(next.start.y + next.thickness / 2).toBeCloseTo(t / 2, 6);
  });

  it('25e. wall-edge-length-start drag resizes length with the END fixed', () => {
    const entity = makeStraight();
    const t = entity.params.thickness;
    // Dragging the START short edge −200 along the axis lengthens the wall from the
    // start while the end stays put (opposite-edge-fixed). Thickness unchanged.
    const next = applyWallGripDrag('wall-edge-length-start', {
      originalParams: entity.params,
      delta: { x: -200, y: 0 },
      currentPos: { x: -200, y: 0 },
    });
    expect(next.end.x).toBeCloseTo(1000, 6); // end fixed
    expect(next.start.x).toBeCloseTo(-200, 6); // start moved out
    expect(next.start.y).toBeCloseTo(0, 6);
    expect(next.end.y).toBeCloseTo(0, 6);
    expect(next.thickness).toBeCloseTo(t, 6);
  });

  it('25f. flip=true places the far/start faces on the correct (flipped) sides', () => {
    const entity = makeStraight();
    const t = entity.params.thickness;
    const flipped: WallParams = { ...entity.params, flip: true };
    const grips = getWallGrips({ ...entity, params: flipped });
    const at = (k: string) => grips.find((g) => gripKindOf(g, 'wall') === k)!.position;
    // flip swaps which perp face the single `wall-thickness` handle sits on: now −Y,
    // so the `wall-thickness-far` handle moves to +Y (always the OPPOSITE face).
    expect(at('wall-thickness').y).toBeCloseTo(-t / 2, 6);
    expect(at('wall-thickness-far').y).toBeCloseTo(t / 2, 6);
    // Short edges are flip-independent (axial), unchanged.
    expect(at('wall-edge-length').x).toBeCloseTo(1000, 6);
    expect(at('wall-edge-length-start').x).toBeCloseTo(0, 6);
  });

  // ─── Phase 1C-ter: move/rotation glyphs + wall-rotation grip ──────────────

  it('26. wallGripGlyphShape — midpoint→move, rotation→rotation, others→square', () => {
    expect(wallGripGlyphShape('wall-midpoint')).toBe('move');
    expect(wallGripGlyphShape('wall-rotation')).toBe('rotation');
    expect(wallGripGlyphShape('wall-corner-start-pos')).toBe('square');
    expect(wallGripGlyphShape('wall-thickness')).toBe('square');
    expect(wallGripGlyphShape(undefined)).toBe('square');
  });

  it('27. wall-rotation handle sits ON the centreline at ¼ axis length toward the east end (axis-quarter, Giorgio 2026-06-30)', () => {
    const grips = getWallGrips(makeStraight());
    const rot = grips.find((g) => gripKindOf(g, 'wall') === 'wall-rotation')!;
    expect(rot).toBeDefined();
    // ADR-363 Slice F — `rotationPlacement: 'axis-quarter'`: centre (500) + ¼ of the
    // 0→1000 length toward the east end = 750, ON the centreline (perp = 0), so it no
    // longer overlaps the long-side edge midpoint. SAME SSoT the line rotation grip uses.
    expect(rot.position.x).toBeCloseTo(750, 6);
    expect(rot.position.y).toBeCloseTo(0, 6);
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
