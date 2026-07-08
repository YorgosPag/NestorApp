/**
 * ADR-419 — Floor-finish grips unit tests.
 * Validates grip count, position correctness, vertex drag, and edge-midpoint drag.
 */

import {
  getFloorFinishGrips,
  applyFloorFinishGripDrag,
  removeVertexFromFloorFinish,
} from '../floor-finish-grips';
import type { FloorFinishEntity, FloorFinishParams } from '../../types/floor-finish-types';
import { DEFAULT_FLOOR_FINISH_LAYER_THICKNESS_MM, DEFAULT_FLOOR_FINISH_MATERIAL_ID } from '../../types/floor-finish-types';
import { gripKindOf } from '../../../hooks/grip-kinds';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSquareEntity(side = 1000): FloorFinishEntity {
  return {
    id: 'test-ff-1',
    type: 'floor-finish',
    kind: DEFAULT_FLOOR_FINISH_MATERIAL_ID,
    ifcType: 'IfcCovering',
    params: {
      footprint: {
        vertices: [
          { x: 0, y: 0 },
          { x: side, y: 0 },
          { x: side, y: side },
          { x: 0, y: side },
        ],
      },
      materialId: DEFAULT_FLOOR_FINISH_MATERIAL_ID,
      thicknessMm: DEFAULT_FLOOR_FINISH_LAYER_THICKNESS_MM,
      finishLevel: 0,
    },
    geometry: {
      bbox: { min: { x: 0, y: 0 }, max: { x: side, y: side } },
      area: (side * side) / 1e6,
      perimeter: (4 * side) / 1000,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as FloorFinishEntity;
}

// ─── getFloorFinishGrips ──────────────────────────────────────────────────────

describe('getFloorFinishGrips()', () => {
  it('returns 2N grips for N-vertex polygon (N=4 → 8 grips)', () => {
    const entity = makeSquareEntity();
    const grips = getFloorFinishGrips(entity);
    expect(grips).toHaveLength(8);
  });

  it('first 4 grips are "vertex" type at polygon corners', () => {
    const entity = makeSquareEntity(1000);
    const grips = getFloorFinishGrips(entity);
    const vertexGrips = grips.filter((g) => g.type === 'vertex');
    expect(vertexGrips).toHaveLength(4);
    expect(vertexGrips[0].position).toEqual({ x: 0, y: 0 });
    expect(vertexGrips[1].position).toEqual({ x: 1000, y: 0 });
  });

  it('last 4 grips are "midpoint" type at edge midpoints', () => {
    const entity = makeSquareEntity(1000);
    const grips = getFloorFinishGrips(entity);
    const midGrips = grips.filter((g) => g.type === 'midpoint');
    expect(midGrips).toHaveLength(4);
    // Edge [0,1]: midpoint at (500, 0)
    expect(midGrips[0].position).toEqual({ x: 500, y: 0 });
  });

  it('returns [] for degenerate polygon (< 3 vertices)', () => {
    const entity = {
      ...makeSquareEntity(),
      params: {
        ...makeSquareEntity().params,
        footprint: { vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      },
    } as unknown as FloorFinishEntity;
    expect(getFloorFinishGrips(entity)).toEqual([]);
  });

  it('vertex grips have correct gripKind', () => {
    const entity = makeSquareEntity();
    const grips = getFloorFinishGrips(entity);
    expect(gripKindOf(grips[0], 'floor-finish')).toBe('floor-finish-vertex-0');
    expect(gripKindOf(grips[3], 'floor-finish')).toBe('floor-finish-vertex-3');
  });

  it('midpoint grips have correct gripKind', () => {
    const entity = makeSquareEntity();
    const grips = getFloorFinishGrips(entity);
    expect(gripKindOf(grips[4], 'floor-finish')).toBe('floor-finish-edge-midpoint-0');
    expect(gripKindOf(grips[7], 'floor-finish')).toBe('floor-finish-edge-midpoint-3');
  });
});

// ─── applyFloorFinishGripDrag ─────────────────────────────────────────────────

describe('applyFloorFinishGripDrag()', () => {
  const originalParams = makeSquareEntity(1000).params;

  describe('vertex drag', () => {
    it('moves the target vertex by delta', () => {
      const result = applyFloorFinishGripDrag('floor-finish-vertex-0', {
        originalParams,
        delta: { x: 100, y: 50 },
      });
      const verts = result.footprint.vertices;
      expect(verts[0]).toEqual({ x: 100, y: 50 });
    });

    it('leaves other vertices unchanged', () => {
      const result = applyFloorFinishGripDrag('floor-finish-vertex-0', {
        originalParams,
        delta: { x: 100, y: 50 },
      });
      const verts = result.footprint.vertices;
      expect(verts[1]).toEqual({ x: 1000, y: 0 });
      expect(verts[2]).toEqual({ x: 1000, y: 1000 });
      expect(verts[3]).toEqual({ x: 0, y: 1000 });
    });

    it('returns originalParams when delta is zero', () => {
      const result = applyFloorFinishGripDrag('floor-finish-vertex-1', {
        originalParams,
        delta: { x: 0, y: 0 },
      });
      expect(result).toBe(originalParams);
    });

    it('returns originalParams for out-of-range index', () => {
      const result = applyFloorFinishGripDrag('floor-finish-vertex-99', {
        originalParams,
        delta: { x: 100, y: 100 },
      });
      expect(result).toBe(originalParams);
    });
  });

  describe('edge-midpoint drag (vertex insertion)', () => {
    it('inserts a new vertex between edge endpoints', () => {
      const result = applyFloorFinishGripDrag('floor-finish-edge-midpoint-0', {
        originalParams,
        delta: { x: 0, y: 100 },
      });
      expect(result.footprint.vertices).toHaveLength(5);
    });

    it('new vertex is at midpoint + delta', () => {
      const result = applyFloorFinishGripDrag('floor-finish-edge-midpoint-0', {
        originalParams,
        delta: { x: 0, y: 100 },
      });
      const newVert = result.footprint.vertices[1];
      expect(newVert.x).toBe(500);
      expect(newVert.y).toBe(100);
    });

    it('returns originalParams for out-of-range edge index', () => {
      const result = applyFloorFinishGripDrag('floor-finish-edge-midpoint-99', {
        originalParams,
        delta: { x: 100, y: 100 },
      });
      expect(result).toBe(originalParams);
    });
  });

  describe('rectilinear constraint', () => {
    it('quantizes to dominant X axis when |dx| > |dy|', () => {
      const result = applyFloorFinishGripDrag('floor-finish-vertex-0', {
        originalParams,
        delta: { x: 200, y: 50 },
        rectilinear: true,
      });
      expect(result.footprint.vertices[0].x).toBe(200);
      expect(result.footprint.vertices[0].y).toBe(0);
    });

    it('quantizes to dominant Y axis when |dy| > |dx|', () => {
      const result = applyFloorFinishGripDrag('floor-finish-vertex-0', {
        originalParams,
        delta: { x: 50, y: 200 },
        rectilinear: true,
      });
      expect(result.footprint.vertices[0].x).toBe(0);
      expect(result.footprint.vertices[0].y).toBe(200);
    });
  });

  describe('unknown gripKind', () => {
    it('returns originalParams unchanged', () => {
      const result = applyFloorFinishGripDrag('unknown-grip-kind' as Parameters<typeof applyFloorFinishGripDrag>[0], {
        originalParams,
        delta: { x: 100, y: 100 },
      });
      expect(result).toBe(originalParams);
    });
  });

  // ─── ADR-535 Φ4 — removeVertexFromFloorFinish (mirror removeVertexFromSlab) ─────
  describe('removeVertexFromFloorFinish', () => {
    it('drops the indexed vertex (4 → 3) and preserves the rest', () => {
      const params = makeSquareEntity(1000).params as FloorFinishParams;
      const next = removeVertexFromFloorFinish(params, 1);
      expect(next.footprint.vertices).toHaveLength(3);
      expect(next.footprint.vertices.map((v) => v.x)).toEqual([0, 1000, 0]);
      expect(next.materialId).toBe(params.materialId);
    });

    it('is a no-op at the minimum triangle (≤3 → identity)', () => {
      const tri: FloorFinishParams = {
        ...(makeSquareEntity(1000).params as FloorFinishParams),
        footprint: { vertices: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 500, y: 1000 }] },
      };
      expect(removeVertexFromFloorFinish(tri, 1)).toBe(tri);
    });

    it('is a no-op for an out-of-range index (identity)', () => {
      const params = makeSquareEntity(1000).params as FloorFinishParams;
      expect(removeVertexFromFloorFinish(params, 99)).toBe(params);
    });
  });
});
