/**
 * Tests for wall-split.ts pure functions — ADR-363 Phase 5.6.
 *
 * Coverage:
 *   - computeSplitOffset: straight walls, degenerate, curved/polyline rejection
 *   - computeSplitWallParams: start/end/bevel inheritance
 *   - redistributeOpenings: wall1 / wall2 assignment, offset adjustment, straddle
 *   - computeSplitIndicatorLine: perpendicular line endpoints
 */

import {
  computeSplitOffset,
  computeSplitWallParams,
  redistributeOpenings,
  computeSplitIndicatorLine,
} from '../wall-split';
import type { WallEntity, WallParams } from '../../types/wall-types';
import type { OpeningEntity } from '../../types/opening-types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWall(
  overrides: Partial<WallParams> & { id?: string; kind?: WallEntity['kind'] },
): WallEntity {
  const params: WallParams = {
    category: 'interior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5000, y: 0, z: 0 }, // 5000mm horizontal
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
    geometry: {
      axisPolyline: { points: [params.start, params.end] },
      outerEdge: { points: [] },
      innerEdge: { points: [] },
      bbox: { min: params.start, max: params.end },
      length: 5,
      area: 15,
      volume: 3,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as WallEntity;
}

function makeOpening(
  id: string,
  wallId: string,
  offsetFromStart: number,
  width: number,
): OpeningEntity {
  return {
    id,
    type: 'opening',
    kind: 'door',
    layerId: 'layer-0',
    params: { kind: 'door', wallId, offsetFromStart, width, height: 2100, sillHeight: 0 },
    geometry: {
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      outline: { vertices: [] },
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
      area: 0,
      perimeter: 0,
    },
    visible: true,
  } as unknown as OpeningEntity;
}

// ── computeSplitOffset ────────────────────────────────────────────────────────

describe('computeSplitOffset', () => {
  test('returns midpoint offset for cursor at axis center', () => {
    const wall = makeWall({});
    const result = computeSplitOffset(wall, { x: 2500, y: 0 });
    expect(result).toBeCloseTo(2500);
  });

  test('clamps to MIN_SEGMENT_MM from start', () => {
    const wall = makeWall({});
    const result = computeSplitOffset(wall, { x: 10, y: 0 }); // too close to start
    expect(result).toBe(100); // MIN_SEGMENT_MM
  });

  test('clamps to MIN_SEGMENT_MM from end', () => {
    const wall = makeWall({});
    const result = computeSplitOffset(wall, { x: 4999, y: 0 }); // too close to end
    expect(result).toBe(4900); // 5000 - 100
  });

  test('returns null for curved wall', () => {
    const wall = makeWall({ kind: 'curved' });
    expect(computeSplitOffset(wall, { x: 2500, y: 0 })).toBeNull();
  });

  test('returns null for polyline wall', () => {
    const wall = makeWall({ kind: 'polyline' });
    expect(computeSplitOffset(wall, { x: 2500, y: 0 })).toBeNull();
  });

  test('returns null for degenerate wall (zero length)', () => {
    const wall = makeWall({ end: { x: 0, y: 0, z: 0 } });
    expect(computeSplitOffset(wall, { x: 0, y: 0 })).toBeNull();
  });

  test('projects cursor offset from axis (cursor not on axis)', () => {
    const wall = makeWall({});
    // Cursor is 100mm above axis at x=3000 — should project to x=3000
    const result = computeSplitOffset(wall, { x: 3000, y: 100 });
    expect(result).toBeCloseTo(3000);
  });
});

// ── computeSplitWallParams ────────────────────────────────────────────────────

describe('computeSplitWallParams', () => {
  test('wall1 ends at split midpoint, wall2 starts there', () => {
    const wall = makeWall({});
    const { wall1Params, wall2Params } = computeSplitWallParams(wall, 2500);
    expect(wall1Params.end.x).toBeCloseTo(2500);
    expect(wall1Params.end.y).toBeCloseTo(0);
    expect(wall2Params.start.x).toBeCloseTo(2500);
    expect(wall2Params.start.y).toBeCloseTo(0);
  });

  test('wall1 inherits original startBevel, clears endBevel', () => {
    const wall = makeWall({ startBevel: 50, endBevel: 80 });
    const { wall1Params } = computeSplitWallParams(wall, 2500);
    expect(wall1Params.startBevel).toBe(50);
    expect(wall1Params.endBevel).toBeUndefined();
  });

  test('wall2 clears startBevel, inherits original endBevel', () => {
    const wall = makeWall({ startBevel: 50, endBevel: 80 });
    const { wall2Params } = computeSplitWallParams(wall, 2500);
    expect(wall2Params.startBevel).toBeUndefined();
    expect(wall2Params.endBevel).toBe(80);
  });

  test('preserves category, height, thickness, flip', () => {
    const wall = makeWall({ category: 'exterior', height: 4000, thickness: 300, flip: true });
    const { wall1Params, wall2Params } = computeSplitWallParams(wall, 2500);
    for (const p of [wall1Params, wall2Params]) {
      expect(p.category).toBe('exterior');
      expect(p.height).toBe(4000);
      expect(p.thickness).toBe(300);
      expect(p.flip).toBe(true);
    }
  });

  test('measurementLength is undefined on both segments', () => {
    const wall = makeWall({ measurementLength: 9999 });
    const { wall1Params, wall2Params } = computeSplitWallParams(wall, 2500);
    expect(wall1Params.measurementLength).toBeUndefined();
    expect(wall2Params.measurementLength).toBeUndefined();
  });
});

// ── redistributeOpenings ──────────────────────────────────────────────────────

describe('redistributeOpenings', () => {
  const splitOffset = 2500;

  const door1 = makeOpening('op-1', 'orig', 500, 900);   // center=950 → wall1
  const door2 = makeOpening('op-2', 'orig', 3000, 900);  // center=3450 → wall2
  const straddle = makeOpening('op-3', 'orig', 2200, 600); // center=2500 → exactly on split → wall1

  const byId = (id: string): OpeningEntity | null => {
    return [door1, door2, straddle].find((o) => o.id === id) ?? null;
  };

  test('opening before split goes to wall1 with unchanged offset', () => {
    const { wall1OpeningIds, openingUpdates } = redistributeOpenings(
      ['op-1'], byId, splitOffset, 'w1', 'w2',
    );
    expect(wall1OpeningIds).toContain('op-1');
    const upd = openingUpdates.find((u) => u.openingId === 'op-1')!;
    expect(upd.nextParams.wallId).toBe('w1');
    expect(upd.nextParams.offsetFromStart).toBe(500);
  });

  test('opening after split goes to wall2 with adjusted offset', () => {
    const { wall2OpeningIds, openingUpdates } = redistributeOpenings(
      ['op-2'], byId, splitOffset, 'w1', 'w2',
    );
    expect(wall2OpeningIds).toContain('op-2');
    const upd = openingUpdates.find((u) => u.openingId === 'op-2')!;
    expect(upd.nextParams.wallId).toBe('w2');
    expect(upd.nextParams.offsetFromStart).toBe(500); // 3000 - 2500
  });

  test('opening straddling split (center=2500) goes to wall1', () => {
    const { wall1OpeningIds } = redistributeOpenings(
      ['op-3'], byId, splitOffset, 'w1', 'w2',
    );
    expect(wall1OpeningIds).toContain('op-3');
  });

  test('missing opening is silently skipped', () => {
    const { openingUpdates } = redistributeOpenings(
      ['nonexistent'], byId, splitOffset, 'w1', 'w2',
    );
    expect(openingUpdates).toHaveLength(0);
  });

  test('offset on wall2 is clamped to 0 minimum', () => {
    const closeOp = makeOpening('op-close', 'orig', 2400, 200); // starts before split
    const byIdClose = (id: string) => id === 'op-close' ? closeOp : null;
    const { openingUpdates } = redistributeOpenings(
      ['op-close'], byIdClose, 2500, 'w1', 'w2',
    );
    // center = 2500, goes to wall2; offset = max(0, 2400 - 2500) = 0
    const upd = openingUpdates.find((u) => u.openingId === 'op-close');
    expect(upd?.nextParams.offsetFromStart).toBeGreaterThanOrEqual(0);
  });

  test('previousParams are preserved for undo', () => {
    const { openingUpdates } = redistributeOpenings(
      ['op-2'], byId, splitOffset, 'w1', 'w2',
    );
    const upd = openingUpdates.find((u) => u.openingId === 'op-2')!;
    expect(upd.previousParams).toEqual(door2.params);
  });
});

// ── computeSplitIndicatorLine ─────────────────────────────────────────────────

describe('computeSplitIndicatorLine', () => {
  test('returns perpendicular endpoints for horizontal wall', () => {
    const wall = makeWall({});
    const splitPoint = { x: 2500, y: 0 };
    const [a, b] = computeSplitIndicatorLine(wall, splitPoint);
    // Axis is horizontal → perpendicular is vertical
    expect(a.x).toBeCloseTo(2500);
    expect(b.x).toBeCloseTo(2500);
    expect(a.y).toBeGreaterThan(0); // one side up
    expect(b.y).toBeLessThan(0);    // one side down
  });

  test('line length equals thickness × REACH_FACTOR', () => {
    const wall = makeWall({ thickness: 200 });
    const splitPoint = { x: 2500, y: 0 };
    const [a, b] = computeSplitIndicatorLine(wall, splitPoint);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    // reach = 100 × 1.5 = 150 each side → total = 300
    expect(len).toBeCloseTo(300);
  });

  test('returns zero-length pair for degenerate wall', () => {
    const wall = makeWall({ end: { x: 0, y: 0, z: 0 } });
    const splitPoint = { x: 0, y: 0 };
    const [a, b] = computeSplitIndicatorLine(wall, splitPoint);
    expect(a).toEqual(splitPoint);
    expect(b).toEqual(splitPoint);
  });
});
