/**
 * ADR-363 Phase 8F — `column-dim-labels` pure-function tests.
 *
 * Verifies:
 *   - `formatColumnDimLabels` produces correct text for all 7 column kinds
 *   - Math.round is applied to width/depth values
 *   - `params.catalogProfile` prepended as first line when present
 *   - Polygon `sides` fallback to DEFAULT_POLYGON_SIDES when absent
 *   - Empty array returned for unrecognised kind
 *   - `COLUMN_LABEL_MIN_FOOTPRINT_PX` exported constant value
 */

import { formatColumnDimLabels, COLUMN_LABEL_MIN_FOOTPRINT_PX } from '../column-dim-labels';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import type { ColumnParams, ColumnKind } from '../../types/column-types';

function makeParams(kind: ColumnKind, overrides: Partial<ColumnParams> = {}): ColumnParams {
  return { ...buildDefaultColumnParams({ x: 0, y: 0 }, kind), ...overrides };
}

describe('formatColumnDimLabels', () => {
  describe('rectangular', () => {
    it('produces w= d= format', () => {
      const params = makeParams('rectangular', { width: 400, depth: 400 });
      expect(formatColumnDimLabels(params)).toEqual(['w=400  d=400']);
    });

    it('rounds width and depth', () => {
      const params = makeParams('rectangular', { width: 400.7, depth: 399.2 });
      expect(formatColumnDimLabels(params)).toEqual(['w=401  d=399']);
    });

    it('prepends catalogProfile when present', () => {
      const params = makeParams('rectangular', { width: 400, depth: 400, catalogProfile: 'C25/30' });
      expect(formatColumnDimLabels(params)).toEqual(['C25/30', 'w=400  d=400']);
    });
  });

  describe('circular', () => {
    it('produces Ø= format using width as diameter', () => {
      const params = makeParams('circular', { width: 500 });
      expect(formatColumnDimLabels(params)).toEqual(['Ø=500']);
    });

    it('prepends catalogProfile when present', () => {
      const params = makeParams('circular', { width: 400, catalogProfile: 'C20/25' });
      expect(formatColumnDimLabels(params)).toEqual(['C20/25', 'Ø=400']);
    });
  });

  describe('shear-wall', () => {
    it('produces L= t= format', () => {
      const params = makeParams('shear-wall', { width: 2000, depth: 200 });
      expect(formatColumnDimLabels(params)).toEqual(['L=2000  t=200']);
    });

    it('prepends catalogProfile when present', () => {
      const params = makeParams('shear-wall', { width: 2000, depth: 200, catalogProfile: 'C30/37' });
      expect(formatColumnDimLabels(params)).toEqual(['C30/37', 'L=2000  t=200']);
    });
  });

  describe('I-shape', () => {
    it('produces b= h= format', () => {
      const params = makeParams('I-shape', { width: 150, depth: 300 });
      expect(formatColumnDimLabels(params)).toEqual(['b=150  h=300']);
    });

    it('prepends catalogProfile when present', () => {
      const params = makeParams('I-shape', { width: 150, depth: 300, catalogProfile: 'IPE-300' });
      expect(formatColumnDimLabels(params)).toEqual(['IPE-300', 'b=150  h=300']);
    });
  });

  describe('polygon', () => {
    it('produces Ø= N= format with explicit sides', () => {
      const params = makeParams('polygon', { width: 600, polygon: { sides: 8 } });
      expect(formatColumnDimLabels(params)).toEqual(['Ø=600  N=8']);
    });

    it('falls back to DEFAULT_POLYGON_SIDES (6) when polygon block absent', () => {
      const params = makeParams('polygon', { width: 500, polygon: undefined });
      expect(formatColumnDimLabels(params)).toEqual(['Ø=500  N=6']);
    });

    it('falls back to DEFAULT_POLYGON_SIDES when sides is undefined', () => {
      const params = makeParams('polygon', { width: 400, polygon: {} });
      expect(formatColumnDimLabels(params)).toEqual(['Ø=400  N=6']);
    });

    it('prepends catalogProfile when present', () => {
      const params = makeParams('polygon', { width: 600, polygon: { sides: 6 }, catalogProfile: 'Hex-600' });
      expect(formatColumnDimLabels(params)).toEqual(['Hex-600', 'Ø=600  N=6']);
    });
  });

  describe('L-shape', () => {
    it('produces w= d= bounding-box format', () => {
      const params = makeParams('L-shape', { width: 300, depth: 600 });
      expect(formatColumnDimLabels(params)).toEqual(['w=300  d=600']);
    });
  });

  describe('T-shape', () => {
    it('produces w= d= bounding-box format', () => {
      const params = makeParams('T-shape', { width: 500, depth: 300 });
      expect(formatColumnDimLabels(params)).toEqual(['w=500  d=300']);
    });
  });

  describe('edge cases', () => {
    it('undefined catalogProfile produces no prefix', () => {
      const params = makeParams('rectangular', { catalogProfile: undefined });
      expect(formatColumnDimLabels(params)[0]).not.toMatch(/undefined/);
    });

    it('returns empty array for unrecognised kind', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = makeParams('rectangular', { kind: 'unknown' as any });
      expect(formatColumnDimLabels(params)).toEqual([]);
    });
  });
});

describe('COLUMN_LABEL_MIN_FOOTPRINT_PX', () => {
  it('is a positive number', () => {
    expect(COLUMN_LABEL_MIN_FOOTPRINT_PX).toBeGreaterThan(0);
  });
});
