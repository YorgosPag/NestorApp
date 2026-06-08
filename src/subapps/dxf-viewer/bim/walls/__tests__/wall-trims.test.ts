/**
 * ADR-363 Phase 1D-B/C — `wall-trims` pure geometry tests.
 *
 * Coverage:
 *   computeWallTrims():
 *     Phase 1D-C (corner miter):
 *       3. 90° corner — endMiter computed, outer/inner correct
 *       4. 90° corner — startMiter computed for both
 *       5. 45° oblique corner — miter points computed (not bevel)
 *      11. Very short wall (overflow guard) → falls back to axis-bevel
 *     Phase 1D-B (T-junction bevel):
 *       6. T-junction — only stem wall trimmed (bevel)
 *       7. T-junction reversed
 *       8. Parallel — no trim
 *       9. Far-apart — no trim
 *      10. Nearly-parallel — no trim
 *
 *   applyTrimPatches():
 *     Phase 1D-C:
 *      20. miter patch applied → edges match miter points
 *     Phase 1D-B:
 *      12. bevel patch applied → geometry.length decreases
 *      13. non-wall entities pass through
 *      14. empty trim map
 *      15. wall not in trim map unchanged
 *
 *   wall-geometry bevel integration:
 *    16-19. startBevel/endBevel integration (unchanged)
 *
 *   computeWallTrims end-to-end miter:
 *    21. 90° corner two ends → both walls have endMiter
 *    22. 90° corner outer point matches (3100,100) for the standard test config
 *    23. Corner + T-junction in one scene — corner gets miter, stem gets bevel
 */

import { computeWallTrims, applyTrimPatches } from '../wall-trims';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import type { WallEntity, WallParams } from '../../types/wall-types';
import { computeWallGeometry } from '../../geometry/wall-geometry';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWall(
  start: { x: number; y: number },
  end: { x: number; y: number },
  thickness = 200,
  idSuffix = '',
): WallEntity {
  const params = buildDefaultWallParams(start, end);
  // Drop dna when overriding thickness so validator doesn't fire dnaThicknessMismatch.
  const overrideParams: WallParams = { ...params, thickness, dna: undefined };
  const result = buildWallEntity(overrideParams, '0', 'straight');
  if (!result.ok) throw new Error('Failed to build wall: ' + result.hardErrors.join(', '));
  const entity = result.entity;
  // Suffix id for uniqueness in tests
  return idSuffix ? { ...entity, id: entity.id + idSuffix } : entity;
}

// ─── computeWallTrims ─────────────────────────────────────────────────────────

describe('computeWallTrims', () => {
  it('1. empty walls → empty map, no crash', () => {
    expect(computeWallTrims([])).toEqual(new Map());
  });

  it('2. single wall → empty map', () => {
    const w = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 });
    expect(computeWallTrims([w])).toEqual(new Map());
  });

  it('3. 90° corner — A.end meets B.end → both walls get endMiter (Phase 1D-C)', () => {
    // A horizontal 3000mm, B vertical 3000mm, both ending at (3000, 0)
    const wallA = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 3000, y: 3000 }, { x: 3000, y: 0 }, 200, 'B');

    const trims = computeWallTrims([wallA, wallB]);

    expect(trims.has(wallA.id)).toBe(true);
    expect(trims.has(wallB.id)).toBe(true);

    const trimA = trims.get(wallA.id)!;
    const trimB = trims.get(wallB.id)!;

    // Corner → geometric miter, NOT axis-bevel
    expect(trimA.endMiter).toBeDefined();
    expect(trimB.endMiter).toBeDefined();
    expect(trimA.endBevel).toBeUndefined();
    expect(trimB.endBevel).toBeUndefined();
    expect(trimA.startMiter).toBeUndefined();
    expect(trimB.startMiter).toBeUndefined();

    // end+end is an "inconsistent" corner: A's outer side faces the concave side
    // while B's outer side faces the convex side. The walls therefore share the
    // SAME two physical corners but with outer/inner mirror-swapped — A.outer is
    // B.inner and vice-versa (NOT outer↔outer, which would be a phantom vertex).
    expect(trimA.endMiter!.outer.x).toBeCloseTo(trimB.endMiter!.inner.x, 1);
    expect(trimA.endMiter!.outer.y).toBeCloseTo(trimB.endMiter!.inner.y, 1);
    expect(trimA.endMiter!.inner.x).toBeCloseTo(trimB.endMiter!.outer.x, 1);
    expect(trimA.endMiter!.inner.y).toBeCloseTo(trimB.endMiter!.outer.y, 1);
  });

  it('4. 90° corner — A.start meets B.start → both walls get startMiter', () => {
    // A goes right from (1000,0), B goes up from (1000,0)
    const wallA = makeWall({ x: 1000, y: 0 }, { x: 4000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 1000, y: 0 }, { x: 1000, y: 3000 }, 200, 'B');

    const trims = computeWallTrims([wallA, wallB]);

    const trimA = trims.get(wallA.id)!;
    const trimB = trims.get(wallB.id)!;
    expect(trimA.startMiter).toBeDefined();
    expect(trimB.startMiter).toBeDefined();
    expect(trimA.endMiter).toBeUndefined();
    expect(trimB.endMiter).toBeUndefined();
  });

  it('5. 45° oblique corner — miter points computed (not bevel)', () => {
    // A horizontal, B at 45°, both starting at origin
    const wallA = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 0, y: 0 }, { x: 2121, y: 2121 }, 200, 'B');

    const trims = computeWallTrims([wallA, wallB]);
    const trimA = trims.get(wallA.id);
    const trimB = trims.get(wallB.id);

    // Phase 1D-C: long walls → miter (not bevel)
    expect(trimA?.startMiter).toBeDefined();
    expect(trimB?.startMiter).toBeDefined();
    expect(trimA?.startBevel).toBeUndefined();
    expect(trimB?.startBevel).toBeUndefined();

    // start+start is an "inconsistent" corner → outer/inner mirror-swapped between
    // the two walls (A.outer == B.inner), same two physical corners.
    expect(trimA!.startMiter!.outer.x).toBeCloseTo(trimB!.startMiter!.inner.x, 1);
    expect(trimA!.startMiter!.outer.y).toBeCloseTo(trimB!.startMiter!.inner.y, 1);
  });

  it('6. T-junction — A continues, B perpendicular stem hits A.body → only B trimmed', () => {
    // A horizontal 6000mm at y=0, B vertical hits A at (3000,0) coming from below
    const wallA = makeWall({ x: 0, y: 0 }, { x: 6000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 3000, y: 2000 }, { x: 3000, y: 0 }, 200, 'B');

    const trims = computeWallTrims([wallA, wallB]);

    expect(trims.has(wallA.id)).toBe(false); // A is not trimmed
    expect(trims.has(wallB.id)).toBe(true);

    const trimB = trims.get(wallB.id)!;
    expect(trimB.endBevel).toBeCloseTo(100, 0); // halfThicknessA/sin(90°)
  });

  it('7. T-junction reversed — B continues, A stem hits B.body', () => {
    const wallA = makeWall({ x: 3000, y: 2000 }, { x: 3000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 0, y: 0 }, { x: 6000, y: 0 }, 200, 'B');

    const trims = computeWallTrims([wallA, wallB]);

    expect(trims.has(wallB.id)).toBe(false);
    expect(trims.has(wallA.id)).toBe(true);
    expect(trims.get(wallA.id)!.endBevel).toBeCloseTo(100, 0);
  });

  it('8. Parallel walls (same direction) → no intersection, no trim', () => {
    const wallA = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 0, y: 300 }, { x: 3000, y: 300 }, 200, 'B');

    const trims = computeWallTrims([wallA, wallB]);
    expect(trims.size).toBe(0);
  });

  it('9. Far-apart walls (intersection far outside JOIN_THRESHOLD) → no trim', () => {
    // Perpendicular but don't actually touch — endpoints 500mm apart
    const wallA = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 3500, y: 3000 }, { x: 3500, y: 600 }, 200, 'B'); // 600mm away from A

    const trims = computeWallTrims([wallA, wallB]);
    expect(trims.size).toBe(0);
  });

  it('10. Nearly parallel angle (<15°) → no trim despite proximity', () => {
    // Almost horizontal wall at 5° angle meeting A's endpoint
    const wallA = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 200, 'A');
    const angle5deg = 5 * Math.PI / 180;
    const wallB = makeWall(
      { x: 3000, y: 0 },
      { x: 3000 + 3000 * Math.cos(angle5deg), y: 3000 * Math.sin(angle5deg) },
      200, 'B',
    );

    const trims = computeWallTrims([wallA, wallB]);
    expect(trims.size).toBe(0);
  });

  it('11. Very short wall (overflow guard) → falls back to axis-bevel, not miter', () => {
    // Wall B only 100mm tall, 200mm thick — miter would extend 100% of lenB → overflow
    // → Phase 1D-C overflow guard triggers → falls back to Phase 1D-B axis-bevel
    const wallA = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 3000, y: 100 }, { x: 3000, y: 0 }, 200, 'B');

    const trims = computeWallTrims([wallA, wallB]);
    const trimB = trims.get(wallB.id);

    // Falls back to bevel (not miter)
    expect(trimB?.endMiter).toBeUndefined();
    // halfThicknessA = 100, lenB = 100, MAX_BEVEL_FRACTION=0.40 → max 40mm
    if (trimB?.endBevel !== undefined) {
      expect(trimB.endBevel).toBeLessThanOrEqual(40 + 0.1);
    }
  });
});

// ─── applyTrimPatches ─────────────────────────────────────────────────────────

describe('applyTrimPatches', () => {
  it('12. patches wall params (bevel) and recomputes geometry', () => {
    const wall = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 200);
    const trims = new Map([[wall.id, { endBevel: 100 }]]);

    const result = applyTrimPatches([wall], trims);
    const patched = result[0] as WallEntity;

    expect(patched.params.endBevel).toBe(100);
    // Geometry should reflect the shorter axis
    expect(patched.geometry.length).toBeLessThan(wall.geometry.length);
  });

  it('20. applyTrimPatches with endMiter → outer/inner edge endpoints replaced', () => {
    // Horizontal wall (0,0)→(3000,0), thickness 200 (half=100), flip=false
    // endMiter = { outer: {x:3100,y:100}, inner: {x:2900,y:-100} }
    const wall = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 200);
    const miter = { outer: { x: 3100, y: 100 }, inner: { x: 2900, y: -100 } };
    const trims = new Map([[wall.id, { endMiter: miter }]]);

    const result = applyTrimPatches([wall], trims);
    const patched = result[0] as WallEntity;

    expect(patched.params.endMiter).toEqual(miter);

    // The last point of outerEdge should be the miter outer point
    const outerPts = patched.geometry.outerEdge.points;
    const innerPts = patched.geometry.innerEdge.points;
    expect(outerPts[outerPts.length - 1].x).toBeCloseTo(3100, 1);
    expect(outerPts[outerPts.length - 1].y).toBeCloseTo(100, 1);
    expect(innerPts[innerPts.length - 1].x).toBeCloseTo(2900, 1);
    expect(innerPts[innerPts.length - 1].y).toBeCloseTo(-100, 1);
  });

  it('13. non-wall entities pass through unchanged', () => {
    const fakeEntity = { id: 'line1', type: 'line' as const } as never;
    const trims = new Map<string, never>();

    const result = applyTrimPatches([fakeEntity], trims);
    expect(result[0]).toBe(fakeEntity);
  });

  it('14. empty trim map returns shallow-cloned array, entities identical', () => {
    const wall = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 });
    const result = applyTrimPatches([wall], new Map());
    expect(result[0]).toBe(wall); // same reference
  });

  it('15. wall not in trim map is unchanged', () => {
    const wallA = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 4000, y: 0 }, { x: 7000, y: 0 }, 200, 'B');
    const trims = new Map([[wallA.id, { startBevel: 50 }]]);

    const result = applyTrimPatches([wallA, wallB], trims);
    expect((result[0] as WallEntity).params.startBevel).toBe(50);
    expect(result[1]).toBe(wallB); // B unchanged, same reference
  });
});

// ─── wall-geometry bevel integration (via computeWallGeometry) ───────────────

describe('wall-geometry bevel integration (Phase 1D-B)', () => {
  it('16. startBevel > 0 shortens axis at start, geometry.length decreases', () => {
    const params: WallParams = { ...buildDefaultWallParams({ x: 0, y: 0 }, { x: 3000, y: 0 }), startBevel: 100 };
    const geo = computeWallGeometry(params, 'straight');
    // Length = 2900mm = 2.9m
    expect(geo.length).toBeCloseTo(2.9, 2);
    // axis start moved 100mm right
    expect(geo.axisPolyline.points[0].x).toBeCloseTo(100, 1);
    expect(geo.axisPolyline.points[0].y).toBeCloseTo(0, 1);
  });

  it('17. endBevel > 0 shortens axis at end', () => {
    const params: WallParams = { ...buildDefaultWallParams({ x: 0, y: 0 }, { x: 3000, y: 0 }), endBevel: 150 };
    const geo = computeWallGeometry(params, 'straight');
    expect(geo.length).toBeCloseTo(2.85, 2);
    expect(geo.axisPolyline.points[1].x).toBeCloseTo(2850, 1);
  });

  it('18. both bevels applied — total shortening = startBevel + endBevel', () => {
    const params: WallParams = {
      ...buildDefaultWallParams({ x: 0, y: 0 }, { x: 3000, y: 0 }),
      startBevel: 100,
      endBevel: 100,
    };
    const geo = computeWallGeometry(params, 'straight');
    expect(geo.length).toBeCloseTo(2.8, 2);
  });

  it('19. zero bevels leave geometry unchanged', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 3000, y: 0 });
    const geoNo = computeWallGeometry(params, 'straight');
    const geoZero = computeWallGeometry({ ...params, startBevel: 0, endBevel: 0 }, 'straight');
    expect(geoZero.length).toBeCloseTo(geoNo.length, 5);
  });
});

// ─── Phase 1D-C: miter geometry end-to-end ───────────────────────────────────

describe('wall-geometry miter integration (Phase 1D-C)', () => {
  it('21. endMiter replaces edge endpoints — outer at (3100,100), inner at (2900,-100)', () => {
    // Horizontal wall (0,0)→(3000,0), thickness 200, flip=false
    // Standard 90° corner config: outer north (+y), inner south (−y)
    const params: WallParams = {
      ...buildDefaultWallParams({ x: 0, y: 0 }, { x: 3000, y: 0 }),
      thickness: 200,
      dna: undefined,
      endMiter: { outer: { x: 3100, y: 100 }, inner: { x: 2900, y: -100 } },
    };
    const geo = computeWallGeometry(params, 'straight');
    const outer = geo.outerEdge.points;
    const inner = geo.innerEdge.points;

    expect(outer[outer.length - 1].x).toBeCloseTo(3100, 1);
    expect(outer[outer.length - 1].y).toBeCloseTo(100, 1);
    expect(inner[inner.length - 1].x).toBeCloseTo(2900, 1);
    expect(inner[inner.length - 1].y).toBeCloseTo(-100, 1);

    // Start endpoints unchanged (no startMiter)
    expect(outer[0].y).toBeCloseTo(100, 1);
    expect(inner[0].y).toBeCloseTo(-100, 1);
  });

  it('22. computeWallTrims 90° end+end corner: A.outer=concave(2900,100), A.inner=convex(3100,-100)', () => {
    // A: (0,0)→(3000,0), B: (3000,3000)→(3000,0), both END at (3000,0).
    // This is an L-corner: A extends left, B extends up. The concave (inner-elbow)
    // vertex is (2900,100); the convex (outer-elbow) vertex is (3100,-100).
    // A's outer edge is its +y side (y=100) which faces the CONCAVE side, so
    // A.outer = A_outer(y=100) ∩ B_inner(x=2900) = (2900,100). A.inner is the convex.
    // Pairing A_outer with B_outer (x=3100) would yield the phantom vertex (3100,100)
    // that sits OUTSIDE the wall outline — the triangular-gap bug.
    const wallA = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 3000, y: 3000 }, { x: 3000, y: 0 }, 200, 'B');

    const trims = computeWallTrims([wallA, wallB]);
    const miterA = trims.get(wallA.id)!.endMiter!;
    const miterB = trims.get(wallB.id)!.endMiter!;

    // A.outer lands on the concave corner (2900,100); A.inner on the convex (3100,-100).
    expect(miterA.outer.x).toBeCloseTo(2900, 1);
    expect(miterA.outer.y).toBeCloseTo(100, 1);
    expect(miterA.inner.x).toBeCloseTo(3100, 1);
    expect(miterA.inner.y).toBeCloseTo(-100, 1);

    // B's outer edge is its +x side (x=3100), facing the CONVEX side → mirror-swapped.
    expect(miterB.outer.x).toBeCloseTo(3100, 1);
    expect(miterB.outer.y).toBeCloseTo(-100, 1);
    expect(miterB.inner.x).toBeCloseTo(2900, 1);
    expect(miterB.inner.y).toBeCloseTo(100, 1);
  });

  it('24. REGRESSION (diagonal-corner bug): rectangle drawn the natural way → all 4 corners correct', () => {
    // The reported bug: a rectangle drawn with the two horizontals in the SAME
    // direction and the two verticals in the SAME direction yields two end+start
    // corners (correct) and two start+start / end+end corners (previously broken,
    // producing a phantom vertex and a triangular gap — the diagonal pattern).
    //
    // Rectangle 4000×3000, thickness 200 (half=100). flip=false on all walls.
    //   interior vertices: (100,100) (3900,100) (3900,2900) (100,2900)
    //   exterior vertices: (-100,-100) (4100,-100) (4100,3100) (-100,3100)
    const bottom = makeWall({ x: 0, y: 0 },    { x: 4000, y: 0 },    200, 'BOT');
    const top    = makeWall({ x: 0, y: 3000 }, { x: 4000, y: 3000 }, 200, 'TOP');
    const left   = makeWall({ x: 0, y: 0 },    { x: 0, y: 3000 },    200, 'LEF');
    const right  = makeWall({ x: 4000, y: 0 }, { x: 4000, y: 3000 }, 200, 'RIG');

    const trims = computeWallTrims([bottom, top, left, right]);

    const close = (p: { x: number; y: number }, x: number, y: number): void => {
      expect(p.x).toBeCloseTo(x, 1);
      expect(p.y).toBeCloseTo(y, 1);
    };

    // Every wall must receive miters at BOTH endpoints (it sits between two corners).
    const tBot = trims.get(bottom.id)!;
    const tTop = trims.get(top.id)!;
    const tLef = trims.get(left.id)!;
    const tRig = trims.get(right.id)!;
    for (const t of [tBot, tTop, tLef, tRig]) {
      expect(t.startMiter).toBeDefined();
      expect(t.endMiter).toBeDefined();
      expect(t.startBevel).toBeUndefined();
      expect(t.endBevel).toBeUndefined();
    }

    // ── BL corner (0,0): bottom.start (start+start, swap) ↔ left.start ──────────
    close(tBot.startMiter!.outer, 100, 100);    // bottom outer (+y) → interior
    close(tBot.startMiter!.inner, -100, -100);  // bottom inner (−y) → exterior
    close(tLef.startMiter!.outer, -100, -100);  // left outer (−x) → exterior (swapped)
    close(tLef.startMiter!.inner, 100, 100);    // left inner (+x) → interior

    // ── BR corner (4000,0): bottom.end (end+start, no swap) ↔ right.start ──────
    close(tBot.endMiter!.outer, 3900, 100);     // both outer land on interior vertex
    close(tBot.endMiter!.inner, 4100, -100);
    close(tRig.startMiter!.outer, 3900, 100);
    close(tRig.startMiter!.inner, 4100, -100);

    // ── TR corner (4000,3000): top.end (end+end, swap) ↔ right.end ─────────────
    close(tTop.endMiter!.outer, 4100, 3100);    // top outer (+y) → exterior (swapped)
    close(tTop.endMiter!.inner, 3900, 2900);    // top inner (−y) → interior
    close(tRig.endMiter!.outer, 3900, 2900);    // right outer (+...→interior side)
    close(tRig.endMiter!.inner, 4100, 3100);

    // ── TL corner (0,3000): top.start (start+end, no swap) ↔ left.end ──────────
    close(tTop.startMiter!.outer, -100, 3100);
    close(tTop.startMiter!.inner, 100, 2900);
    close(tLef.endMiter!.outer, -100, 3100);
    close(tLef.endMiter!.inner, 100, 2900);

    // Outline-closure invariant: at every corner the two walls must agree on the
    // pair of physical vertices (one wall's outer == the other wall's inner, and
    // vice-versa). Already asserted pointwise above; this documents the property.
  });

  it('23. scene with corner + T-junction: corner gets miter, T-stem gets bevel', () => {
    // A: long horizontal 6000mm (body of T + corner)
    // B: short vertical 3000mm ending at A's midpoint → T-junction
    // C: 3000mm vertical ending at A's right end → corner junction
    const wallA = makeWall({ x: 0, y: 0 }, { x: 6000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 3000, y: 2000 }, { x: 3000, y: 0 }, 200, 'B'); // T-junction
    const wallC = makeWall({ x: 6000, y: 3000 }, { x: 6000, y: 0 }, 200, 'C'); // corner

    const trims = computeWallTrims([wallA, wallB, wallC]);

    // B is T-junction stem → bevel, not miter
    const trimB = trims.get(wallB.id)!;
    expect(trimB.endBevel).toBeDefined();
    expect(trimB.endMiter).toBeUndefined();

    // C meets A's end → corner → miter
    const trimC = trims.get(wallC.id)!;
    expect(trimC.endMiter).toBeDefined();
    expect(trimC.endBevel).toBeUndefined();
  });
});

// ─── Multi-wall (3+) junctions — Revit "primary pair mitres, rest butt" ───────

describe('computeWallTrims — multi-wall junction resolution', () => {
  it('25. REGRESSION: a thin partition joining a clean 2-wall corner does NOT change the thick walls’ miter', () => {
    // Two THICK exterior walls form an L-corner at (0,0) — both start there.
    const thickA = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 300, 'TA');
    const thickB = makeWall({ x: 0, y: 0 }, { x: 0, y: 3000 }, 300, 'TB');
    // Baseline: the 2-wall corner mitres cleanly.
    const before = computeWallTrims([thickA, thickB]);
    const beforeA = before.get(thickA.id)!.startMiter;
    const beforeB = before.get(thickB.id)!.startMiter;
    expect(beforeA).toBeDefined();
    expect(beforeB).toBeDefined();

    // Add a THIN interior partition whose end lands at the SAME corner (3-way junction).
    const thin = makeWall({ x: 0, y: 0 }, { x: 2000, y: 2000 }, 100, 'THIN');
    const after = computeWallTrims([thickA, thickB, thin]);

    // The thick pair keeps the IDENTICAL miter (was overwritten by the thin wall before the fix).
    expect(after.get(thickA.id)!.startMiter).toEqual(beforeA);
    expect(after.get(thickB.id)!.startMiter).toEqual(beforeB);
    // The thin partition BUTTS (bevel), it does NOT miter (no overwrite).
    const trimThin = after.get(thin.id)!;
    expect(trimThin.startBevel).toBeDefined();
    expect(trimThin.startBevel).toBeGreaterThan(0);
    expect(trimThin.startMiter).toBeUndefined();
  });

  it('26. unequal-thickness 2-wall corner → clean geometric miter (not bevel)', () => {
    const thick = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 300, 'UA');
    const thin = makeWall({ x: 0, y: 0 }, { x: 0, y: 3000 }, 100, 'UB');
    const trims = computeWallTrims([thick, thin]);
    expect(trims.get(thick.id)!.startMiter).toBeDefined();
    expect(trims.get(thin.id)!.startMiter).toBeDefined();
    expect(trims.get(thick.id)!.startBevel).toBeUndefined();
    expect(trims.get(thin.id)!.startBevel).toBeUndefined();
  });

  it('27. collinear through-wall + branch: the through pair is left straight, the branch butts', () => {
    // A + B are a single straight run split at (3000,0); C is a thin branch there.
    const runA = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 300, 'RA');
    const runB = makeWall({ x: 3000, y: 0 }, { x: 6000, y: 0 }, 300, 'RB');
    const branch = makeWall({ x: 3000, y: 0 }, { x: 3000, y: 3000 }, 100, 'BR');
    const trims = computeWallTrims([runA, runB, branch]);

    // The collinear primary pair continues straight → no trim on either.
    expect(trims.get(runA.id)).toBeUndefined();
    expect(trims.get(runB.id)).toBeUndefined();
    // The branch butts into the through line (bevel ≈ through half-thickness = 150).
    const trimBranch = trims.get(branch.id)!;
    expect(trimBranch.startBevel).toBeCloseTo(150, 0);
    expect(trimBranch.startMiter).toBeUndefined();
  });
});

// ─── Phase 1L: «Disallow Join» auto square-off (edge-only column corner) ───────

describe('computeWallTrims — Phase 1L «Disallow Join» (edge-only corner)', () => {
  it('28. edge-only face-butt corner (column gap) → NO trim, both walls stay square', () => {
    // Reported bug (screenshot 170820/171048): region-fill produced two walls that
    // touch ONLY through one edge — the horizontal C ends on the vertical A's FACE
    // (and A ends on C's face), with the corner square reserved for a column. They
    // sit ~one half-thickness apart, so the old 200mm-threshold corner classifier
    // wrongly mitred them → an elongated triangular cap punched through A. They must
    // now be left rectangular (square-off).
    //   C horizontal: ends at A's LEFT face (x = 3000 − 100 = 2900)
    //   A vertical:   ends at C's TOP face  (y = 0    + 100 = 100)
    //   endpoint gap = hypot(100,100) ≈ 141mm  >  0.5·min(half)=50mm → square-off
    const wallC = makeWall({ x: 0, y: 0 },       { x: 2900, y: 0 },   200, 'C');
    const wallA = makeWall({ x: 3000, y: 3000 }, { x: 3000, y: 100 }, 200, 'A');

    const trims = computeWallTrims([wallC, wallA]);

    // Neither wall is trimmed — the corner stays open for a column.
    expect(trims.size).toBe(0);
    expect(trims.has(wallC.id)).toBe(false);
    expect(trims.has(wallA.id)).toBe(false);
  });

  it('29. CONTRAST: a near-coincident corner (30mm snapping slop) STILL mitres', () => {
    // The guard must not over-trigger: a genuine L-corner whose endpoints are only
    // slightly apart (30mm < 0.5·half = 50mm) is still treated as a join → miter.
    const wallA = makeWall({ x: 0, y: 0 },       { x: 3000, y: 0 },  200, 'A');
    const wallB = makeWall({ x: 3000, y: 3000 }, { x: 3000, y: 30 }, 200, 'B');

    const trims = computeWallTrims([wallA, wallB]);

    expect(trims.get(wallA.id)?.endMiter).toBeDefined();
    expect(trims.get(wallB.id)?.endMiter).toBeDefined();
  });

  it('31. overshoot bug (171848): auto-join pushed wall end to neighbour CENTRELINE → bevel back to FACE', () => {
    // Reported regression (screenshot 172521): wall 1 (vertical) created first; wall 2
    // region-filled to its left. Phase 1K auto-join extended wall 2's end to wall 1's
    // CENTRELINE (x=3000) because wall 1's body spans wall 2's level. The pair is
    // classified as a corner (wall 1 ends near wall 2), endpoints OFFSET (gap=150) →
    // square-off. Plain "no patch" left wall 2 overshooting to the centre; the
    // penetration bevel must pull it back to wall 1's near face (x=2900).
    const wall1 = makeWall({ x: 3000, y: 3000 }, { x: 3000, y: -150 }, 200, '1'); // spans y=0, ends just below
    const wall2 = makeWall({ x: 0, y: 0 },       { x: 3000, y: 0 },    200, '2'); // end AT wall1 centreline

    const trims = computeWallTrims([wall1, wall2]);

    // wall 2 penetrates wall1 by half1 (100) → bevelled back to the face. No miter.
    const t2 = trims.get(wall2.id)!;
    expect(t2.endMiter).toBeUndefined();
    expect(t2.endBevel).toBeCloseTo(100, 0);
    // wall 1 passes THROUGH wall 2 (ends below it) → not trimmed.
    expect(trims.get(wall1.id)?.endBevel ?? 0).toBeCloseTo(0, 0);
    expect(trims.get(wall1.id)?.endMiter).toBeUndefined();
  });

  it('32. T-junction, stem ends on neighbour FACE (region-fill, no auto-join) → NO over-bevel (no gap)', () => {
    // Phase 1L generalises the T-bevel to penetration-based: a stem whose end sits
    // exactly on the continuing wall's FACE penetrates 0 → no bevel. (The old fixed
    // `halfA/sinA` bevel pulled it BEHIND the face → a gap.) Stem at centreline still
    // bevels by halfA — covered by test 6.
    const horizontal = makeWall({ x: 0, y: 0 },    { x: 6000, y: 0 },   200, 'H'); // half=100, top face y=100
    const stem       = makeWall({ x: 3000, y: 2000 }, { x: 3000, y: 100 }, 200, 'S'); // ends AT top face

    const trims = computeWallTrims([horizontal, stem]);

    // Stem already on the face → no trim, no gap. Horizontal continues untouched.
    expect(trims.get(stem.id)?.endBevel ?? 0).toBeCloseTo(0, 0);
    expect(trims.has(horizontal.id)).toBe(false);
  });

  it('33. crossing wall + two collinear fill walls auto-joined to its centreline → each butts at its FACE', () => {
    // The 173625 bug: a through wall (horizontal) crossed by two collinear fill walls
    // (top + bottom). Phase 1K auto-join pushed BOTH fill ends to the through wall's
    // CENTRELINE. Each fill↔through pair is a T-junction; the penetration-bevel must
    // pull each fill back to the through wall's near face (half=150) → no overshoot.
    const through = makeWall({ x: -2000, y: 0 }, { x: 2000, y: 0 }, 300, 'TH'); // half=150, faces y=±150
    const topFill = makeWall({ x: 0, y: 0 }, { x: 0, y: 2000 },  100, 'TF');    // start auto-joined to centreline
    const botFill = makeWall({ x: 0, y: 0 }, { x: 0, y: -2000 }, 100, 'BF');    // start auto-joined to centreline

    const trims = computeWallTrims([through, topFill, botFill]);

    // Each fill's junction end bevelled by the through half (150) → back to its face.
    expect(trims.get(topFill.id)?.startBevel).toBeCloseTo(150, 0);
    expect(trims.get(botFill.id)?.startBevel).toBeCloseTo(150, 0);
    expect(trims.get(topFill.id)?.startMiter).toBeUndefined();
    expect(trims.get(botFill.id)?.startMiter).toBeUndefined();
    // The through wall continues — not trimmed.
    expect(trims.has(through.id)).toBe(false);
  });

  it('30. REGRESSION: exact-coincident L-corner (gap 0) is unaffected by the guard', () => {
    // Identical to test 3's config — both walls END at (3000,0). gap = 0 → miter.
    const wallA = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 3000, y: 3000 }, { x: 3000, y: 0 }, 200, 'B');

    const trims = computeWallTrims([wallA, wallB]);

    expect(trims.get(wallA.id)?.endMiter).toBeDefined();
    expect(trims.get(wallB.id)?.endMiter).toBeDefined();
    expect(trims.get(wallA.id)?.endBevel).toBeUndefined();
  });
});

