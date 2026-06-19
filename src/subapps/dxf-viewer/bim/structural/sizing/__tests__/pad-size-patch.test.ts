/**
 * ADR-503 Slice 3 — pad-size-patch (safety-gated lock σε χειροκίνητη διάσταση πεδίλου).
 * Lock-flag = `autoDesigned` (ο reconciler ξαναδιαστασιολογεί μόνο autoDesigned).
 */

import type { Entity } from '../../../types/entities';
import type { FoundationEntity, PadFootingParams } from '../../types/foundation-types';
import type { PadSizingInput } from '../../structural/footing-design/suggest-pad-dimensions';
import {
  buildPadSizingInput,
  isPadAutoSized,
  isPadSectionAdequate,
  resolvePadSectionLock,
} from '../pad-size-patch';

function makePad(over: Partial<PadFootingParams> = {}): FoundationEntity {
  const params: PadFootingParams = {
    kind: 'pad',
    position: { x: 0, y: 0, z: 0 },
    width: 1500,
    length: 1500,
    rotation: 0,
    anchor: 'center',
    profile: 'flat',
    topElevationMm: -1000,
    thicknessMm: 500,
    ...over,
  };
  return {
    type: 'foundation', kind: 'pad', id: 'pad_1', params,
    predefinedType: 'PAD_FOOTING', ifcType: 'IfcFooting', geometry: {},
  } as unknown as FoundationEntity;
}

// N=1000 kN, σ=200 kPa → A_req=5 m² → πλευρά √5·1000 ≈ 2236 → roundUp50 = 2250.
const BEARING_INPUT: PadSizingInput = {
  columnWidthMm: 400, columnDepthMm: 400, axialServiceKn: 1000, soilBearingCapacityKpa: 200,
};
const MIN_BEARING_MM = 2250;

describe('isPadAutoSized', () => {
  it('AUTO μόνο όταν autoDesigned===true (ο reconciler το διαχειρίζεται)', () => {
    expect(isPadAutoSized(makePad({ autoDesigned: true }).params as PadFootingParams)).toBe(true);
    expect(isPadAutoSized(makePad().params as PadFootingParams)).toBe(false);
    expect(isPadAutoSized(makePad({ autoDesigned: false }).params as PadFootingParams)).toBe(false);
  });
});

describe('isPadSectionAdequate (ADR-503 Slice 3)', () => {
  it('flags an under-sized pad as inadequate + reports the bearing minimum', () => {
    const res = isPadSectionAdequate(BEARING_INPUT, { widthMm: 1500, lengthMm: 1500 });
    expect(res.adequate).toBe(false);
    expect(res.minWidthMm).toBe(MIN_BEARING_MM);
    expect(res.minLengthMm).toBe(MIN_BEARING_MM);
  });

  it('accepts a pad at or above the bearing minimum', () => {
    expect(isPadSectionAdequate(BEARING_INPUT, { widthMm: 2500, lengthMm: 2500 }).adequate).toBe(true);
  });

  it('falls back to the geometric/detailing minimum without load/soil', () => {
    // column 400 + 2·150 overhang = 700 → 600 (PAD_MIN_SIDE) δεν κυριαρχεί.
    const geo: PadSizingInput = { columnWidthMm: 400, columnDepthMm: 400 };
    expect(isPadSectionAdequate(geo, { widthMm: 600, lengthMm: 600 }).adequate).toBe(false);
    expect(isPadSectionAdequate(geo, { widthMm: 800, lengthMm: 800 }).adequate).toBe(true);
  });
});

describe('resolvePadSectionLock (ADR-503 Slice 3)', () => {
  it('passes through a non-size edit (no autoDesigned mutation)', () => {
    const prev = makePad().params as PadFootingParams;
    const next = makePad({ topElevationMm: -1200 }).params as PadFootingParams;
    const lock = resolvePadSectionLock(BEARING_INPUT, prev, next);
    expect(lock.rejected).toBe(false);
    expect(lock.params).toBe(next);
    expect(lock.params.autoDesigned).toBeUndefined();
  });

  it('locks an adequate manual size (autoDesigned:false, Revit user-wins)', () => {
    const prev = makePad().params as PadFootingParams;
    const next = makePad({ width: 2500, length: 2500 }).params as PadFootingParams;
    const lock = resolvePadSectionLock(BEARING_INPUT, prev, next);
    expect(lock.rejected).toBe(false);
    expect(lock.params.autoDesigned).toBe(false);
    expect(lock.params.width).toBe(2500);
  });

  it('BLOCKS an under-sized manual size → clamps to bearing minimum, preserves auto flag', () => {
    const prev = makePad({ width: 2500, length: 2500, autoDesigned: true }).params as PadFootingParams;
    const next = makePad({ width: 1000, length: 1000, autoDesigned: true }).params as PadFootingParams;
    const lock = resolvePadSectionLock(BEARING_INPUT, prev, next);
    expect(lock.rejected).toBe(true);
    expect(lock.params.width).toBe(MIN_BEARING_MM);
    expect(lock.params.length).toBe(MIN_BEARING_MM);
    expect(lock.params.autoDesigned).toBe(true);
  });
});

describe('buildPadSizingInput (ADR-503 Slice 3)', () => {
  it('returns null for a non-pad footing', () => {
    const strip = { type: 'foundation', id: 's', params: { kind: 'strip' } } as unknown as FoundationEntity;
    expect(buildPadSizingInput(strip, [], 200)).toBeNull();
  });

  it('derives axial from appliedLoad (G+Q) + soil, 0 column dims without a supporting column', () => {
    const footing = makePad({ appliedLoad: { deadAxialKn: 600, liveAxialKn: 400 } });
    const input = buildPadSizingInput(footing, [] as readonly Entity[], 200);
    expect(input).toEqual({
      columnWidthMm: 0, columnDepthMm: 0, axialServiceKn: 1000, soilBearingCapacityKpa: 200,
    });
  });

  it('omits axial/soil when absent (sizer falls back to geometric min)', () => {
    const input = buildPadSizingInput(makePad(), [] as readonly Entity[], undefined);
    expect(input).toEqual({ columnWidthMm: 0, columnDepthMm: 0 });
  });
});
