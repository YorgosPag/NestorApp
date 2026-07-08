/**
 * ADR-358 Phase 5b + ADR-393 — `stair-grips` pure handlers tests.
 *
 * Coverage:
 *   - `getStairGrips()` grip layout per variant (ADR-393 v2: straight = 5 grips
 *     = rotation + 4 corners, move/stair-base suppressed per ADR-363 Φ1G.5 Slice 2;
 *     Phase 2: l-shape/u-shape/gamma = rotation + 4 flight-based corners + landing
 *     grips, width/length also suppressed; curved = rotation + width +
 *     length; legacy `stair-split` removed per ADR-393 Q4).
 *   - ADR-393 v2 Phase 2 multi-flight corner transforms (perp→width, axial
 *     start→flightSplit[0], axial end→flightSplit[last] on the LAST flight's
 *     direction read from the walkline geometry).
 *   - `stairGripGlyphShape()` + `polylineArcMidpoint()` (ADR-393 v2 helpers).
 *   - `applyStairGripDrag()` transforms for the ADR-358 base grips AND the
 *     ADR-393 corner / mid-front / per-flight / landing transforms (kept even
 *     where the grip is no longer emitted — corners reuse them).
 *   - NOTE: stair-base is computed internally but FILTERED from output
 *     per ADR-363 Φ1G.5 Slice 2 (central move marker removed from DXF canvas).
 */

import {
  buildDefaultStairParams,
  buildStairEntity,
} from '../../../hooks/drawing/stair-completion';
import { applyStairGripDrag, getStairGrips, stairGripGlyphShape } from '../stair-grips';
import { polylineArcMidpoint } from '../stair-grip-math';
import type { StairEntity, StairParams } from '../../../bim/types/stair-types';
import { gripKindOf } from '../../../hooks/grip-kinds';

describe('stair-grips (ADR-358 Phase 5b + ADR-393)', () => {
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

  // Chamfer/fillet landing GEOMETRY is not implemented yet (StairGeometryService
  // Phase 3c throws), so we cannot `buildStairEntity` a fillet variant. The grip
  // layout + transforms only read `params.variant` + the landing polygon, so we
  // overlay a fillet corner style onto an already-built square l-shape entity.
  function makeLShapeFillet(): StairEntity {
    const sharp = makeLShape();
    const v = sharp.params.variant;
    if (v.kind !== 'l-shape' || v.cornerStyle !== 'landing') {
      throw new Error('makeLShape did not produce an l-shape landing variant');
    }
    return {
      ...sharp,
      params: {
        ...sharp.params,
        variant: { ...v, landingCornerStyle: 'fillet', landingCornerRadius: 0 },
      },
    };
  }

  function makeLShapeWinders(): StairEntity {
    const base = buildDefaultStairParams(basePoint, 0);
    const params: StairParams = {
      ...base,
      variant: {
        kind: 'l-shape',
        cornerStyle: 'winders',
        turnDirection: 'right',
        winderCount: 3,
        winderMethod: 'equal-going',
        flightSplit: [5, 4],
      },
    };
    return buildStairEntity(params, '0');
  }

  function makeGamma(): StairEntity {
    const base = buildDefaultStairParams(basePoint, 0);
    const params: StairParams = {
      ...base,
      variant: {
        kind: 'gamma',
        turnSequence: ['right', 'right'],
        landings: ['auto', 'auto'],
        flightSplit: [4, 3, 3],
      },
    };
    return buildStairEntity(params, '0');
  }

  function makeUShape(): StairEntity {
    const base = buildDefaultStairParams(basePoint, 0);
    const params: StairParams = {
      ...base,
      variant: {
        kind: 'u-shape',
        turnDirection: 'right',
        landingDepth: 'auto',
        flightSplit: [6, 6],
      },
    };
    return buildStairEntity(params, '0');
  }

  // ─── getStairGrips: layout (ADR-358 base) ─────────────────────────────────

  // ADR-363 Φ1G.5 Slice 2: stair-base filtered out → 5 grips (rotation + 4 corners)
  it('1. straight stair → 5 grips (rotation + 4 corners; ADR-393 v2, stair-base removed)', () => {
    const grips = getStairGrips(makeStraight());
    expect(grips).toHaveLength(5);
    expect(grips.map((g) => gripKindOf(g, 'stair'))).toEqual([
      'stair-direction',
      'stair-corner-start-left',
      'stair-corner-start-right',
      'stair-corner-end-left',
      'stair-corner-end-right',
    ]);
  });

  // ADR-363 Φ1G.5 Slice 2: stair-base is NOT present in the returned array.
  // The transform (applyStairGripDrag 'stair-base') is retained — see test 10.
  it('2. stair-base is absent from getStairGrips output (ADR-363 Φ1G.5 Slice 2)', () => {
    const grips = getStairGrips(makeStraight());
    const kinds = grips.map((g) => gripKindOf(g, 'stair'));
    expect(kinds).not.toContain('stair-base');
    // First returned grip is now stair-direction (array index 0, gripIndex field still 1)
    expect(gripKindOf(grips[0], 'stair')).toBe('stair-direction');
  });

  // ADR-363 Φ1G.5 Slice 2: stair-direction shifts to array index 0 (was 1); gripIndex field = 1 (unchanged)
  it('3. direction ROTATION grip at front-centre (base − 100mm·u, −u side)', () => {
    const grips = getStairGrips(makeStraight());
    expect(gripKindOf(grips[0], 'stair')).toBe('stair-direction'); // array index 0 (was 1)
    expect(grips[0].position.x).toBeCloseTo(-100, 6);
    expect(grips[0].position.y).toBeCloseTo(0, 6);
  });

  // ─── getStairGrips: ADR-393 Phase A1 corners (straight) ───────────────────

  it('4. straight corners at footprint ±width/2 on front and back edges', () => {
    const grips = getStairGrips(makeStraight());
    // width=1200 → half=600 ; totalRun=280*11=3080 ; direction=0 → p=(0,1).
    const byKind = Object.fromEntries(grips.map((g) => [gripKindOf(g, 'stair'), g.position]));
    expect(byKind['stair-corner-start-left']).toEqual({ x: 0, y: 600 });
    expect(byKind['stair-corner-start-right']).toEqual({ x: 0, y: -600 });
    expect(byKind['stair-corner-end-left']).toEqual({ x: 3080, y: 600 });
    expect(byKind['stair-corner-end-right']).toEqual({ x: 3080, y: -600 });
  });

  it('5. straight no longer emits width / length / mid-front grips (ADR-393 v2)', () => {
    const kinds = getStairGrips(makeStraight()).map((g) => gripKindOf(g, 'stair'));
    expect(kinds).not.toContain('stair-width');
    expect(kinds).not.toContain('stair-length');
    expect(kinds).not.toContain('stair-start-side');
  });

  // ADR-363 Φ1G.5 Slice 2: stair-base absent from output → removed byKind['stair-base'] assertion
  it('5b. metre-scene: handle offsets stay scene-scaled (not 1000× off-screen)', () => {
    // Rule: BIM grip positions must be scene-unit-correct. In a metre scene the
    // 100 mm direction offset must resolve to 0.1 m, NOT 100 m.
    const params = buildDefaultStairParams(basePoint, 0, {}, 'm');
    const grips = getStairGrips(buildStairEntity(params, '0'));
    const byKind = Object.fromEntries(grips.map((g) => [gripKindOf(g, 'stair'), g.position]));
    // width=1.2 → half=0.6 ; tread=0.28 → totalRun=3.08
    expect(byKind['stair-direction'].x).toBeCloseTo(-0.1, 6); // front-centre, −u side
    // stair-base is filtered from output per ADR-363 Φ1G.5 Slice 2 — use applyStairGripDrag for transform
    expect(byKind['stair-corner-start-left']).toEqual({ x: 0, y: 0.6 });
    expect(byKind['stair-corner-end-left'].x).toBeCloseTo(3.08, 6);
    // Regression guard: the old mm-constant bug placed these at ±100 (metres).
    expect(Math.abs(byKind['stair-direction'].x)).toBeLessThan(1);
  });

  // ─── getStairGrips: ADR-393 Phase B (L/U/Γ) ───────────────────────────────

  it('6. l-shape (landing, sharp) → 4 corners + 2 flight + landing-depth, no width/length (ADR-393 v2 Phase 2)', () => {
    const grips = getStairGrips(makeLShape());
    const kinds = grips.map((g) => gripKindOf(g, 'stair'));
    expect(kinds).toContain('stair-flight1-end');
    expect(kinds).toContain('stair-flight2-start');
    expect(kinds).toContain('stair-landing-depth');
    expect(kinds).not.toContain('stair-landing-corner-radius');
    expect(kinds).not.toContain('stair-split'); // removed (ADR-393 Q4)
    // ADR-393 v2 Phase 2 — L/U/Γ now own the 4 asymmetric corners (was straight-only)
    // and SUPPRESS the on-axis width/length handles (the corners replace them).
    expect(kinds).toContain('stair-corner-start-left');
    expect(kinds).toContain('stair-corner-start-right');
    expect(kinds).toContain('stair-corner-end-left');
    expect(kinds).toContain('stair-corner-end-right');
    expect(kinds).not.toContain('stair-width');
    expect(kinds).not.toContain('stair-length');
  });

  it('7. l-shape with fillet corner → also emits landing-corner-radius', () => {
    const kinds = getStairGrips(makeLShapeFillet()).map((g) => gripKindOf(g, 'stair'));
    expect(kinds).toContain('stair-landing-corner-radius');
  });

  it('8. l-shape winders → flight grips but no landing-depth/corner-radius', () => {
    const kinds = getStairGrips(makeLShapeWinders()).map((g) => gripKindOf(g, 'stair'));
    expect(kinds).toContain('stair-flight1-end');
    expect(kinds).toContain('stair-flight2-start');
    expect(kinds).not.toContain('stair-landing-depth');
    expect(kinds).not.toContain('stair-landing-corner-radius');
  });

  it('9. gamma → flight grips, no landing-depth (uses landings tuple)', () => {
    const kinds = getStairGrips(makeGamma()).map((g) => gripKindOf(g, 'stair'));
    expect(kinds).toContain('stair-flight1-end');
    expect(kinds).toContain('stair-flight2-start');
    expect(kinds).not.toContain('stair-landing-depth');
  });

  // ─── applyStairGripDrag: ADR-358 base grips ───────────────────────────────

  it('10. stair-base drag → translates basePoint by delta', () => {
    const entity = makeStraight();
    const next = applyStairGripDrag('stair-base', {
      originalParams: entity.params,
      delta: { x: 50, y: 30 },
      currentPos: { x: 50, y: 30 },
    });
    expect(next.basePoint.x).toBe(50);
    expect(next.basePoint.y).toBe(30);
  });

  it('11. stair-direction drag → recomputes direction via atan2', () => {
    const entity = makeStraight();
    const next = applyStairGripDrag('stair-direction', {
      originalParams: entity.params,
      delta: { x: 0, y: 100 },
      currentPos: { x: 0, y: 100 },
    });
    expect(next.direction).toBeCloseTo(90, 4);
  });

  it('12. stair-width drag → width = 2·|projection on perp|', () => {
    const entity = makeStraight();
    const next = applyStairGripDrag('stair-width', {
      originalParams: entity.params,
      delta: { x: 0, y: 600 },
      currentPos: { x: 0, y: 600 },
    });
    expect(next.width).toBeCloseTo(1200, 4);
  });

  it('13. stair-length drag → derives stepCount from projection / tread', () => {
    const entity = makeStraight();
    const next = applyStairGripDrag('stair-length', {
      originalParams: entity.params,
      delta: { x: 1000, y: 0 },
      currentPos: { x: 1000, y: 0 },
    });
    expect(next.stepCount).toBe(4); // floor(1000/280)+1
    expect(next.totalRun).toBeCloseTo(280 * 3, 4);
  });

  // ─── applyStairGripDrag: ADR-393 Phase A1 corners ─────────────────────────

  it('14. corner-start-left perp drag → width grows + axis recenters by half', () => {
    const entity = makeStraight();
    const next = applyStairGripDrag('stair-corner-start-left', {
      originalParams: entity.params,
      delta: { x: 0, y: 200 },
      currentPos: { x: 0, y: 200 },
    });
    expect(next.width).toBeCloseTo(1400, 4); // 1200 + 200
    expect(next.basePoint.y).toBeCloseTo(100, 4); // recenter by half of 200
    expect(next.stepCount).toBe(12); // run unchanged
  });

  it('15. corner-start-right perp drag (−p) → width grows symmetrically', () => {
    const entity = makeStraight();
    const next = applyStairGripDrag('stair-corner-start-right', {
      originalParams: entity.params,
      delta: { x: 0, y: -200 }, // drag the −p face outward
      currentPos: { x: 0, y: -200 },
    });
    expect(next.width).toBeCloseTo(1400, 4);
    expect(next.basePoint.y).toBeCloseTo(-100, 4);
  });

  it('16. corner-end-left axial drag → grows run, basePoint fixed', () => {
    const entity = makeStraight();
    const next = applyStairGripDrag('stair-corner-end-left', {
      originalParams: entity.params,
      delta: { x: 280, y: 0 }, // one tread forward
      currentPos: { x: 3080 + 280, y: 600 },
    });
    expect(next.stepCount).toBe(13); // floor(3360/280)+1
    expect(next.totalRun).toBeCloseTo(3360, 4);
    expect(next.basePoint.x).toBeCloseTo(0, 4); // end corner leaves base fixed
  });

  it('17. corner-start axial drag → moves base forward, keeps back edge fixed', () => {
    const entity = makeStraight();
    const next = applyStairGripDrag('stair-corner-start-left', {
      originalParams: entity.params,
      delta: { x: 280, y: 0 }, // pull start one tread toward the back
      currentPos: { x: 280, y: 600 },
    });
    expect(next.stepCount).toBe(11); // floor(2800/280)+1
    expect(next.totalRun).toBeCloseTo(2800, 4);
    expect(next.basePoint.x).toBeCloseTo(280, 4); // base moved forward
    // back edge = base + run = 280 + 2800 = 3080 (original back) → fixed
    expect(next.basePoint.x + next.totalRun).toBeCloseTo(3080, 4);
  });

  it('18. corner width clamps to scene-unit-aware floor (no collapse)', () => {
    const entity = makeStraight();
    const next = applyStairGripDrag('stair-corner-start-left', {
      originalParams: entity.params,
      delta: { x: 0, y: -100000 }, // collapse the +p face far past the axis
      currentPos: { x: 0, y: -100000 },
    });
    expect(next.width).toBeGreaterThanOrEqual(50); // MIN_WIDTH_MM floor for mm scene
  });

  // ─── applyStairGripDrag: ADR-393 Phase A2 mid-front ───────────────────────

  it('19. stair-start-side drag → moves base along direction, run shrinks, back fixed', () => {
    const entity = makeStraight();
    const next = applyStairGripDrag('stair-start-side', {
      originalParams: entity.params,
      delta: { x: 280, y: 0 },
      currentPos: { x: 180, y: 0 },
    });
    expect(next.stepCount).toBe(11);
    expect(next.totalRun).toBeCloseTo(2800, 4);
    expect(next.basePoint.x).toBeCloseTo(280, 4);
    expect(next.basePoint.x + next.totalRun).toBeCloseTo(3080, 4); // back edge fixed
    expect(next.width).toBe(entity.params.width); // no width change
  });

  // ─── applyStairGripDrag: ADR-393 Phase B1 per-flight ──────────────────────

  it('20. flight1-end drag → flightSplit integers summing to corner budget', () => {
    const entity = makeLShape();
    const next = applyStairGripDrag('stair-flight1-end', {
      originalParams: entity.params,
      delta: { x: 100000, y: 0 },
      currentPos: { x: 100000, y: 0 },
    });
    expect(next.variant.kind).toBe('l-shape');
    if (next.variant.kind === 'l-shape') {
      const [a, b] = next.variant.flightSplit;
      expect(Number.isInteger(a)).toBe(true);
      expect(Number.isInteger(b)).toBe(true);
      expect(a).toBeGreaterThanOrEqual(1);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(a + b).toBe(next.stepCount - 1); // landing: n1 + 1 + n2 = stepCount
    }
  });

  it('21. flight2-start drag uses the same reapportion math as flight1-end', () => {
    const entity = makeLShape();
    const input = {
      originalParams: entity.params,
      delta: { x: 1000, y: 0 },
      currentPos: { x: 1000, y: 0 },
    };
    const a = applyStairGripDrag('stair-flight1-end', input);
    const b = applyStairGripDrag('stair-flight2-start', input);
    expect(a.variant).toEqual(b.variant);
  });

  it('22. flight grip on straight → returns originalParams unchanged (no split)', () => {
    const entity = makeStraight();
    const next = applyStairGripDrag('stair-flight1-end', {
      originalParams: entity.params,
      delta: { x: 100, y: 0 },
      currentPos: { x: 100, y: 0 },
    });
    expect(next).toBe(entity.params);
  });

  // ─── applyStairGripDrag: ADR-393 Phase B2 landing ─────────────────────────

  it('23. landing-depth drag → sets depth from distance past flight-1', () => {
    const entity = makeLShape();
    // flight1Run = flightSplit[0]·tread = 6·280 = 1680. cursor at x=2000 → depth 320.
    const next = applyStairGripDrag('stair-landing-depth', {
      originalParams: entity.params,
      delta: { x: 0, y: 0 },
      currentPos: { x: 2000, y: 0 },
    });
    expect(next.variant.kind).toBe('l-shape');
    if (next.variant.kind === 'l-shape' && next.variant.cornerStyle === 'landing') {
      expect(next.variant.landingDepth).toBeCloseTo(320, 4);
    }
  });

  it('24. landing-depth floored at one tread', () => {
    const entity = makeLShape();
    const next = applyStairGripDrag('stair-landing-depth', {
      originalParams: entity.params,
      delta: { x: 0, y: 0 },
      currentPos: { x: 0, y: 0 }, // projection well below flight-1
    });
    if (next.variant.kind === 'l-shape' && next.variant.cornerStyle === 'landing') {
      expect(next.variant.landingDepth).toBeCloseTo(280, 4);
    }
  });

  it('25. landing-corner-radius drag inward grows radius, clamped to max', () => {
    const entity = makeLShapeFillet();
    const next = applyStairGripDrag('stair-landing-corner-radius', {
      originalParams: entity.params,
      delta: { x: -100, y: -100 }, // inward toward landing centre
      currentPos: { x: 0, y: 0 },
    });
    if (next.variant.kind === 'l-shape' && next.variant.cornerStyle === 'landing') {
      expect(next.variant.landingCornerRadius).toBeGreaterThan(0);
      expect(next.variant.landingCornerRadius).toBeLessThanOrEqual(600); // min(width,depth)/2
    }
  });

  it('26. landing transforms on straight → returns originalParams unchanged', () => {
    const entity = makeStraight();
    const depth = applyStairGripDrag('stair-landing-depth', {
      originalParams: entity.params,
      delta: { x: 0, y: 0 },
      currentPos: { x: 2000, y: 0 },
    });
    const radius = applyStairGripDrag('stair-landing-corner-radius', {
      originalParams: entity.params,
      delta: { x: -100, y: -100 },
      currentPos: { x: 0, y: 0 },
    });
    expect(depth).toBe(entity.params);
    expect(radius).toBe(entity.params);
  });

  // ─── ADR-393 v2 — glyph shape mapping + walkline arc-midpoint ─────────────

  it('27. stairGripGlyphShape: base→move, direction→rotation, else→square', () => {
    expect(stairGripGlyphShape('stair-base')).toBe('move');
    expect(stairGripGlyphShape('stair-direction')).toBe('rotation');
    expect(stairGripGlyphShape('stair-corner-start-left')).toBe('square');
    expect(stairGripGlyphShape('stair-width')).toBe('square');
    expect(stairGripGlyphShape(undefined)).toBe('square');
  });

  it('28. polylineArcMidpoint: half-arc-length point on a multi-segment path', () => {
    // L-path total length 4 (2 + 2); half = 2 lands exactly at the corner.
    const mid = polylineArcMidpoint([
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 2, y: 2, z: 0 },
    ]);
    expect(mid).toEqual({ x: 2, y: 0 });
    expect(polylineArcMidpoint([])).toBeNull();
    expect(polylineArcMidpoint([{ x: 5, y: 7, z: 0 }])).toEqual({ x: 5, y: 7 });
  });

  // ─── ADR-393 v2 Phase 2 — L/U/Γ corners (emit + positions + transforms) ───

  it('29. u-shape → 4 corners + no width/length', () => {
    const kinds = getStairGrips(makeUShape()).map((g) => gripKindOf(g, 'stair'));
    expect(kinds).toContain('stair-corner-start-left');
    expect(kinds).toContain('stair-corner-start-right');
    expect(kinds).toContain('stair-corner-end-left');
    expect(kinds).toContain('stair-corner-end-right');
    expect(kinds).not.toContain('stair-width');
    expect(kinds).not.toContain('stair-length');
  });

  it('30. gamma → 4 corners + flight grips, no width/length', () => {
    const kinds = getStairGrips(makeGamma()).map((g) => gripKindOf(g, 'stair'));
    expect(kinds).toContain('stair-corner-start-left');
    expect(kinds).toContain('stair-corner-end-right');
    expect(kinds).toContain('stair-flight1-end');
    expect(kinds).not.toContain('stair-width');
    expect(kinds).not.toContain('stair-length');
  });

  it('31. l-shape corner positions read from stringer endpoints', () => {
    const grips = getStairGrips(makeLShape());
    const byKind = Object.fromEntries(grips.map((g) => [gripKindOf(g, 'stair'), g.position]));
    // flight-1 entry on ±p1 (width=1200 → ±600); turnDirection right → flight 2
    // descends along −y, its exit endpoints sit on ±x of the last vertex.
    expect(byKind['stair-corner-start-left'].x).toBeCloseTo(0, 4);
    expect(byKind['stair-corner-start-left'].y).toBeCloseTo(600, 4);
    expect(byKind['stair-corner-start-right'].y).toBeCloseTo(-600, 4);
    expect(byKind['stair-corner-end-left'].x).toBeCloseTo(2880, 4);
    expect(byKind['stair-corner-end-left'].y).toBeCloseTo(-2000, 4);
    expect(byKind['stair-corner-end-right'].x).toBeCloseTo(1680, 4);
    expect(byKind['stair-corner-end-right'].y).toBeCloseTo(-2000, 4);
  });

  it('32. l-shape corner-start perp drag → width grows + axis recenters (split unchanged)', () => {
    const entity = makeLShape();
    const next = applyStairGripDrag('stair-corner-start-left', {
      originalParams: entity.params,
      delta: { x: 0, y: 200 },
      currentPos: { x: 0, y: 800 },
      geometry: entity.geometry,
    });
    expect(next.width).toBeCloseTo(1400, 4); // 1200 + 200
    expect(next.basePoint.y).toBeCloseTo(100, 4); // recenter by half
    expect(next.variant.kind).toBe('l-shape');
    if (next.variant.kind === 'l-shape') {
      expect(next.variant.flightSplit[0]).toBe(6); // no axial → split untouched
      expect(next.variant.flightSplit[1]).toBe(6);
    }
  });

  it('33. l-shape corner-end axial drag → extends last flight, base fixed', () => {
    const entity = makeLShape();
    const next = applyStairGripDrag('stair-corner-end-left', {
      originalParams: entity.params,
      delta: { x: 0, y: -280 }, // one tread along the last flight (−y)
      currentPos: { x: 2280, y: -2280 },
      geometry: entity.geometry,
    });
    expect(next.variant.kind).toBe('l-shape');
    if (next.variant.kind === 'l-shape') {
      expect(next.variant.flightSplit[1]).toBe(7); // 6 + 1
      expect(next.variant.flightSplit[0]).toBe(6); // first flight untouched
    }
    expect(next.stepCount).toBe(entity.params.stepCount + 1);
    expect(next.basePoint.x).toBeCloseTo(0, 6); // end corner anchors base
    expect(next.basePoint.y).toBeCloseTo(0, 6);
  });

  it('34. l-shape corner-start axial drag → shrinks flight 1, base moves forward', () => {
    const entity = makeLShape();
    const next = applyStairGripDrag('stair-corner-start-left', {
      originalParams: entity.params,
      delta: { x: 280, y: 0 }, // pull entry one tread toward the landing (+u1)
      currentPos: { x: 280, y: 600 },
      geometry: entity.geometry,
    });
    expect(next.variant.kind).toBe('l-shape');
    if (next.variant.kind === 'l-shape') {
      expect(next.variant.flightSplit[0]).toBe(5); // 6 − 1
      expect(next.variant.flightSplit[1]).toBe(6);
    }
    expect(next.stepCount).toBe(entity.params.stepCount - 1);
    expect(next.basePoint.x).toBeCloseTo(280, 6); // base moved forward one tread
  });

  it('35. metre-scene l-shape corners stay scene-scaled (±0.6 m, not ±600)', () => {
    const base = buildDefaultStairParams(basePoint, 0, {}, 'm');
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
    const grips = getStairGrips(buildStairEntity(params, '0'));
    const byKind = Object.fromEntries(grips.map((g) => [gripKindOf(g, 'stair'), g.position]));
    expect(byKind['stair-corner-start-left'].y).toBeCloseTo(0.6, 6);
    expect(byKind['stair-corner-start-right'].y).toBeCloseTo(-0.6, 6);
    // Regression guard: positions read from geometry, never raw mm constants.
    expect(Math.abs(byKind['stair-corner-start-left'].y)).toBeLessThan(1);
  });

  it('36. u-shape corner-end axial uses the LAST flight direction (−u1), not flight-1', () => {
    // U-shape flight 2 is anti-parallel to flight 1. Decomposing the drag on
    // flight-1's axis would shrink instead of extend; the geometry-read uLast
    // makes a −u1 drag extend the last flight. Guards the geometry threading.
    const entity = makeUShape();
    const next = applyStairGripDrag('stair-corner-end-left', {
      originalParams: entity.params,
      delta: { x: -280, y: 0 }, // one tread along the last flight (−u1)
      currentPos: { x: 0, y: -1200 },
      geometry: entity.geometry,
    });
    expect(next.variant.kind).toBe('u-shape');
    if (next.variant.kind === 'u-shape') {
      expect(next.variant.flightSplit[1]).toBe(7); // extended, not shrunk
      expect(next.variant.flightSplit[0]).toBe(6);
    }
    expect(next.stepCount).toBe(entity.params.stepCount + 1);
  });
});
