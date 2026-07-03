/**
 * Tests for the wall-gap auto-opening geometry — ADR-568.
 *
 * Coverage:
 *   - computeWallGap: disjoint gap (both orders) / touch / overlap / containment /
 *     reversed endpoints / vertical / non-zero merged origin / degenerate axis
 *   - buildGapOpeningParams: width = gap, offset from merged start, door ΝΟΚ defaults
 */

import { computeWallGap, MIN_GAP_FOR_OPENING_MM } from '../wall-merge';
import { buildGapOpeningParams, GAP_OPENING_KIND } from '../wall-gap-opening';
import { DEFAULT_FRAME_WIDTH_MM, OPENING_KIND_DEFAULTS } from '../../types/opening-types';
import type { WallEntity, WallParams } from '../../types/wall-types';

// ── Helper (mirror wall-merge.test.ts) ────────────────────────────────────────

function makeWall(
  overrides: Partial<WallParams> & { id?: string; kind?: WallEntity['kind'] },
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
    hostedOpeningIds: [],
    geometry: {
      axisPolyline: { points: [params.start, params.end] },
      outerEdge: { points: [] }, innerEdge: { points: [] },
      bbox: { min: params.start, max: params.end }, length: 5, area: 15, volume: 3,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as WallEntity;
}

// ── computeWallGap ────────────────────────────────────────────────────────────

describe('computeWallGap', () => {
  test('two collinear walls with a gap (B after A) → gap + offset from merged start', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 6000, y: 0, z: 0 }, end: { x: 10000, y: 0, z: 0 } });
    expect(computeWallGap(a, b)).toEqual({ gapMm: 1000, openingOffsetFromMergedStart: 5000 });
  });

  test('gap when A lies after B on the axis → symmetric result', () => {
    const a = makeWall({ id: 'a', start: { x: 6000, y: 0, z: 0 }, end: { x: 10000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 } });
    // merged start = min projection along A's axis (origin at A.start=6000) → B.start = -6000.
    // gap near edge = B.end world 5000 → scalar -1000; offset = -1000 - (-6000) = 5000.
    expect(computeWallGap(a, b)).toEqual({ gapMm: 1000, openingOffsetFromMergedStart: 5000 });
  });

  test('reversed inner endpoints on B still yields the correct gap', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 7000, y: 0, z: 0 }, end: { x: 6000, y: 0, z: 0 } });
    expect(computeWallGap(a, b)).toEqual({ gapMm: 1000, openingOffsetFromMergedStart: 5000 });
  });

  test('non-zero merged origin: offset measured from merged wall start', () => {
    const a = makeWall({ id: 'a', start: { x: -2000, y: 0, z: 0 }, end: { x: 3000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 0, z: 0 }, end: { x: 9000, y: 0, z: 0 } });
    // gap 3000..5000 (world), merged start at world -2000 → offset 5000, gap 2000.
    expect(computeWallGap(a, b)).toEqual({ gapMm: 2000, openingOffsetFromMergedStart: 5000 });
  });

  test('vertical collinear walls with a gap', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 4000, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 0, y: 5500, z: 0 }, end: { x: 0, y: 9000, z: 0 } });
    expect(computeWallGap(a, b)).toEqual({ gapMm: 1500, openingOffsetFromMergedStart: 4000 });
  });

  test('touching walls → null (no empty span)', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 5000, y: 0, z: 0 }, end: { x: 9000, y: 0, z: 0 } });
    expect(computeWallGap(a, b)).toBeNull();
  });

  test('overlapping walls → null', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 3000, y: 0, z: 0 }, end: { x: 8000, y: 0, z: 0 } });
    expect(computeWallGap(a, b)).toBeNull();
  });

  test('containment (B inside A) → null', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 10000, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 3000, y: 0, z: 0 }, end: { x: 6000, y: 0, z: 0 } });
    expect(computeWallGap(a, b)).toBeNull();
  });

  test('degenerate (zero-length) primary axis → null', () => {
    const a = makeWall({ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 0 } });
    const b = makeWall({ id: 'b', start: { x: 6000, y: 0, z: 0 }, end: { x: 10000, y: 0, z: 0 } });
    expect(computeWallGap(a, b)).toBeNull();
  });
});

// ── buildGapOpeningParams ─────────────────────────────────────────────────────

describe('buildGapOpeningParams', () => {
  const gap = { gapMm: 900, openingOffsetFromMergedStart: 5000 } as const;

  test('width = gap, offset = gap offset, door ΝΟΚ defaults, hosted on merged wall', () => {
    const params = buildGapOpeningParams('wall-merged', gap);
    expect(params.kind).toBe('door');
    expect(params.wallId).toBe('wall-merged');
    expect(params.width).toBe(900); // πλάτος = κενό
    expect(params.offsetFromStart).toBe(5000);
    expect(params.height).toBe(OPENING_KIND_DEFAULTS.door.height); // 2100 ΝΟΚ
    expect(params.sillHeight).toBe(OPENING_KIND_DEFAULTS.door.sillHeight); // 0
    expect(params.frameWidth).toBe(DEFAULT_FRAME_WIDTH_MM);
  });

  test('default kind is a door (passage)', () => {
    expect(GAP_OPENING_KIND).toBe('door');
    expect(buildGapOpeningParams('w', gap).handing).toBe('left');
    expect(buildGapOpeningParams('w', gap).openDirection).toBe('inward');
  });

  test('window kind carries a sill (parapet) and no handing', () => {
    const params = buildGapOpeningParams('w', gap, 'window');
    expect(params.sillHeight).toBe(OPENING_KIND_DEFAULTS.window.sillHeight); // 900
    expect(params.handing).toBeUndefined();
  });

  test('MIN_GAP_FOR_OPENING_MM is above the hard opening floor', () => {
    expect(MIN_GAP_FOR_OPENING_MM).toBe(400);
  });
});
