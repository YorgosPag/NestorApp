/**
 * ADR-349 / ADR-620 — stretch-entity-transform RECTANGLE reshape (commit side).
 *
 * Regression (Giorgio 2026-07-18): the «Ορθογώνιο» drawing tool emits a RectangleEntity as
 * `{ corner1, corner2, rotation }` WITH NO `x/y/width/height` (those are typed required but the
 * builder casts). `stretchRectangle` read `entity.x/width` → `undefined → NaN` → a corner-grip
 * drop produced NaN polyline vertices → the rectangle VANISHED. The fix derives the 4 corners via
 * the SSoT `rectangleEntityVertices` (corner1/corner2 OR x/y/w/h + rotation), same order as grips.
 */

import { applyVertexDisplacement } from '../stretch-entity-transform';
import type { Entity } from '../../../types/entities';
import type { VertexRef } from '../stretch-vertex-classifier';

// Freshly-drawn rectangle: corner1(0,0) → corner2(100,60), NO x/y/width/height (like the tool).
const drawnRect = (): Entity =>
  ({ id: 'r', type: 'rectangle', corner1: { x: 0, y: 0 }, corner2: { x: 100, y: 60 }, rotation: 0, visible: true, layerId: 'L' }) as unknown as Entity;

const cornerRef = (index: number): VertexRef => ({ entityId: 'r', kind: 'rectangle-corner', index });

const isFinitePt = (p: { x: number; y: number }): boolean => Number.isFinite(p.x) && Number.isFinite(p.y);

describe('stretchRectangle — corner1/corner2 rectangle (no x/y/w/h)', () => {
  it('partial corner capture → FINITE polyline (was NaN → invisible)', () => {
    const res = applyVertexDisplacement(drawnRect(), [cornerRef(2)], { x: 20, y: 10 });
    expect(res.kind).toBe('replace');
    if (res.kind !== 'replace') return;
    const poly = res.entity as unknown as { type: string; vertices: { x: number; y: number }[]; closed: boolean; id: string };
    expect(poly.type).toBe('polyline');
    expect(poly.closed).toBe(true);
    expect(poly.id).toBe('r'); // id preserved → selection stays valid
    expect(poly.vertices).toHaveLength(4);
    // No NaN anywhere — the original bug produced all-NaN vertices.
    expect(poly.vertices.every(isFinitePt)).toBe(true);
    // Order = rectangleEntityVertices: [c1, (c2.x,c1.y), c2, (c1.x,c2.y)]. Index 2 = corner2 dragged.
    expect(poly.vertices[0]).toEqual({ x: 0, y: 0 });
    expect(poly.vertices[1]).toEqual({ x: 100, y: 0 });
    expect(poly.vertices[2]).toEqual({ x: 120, y: 70 }); // dragged corner2 + delta
    expect(poly.vertices[3]).toEqual({ x: 0, y: 60 });
  });

  it('all 4 corners captured → rigid translate keeps the rectangle (corner1/corner2 shifted)', () => {
    const res = applyVertexDisplacement(drawnRect(), [cornerRef(0), cornerRef(1), cornerRef(2), cornerRef(3)], { x: 5, y: -4 });
    expect(res.kind).toBe('update');
    if (res.kind !== 'update') return;
    const u = res.updates as { corner1: { x: number; y: number }; corner2: { x: number; y: number } };
    expect(u.corner1).toEqual({ x: 5, y: -4 });
    expect(u.corner2).toEqual({ x: 105, y: 56 });
  });
});
