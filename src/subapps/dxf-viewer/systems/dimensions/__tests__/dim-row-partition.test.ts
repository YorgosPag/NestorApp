/**
 * ADR-362 Round 35 — dimension row partition + handle geometry tests.
 */

import { partitionDimensionRows } from '../dim-row-partition';
import {
  computeRowHandleScreenPos,
  computeRowGhostSegments,
  projectRowDelta,
} from '../dim-row-handle-geometry';
import { extractDimLineInfo } from '../dim-line-info';
import type { DimensionEntity, LinearDimensionEntity } from '../../../types/dimension';
import type { Point2D, ViewTransform, Viewport } from '../../../rendering/types/Types';

let seq = 0;
function linear(o1: Point2D, o2: Point2D, ref: Point2D): LinearDimensionEntity {
  return {
    id: `dim_${seq++}`,
    type: 'dimension',
    dimensionType: 'linear',
    styleId: 'Standard',
    layerId: '0',
    rotation: 0,
    defPoints: [o1, o2, ref],
  };
}

describe('partitionDimensionRows', () => {
  it('splits stacked + perpendicular dims into distinct rows', () => {
    // Row 1 — two collinear horizontal dims at y=100.
    const a = linear({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 100 });
    const b = linear({ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 75, y: 100 });
    // Row 2 — horizontal dim on a DIFFERENT dim line (y=200).
    const c = linear({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 200 });
    // Row 3 — a vertical dim (perpendicular axis).
    const v = linear({ x: 300, y: 0 }, { x: 300, y: 80 }, { x: 400, y: 40 });

    const rows = partitionDimensionRows([a, b, c, v]);
    expect(rows).toHaveLength(3);
    expect(rows[0].dims.map((d) => d.id)).toEqual([a.id, b.id]);
    expect(rows[1].dims.map((d) => d.id)).toEqual([c.id]);
    expect(rows[2].dims.map((d) => d.id)).toEqual([v.id]);
  });

  it('skips non-linear dims (no row concept)', () => {
    const radial = {
      id: 'dim_r', type: 'dimension', dimensionType: 'radius',
      styleId: 'Standard', layerId: '0', defPoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    } as unknown as DimensionEntity;
    const a = linear({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 100 });
    const rows = partitionDimensionRows([radial, a]);
    expect(rows).toHaveLength(1);
    expect(rows[0].dims.map((d) => d.id)).toEqual([a.id]);
  });

  it('gives a stable id independent of member order', () => {
    const a = linear({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 100 });
    const b = linear({ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 75, y: 100 });
    const id1 = partitionDimensionRows([a, b])[0].id;
    const id2 = partitionDimensionRows([b, a])[0].id;
    expect(id1).toBe(id2);
  });
});

describe('computeRowHandleScreenPos', () => {
  // 1:1 scale, no offset → world (x,y) → screen via margins + Y-flip.
  const transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  const viewport: Viewport = { width: 800, height: 600 };

  it('docks a horizontal row to the RIGHT edge', () => {
    const a = linear({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 });
    const info = extractDimLineInfo(a)!;
    const p = computeRowHandleScreenPos(info, transform, viewport, 24);
    expect(p).not.toBeNull();
    expect(p!.orientation).toBe('horizontal');
    expect(p!.screen.x).toBe(800 - 24);
  });

  it('docks a vertical row to the BOTTOM edge', () => {
    const a = linear({ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 50 });
    const info = extractDimLineInfo(a)!;
    const p = computeRowHandleScreenPos(info, transform, viewport, 24);
    expect(p).not.toBeNull();
    expect(p!.orientation).toBe('vertical');
    expect(p!.screen.y).toBe(600 - 24);
  });

  it('returns null when the dim line falls outside the visible band', () => {
    // Horizontal line at world y=100000 → far above the 600px viewport.
    const a = linear({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100000 });
    const info = extractDimLineInfo(a)!;
    expect(computeRowHandleScreenPos(info, transform, viewport, 24)).toBeNull();
  });
});

describe('computeRowGhostSegments', () => {
  it('translates each dim line by the delta', () => {
    const a = linear({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 });
    const delta: Point2D = { x: 0, y: 40 };
    const segs = computeRowGhostSegments([a], delta);
    expect(segs).toHaveLength(1);
    // Current dim line runs at y=100 (offset) → shifted to y=140.
    expect(segs[0].a).toEqual({ x: 0, y: 140 });
    expect(segs[0].b).toEqual({ x: 100, y: 140 });
  });
});

describe('projectRowDelta', () => {
  it('keeps only the component along the row normal (free — no F9)', () => {
    const normal: Point2D = { x: 0, y: 1 };
    const out = projectRowDelta({ x: 37, y: 40 }, normal);
    // X (along-axis) dropped; Y (perpendicular) preserved. F9 off by default → no snap.
    expect(out).toEqual({ x: 0, y: 40 });
  });
});
