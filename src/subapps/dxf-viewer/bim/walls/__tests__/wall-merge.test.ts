/**
 * Tests for wall-merge.ts pure functions — ADR-566 (Merge/Join Walls).
 *
 * Coverage:
 *   - canMergeWalls: collinear ok / non-collinear / different-thickness / curved / degenerate
 *   - buildMergedWallParams: union outer-to-outer, gap bridge, overlap, reversed endpoints,
 *     bevel inheritance, primary params win
 *   - collectMergedOpenings: offset recompute from merged start, both walls, wallId patch
 *   - computeMergedGhostAxis: outer endpoints
 */

import {
  canMergeWalls,
  buildMergedWallParams,
  collectMergedOpenings,
  computeMergedGhostAxis,
  classifyWallJoin,
  computeWallCornerJoin,
} from '../wall-merge';
import type { WallEntity, WallParams } from '../../types/wall-types';
import type { OpeningEntity } from '../../types/opening-types';

// ── Helpers (mirror wall-split.test.ts) ───────────────────────────────────────

function makeWall(
  overrides: Partial<WallParams> & { id?: string; kind?: WallEntity['kind']; hostedOpeningIds?: string[] },
): WallEntity {
  const params: WallParams = {
    category: 'interior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5000, y: 0, z: 0 },
    height: 3000,
    thickness: 200,
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    ...overrides,
  };
  return {
    id: overrides.id ?? 'wall-1',
    type: 'wall',
    kind: overrides.kind ?? 'straight',
    layerId: 'layer-0',
    ifcType: 'IfcWallStandardCase',
    params,
    hostedOpeningIds: overrides.hostedOpeningIds ?? [],
    geometry: {
      axisPolyline: { points: [params.start, params.end] },
      outerEdge: { points: [] },
      innerEdge: { points: [] },
      bbox: { min: params.start, max: params.end },
      length: 5, area: 15, volume: 3,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as WallEntity;
}

function makeOpening(id: string, wallId: string, offsetFromStart: number, width: number): OpeningEntity {
  return {
    id, type: 'opening', kind: 'door', layerId: 'layer-0',
    params: { kind: 'door', wallId, offsetFromStart, width, height: 2100, sillHeight: 0 },
    geometry: {
      position: { x: 0, y: 0, z: 0 }, rotation: 0, outline: { vertices: [] },
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } }, area: 0, perimeter: 0,
    },
    visible: true,
  } as unknown as OpeningEntity;
}

// ── canMergeWalls ─────────────────────────────────────────────────────────────

describe('canMergeWalls', () => {
  test('two collinear touching horizontal walls → ok', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 0, z: 0 }, end: { x: 9000, y: 0, z: 0 } });
    expect(canMergeWalls(a, b)).toEqual({ ok: true });
  });

  test('collinear with a gap → still ok (bridge)', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 5200, y: 0, z: 0 }, end: { x: 7000, y: 0, z: 0 } });
    expect(canMergeWalls(a, b)).toEqual({ ok: true });
  });

  test('parallel but offset (not same line) → not-collinear', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 300, z: 0 }, end: { x: 9000, y: 300, z: 0 } });
    expect(canMergeWalls(a, b)).toEqual({ ok: false, reason: 'not-collinear' });
  });

  test('perpendicular walls → not-collinear', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 0, z: 0 }, end: { x: 5000, y: 4000, z: 0 } });
    expect(canMergeWalls(a, b)).toEqual({ ok: false, reason: 'not-collinear' });
  });

  test('different thickness → different-thickness', () => {
    const a = makeWall({ id: 'a', thickness: 200 });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 0, z: 0 }, end: { x: 9000, y: 0, z: 0 }, thickness: 300 });
    expect(canMergeWalls(a, b)).toEqual({ ok: false, reason: 'different-thickness' });
  });

  test('different category (same thickness/line) → ok (primary wins)', () => {
    const a = makeWall({ id: 'a', category: 'exterior' });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 0, z: 0 }, end: { x: 9000, y: 0, z: 0 }, category: 'interior' });
    expect(canMergeWalls(a, b)).toEqual({ ok: true });
  });

  test('curved wall → not-straight', () => {
    const a = makeWall({ id: 'a', kind: 'curved' });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 0, z: 0 }, end: { x: 9000, y: 0, z: 0 } });
    expect(canMergeWalls(a, b)).toEqual({ ok: false, reason: 'not-straight' });
  });

  test('small perpendicular drift within thickness band → ok (visually collinear)', () => {
    // thickness 200 → perp band = max(5, 0.5*200) = 100mm. 50mm drift merges.
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 }, thickness: 200 });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 50, z: 0 }, end: { x: 9000, y: 50, z: 0 }, thickness: 200 });
    expect(canMergeWalls(a, b)).toEqual({ ok: true });
  });

  test('slightly angled but roughly collinear (~2°) → ok', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 }, thickness: 200 });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 0, z: 0 }, end: { x: 8000, y: 100, z: 0 }, thickness: 200 });
    expect(canMergeWalls(a, b)).toEqual({ ok: true });
  });

  test('collinear on a diagonal axis → ok', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 3000, y: 4000, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 3000, y: 4000, z: 0 }, end: { x: 6000, y: 8000, z: 0 } });
    expect(canMergeWalls(a, b)).toEqual({ ok: true });
  });
});

// ── buildMergedWallParams ─────────────────────────────────────────────────────

describe('buildMergedWallParams', () => {
  test('touching walls → span outer-to-outer', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 0, z: 0 }, end: { x: 9000, y: 0, z: 0 } });
    const p = buildMergedWallParams(a, b);
    expect(p.start.x).toBeCloseTo(0);
    expect(p.end.x).toBeCloseTo(9000);
  });

  test('gap between walls → bridged (0 → 7000)', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 5200, y: 0, z: 0 }, end: { x: 7000, y: 0, z: 0 } });
    const p = buildMergedWallParams(a, b);
    expect(p.start.x).toBeCloseTo(0);
    expect(p.end.x).toBeCloseTo(7000);
  });

  test('overlapping walls → span the union extent', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 6000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 4000, y: 0, z: 0 }, end: { x: 9000, y: 0, z: 0 } });
    const p = buildMergedWallParams(a, b);
    expect(p.start.x).toBeCloseTo(0);
    expect(p.end.x).toBeCloseTo(9000);
  });

  test('reversed endpoint order (b runs right→left) → still outer-to-outer', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 9000, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 } });
    const p = buildMergedWallParams(a, b);
    expect(p.start.x).toBeCloseTo(0);
    expect(p.end.x).toBeCloseTo(9000);
  });

  test('primary params win (thickness/category from a)', () => {
    const a = makeWall({ id: 'a', thickness: 200, category: 'exterior', height: 2800 });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 0, z: 0 }, end: { x: 9000, y: 0, z: 0 }, category: 'interior' });
    const p = buildMergedWallParams(a, b);
    expect(p.thickness).toBe(200);
    expect(p.category).toBe('exterior');
    expect(p.height).toBe(2800);
  });

  test('bevel inheritance from outer endpoints; measurementLength cleared', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 }, startBevel: 11, endBevel: 99, measurementLength: 1234 });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 0, z: 0 }, end: { x: 9000, y: 0, z: 0 }, startBevel: 77, endBevel: 22 });
    const p = buildMergedWallParams(a, b);
    // lo endpoint = a.start (bevel 11); hi endpoint = b.end (bevel 22)
    expect(p.startBevel).toBe(11);
    expect(p.endBevel).toBe(22);
    expect(p.measurementLength).toBeUndefined();
  });
});

// ── collectMergedOpenings ─────────────────────────────────────────────────────

describe('collectMergedOpenings', () => {
  test('openings from both walls re-hosted with merged-start offsets', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 }, hostedOpeningIds: ['o1'] });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 0, z: 0 }, end: { x: 9000, y: 0, z: 0 }, hostedOpeningIds: ['o2'] });
    const openings: Record<string, OpeningEntity> = {
      o1: makeOpening('o1', 'a', 1000, 900), // 1000mm from a.start
      o2: makeOpening('o2', 'b', 500, 900),  // 500mm from b.start (=5500 absolute)
    };
    const updates = collectMergedOpenings(a, b, (id) => openings[id] ?? null, 'merged');
    expect(updates).toHaveLength(2);
    const u1 = updates.find((u) => u.openingId === 'o1')!;
    const u2 = updates.find((u) => u.openingId === 'o2')!;
    expect(u1.nextParams.wallId).toBe('merged');
    expect(u1.nextParams.offsetFromStart).toBeCloseTo(1000);
    expect(u2.nextParams.wallId).toBe('merged');
    expect(u2.nextParams.offsetFromStart).toBeCloseTo(5500);
  });

  test('missing opening skipped', () => {
    const a = makeWall({ id: 'a', hostedOpeningIds: ['missing'] });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 0, z: 0 }, end: { x: 9000, y: 0, z: 0 } });
    const updates = collectMergedOpenings(a, b, () => null, 'merged');
    expect(updates).toHaveLength(0);
  });
});

// ── computeMergedGhostAxis ────────────────────────────────────────────────────

describe('computeMergedGhostAxis', () => {
  test('returns the two outer endpoints', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 0, z: 0 }, end: { x: 9000, y: 0, z: 0 } });
    const axis = computeMergedGhostAxis(a, b);
    expect(axis).not.toBeNull();
    expect(axis![0].x).toBeCloseTo(0);
    expect(axis![1].x).toBeCloseTo(9000);
  });
});

// ── classifyWallJoin (ADR-566 §corner-join) ───────────────────────────────────

describe('classifyWallJoin', () => {
  test('collinear pair → collinear merge', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 1000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 3000, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 } });
    expect(classifyWallJoin(a, b)).toEqual({ kind: 'collinear' });
  });

  test('crossing (perpendicular) pair → corner at axis intersection', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 1000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 3000, y: -3000, z: 0 }, end: { x: 3000, y: -6000, z: 0 } });
    const plan = classifyWallJoin(a, b);
    expect(plan.kind).toBe('corner');
    if (plan.kind === 'corner') {
      expect(plan.joinPoint.x).toBeCloseTo(3000);
      expect(plan.joinPoint.y).toBeCloseTo(0);
    }
  });

  test('corner join allows different thickness (walls stay separate)', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 1000, y: 0, z: 0 }, thickness: 200 });
    const b = makeWall({ id: 'b', start: { x: 3000, y: -3000, z: 0 }, end: { x: 3000, y: -6000, z: 0 }, thickness: 350 });
    expect(classifyWallJoin(a, b).kind).toBe('corner');
  });

  test('parallel but offset (no shared corner) → blocked parallel-offset', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 1000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 0, y: 1000, z: 0 }, end: { x: 1000, y: 1000, z: 0 } });
    expect(classifyWallJoin(a, b)).toEqual({ kind: 'blocked', reason: 'parallel-offset' });
  });

  test('curved wall → blocked not-straight', () => {
    const a = makeWall({ id: 'a', kind: 'curved' });
    const b = makeWall({ id: 'b', start: { x: 3000, y: -3000, z: 0 }, end: { x: 3000, y: -6000, z: 0 } });
    expect(classifyWallJoin(a, b)).toEqual({ kind: 'blocked', reason: 'not-straight' });
  });
});

// ── computeWallCornerJoin ─────────────────────────────────────────────────────

describe('computeWallCornerJoin', () => {
  test('Giorgio example: extends both nearest endpoints onto the L-corner', () => {
    // Horizontal 1m wall + vertical wall 3m right / 3m down. Axes meet at (3000, 0).
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 1000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 3000, y: -3000, z: 0 }, end: { x: 3000, y: -6000, z: 0 } });
    const res = computeWallCornerJoin(a, b)!;
    expect(res).not.toBeNull();
    expect(res.joinPoint.x).toBeCloseTo(3000);
    expect(res.joinPoint.y).toBeCloseTo(0);
    // A: nearest endpoint is `end` (1000,0) → moves to corner; start untouched.
    expect(res.wallAParams.start.x).toBeCloseTo(0);
    expect(res.wallAParams.end.x).toBeCloseTo(3000);
    expect(res.wallAParams.end.y).toBeCloseTo(0);
    // B: nearest endpoint is `start` (3000,-3000) → moves to corner; end untouched.
    expect(res.wallBParams.start.x).toBeCloseTo(3000);
    expect(res.wallBParams.start.y).toBeCloseTo(0);
    expect(res.wallBParams.end.y).toBeCloseTo(-6000);
  });

  test('clears miters + measurementLength (framing re-derives)', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 1000, y: 0, z: 0 }, startMiter: 10, endMiter: 20, measurementLength: 999 } as Partial<WallParams>);
    const b = makeWall({ id: 'b', start: { x: 3000, y: -3000, z: 0 }, end: { x: 3000, y: -6000, z: 0 } });
    const res = computeWallCornerJoin(a, b)!;
    expect(res.wallAParams.startMiter).toBeUndefined();
    expect(res.wallAParams.endMiter).toBeUndefined();
    expect(res.wallAParams.measurementLength).toBeUndefined();
  });

  test('parallel axes → null', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 1000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 0, y: 1000, z: 0 }, end: { x: 1000, y: 1000, z: 0 } });
    expect(computeWallCornerJoin(a, b)).toBeNull();
  });
});
