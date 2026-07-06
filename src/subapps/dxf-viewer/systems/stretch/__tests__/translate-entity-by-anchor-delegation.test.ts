/**
 * SSoT convergence — `translateEntityByAnchor` now delegates to the canonical
 * `calculateMovedGeometry`, so it rigid-moves the FULL type set (incl. line / polyline /
 * lwpolyline) that its old private `switch` silently no-op'd. That no-op broke the
 * directional move-by-value handle on JOINed (lwpolyline) entities.
 */

import { translateEntityByAnchor } from '../stretch-entity-transform';
import type { Entity } from '../../../types/entities';

describe('translateEntityByAnchor → canonical calculateMovedGeometry delegate', () => {
  it('moves a JOINed lwpolyline (was a silent no-op)', () => {
    const lw = { id: 'lw', type: 'lwpolyline', vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false } as unknown as Entity;
    const patch = translateEntityByAnchor(lw, { x: 5, y: 5 }) as { vertices?: unknown };
    expect(patch.vertices).toEqual([{ x: 5, y: 5 }, { x: 15, y: 5 }]);
  });

  it('moves a plain polyline + a line (both were no-op in the old switch)', () => {
    const poly = { id: 'p', type: 'polyline', vertices: [{ x: 1, y: 1 }], closed: false } as unknown as Entity;
    expect((translateEntityByAnchor(poly, { x: 2, y: 3 }) as { vertices?: unknown }).vertices).toEqual([{ x: 3, y: 4 }]);

    const line = { id: 'l', type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } } as unknown as Entity;
    const lp = translateEntityByAnchor(line, { x: 1, y: 1 }) as { start?: unknown; end?: unknown };
    expect(lp.start).toEqual({ x: 1, y: 1 });
    expect(lp.end).toEqual({ x: 11, y: 1 });
  });

  it('still moves a circle by center (no regression)', () => {
    const c = { id: 'c', type: 'circle', center: { x: 0, y: 0 }, radius: 5 } as unknown as Entity;
    expect((translateEntityByAnchor(c, { x: 4, y: 4 }) as { center?: unknown }).center).toEqual({ x: 4, y: 4 });
  });
});
