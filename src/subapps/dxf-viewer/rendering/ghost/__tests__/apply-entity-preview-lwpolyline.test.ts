/**
 * ADR-186/561 — LWPolyline drag-preview parity with polyline.
 *
 * A JOIN of two lines at an angle produces a scene `'lwpolyline'`. The preview SSoT
 * (`applyEntityPreview`) + the ghost model builder are keyed on `'polyline'`, and preview
 * callers pass the RAW scene entity, so an lwpolyline would match no branch → the ghost never
 * appears (Giorgio 2026-07-05 «να εμφανίζονται πάντοτε τα φαντάσματα»). `normalizePreviewEntity`
 * maps the discriminator up-front (shape identical) so it transforms EXACTLY like a polyline.
 */

import { applyEntityPreview, normalizePreviewEntity } from '../apply-entity-preview';
import type { EntityPreviewTransform } from '../entity-preview-types';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

function makeLwpolyline(): DxfEntityUnion {
  // Two lines joined at a right angle: A(0,100)→P(0,0)→B(60,0).
  return {
    id: 'lw_1', type: 'lwpolyline',
    vertices: [{ x: 0, y: 100 }, { x: 0, y: 0 }, { x: 60, y: 0 }],
    closed: false,
  } as unknown as DxfEntityUnion;
}

type PolyGhost = { type: string; vertices: { x: number; y: number }[] };

describe('normalizePreviewEntity (ADR-186/561)', () => {
  it('maps an lwpolyline to a polyline (new ref, vertices preserved)', () => {
    const lw = makeLwpolyline();
    const norm = normalizePreviewEntity(lw) as unknown as PolyGhost;
    expect(norm.type).toBe('polyline');
    expect(norm.vertices).toEqual((lw as unknown as PolyGhost).vertices);
    expect(norm).not.toBe(lw); // shallow clone, original untouched
    expect((lw as unknown as PolyGhost).type).toBe('lwpolyline');
  });

  it('leaves a real polyline untouched (same reference)', () => {
    const poly = { id: 'p', type: 'polyline', vertices: [{ x: 0, y: 0 }], closed: false } as unknown as DxfEntityUnion;
    expect(normalizePreviewEntity(poly)).toBe(poly);
  });

  it('leaves a line untouched (same reference)', () => {
    const line = { id: 'l', type: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } } as unknown as DxfEntityUnion;
    expect(normalizePreviewEntity(line)).toBe(line);
  });
});

describe('applyEntityPreview on a normalized lwpolyline → real ghost (transformed !== entity)', () => {
  it('VERTEX reshape moves the dragged vertex (was a no-op for a raw lwpolyline)', () => {
    const entity = normalizePreviewEntity(makeLwpolyline());
    const preview: EntityPreviewTransform = {
      entityId: 'lw_1', gripIndex: 0, delta: { x: 10, y: 5 },
    };
    const g = applyEntityPreview(entity, preview) as unknown as PolyGhost;
    expect(g).not.toBe(entity);            // a ghost IS produced
    expect(g.vertices[0]).toEqual({ x: 10, y: 105 }); // vertex 0 dragged
    expect(g.vertices[1]).toEqual({ x: 0, y: 0 });    // others fixed
    expect(g.vertices[2]).toEqual({ x: 60, y: 0 });
  });

  it('WHOLE move translates every vertex', () => {
    const entity = normalizePreviewEntity(makeLwpolyline());
    const preview: EntityPreviewTransform = {
      entityId: 'lw_1', gripIndex: 5, delta: { x: 20, y: -10 }, movesEntity: true,
    };
    const g = applyEntityPreview(entity, preview) as unknown as PolyGhost;
    expect(g).not.toBe(entity);
    expect(g.vertices).toEqual([{ x: 20, y: 90 }, { x: 20, y: -10 }, { x: 80, y: -10 }]);
  });

  it('a RAW lwpolyline (un-normalized) stays a no-op — proving the normalization is what fixes it', () => {
    const raw = makeLwpolyline();
    const preview: EntityPreviewTransform = { entityId: 'lw_1', gripIndex: 0, delta: { x: 10, y: 5 } };
    expect(applyEntityPreview(raw, preview)).toBe(raw); // no ghost without normalization
  });
});
