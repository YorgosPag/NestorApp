/**
 * ADR-362 Phase R-import — DXF DIMENSION → first-class DimensionEntity.
 *
 * Verifies the importer emits a real `type:'dimension'` entity (so it renders
 * through DimensionRenderer with arrowheads) for linear/aligned/radius/diameter,
 * and falls back to legacy text+line primitives for angular/ordinate. The
 * geometry-builder integration asserts the mapped defPoints are render-valid.
 */

import { describe, it, expect } from '@jest/globals';
import { convertDimension } from '../dxf-dimension-converter';
import {
  isLinearDimension,
  isAlignedDimension,
  isRadiusDimension,
  isDiameterDimension,
  type DimensionEntity,
} from '../../types/dimension';
import { buildDimensionGeometry } from '../../systems/dimensions/dim-geometry-builder';
import { ISO_129_TEMPLATE } from '../../systems/dimensions/dim-style-templates';

// DXF code helpers — a horizontal linear dim from (0,0)→(1000,0), dim line at y=200.
function linearData(extra: Record<string, string> = {}): Record<string, string> {
  return {
    '70': '0',
    '13': '0', '23': '0',      // extOrigin1
    '14': '1000', '24': '0',   // extOrigin2
    '10': '0', '20': '200',    // dimLineRef
    '11': '500', '21': '230',  // text midpoint
    '42': '1000',              // measurement
    ...extra,
  };
}

function asDim(result: ReturnType<typeof convertDimension>): DimensionEntity {
  expect(result).toHaveLength(1);
  const e = result[0];
  expect(e.type).toBe('dimension');
  return e as unknown as DimensionEntity;
}

describe('convertDimension — first-class DimensionEntity', () => {
  it('linear (type 0) → LinearDimensionEntity with defPoints [o1, o2, dimLineRef] + rotation', () => {
    const dim = asDim(convertDimension(linearData({ '50': '0' }), 'lyr_dim', 7));
    expect(isLinearDimension(dim)).toBe(true);
    expect(dim.id).toBe('dimension_7');
    expect(dim.layerId).toBe('lyr_dim');
    expect(dim.styleId).toBe(''); // → resolveDimStyle falls back to active imported style
    expect(dim.defPoints).toEqual([{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 200 }]);
    expect(dim.textMidpoint).toEqual({ x: 500, y: 230 });
    if (isLinearDimension(dim)) expect(dim.rotation).toBe(0);
  });

  it('linear without code 50 → rotation defaults to 0', () => {
    const dim = asDim(convertDimension(linearData(), 'L', 1));
    if (isLinearDimension(dim)) expect(dim.rotation).toBe(0);
  });

  it('aligned (type 1) → AlignedDimensionEntity, same defPoints, no rotation field', () => {
    const dim = asDim(convertDimension(linearData({ '70': '1' }), 'L', 2));
    expect(isAlignedDimension(dim)).toBe(true);
    expect(dim.defPoints).toHaveLength(3);
  });

  it('radius (type 4) → defPoints [center (15/25), arcPoint (10/20)]', () => {
    const data = { '70': '4', '15': '100', '25': '100', '10': '150', '20': '100', '42': '50' };
    const dim = asDim(convertDimension(data, 'L', 3));
    expect(isRadiusDimension(dim)).toBe(true);
    expect(dim.defPoints).toEqual([{ x: 100, y: 100 }, { x: 150, y: 100 }]);
  });

  it('diameter (type 3) → defPoints [side1 (10/20), side2 (15/25)]', () => {
    const data = { '70': '3', '10': '50', '20': '100', '15': '150', '25': '100', '42': '100' };
    const dim = asDim(convertDimension(data, 'L', 4));
    expect(isDiameterDimension(dim)).toBe(true);
    expect(dim.defPoints).toEqual([{ x: 50, y: 100 }, { x: 150, y: 100 }]);
  });

  it('text override: code 1 literal → userText override; empty → undefined (measured)', () => {
    const withText = asDim(convertDimension(linearData({ '1': 'APPROX' }), 'L', 5));
    expect(withText.userText).toBe('APPROX');
    const noText = asDim(convertDimension(linearData(), 'L', 6));
    expect(noText.userText).toBeUndefined();
  });

  it('measurementValue carried from code 42 (NaN → omitted)', () => {
    expect(asDim(convertDimension(linearData(), 'L', 1)).measurementValue).toBe(1000);
    const noMeas = asDim(convertDimension(linearData({ '42': '' }), 'L', 1));
    expect(noMeas.measurementValue).toBeUndefined();
  });

  it('legacy back-compat fields populated for Phase-A1 consumers (PathCache / snap)', () => {
    const dim = asDim(convertDimension(linearData(), 'L', 1));
    expect(dim.startPoint).toEqual({ x: 0, y: 0 });
    expect(dim.endPoint).toEqual({ x: 1000, y: 0 });
    expect(dim.textPosition).toEqual({ x: 500, y: 230 });
  });

  it('missing definition coords → empty (skipped, no crash)', () => {
    expect(convertDimension({ '70': '0' }, 'L', 1)).toEqual([]);
  });
});

describe('convertDimension — geometry-builder integration (render contract)', () => {
  it('produced linear entity builds valid geometry with correct measurement', () => {
    const dim = asDim(convertDimension(linearData(), 'L', 1));
    const geom = buildDimensionGeometry(dim, ISO_129_TEMPLATE);
    expect(geom.kind).toBe('linear');
    expect(geom.measurementValue).toBeCloseTo(1000);
  });

  it('produced radius entity builds valid radial geometry', () => {
    const data = { '70': '4', '15': '0', '25': '0', '10': '50', '20': '0', '42': '50' };
    const dim = asDim(convertDimension(data, 'L', 1));
    const geom = buildDimensionGeometry(dim, ISO_129_TEMPLATE);
    expect(geom.kind).toBe('radial');
    expect(geom.measurementValue).toBeCloseTo(50);
  });
});

describe('convertDimension — legacy fallback (angular / ordinate)', () => {
  it('angular (type 2) → legacy text+line primitives (no dimension entity)', () => {
    const data = {
      '70': '2',
      '13': '0', '23': '0', '14': '100', '24': '0',
      '10': '0', '20': '50', '11': '50', '21': '60', '42': '90',
    };
    const result = convertDimension(data, 'L', 9);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every((e) => e.type !== 'dimension')).toBe(true);
    expect(result.some((e) => e.type === 'text')).toBe(true);
  });
});
