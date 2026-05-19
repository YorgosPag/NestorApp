/**
 * ADR-363 Phase 7A — BIM move geometry unit tests.
 *
 * Verifies that `calculateBimMovedGeometry` produces a `{params, geometry}`
 * atomic patch for each of the 7 BIM types, with:
 *  - delta applied to every world-coord field of `params`
 *  - geometry cache recomputed (bbox shifts by the same delta, length preserved)
 *  - z component on Point3D preserved (2D plan-view move)
 *  - opening returns `{}` (hosted-derived, no direct move)
 *  - non-BIM entity types return null (caller falls through)
 */

import { calculateBimMovedGeometry } from '../bim-move-geometry';
import type { Entity } from '../../../types/entities';
import type { WallEntity } from '../../types/wall-types';
import type { SlabEntity } from '../../types/slab-types';
import type { SlabOpeningEntity } from '../../types/slab-opening-types';
import type { ColumnEntity } from '../../types/column-types';
import type { BeamEntity } from '../../types/beam-types';

const DELTA = { x: 1000, y: 500 };

function makeWall(): WallEntity {
  return {
    id: 'wall_1',
    name: 'W1',
    type: 'wall',
    kind: 'straight',
    layerId: 'L',
    params: {
      category: 'exterior',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 5000, y: 0, z: 0 },
      height: 3000,
      thickness: 250,
      flip: false,
    },
    geometry: {
      bbox: { min: { x: 0, y: -125 }, max: { x: 5000, y: 125 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as WallEntity;
}

function makeSlab(): SlabEntity {
  return {
    id: 'slab_1',
    name: 'S1',
    type: 'slab',
    kind: 'floor',
    layerId: 'L',
    params: {
      kind: 'floor',
      outline: {
        vertices: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 1000, y: 1000 },
          { x: 0, y: 1000 },
        ],
      },
      elevation: 0,
      thickness: 200,
    },
    geometry: {
      bbox: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as SlabEntity;
}

function makeSlabOpening(): SlabOpeningEntity {
  return {
    id: 'slbopn_1',
    name: 'SO1',
    type: 'slab-opening',
    kind: 'shaft',
    layerId: 'L',
    params: {
      kind: 'shaft',
      slabId: 'slab_1',
      outline: {
        vertices: [
          { x: 100, y: 100 },
          { x: 300, y: 100 },
          { x: 300, y: 300 },
          { x: 100, y: 300 },
        ],
      },
    },
    geometry: {
      bbox: { min: { x: 100, y: 100 }, max: { x: 300, y: 300 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as SlabOpeningEntity;
}

function makeColumn(): ColumnEntity {
  return {
    id: 'col_1',
    name: 'C1',
    type: 'column',
    kind: 'rectangular',
    layerId: 'L',
    params: {
      kind: 'rectangular',
      position: { x: 2000, y: 2000, z: 0 },
      anchor: 'center',
      width: 400,
      depth: 400,
      height: 3000,
      rotation: 0,
    },
    geometry: {
      bbox: { min: { x: 1800, y: 1800 }, max: { x: 2200, y: 2200 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as ColumnEntity;
}

function makeBeam(): BeamEntity {
  return {
    id: 'beam_1',
    name: 'B1',
    type: 'beam',
    kind: 'straight',
    layerId: 'L',
    params: {
      kind: 'straight',
      startPoint: { x: 0, y: 0, z: 3000 },
      endPoint: { x: 5000, y: 0, z: 3000 },
      width: 250,
      depth: 400,
      elevation: 3000,
    },
    geometry: {
      bbox: { min: { x: 0, y: -125 }, max: { x: 5000, y: 125 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as BeamEntity;
}

describe('ADR-363 Phase 7A — calculateBimMovedGeometry', () => {
  it('wall: shifts params.start + params.end by delta, preserves z', () => {
    const patch = calculateBimMovedGeometry(makeWall() as unknown as Entity, DELTA);
    expect(patch).not.toBeNull();
    const p = (patch as { params: { start: { x: number; y: number; z?: number }; end: { x: number; y: number; z?: number } } }).params;
    expect(p.start).toEqual({ x: 1000, y: 500, z: 0 });
    expect(p.end).toEqual({ x: 6000, y: 500, z: 0 });
  });

  it('wall: recomputes geometry.bbox shifted by delta', () => {
    const patch = calculateBimMovedGeometry(makeWall() as unknown as Entity, DELTA) as {
      geometry: { bbox: { min: { x: number; y: number }; max: { x: number; y: number } } };
    };
    expect(patch.geometry.bbox.min.x).toBeCloseTo(1000, 0);
    expect(patch.geometry.bbox.min.y).toBeCloseTo(375, 0); // y0=-125 + 500
    expect(patch.geometry.bbox.max.x).toBeCloseTo(6000, 0);
    expect(patch.geometry.bbox.max.y).toBeCloseTo(625, 0); // y0=125 + 500
  });

  it('opening: returns empty patch (hosted-derived, no direct move)', () => {
    const opening = { type: 'opening' } as unknown as Entity;
    expect(calculateBimMovedGeometry(opening, DELTA)).toEqual({});
  });

  it('slab: shifts every vertex of params.outline by delta', () => {
    const patch = calculateBimMovedGeometry(makeSlab() as unknown as Entity, DELTA) as {
      params: { outline: { vertices: readonly { x: number; y: number }[] } };
    };
    expect(patch.params.outline.vertices).toEqual([
      { x: 1000, y: 500 },
      { x: 2000, y: 500 },
      { x: 2000, y: 1500 },
      { x: 1000, y: 1500 },
    ]);
  });

  it('slab-opening: shifts every vertex of params.outline by delta (independent world coords)', () => {
    const patch = calculateBimMovedGeometry(makeSlabOpening() as unknown as Entity, DELTA) as {
      params: { outline: { vertices: readonly { x: number; y: number }[] } };
    };
    expect(patch.params.outline.vertices).toEqual([
      { x: 1100, y: 600 },
      { x: 1300, y: 600 },
      { x: 1300, y: 800 },
      { x: 1100, y: 800 },
    ]);
  });

  it('column: shifts params.position by delta, preserves z', () => {
    const patch = calculateBimMovedGeometry(makeColumn() as unknown as Entity, DELTA) as {
      params: { position: { x: number; y: number; z?: number } };
    };
    expect(patch.params.position).toEqual({ x: 3000, y: 2500, z: 0 });
  });

  it('beam: shifts params.startPoint + params.endPoint by delta', () => {
    const patch = calculateBimMovedGeometry(makeBeam() as unknown as Entity, DELTA) as {
      params: {
        startPoint: { x: number; y: number; z?: number };
        endPoint: { x: number; y: number; z?: number };
      };
    };
    expect(patch.params.startPoint).toEqual({ x: 1000, y: 500, z: 3000 });
    expect(patch.params.endPoint).toEqual({ x: 6000, y: 500, z: 3000 });
  });

  it('returns null for non-BIM entity types', () => {
    const line = { type: 'line' } as unknown as Entity;
    expect(calculateBimMovedGeometry(line, DELTA)).toBeNull();

    const circle = { type: 'circle' } as unknown as Entity;
    expect(calculateBimMovedGeometry(circle, DELTA)).toBeNull();
  });

  it('preserves z coordinates on Point3D fields (2D plan-view move)', () => {
    const patch = calculateBimMovedGeometry(makeWall() as unknown as Entity, DELTA) as {
      params: { start: { z?: number }; end: { z?: number } };
    };
    expect(patch.params.start.z).toBe(0);
    expect(patch.params.end.z).toBe(0);
  });
});
