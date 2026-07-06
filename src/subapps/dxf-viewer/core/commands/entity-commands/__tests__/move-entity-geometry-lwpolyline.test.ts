/**
 * ADR-186/561 + SSoT convergence — `calculateMovedGeometry` is the canonical rigid-move
 * geometry SSoT. Regression guard that a JOINed `lwpolyline` (and mtext / block, previously
 * only in the now-converged `translateEntityByAnchor` duplicate) translates natively,
 * keeping its type. This is the commit-side counterpart of `normalizePreviewEntity`.
 */

import { calculateMovedGeometry } from '../move-entity-geometry';
import type { SceneEntity } from '../interfaces';

const lwpoly = (): SceneEntity =>
  ({ id: 'lw', type: 'lwpolyline', layer: 'L0', visible: true,
     vertices: [{ x: 0, y: 100 }, { x: 0, y: 0 }, { x: 60, y: 0 }], closed: false } as unknown as SceneEntity);

describe('calculateMovedGeometry — canonical rigid-move SSoT (lwpolyline + block + mtext)', () => {
  it('translates every vertex of a JOINed lwpolyline (native, keep-type)', () => {
    const patch = calculateMovedGeometry(lwpoly(), { x: 20, y: -10, z: 0 }) as { vertices?: unknown };
    expect(patch.vertices).toEqual([{ x: 20, y: 90 }, { x: 20, y: -10 }, { x: 80, y: -10 }]);
  });

  it('still translates a plain polyline (no regression)', () => {
    const poly = { id: 'p', type: 'polyline', layer: 'L0', visible: true, vertices: [{ x: 1, y: 1 }], closed: false } as unknown as SceneEntity;
    const patch = calculateMovedGeometry(poly, { x: 5, y: 5, z: 0 }) as { vertices?: unknown };
    expect(patch.vertices).toEqual([{ x: 6, y: 6 }]);
  });

  it('rigid-translates MTEXT + INSERT/block by position (converged from translateEntityByAnchor)', () => {
    const mtext = { id: 'm', type: 'mtext', layer: 'L0', visible: true, position: { x: 10, y: 10 } } as unknown as SceneEntity;
    const block = { id: 'b', type: 'block', layer: 'L0', visible: true, position: { x: 0, y: 0 } } as unknown as SceneEntity;
    expect((calculateMovedGeometry(mtext, { x: 3, y: 4, z: 0 }) as { position?: unknown }).position).toEqual({ x: 13, y: 14 });
    expect((calculateMovedGeometry(block, { x: -2, y: 7, z: 0 }) as { position?: unknown }).position).toEqual({ x: -2, y: 7 });
  });
});
