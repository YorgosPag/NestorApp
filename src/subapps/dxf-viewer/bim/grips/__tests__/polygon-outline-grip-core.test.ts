/**
 * SSoT tests for `polygon-outline-grip-core` — the shared emit + edit engine for the
 * five polygon-outline BIM entities (slab / slab-opening / roof / floor-finish /
 * mep-underfloor). Pins the contracts every caller relies on: stable grip order,
 * null = referential no-op, z-preservation, and the injected container/insert seams.
 */

import {
  cloneOutlineVertex,
  outlineEdgeInsertedVertex,
  buildPolygonOutlineGrips,
  moveOutlineVertexInList,
  insertOutlineVertexInList,
  removeOutlineVertexInList,
  applyPolygonOutlineGripDrag,
} from '../polygon-outline-grip-core';
import type { Point3D } from '../../types/bim-base';

const square: Point3D[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('cloneOutlineVertex', () => {
  it('drops z when absent, preserves it when present', () => {
    expect(cloneOutlineVertex({ x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
    expect(cloneOutlineVertex({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 });
  });
});

describe('outlineEdgeInsertedVertex', () => {
  it('is the midpoint offset by delta; z averaged only when either endpoint has one', () => {
    expect(outlineEdgeInsertedVertex({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 2 }))
      .toEqual({ x: 5, y: 2 });
    expect(outlineEdgeInsertedVertex({ x: 0, y: 0, z: 4 }, { x: 10, y: 0 }, { x: 0, y: 0 }))
      .toEqual({ x: 5, y: 0, z: 2 });
  });
});

describe('buildPolygonOutlineGrips', () => {
  it('emits 2N grips: N vertex then N edge-midpoint, in stable index order', () => {
    const grips = buildPolygonOutlineGrips('e1', square, 'slab');
    expect(grips).toHaveLength(8);
    expect(grips.slice(0, 4).map((g) => g.type)).toEqual(['vertex', 'vertex', 'vertex', 'vertex']);
    expect(grips.slice(4).map((g) => g.type)).toEqual(['midpoint', 'midpoint', 'midpoint', 'midpoint']);
    expect(grips.map((g) => g.gripIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(grips[0].gripKind).toEqual({ on: 'slab', kind: 'slab-vertex-0' });
    expect(grips[4].gripKind).toEqual({ on: 'slab', kind: 'slab-edge-midpoint-0' });
    // edge midpoint 0 is between vertex 0 and 1; edgeVertexIndices wraps on the last edge.
    expect(grips[4].position).toEqual({ x: 5, y: 0 });
    expect(grips[4].edgeVertexIndices).toEqual([0, 1]);
    expect(grips[7].edgeVertexIndices).toEqual([3, 0]);
  });

  it('uses the entity `on` as the kind prefix', () => {
    const grips = buildPolygonOutlineGrips('r1', square, 'roof');
    expect(grips[0].gripKind).toEqual({ on: 'roof', kind: 'roof-vertex-0' });
    expect(grips[4].gripKind).toEqual({ on: 'roof', kind: 'roof-edge-midpoint-0' });
  });
});

describe('moveOutlineVertexInList', () => {
  it('translates the target vertex, clones the rest', () => {
    const next = moveOutlineVertexInList(square, 1, { x: 3, y: 4 });
    expect(next).not.toBeNull();
    expect(next![1]).toEqual({ x: 13, y: 4 });
    expect(next![0]).toEqual({ x: 0, y: 0 });
  });
  it('null (no-op) on out-of-range index OR zero delta', () => {
    expect(moveOutlineVertexInList(square, 9, { x: 1, y: 1 })).toBeNull();
    expect(moveOutlineVertexInList(square, 1, { x: 0, y: 0 })).toBeNull();
  });
});

describe('insertOutlineVertexInList', () => {
  it('splices a fresh vertex right after the edge index', () => {
    const next = insertOutlineVertexInList(square, 0, { x: 0, y: -2 });
    expect(next).toHaveLength(5);
    expect(next![1]).toEqual({ x: 5, y: -2 });
  });
  it('null on out-of-range edge index', () => {
    expect(insertOutlineVertexInList(square, 9, { x: 0, y: 0 })).toBeNull();
  });
});

describe('removeOutlineVertexInList', () => {
  it('removes the vertex when above the minimum triangle', () => {
    expect(removeOutlineVertexInList(square, 2)).toEqual([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 },
    ]);
  });
  it('null when the guard trips (<= 3 verts, or out of range)', () => {
    expect(removeOutlineVertexInList(square.slice(0, 3), 0)).toBeNull();
    expect(removeOutlineVertexInList(square, 9)).toBeNull();
    expect(removeOutlineVertexInList(square, -1)).toBeNull();
  });
});

describe('applyPolygonOutlineGripDrag', () => {
  interface Slabish {
    readonly outline: { readonly vertices: Point3D[] };
    readonly tag: string;
  }
  const params: Slabish = { outline: { vertices: square }, tag: 'keep-me' };
  const getVerts = (p: Slabish) => p.outline.vertices;
  const withVerts = (p: Slabish, vertices: Point3D[]): Slabish => ({ ...p, outline: { vertices } });

  it('routes `${on}-vertex-N` → move and preserves the rest of params', () => {
    const out = applyPolygonOutlineGripDrag(
      'slab-vertex-1', 'slab',
      { originalParams: params, delta: { x: 5, y: 0 } },
      getVerts, withVerts,
    );
    expect(out.outline.vertices[1]).toEqual({ x: 15, y: 0 });
    expect(out.tag).toBe('keep-me');
  });

  it('routes `${on}-edge-midpoint-N` → insert', () => {
    const out = applyPolygonOutlineGripDrag(
      'slab-edge-midpoint-0', 'slab',
      { originalParams: params, delta: { x: 0, y: 0 } },
      getVerts, withVerts,
    );
    expect(out.outline.vertices).toHaveLength(5);
  });

  it('returns originalParams REFERENTIALLY unchanged on a no-op (zero-delta move)', () => {
    const out = applyPolygonOutlineGripDrag(
      'slab-vertex-1', 'slab',
      { originalParams: params, delta: { x: 0, y: 0 } },
      getVerts, withVerts,
    );
    expect(out).toBe(params);
  });

  it('applies Ortho quantization when rectilinear', () => {
    const out = applyPolygonOutlineGripDrag(
      'slab-vertex-1', 'slab',
      { originalParams: params, delta: { x: 5, y: 2 }, rectilinear: true },
      getVerts, withVerts,
    );
    // |dx| >= |dy| → dy collapses to 0.
    expect(out.outline.vertices[1]).toEqual({ x: 15, y: 0 });
  });

  it('uses insertOverride for the edge-midpoint branch when supplied (roof edges seam)', () => {
    const override = jest.fn((p: Slabish) => ({ ...p, tag: 'override-ran' }));
    const out = applyPolygonOutlineGripDrag(
      'slab-edge-midpoint-0', 'slab',
      { originalParams: params, delta: { x: 0, y: 1 } },
      getVerts, withVerts, override,
    );
    expect(override).toHaveBeenCalledWith(params, 0, { x: 0, y: 1 });
    expect(out.tag).toBe('override-ran');
  });

  it('ignores an unrecognized grip kind (returns originalParams)', () => {
    const out = applyPolygonOutlineGripDrag(
      'slab-rotation', 'slab',
      { originalParams: params, delta: { x: 5, y: 5 } },
      getVerts, withVerts,
    );
    expect(out).toBe(params);
  });
});
