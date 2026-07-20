/**
 * ADR-462 Round 21 — off-drawing junk removal.
 *
 * A geo-referenced survey parks decorative junk (legacy ASHADE blocks) at the origin while
 * the real drawing sits far away (~131k). Left in, the scene bbox spans 0..131k → the
 * viewport frames a giant empty box → the drawing is a sub-pixel speck ("empty canvas").
 * The filter drops ONLY entities entirely outside the declared $EXTMIN/$EXTMAX (padded by a
 * drawing-diagonal), and ONLY when the extents are usable. Normal drawings are untouched.
 */

import { dropOutOfExtentsEntities } from '../dxf-out-of-extents-filter';
import type { AnySceneEntity } from '../types/scene';

const line = (id: string, x1: number, y1: number, x2: number, y2: number): AnySceneEntity =>
  ({ id, type: 'line', layerId: '0', visible: true, start: { x: x1, y: y1 }, end: { x: x2, y: y2 } } as unknown as AnySceneEntity);

// Real survey extents + an origin-junk line vs the actual drawing.
const EXTMIN = { x: 131685, y: 741755 };
const EXTMAX = { x: 131992, y: 741923 };
const junk = line('junk', 0, 0, 1, 0);                         // at origin — hundreds of diagonals away
const real = line('real', 131700, 741800, 131980, 741900);    // inside the extents

describe('dropOutOfExtentsEntities', () => {
  it('drops far-flung origin junk but keeps the real drawing', () => {
    const { kept, dropped } = dropOutOfExtentsEntities([junk, real], EXTMIN, EXTMAX);
    expect(dropped).toBe(1);
    expect(kept.map(e => e.id)).toEqual(['real']);
  });

  it('keeps an entity that OVERLAPS the extents (partial spill is not junk)', () => {
    // Spans from just outside into the drawing → overlaps padded extents → kept.
    const spill = line('spill', 131000, 741700, 131800, 741850);
    const { kept, dropped } = dropOutOfExtentsEntities([spill, real], EXTMIN, EXTMAX);
    expect(dropped).toBe(0);
    expect(kept).toHaveLength(2);
  });

  it('no-ops without declared extents (normal drawings untouched)', () => {
    expect(dropOutOfExtentsEntities([junk, real], undefined, undefined).dropped).toBe(0);
  });

  it('no-ops on the ±1e20 uninitialized sentinel', () => {
    const r = dropOutOfExtentsEntities([junk, real], { x: 1e20, y: 1e20 }, { x: -1e20, y: -1e20 });
    expect(r.dropped).toBe(0);
    expect(r.kept).toHaveLength(2);
  });
});
