/**
 * ADR-463 — kind-aware foundation reinforcement read/patch helpers.
 */

import {
  readFoundationStructuralField,
  patchFoundationStructuralField,
} from '../foundation-structural-param';
import { FOUNDATION_STRUCTURAL_KEYS as K } from '../foundation-command-keys';
import type {
  PadReinforcement,
  StripReinforcement,
  TieBeamReinforcement,
} from '../../../../../bim/structural/reinforcement/footing-reinforcement-types';

const pad: PadReinforcement = {
  kind: 'pad',
  bottomMeshX: { diameterMm: 12, spacingMm: 200 },
  bottomMeshY: { diameterMm: 12, spacingMm: 200 },
  coverMm: 50,
};

const strip: StripReinforcement = {
  kind: 'strip',
  transverse: { diameterMm: 12, spacingMm: 150 },
  longitudinal: { diameterMm: 14, count: 4 },
  coverMm: 50,
};

const tieBeam: TieBeamReinforcement = {
  kind: 'tie-beam',
  bottom: { diameterMm: 16, count: 3 },
  top: { diameterMm: 16, count: 3 },
  stirrups: { diameterMm: 8, spacingMm: 200 },
  coverMm: 40,
};

describe('foundation-structural-param — pad', () => {
  it('reads mesh + cover + top-toggle', () => {
    expect(readFoundationStructuralField(pad, K.padBottomXDiameter)).toBe('12');
    expect(readFoundationStructuralField(pad, K.padBottomXSpacing)).toBe('200');
    expect(readFoundationStructuralField(pad, K.cover)).toBe('50');
    expect(readFoundationStructuralField(pad, K.padTopEnabled)).toBe('off');
  });

  it('patches spacing immutably', () => {
    const next = patchFoundationStructuralField(pad, K.padBottomXSpacing, '250') as PadReinforcement;
    expect(next.bottomMeshX.spacingMm).toBe(250);
    expect(pad.bottomMeshX.spacingMm).toBe(200); // original untouched
  });

  it('enables/disables top mesh via toggle', () => {
    const on = patchFoundationStructuralField(pad, K.padTopEnabled, 'on') as PadReinforcement;
    expect(on.topMesh).toBeDefined();
    expect(readFoundationStructuralField(on, K.padTopEnabled)).toBe('on');
    const off = patchFoundationStructuralField(on, K.padTopEnabled, 'off') as PadReinforcement;
    expect(off.topMesh).toBeUndefined();
  });

  it('returns null for keys of other kinds', () => {
    expect(readFoundationStructuralField(pad, K.stripTransverseDiameter)).toBeNull();
    expect(patchFoundationStructuralField(pad, K.tieBottomCount, '4')).toBeNull();
  });
});

describe('foundation-structural-param — strip', () => {
  it('reads transverse + longitudinal', () => {
    expect(readFoundationStructuralField(strip, K.stripTransverseSpacing)).toBe('150');
    expect(readFoundationStructuralField(strip, K.stripLongitudinalCount)).toBe('4');
    expect(readFoundationStructuralField(strip, K.stripStirrupEnabled)).toBe('off');
  });

  it('enables stirrups + patches diameter', () => {
    const on = patchFoundationStructuralField(strip, K.stripStirrupEnabled, 'on') as StripReinforcement;
    expect(on.stirrups).toBeDefined();
    const d = patchFoundationStructuralField(on, K.stripStirrupDiameter, '10') as StripReinforcement;
    expect(d.stirrups?.diameterMm).toBe(10);
  });
});

describe('foundation-structural-param — tie-beam', () => {
  it('reads bars + stirrups', () => {
    expect(readFoundationStructuralField(tieBeam, K.tieBottomCount)).toBe('3');
    expect(readFoundationStructuralField(tieBeam, K.tieStirrupSpacing)).toBe('200');
    expect(readFoundationStructuralField(tieBeam, K.tieStirrupCriticalSpacing)).toBe('200');
  });

  it('patches critical spacing', () => {
    const next = patchFoundationStructuralField(tieBeam, K.tieStirrupCriticalSpacing, '100') as TieBeamReinforcement;
    expect(next.stirrups.spacingCriticalMm).toBe(100);
  });
});
