/**
 * ADR-417 Φ1-part-2 #2 — `roof-grips` pure handlers tests.
 *
 * Coverage:
 *   - `getRoofGrips()` returns `2N` grips per footprint polygon (N vertex +
 *     N edge-midpoint), stable index order, positions = outline + edge midpoints.
 *   - `getRoofGrips()` returns empty array for degenerate polygons (<3 vertices).
 *   - `applyRoofGripDrag()`:
 *       · `roof-vertex-N`        → translates the indexed vertex (XY, z preserved),
 *                                   `edges` count + content UNCHANGED.
 *       · `roof-edge-midpoint-N` → inserts a fresh vertex at edge midpoint + delta;
 *                                   vertices length+1 AND edges length+1, the new
 *                                   edge is a COPY of the split edge (lockstep).
 *       · `rectilinear=true`     → quantizes delta to the dominant world axis.
 *       · ignores unknown grip kinds + out-of-range index (identity return).
 *   - `removeVertexFromRoof()`:
 *       · removes vertex AND its parallel edge (lockstep, length-1 each).
 *       · guards `vertices.length <= 3` (minimum triangle, identity return).
 *
 * 🔑 The lockstep invariant (`edges.length === outline.vertices.length`) is the
 * contract `UpdateRoofParamsCommand.validate()` enforces — every mutating op is
 * asserted against it so a regression that desyncs the arrays fails here, not
 * silently at command dispatch.
 */

import { applyRoofGripDrag, getRoofGrips, removeVertexFromRoof } from '../roof-grips';
import { applyRoofShapePreset } from '../../geometry/roof-geometry';
import type { Point3D, Polygon3D } from '../../types/bim-base';
import type { RoofEntity, RoofParams } from '../../types/roof-types';

const RECT: Point3D[] = [
  { x: 0, y: 0, z: 0 },
  { x: 4000, y: 0, z: 0 },
  { x: 4000, y: 3000, z: 0 },
  { x: 0, y: 3000, z: 0 },
];

function makeParams(verts: Point3D[] = RECT, shape: 'flat' | 'mono-pitch' | 'gable' = 'gable'): RoofParams {
  const outline: Polygon3D = { vertices: verts };
  return {
    outline,
    edges: applyRoofShapePreset(outline, shape, 30, 'deg'),
    slopeUnit: 'deg',
    basePivotZ: 3000,
    thickness: 200,
    sceneUnits: 'mm',
  };
}

function makeRoof(verts: Point3D[] = RECT): RoofEntity {
  return { id: 'roof-1', type: 'roof', params: makeParams(verts) } as unknown as RoofEntity;
}

/** The invariant the command validates — asserted after every mutation. */
function expectLockstep(params: RoofParams): void {
  expect(params.edges.length).toBe(params.outline.vertices.length);
}

describe('roof-grips (ADR-417 Φ1-part-2 #2)', () => {
  // ─── getRoofGrips ──────────────────────────────────────────────────────────

  it('1. rectangle roof → 4 vertex + 4 edge-midpoint grips in stable order', () => {
    const grips = getRoofGrips(makeRoof());
    expect(grips).toHaveLength(8);
    expect(grips.map((g) => g.roofGripKind)).toEqual([
      'roof-vertex-0',
      'roof-vertex-1',
      'roof-vertex-2',
      'roof-vertex-3',
      'roof-edge-midpoint-0',
      'roof-edge-midpoint-1',
      'roof-edge-midpoint-2',
      'roof-edge-midpoint-3',
    ]);
  });

  it('2. vertex grip positions match footprint vertices; midpoints are edge centres', () => {
    const grips = getRoofGrips(makeRoof());
    expect(grips[0].position).toEqual({ x: 0, y: 0 });
    expect(grips[2].position).toEqual({ x: 4000, y: 3000 });
    // edge-midpoint-0 = midpoint of (0,0)→(4000,0)
    expect(grips[4].position).toEqual({ x: 2000, y: 0 });
    expect(grips[4].type).toBe('midpoint');
    expect(grips[0].type).toBe('vertex');
  });

  it('3. degenerate polygon (<3 vertices) → no grips', () => {
    const roof = makeRoof([{ x: 0, y: 0 }, { x: 1000, y: 0 }] as Point3D[]);
    expect(getRoofGrips(roof)).toHaveLength(0);
  });

  // ─── applyRoofGripDrag — move vertex ────────────────────────────────────────

  it('4. roof-vertex-N translates the indexed vertex; edges UNCHANGED (lockstep)', () => {
    const params = makeParams();
    const next = applyRoofGripDrag('roof-vertex-1', { originalParams: params, delta: { x: 500, y: -200 } });
    expect(next.outline.vertices[1]).toEqual({ x: 4500, y: -200, z: 0 });
    // others untouched
    expect(next.outline.vertices[0]).toEqual({ x: 0, y: 0, z: 0 });
    // edges identical in count AND content (vertex move never touches slopes)
    expect(next.edges).toEqual(params.edges);
    expectLockstep(next);
  });

  it('5. roof-vertex move with zero delta → identity (no-op short-circuit)', () => {
    const params = makeParams();
    const next = applyRoofGripDrag('roof-vertex-0', { originalParams: params, delta: { x: 0, y: 0 } });
    expect(next).toBe(params);
  });

  it('6. roof-vertex out-of-range index → identity', () => {
    const params = makeParams();
    const next = applyRoofGripDrag('roof-vertex-99', { originalParams: params, delta: { x: 1, y: 1 } });
    expect(next).toBe(params);
  });

  it('7. rectilinear=true quantizes delta to the dominant axis', () => {
    const params = makeParams();
    // |dx| > |dy| → keep dx, drop dy
    const horiz = applyRoofGripDrag('roof-vertex-1', { originalParams: params, delta: { x: 500, y: 120 }, rectilinear: true });
    expect(horiz.outline.vertices[1]).toEqual({ x: 4500, y: 0, z: 0 });
    // |dy| > |dx| → keep dy, drop dx
    const vert = applyRoofGripDrag('roof-vertex-1', { originalParams: params, delta: { x: 80, y: 600 }, rectilinear: true });
    expect(vert.outline.vertices[1]).toEqual({ x: 4000, y: 600, z: 0 });
  });

  // ─── applyRoofGripDrag — insert vertex ──────────────────────────────────────

  it('8. roof-edge-midpoint-N inserts a vertex AND a copied edge (lockstep length+1)', () => {
    const params = makeParams();
    const before = params.outline.vertices.length;
    const next = applyRoofGripDrag('roof-edge-midpoint-0', { originalParams: params, delta: { x: 0, y: -300 } });
    expect(next.outline.vertices).toHaveLength(before + 1);
    expect(next.edges).toHaveLength(before + 1);
    expectLockstep(next);
    // inserted vertex sits at index 1 = midpoint(v0,v1) + delta
    expect(next.outline.vertices[1]).toEqual({ x: 2000, y: -300, z: 0 });
    // the new edge (index 1) is a COPY of the split edge (index 0)
    expect(next.edges[1]).toEqual(params.edges[0]);
    expect(next.edges[1]).not.toBe(params.edges[0]); // fresh object, not aliased
  });

  it('9. insert preserves the surrounding edges (slopes intact around the split)', () => {
    const params = makeParams();
    const next = applyRoofGripDrag('roof-edge-midpoint-1', { originalParams: params, delta: { x: 100, y: 0 } });
    // edges before the split index are unchanged
    expect(next.edges[0]).toEqual(params.edges[0]);
    expect(next.edges[1]).toEqual(params.edges[1]);
    // duplicated edge at split+1 mirrors edges[1]
    expect(next.edges[2]).toEqual(params.edges[1]);
  });

  // ─── removeVertexFromRoof ───────────────────────────────────────────────────

  it('10. removeVertexFromRoof drops vertex AND its parallel edge (lockstep length-1)', () => {
    // 5-gon so we are above the triangle floor.
    const penta: Point3D[] = [...RECT, { x: 2000, y: 4000, z: 0 }];
    const params = makeParams(penta);
    const next = removeVertexFromRoof(params, 2);
    expect(next.outline.vertices).toHaveLength(4);
    expect(next.edges).toHaveLength(4);
    expectLockstep(next);
    // vertex 2 (4000,3000) is gone
    expect(next.outline.vertices.some((v) => v.x === 4000 && v.y === 3000)).toBe(false);
  });

  it('11. removeVertexFromRoof guards the minimum triangle (length<=3 → identity)', () => {
    const tri: Point3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 4000, y: 0, z: 0 },
      { x: 2000, y: 3000, z: 0 },
    ];
    const params = makeParams(tri);
    expect(removeVertexFromRoof(params, 1)).toBe(params);
  });

  it('12. removeVertexFromRoof out-of-range index → identity', () => {
    const penta: Point3D[] = [...RECT, { x: 2000, y: 4000, z: 0 }];
    const params = makeParams(penta);
    expect(removeVertexFromRoof(params, 99)).toBe(params);
  });
});
