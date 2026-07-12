/**
 * ADR-641 Φ4 — behaviour-lock for the vertex ops extracted from `LevelSceneManagerAdapter`
 * (`applyVertexUpdate` / `insertEntityVertex` / `removeEntityVertex` / `getEntityVertices`).
 * These pin the exact per-type semantics the adapter previously inlined, so the extraction is proven
 * behaviour-preserving.
 */

import {
  applyVertexUpdate,
  insertEntityVertex,
  removeEntityVertex,
  getEntityVertices,
} from '../level-scene-vertex-ops';
import type { Entity } from '../../../types/entities';

const mkPolyline = (pts: Array<[number, number]>): Entity =>
  ({ id: 'p', type: 'polyline', layerId: 'l', visible: true, vertices: pts.map(([x, y]) => ({ x, y })) } as unknown as Entity);
const mkLine = (): Entity =>
  ({ id: 'ln', type: 'line', layerId: 'l', visible: true, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as unknown as Entity);
const mkCircle = (): Entity =>
  ({ id: 'c', type: 'circle', layerId: 'l', visible: true, center: { x: 2, y: 3 }, radius: 5 } as unknown as Entity);
const mkRect = (): Entity =>
  ({ id: 'r', type: 'rectangle', layerId: 'l', visible: true, corner1: { x: 0, y: 0 }, corner2: { x: 4, y: 2 } } as unknown as Entity);

describe('applyVertexUpdate (ADR-641)', () => {
  it('moves a polyline vertex', () => {
    const next = applyVertexUpdate(mkPolyline([[0, 0], [1, 1]]), 1, { x: 9, y: 9 });
    expect((next as unknown as { vertices: Array<{ x: number }> }).vertices[1]).toEqual({ x: 9, y: 9 });
  });
  it('moves a line start (0) / end (1)', () => {
    expect((applyVertexUpdate(mkLine(), 0, { x: 5, y: 5 }) as unknown as { start: unknown }).start).toEqual({ x: 5, y: 5 });
    expect((applyVertexUpdate(mkLine(), 1, { x: 6, y: 6 }) as unknown as { end: unknown }).end).toEqual({ x: 6, y: 6 });
  });
  it('moves a circle center (0)', () => {
    expect((applyVertexUpdate(mkCircle(), 0, { x: 7, y: 8 }) as unknown as { center: unknown }).center).toEqual({ x: 7, y: 8 });
  });
  it('returns the SAME reference for an out-of-range / unsupported op', () => {
    const line = mkLine();
    expect(applyVertexUpdate(line, 5, { x: 0, y: 0 })).toBe(line);
    const poly = mkPolyline([[0, 0]]);
    expect(applyVertexUpdate(poly, 9, { x: 0, y: 0 })).toBe(poly);
  });
});

describe('insertEntityVertex / removeEntityVertex (ADR-641)', () => {
  it('inserts a polyline vertex at the index', () => {
    const next = insertEntityVertex(mkPolyline([[0, 0], [2, 2]]), 1, { x: 1, y: 1 });
    expect((next as unknown as { vertices: Array<{ x: number }> }).vertices.map((v) => v.x)).toEqual([0, 1, 2]);
  });
  it('does not insert on a non-polyline (same ref)', () => {
    const line = mkLine();
    expect(insertEntityVertex(line, 0, { x: 0, y: 0 })).toBe(line);
  });
  it('removes a polyline vertex only while >2 remain', () => {
    const next = removeEntityVertex(mkPolyline([[0, 0], [1, 1], [2, 2]]), 1);
    expect((next as unknown as { vertices: Array<{ x: number }> }).vertices.map((v) => v.x)).toEqual([0, 2]);
  });
  it('refuses to drop below 2 vertices (same ref)', () => {
    const poly = mkPolyline([[0, 0], [1, 1]]);
    expect(removeEntityVertex(poly, 0)).toBe(poly);
  });
});

describe('getEntityVertices (ADR-641)', () => {
  it('polyline → vertices, line → [start,end], circle → [center], rect → [c1,c2]', () => {
    expect(getEntityVertices(mkPolyline([[0, 0], [1, 1]]))).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(getEntityVertices(mkLine())).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(getEntityVertices(mkCircle())).toEqual([{ x: 2, y: 3 }]);
    expect(getEntityVertices(mkRect())).toEqual([{ x: 0, y: 0 }, { x: 4, y: 2 }]);
  });
  it('returns undefined for a type without a vertex list', () => {
    const text = { id: 't', type: 'text', layerId: 'l', visible: true } as unknown as Entity;
    expect(getEntityVertices(text)).toBeUndefined();
  });
});
