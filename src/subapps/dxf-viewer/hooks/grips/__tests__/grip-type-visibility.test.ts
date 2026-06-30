/// <reference types="jest" />
/**
 * @file grip-type-visibility.test.ts
 * @description SSoT guard for `isGripTypeVisible` — the ONE grip-type display predicate shared by
 * the visible render path and the hit-test producer (ADR-559 §3d).
 */

import { isGripTypeVisible } from '../grip-type-visibility';

const ALL_ON = { showMidpoints: true, showCenters: true, showQuadrants: true };
const ALL_OFF = { showMidpoints: false, showCenters: false, showQuadrants: false };

describe('isGripTypeVisible', () => {
  it('always shows structural endpoints regardless of flags', () => {
    for (const t of ['vertex', 'corner', 'control'] as const) {
      expect(isGripTypeVisible(t, ALL_OFF)).toBe(true);
      expect(isGripTypeVisible(t, ALL_ON)).toBe(true);
    }
  });

  it('gates center grips by showCenters', () => {
    expect(isGripTypeVisible('center', { ...ALL_OFF, showCenters: true })).toBe(true);
    expect(isGripTypeVisible('center', { ...ALL_ON, showCenters: false })).toBe(false);
  });

  it('gates quadrant grips by showQuadrants', () => {
    expect(isGripTypeVisible('quadrant', { ...ALL_OFF, showQuadrants: true })).toBe(true);
    expect(isGripTypeVisible('quadrant', { ...ALL_ON, showQuadrants: false })).toBe(false);
  });

  it('gates BOTH `midpoint` and the legacy `edge` alias by showMidpoints', () => {
    expect(isGripTypeVisible('midpoint', { ...ALL_OFF, showMidpoints: true })).toBe(true);
    expect(isGripTypeVisible('edge', { ...ALL_OFF, showMidpoints: true })).toBe(true);
    expect(isGripTypeVisible('midpoint', { ...ALL_ON, showMidpoints: false })).toBe(false);
    expect(isGripTypeVisible('edge', { ...ALL_ON, showMidpoints: false })).toBe(false);
  });

  it('independent axes — turning one type off leaves the others on', () => {
    const onlyCentersOff = { showMidpoints: true, showCenters: false, showQuadrants: true };
    expect(isGripTypeVisible('center', onlyCentersOff)).toBe(false);
    expect(isGripTypeVisible('quadrant', onlyCentersOff)).toBe(true);
    expect(isGripTypeVisible('edge', onlyCentersOff)).toBe(true);
    expect(isGripTypeVisible('vertex', onlyCentersOff)).toBe(true);
  });
});
