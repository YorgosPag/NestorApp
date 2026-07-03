/**
 * ADR-362 — dimension row detector tests.
 */

import { collectDimensionRow, isSameDimRow } from '../dim-row-detect';
import { extractDimLineInfo } from '../dim-line-info';
import type { DimensionEntity, LinearDimensionEntity } from '../../../types/dimension';
import type { Point2D } from '../../../rendering/types/Types';

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

describe('collectDimensionRow', () => {
  it('groups collinear parallel dims into one row', () => {
    const a = linear({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 100 });
    const b = linear({ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 75, y: 100 });
    const c = linear({ x: 100, y: 0 }, { x: 160, y: 0 }, { x: 130, y: 100 });
    const row = collectDimensionRow(a, [a, b, c]);
    expect(row.map((d) => d.id)).toEqual([a.id, b.id, c.id]);
  });

  it('excludes a parallel dim on a DIFFERENT dim line (stacked row)', () => {
    const a = linear({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 100 });
    const other = linear({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 110 }); // +10mm offset
    const row = collectDimensionRow(a, [a, other]);
    expect(row.map((d) => d.id)).toEqual([a.id]);
  });

  it('excludes a perpendicular (non-parallel) dim', () => {
    const a = linear({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 100 });
    const vertical = linear({ x: 200, y: 0 }, { x: 200, y: 50 }, { x: 300, y: 25 });
    const row = collectDimensionRow(a, [a, vertical]);
    expect(row.map((d) => d.id)).toEqual([a.id]);
  });

  it('returns [target] for a non-linear dim (no row concept)', () => {
    const radial = {
      id: 'dim_r', type: 'dimension', dimensionType: 'radius',
      styleId: 'Standard', layerId: '0', defPoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    } as unknown as DimensionEntity;
    const a = linear({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 100 });
    expect(collectDimensionRow(radial, [radial, a]).map((d) => d.id)).toEqual(['dim_r']);
  });

  it('tolerates tiny collinear noise within the default 1mm window', () => {
    const a = linear({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 100 });
    const b = linear({ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 75, y: 100.5 }); // 0.5mm noise
    const info = extractDimLineInfo(a)!;
    expect(isSameDimRow(info, b)).toBe(true);
  });
});
