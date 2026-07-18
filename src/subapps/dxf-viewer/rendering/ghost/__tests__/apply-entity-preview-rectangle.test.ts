/**
 * ADR-620/561/349 — RECTANGLE drag-preview parity with polyline (ghost side).
 *
 * The «Ορθογώνιο» tool emits a RectangleEntity `{ corner1, corner2 }` (no x/y/w/h). The preview
 * SSoT (`applyEntityPreview`) + the ghost model builder are keyed on `'polyline'` and callers pass
 * the RAW scene entity — so a corner-grip drag on a drawn rectangle matched NO branch → the ghost
 * never appeared (Giorgio 2026-07-18). `normalizePreviewEntity` now maps `rectangle`→`polyline` with
 * the SAME `rectangleEntityVertices` order the grips + commit use, so preview ≡ commit.
 */

import { applyEntityPreview } from '../apply-entity-preview';
import { normalizePreviewEntity } from '../normalize-preview-entity';
import type { EntityPreviewTransform } from '../entity-preview-types';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

// Freshly-drawn rectangle: corner1(0,0) → corner2(100,60), NO x/y/width/height.
function makeDrawnRect(): DxfEntityUnion {
  return {
    id: 'r1', type: 'rectangle',
    corner1: { x: 0, y: 0 }, corner2: { x: 100, y: 60 }, rotation: 0,
  } as unknown as DxfEntityUnion;
}

type PolyGhost = { type: string; vertices: { x: number; y: number }[]; closed?: boolean };

describe('normalizePreviewEntity — rectangle → polyline (ADR-620)', () => {
  it('maps a drawn rectangle (corner1/corner2) to a closed 4-vertex polyline', () => {
    const rect = makeDrawnRect();
    const norm = normalizePreviewEntity(rect) as unknown as PolyGhost;
    expect(norm.type).toBe('polyline');
    expect(norm.closed).toBe(true);
    expect(norm.vertices).toHaveLength(4);
    // rectangleEntityVertices order: [c1, (c2.x,c1.y), c2, (c1.x,c2.y)].
    expect(norm.vertices).toEqual([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 },
    ]);
    expect(norm).not.toBe(rect);
    expect((rect as unknown as PolyGhost).type).toBe('rectangle'); // original untouched
  });

  it('keeps a degenerate rectangle (no corners, no x/y/w/h → NaN) as-is (no ghost)', () => {
    const bad = { id: 'r2', type: 'rectangle' } as unknown as DxfEntityUnion;
    expect(normalizePreviewEntity(bad)).toBe(bad);
  });
});

describe('applyEntityPreview on a normalized rectangle → real ghost (transformed !== entity)', () => {
  it('CORNER reshape moves the dragged corner (was a no-op → no ghost for a raw rectangle)', () => {
    const entity = normalizePreviewEntity(makeDrawnRect());
    // Grip index 2 = corner2 (rectangleEntityVertices order), dragged by (20,10).
    const preview: EntityPreviewTransform = { entityId: 'r1', gripIndex: 2, delta: { x: 20, y: 10 } };
    const g = applyEntityPreview(entity, preview) as unknown as PolyGhost;
    expect(g).not.toBe(entity); // a ghost IS produced now
    expect(g.vertices[2]).toEqual({ x: 120, y: 70 }); // dragged corner
    expect(g.vertices[0]).toEqual({ x: 0, y: 0 });     // opposite corners fixed
    expect(g.vertices[1]).toEqual({ x: 100, y: 0 });
    expect(g.vertices[3]).toEqual({ x: 0, y: 60 });
  });

  it('a RAW rectangle (un-normalized) still produces no ghost — proving normalization is required', () => {
    const raw = makeDrawnRect();
    const preview: EntityPreviewTransform = { entityId: 'r1', gripIndex: 2, delta: { x: 20, y: 10 } };
    expect(applyEntityPreview(raw, preview)).toBe(raw); // no branch matches → unchanged
  });
});
