/**
 * ADR-363 §5.6b — shear-wall SOFT extent limits (advisory πάχους/μήκους).
 *
 * Καλύπτει: υπέρβαση πάχους/μήκους (order-agnostic), boundary (ΑΥΣΤΗΡΑ >), crossing-only
 * (guard μόνο στη ΝΕΑ υπέρβαση, μηδέν re-nag), scope (μόνο shear-wall).
 */

import {
  isShearWallExtentExceeded,
  detectShearWallExtentCrossing,
} from '../shear-wall-extents';
import {
  MAX_TYPICAL_SHEAR_WALL_THICKNESS_MM,
  MAX_TYPICAL_SHEAR_WALL_LENGTH_MM,
} from '../../types/column-types';
import {
  DEFAULT_COLUMN_BASE_BINDING,
  DEFAULT_COLUMN_TOP_BINDING,
} from '../../types/bim-binding';
import type { ColumnKind, ColumnParams } from '../../types/column-types';

function makeParams(over: Partial<ColumnParams> & { kind?: ColumnKind }): ColumnParams {
  return {
    kind: 'shear-wall',
    position: { x: 0, y: 0, z: 0 },
    anchor: 'center',
    width: 2000,
    depth: 200,
    height: 3000,
    rotation: 0,
    baseBinding: DEFAULT_COLUMN_BASE_BINDING,
    topBinding: DEFAULT_COLUMN_TOP_BINDING,
    ...over,
  };
}

describe('isShearWallExtentExceeded', () => {
  it('εντός τυπικού → κανένα flag', () => {
    expect(isShearWallExtentExceeded({ width: 2000, depth: 200 })).toEqual({ thick: false, length: false });
  });

  it('πάχος (μικρή πλευρά) πάνω από όριο, order-agnostic', () => {
    expect(isShearWallExtentExceeded({ width: 2000, depth: 1600 }).thick).toBe(true);
    expect(isShearWallExtentExceeded({ width: 1600, depth: 2000 }).thick).toBe(true);
  });

  it('μήκος (μεγάλη πλευρά) πάνω από όριο', () => {
    expect(isShearWallExtentExceeded({ width: 35000, depth: 200 }).length).toBe(true);
  });

  it('boundary: ΑΥΣΤΗΡΑ > (ίσο με το όριο → όχι υπέρβαση)', () => {
    expect(isShearWallExtentExceeded({ width: 2000, depth: MAX_TYPICAL_SHEAR_WALL_THICKNESS_MM }).thick).toBe(false);
    expect(isShearWallExtentExceeded({ width: 2000, depth: MAX_TYPICAL_SHEAR_WALL_THICKNESS_MM + 1 }).thick).toBe(true);
    expect(isShearWallExtentExceeded({ width: MAX_TYPICAL_SHEAR_WALL_LENGTH_MM, depth: 200 }).length).toBe(false);
    expect(isShearWallExtentExceeded({ width: MAX_TYPICAL_SHEAR_WALL_LENGTH_MM + 1, depth: 200 }).length).toBe(true);
  });
});

describe('detectShearWallExtentCrossing', () => {
  it('εντός → εντός → null', () => {
    expect(detectShearWallExtentCrossing(makeParams({}), makeParams({ width: 2500 }))).toBeNull();
  });

  it('πάχος περνά το όριο → crossing (thickTooLarge)', () => {
    const res = detectShearWallExtentCrossing(makeParams({}), makeParams({ depth: 1600 }));
    expect(res).not.toBeNull();
    expect(res?.thickTooLarge).toBe(true);
    expect(res?.lengthTooLarge).toBe(false);
    expect(res?.thicknessMm).toBe(1600);
  });

  it('μήκος περνά το όριο → crossing (lengthTooLarge)', () => {
    const res = detectShearWallExtentCrossing(makeParams({}), makeParams({ width: 35000 }));
    expect(res).not.toBeNull();
    expect(res?.lengthTooLarge).toBe(true);
    expect(res?.lengthMm).toBe(35000);
  });

  it('prev ήδη εκτός πάχους, next ακόμη εκτός πάχους (καμία ΝΕΑ) → null (μη re-nag)', () => {
    const prev = makeParams({ depth: 1600 });
    const next = makeParams({ depth: 1700, width: 2500 });
    expect(detectShearWallExtentCrossing(prev, next)).toBeNull();
  });

  it('prev εκτός πάχους, next προσθέτει ΝΕΑ υπέρβαση μήκους → crossing', () => {
    const prev = makeParams({ depth: 1600 });
    const next = makeParams({ depth: 1600, width: 35000 });
    const res = detectShearWallExtentCrossing(prev, next);
    expect(res).not.toBeNull();
    expect(res?.lengthTooLarge).toBe(true);
  });

  it('next kind όχι shear-wall → null (scope)', () => {
    const prev = makeParams({});
    const next = makeParams({ kind: 'rectangular', depth: 1600 });
    expect(detectShearWallExtentCrossing(prev, next)).toBeNull();
  });
});
