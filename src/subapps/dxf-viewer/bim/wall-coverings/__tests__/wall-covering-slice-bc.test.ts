/**
 * ADR-511 Slices B + C — wall-covering geometry / pick / room-partition / defaults.
 *
 * Pure unit tests (zero React / canvas). Validate:
 *   - computeWallCoveringStrip: face-strip quad από host τοίχο + span (Slice B render SSoT)
 *   - computeWallCoveringRenderGeometry: cached bbox + outline (selection/hit-test)
 *   - pickWallFaceFromPoint / alongMmOnWall: pick τοίχου+παρειάς + διαμήκης προβολή
 *   - partitionWallByRooms: coveredIntervals ανά IfcSpace → ένα region/δωμάτιο (Slice C)
 *   - wallCoveringLayersForUseType: auto assembly ανά χρήση δωματίου
 */

import {
  computeWallCoveringStrip,
  computeWallCoveringRenderGeometry,
  wallCoveringFaceLine,
  type WallCoveringHost,
} from '../wall-covering-strip-geometry';
import { pickWallFaceFromPoint, alongMmOnWall } from '../wall-covering-pick';
import { partitionWallByRooms, type RoomSpaceLike } from '../wall-covering-room-partition';
import { wallCoveringLayersForUseType } from '../wall-covering-room-defaults';
import { DEFAULT_WALL_COVERING_LAYERS } from '../../types/wall-covering-types';

// ── Test fixtures ─────────────────────────────────────────────────────────────

/** Ευθύς τοίχος μήκους 1000mm στον άξονα X, πάχος 200 (inner y=-100, outer y=+100). */
function straightWall(id = 'wall-1'): WallCoveringHost {
  return {
    id,
    geometry: {
      axisPolyline: { points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] },
      outerEdge: { points: [{ x: 0, y: 100 }, { x: 1000, y: 100 }] },
      innerEdge: { points: [{ x: 0, y: -100 }, { x: 1000, y: -100 }] },
    },
    params: { thickness: 200 },
  };
}

function rectSpace(id: string, useType: RoomSpaceLike['params']['useType'], x0: number, x1: number): RoomSpaceLike {
  return {
    id,
    params: {
      useType,
      footprint: {
        vertices: [
          { x: x0, y: 50 },
          { x: x1, y: 50 },
          { x: x1, y: 150 },
          { x: x0, y: 150 },
        ],
      },
    },
  };
}

// ── computeWallCoveringStrip ──────────────────────────────────────────────────

describe('computeWallCoveringStrip', () => {
  it('builds an outward strip quad on the outer face for the given span', () => {
    const strip = computeWallCoveringStrip(straightWall(), {
      faceSide: 'outer',
      spanStartMm: 200,
      spanEndMm: 600,
      layers: DEFAULT_WALL_COVERING_LAYERS, // plaster 20 + paint 0 → width clamps to min 25
      sceneUnits: 'mm',
    });
    expect(strip).not.toBeNull();
    expect(strip!.faceStart).toEqual({ x: 200, y: 100 });
    expect(strip!.faceEnd).toEqual({ x: 600, y: 100 });
    // outward points away from the axis (+y for the outer face).
    expect(strip!.outward.y).toBeGreaterThan(0);
    expect(strip!.widthScene).toBe(25);
    // quad = faceStart → faceEnd → faceEnd+offset → faceStart+offset.
    expect(strip!.quad[2]).toEqual({ x: 600, y: 125 });
    expect(strip!.quad[3]).toEqual({ x: 200, y: 125 });
  });

  it('orients the strip toward the inner side for the inner face', () => {
    const strip = computeWallCoveringStrip(straightWall(), {
      faceSide: 'inner',
      spanStartMm: 0,
      spanEndMm: 1000,
      layers: DEFAULT_WALL_COVERING_LAYERS,
      sceneUnits: 'mm',
    });
    expect(strip!.faceStart).toEqual({ x: 0, y: -100 });
    expect(strip!.outward.y).toBeLessThan(0);
  });

  it('clamps the span to the face length', () => {
    const strip = computeWallCoveringStrip(straightWall(), {
      faceSide: 'outer',
      spanStartMm: -500,
      spanEndMm: 5000,
      layers: DEFAULT_WALL_COVERING_LAYERS,
      sceneUnits: 'mm',
    });
    expect(strip!.faceStart.x).toBe(0);
    expect(strip!.faceEnd.x).toBe(1000);
  });

  it('returns null when wall geometry is missing', () => {
    const bare: WallCoveringHost = { id: 'x' };
    expect(
      computeWallCoveringStrip(bare, { faceSide: 'outer', spanStartMm: 0, spanEndMm: 100, layers: [], sceneUnits: 'mm' }),
    ).toBeNull();
  });
});

// ── computeWallCoveringRenderGeometry ─────────────────────────────────────────

describe('computeWallCoveringRenderGeometry', () => {
  it('produces a 4-point outline + bbox from the host wall', () => {
    const geom = computeWallCoveringRenderGeometry(straightWall(), {
      faceSide: 'outer',
      spanStartMm: 200,
      spanEndMm: 600,
      layers: DEFAULT_WALL_COVERING_LAYERS,
      sceneUnits: 'mm',
    });
    expect(geom.outline).toHaveLength(4);
    expect(geom.bbox).toEqual({ min: { x: 200, y: 100, z: 0 }, max: { x: 600, y: 125, z: 0 } });
  });
});

// ── wallCoveringFaceLine ──────────────────────────────────────────────────────

describe('wallCoveringFaceLine', () => {
  it('returns the chosen edge endpoints', () => {
    expect(wallCoveringFaceLine(straightWall(), 'outer')).toEqual({ a: { x: 0, y: 100 }, b: { x: 1000, y: 100 } });
    expect(wallCoveringFaceLine(straightWall(), 'inner')).toEqual({ a: { x: 0, y: -100 }, b: { x: 1000, y: -100 } });
  });
});

// ── pickWallFaceFromPoint / alongMmOnWall ─────────────────────────────────────

describe('pickWallFaceFromPoint', () => {
  it('picks the outer face + along position for a click on the outer side', () => {
    const pick = pickWallFaceFromPoint({ x: 300, y: 100 }, [straightWall()]);
    expect(pick).not.toBeNull();
    expect(pick!.faceSide).toBe('outer');
    expect(pick!.alongMm).toBeCloseTo(300, 3);
    expect(pick!.axisLengthMm).toBeCloseTo(1000, 3);
  });

  it('picks the inner face for a click on the inner side', () => {
    const pick = pickWallFaceFromPoint({ x: 500, y: -90 }, [straightWall()]);
    expect(pick!.faceSide).toBe('inner');
  });

  it('returns null when the point is far from any wall', () => {
    expect(pickWallFaceFromPoint({ x: 500, y: 5000 }, [straightWall()])).toBeNull();
  });
});

describe('alongMmOnWall', () => {
  it('projects a point onto the wall axis (clamped to [0,L])', () => {
    expect(alongMmOnWall(straightWall(), { x: 250, y: 80 })).toBeCloseTo(250, 3);
    expect(alongMmOnWall(straightWall(), { x: -300, y: 0 })).toBe(0);
    expect(alongMmOnWall(straightWall(), { x: 9000, y: 0 })).toBeCloseTo(1000, 3);
  });
});

// ── partitionWallByRooms (Slice C «το μαγικό») ────────────────────────────────

describe('partitionWallByRooms', () => {
  it('splits the wall face into one region per room (boundaries follow rooms)', () => {
    const wall = straightWall();
    const spaces = [
      rectSpace('room-a', 'bathroom', 0, 400),
      rectSpace('room-b', 'bedroom', 400, 900),
    ];
    const regions = partitionWallByRooms(wall, 'outer', spaces);
    expect(regions).toHaveLength(2);
    expect(regions[0]).toMatchObject({ spaceId: 'room-a', useType: 'bathroom' });
    expect(regions[0].spanStartMm).toBeCloseTo(0, 1);
    expect(regions[0].spanEndMm).toBeCloseTo(400, 1);
    expect(regions[1]).toMatchObject({ spaceId: 'room-b', useType: 'bedroom' });
    expect(regions[1].spanStartMm).toBeCloseTo(400, 1);
    expect(regions[1].spanEndMm).toBeCloseTo(900, 1);
  });

  it('skips rooms that do not touch the face', () => {
    const wall = straightWall();
    const far = rectSpace('room-far', 'office', 2000, 2400);
    expect(partitionWallByRooms(wall, 'outer', [far])).toHaveLength(0);
  });

  it('returns empty when wall geometry is missing', () => {
    expect(partitionWallByRooms({ id: 'x' }, 'outer', [rectSpace('r', 'generic', 0, 400)])).toHaveLength(0);
  });
});

// ── wallCoveringLayersForUseType ──────────────────────────────────────────────

describe('wallCoveringLayersForUseType', () => {
  it('proposes tiles for wet rooms', () => {
    const bath = wallCoveringLayersForUseType('bathroom');
    expect(bath.some((l) => l.materialId === 'tile-ceramic')).toBe(true);
    expect(wallCoveringLayersForUseType('wc')).toEqual(bath);
  });

  it('proposes plaster + tile for the kitchen', () => {
    const kitchen = wallCoveringLayersForUseType('kitchen');
    expect(kitchen.some((l) => l.materialId === 'plaster-traditional')).toBe(true);
    expect(kitchen.some((l) => l.materialId === 'tile-ceramic')).toBe(true);
  });

  it('falls back to the default assembly for dry / generic rooms', () => {
    expect(wallCoveringLayersForUseType('bedroom')).toEqual(DEFAULT_WALL_COVERING_LAYERS);
    expect(wallCoveringLayersForUseType('generic')).toEqual(DEFAULT_WALL_COVERING_LAYERS);
  });
});
