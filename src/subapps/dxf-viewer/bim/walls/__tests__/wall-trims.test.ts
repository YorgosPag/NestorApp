/**
 * ADR-363 Phase 1D-B — `wall-trims` pure geometry tests.
 *
 * Coverage:
 *   computeWallTrims():
 *     1. 90° corner — both walls trimmed by halfThickness
 *     2. Oblique corner (45°) — bevel scales as 1/sin(45°)
 *     3. T-junction — only stem wall trimmed
 *     4. Parallel walls — no intersection, no trim
 *     5. Far-apart walls — intersection outside JOIN_THRESHOLD, no trim
 *     6. Nearly-parallel angle (<15°) — skipped
 *     7. Empty / single wall — no crash, empty map
 *     8. Corner on end+start (A.end meets B.start) — correct endpoint chosen
 *
 *   applyTrimPatches():
 *     9. Patches wall params + recomputes geometry
 *    10. Non-wall entities pass through unchanged
 *    11. Empty trim map → entities array cloned unchanged
 *
 *   wall-geometry bevel integration:
 *    12. startBevel shortens axis at start
 *    13. endBevel shortens axis at end
 *    14. Both bevels shorten both ends
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

  it('3. 90° corner — A.end meets B.start → both walls trimmed by ~halfThickness', () => {
    // A horizontal 3000mm, B vertical 3000mm, meeting at (3000, 0)
    const wallA = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 3000, y: 3000 }, { x: 3000, y: 0 }, 200, 'B');

    const trims = computeWallTrims([wallA, wallB]);

    expect(trims.has(wallA.id)).toBe(true);
    expect(trims.has(wallB.id)).toBe(true);

    const trimA = trims.get(wallA.id)!;
    const trimB = trims.get(wallB.id)!;

    // At 90°: sin=1, bevel = halfThickness / 1 = 100mm
    expect(trimA.endBevel).toBeCloseTo(100, 0);
    expect(trimB.endBevel).toBeCloseTo(100, 0);
    expect(trimA.startBevel).toBeUndefined();
    expect(trimB.startBevel).toBeUndefined();
  });

  it('4. 90° corner — A.start meets B.start → startBevels set for both', () => {
    // A goes right from (1000,0), B goes up from (1000,0)
    const wallA = makeWall({ x: 1000, y: 0 }, { x: 4000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 1000, y: 0 }, { x: 1000, y: 3000 }, 200, 'B');

    const trims = computeWallTrims([wallA, wallB]);

    const trimA = trims.get(wallA.id)!;
    const trimB = trims.get(wallB.id)!;
    expect(trimA.startBevel).toBeCloseTo(100, 0);
    expect(trimB.startBevel).toBeCloseTo(100, 0);
    expect(trimA.endBevel).toBeUndefined();
    expect(trimB.endBevel).toBeUndefined();
  });

  it('5. 45° oblique corner — bevel scales by 1/sin(45°) ≈ √2', () => {
    // A horizontal, B at 45°, meeting at origin (both go away from origin)
    const wallA = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 0, y: 0 }, { x: 2121, y: 2121 }, 200, 'B'); // 45° direction

    const trims = computeWallTrims([wallA, wallB]);
    const trimA = trims.get(wallA.id);
    const trimB = trims.get(wallB.id);

    // halfThickness=100, sin(45°)=√2/2≈0.707 → bevel ≈ 141mm
    expect(trimA?.startBevel ?? trimA?.endBevel).toBeCloseTo(141, -1); // within 10mm
    expect(trimB?.startBevel ?? trimB?.endBevel).toBeCloseTo(141, -1);
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

  it('11. Max bevel clamped to MAX_BEVEL_FRACTION of axis length for very thin long walls', () => {
    // Very short wall B (100mm) at 90° → bevel cannot exceed 40mm (40% of 100)
    const wallA = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 200, 'A');
    const wallB = makeWall({ x: 3000, y: 100 }, { x: 3000, y: 0 }, 200, 'B');

    const trims = computeWallTrims([wallA, wallB]);
    const trimB = trims.get(wallB.id);

    // halfThicknessA = 100, lenB = 100, MAX_BEVEL_FRACTION=0.40 → max 40mm
    if (trimB?.endBevel !== undefined) {
      expect(trimB.endBevel).toBeLessThanOrEqual(40 + 0.1);
    }
  });
});

// ─── applyTrimPatches ─────────────────────────────────────────────────────────

describe('applyTrimPatches', () => {
  it('12. patches wall params and recomputes geometry', () => {
    const wall = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 200);
    const trims = new Map([[wall.id, { endBevel: 100 }]]);

    const result = applyTrimPatches([wall], trims);
    const patched = result[0] as WallEntity;

    expect(patched.params.endBevel).toBe(100);
    // Geometry should reflect the shorter axis
    expect(patched.geometry.length).toBeLessThan(wall.geometry.length);
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
