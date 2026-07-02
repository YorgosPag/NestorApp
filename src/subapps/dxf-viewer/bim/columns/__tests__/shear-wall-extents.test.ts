/**
 * ADR-363 §5.6b — shear-wall SOFT extent limits (advisory πάχους/μήκους).
 *
 * Καλύπτει: υπέρβαση πάχους/μήκους (order-agnostic), boundary (ΑΥΣΤΗΡΑ >), crossing-only
 * (guard μόνο στη ΝΕΑ υπέρβαση, μηδέν re-nag), scope (μόνο shear-wall).
 */

import {
  isShearWallExtentExceeded,
  detectMemberExtentCrossing,
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

describe('detectMemberExtentCrossing', () => {
  it('εντός → εντός → null', () => {
    expect(detectMemberExtentCrossing(makeParams({}), makeParams({ width: 2500 }))).toBeNull();
  });

  it('πάχος περνά το όριο → crossing (thickTooLarge)', () => {
    const res = detectMemberExtentCrossing(makeParams({}), makeParams({ depth: 1600 }));
    expect(res).not.toBeNull();
    expect(res?.thickTooLarge).toBe(true);
    expect(res?.lengthTooLarge).toBe(false);
    expect(res?.thicknessMm).toBe(1600);
  });

  it('μήκος περνά το όριο → crossing (lengthTooLarge)', () => {
    const res = detectMemberExtentCrossing(makeParams({}), makeParams({ width: 35000 }));
    expect(res).not.toBeNull();
    expect(res?.lengthTooLarge).toBe(true);
    expect(res?.lengthMm).toBe(35000);
  });

  it('prev ήδη εκτός πάχους, next ακόμη εκτός πάχους (καμία ΝΕΑ) → null (μη re-nag)', () => {
    const prev = makeParams({ depth: 1600 });
    const next = makeParams({ depth: 1700, width: 2500 });
    expect(detectMemberExtentCrossing(prev, next)).toBeNull();
  });

  it('prev εκτός πάχους, next προσθέτει ΝΕΑ υπέρβαση μήκους → crossing', () => {
    const prev = makeParams({ depth: 1600 });
    const next = makeParams({ depth: 1600, width: 35000 });
    const res = detectMemberExtentCrossing(prev, next);
    expect(res).not.toBeNull();
    expect(res?.lengthTooLarge).toBe(true);
  });

  it('§5.6c B — ΓΕΝΙΚΟ: μη-shear-wall τύπος (Τ) που επιμηκύνεται > 30m → crossing (αρμός διαστολής)', () => {
    const prev = makeParams({ kind: 'T-shape', width: 2000, depth: 400 });
    const next = makeParams({ kind: 'T-shape', width: 35000, depth: 400 });
    const res = detectMemberExtentCrossing(prev, next);
    expect(res).not.toBeNull();
    expect(res?.lengthTooLarge).toBe(true);
  });

  it('ορθογώνιο που επιμηκύνεται > 30m → crossing (πλέον όχι shear-wall-only)', () => {
    const res = detectMemberExtentCrossing(makeParams({ kind: 'rectangular', width: 400 }), makeParams({ kind: 'rectangular', width: 35000 }));
    expect(res?.lengthTooLarge).toBe(true);
  });

  it('circular/polygon (συμμετρικά) → null (καμία έννοια μήκους)', () => {
    expect(detectMemberExtentCrossing(makeParams({ kind: 'circular' }), makeParams({ kind: 'circular', width: 35000 }))).toBeNull();
    expect(detectMemberExtentCrossing(makeParams({ kind: 'polygon' }), makeParams({ kind: 'polygon', width: 35000 }))).toBeNull();
  });
});
