/**
 * ADR-408 Εύρος Β #2 — Boiler efficiency + EU ErP energy-class SSoT unit tests.
 *
 * Pins the pure `resolveErpClass`: the official 811/2013 ladder is applied to the
 * primary-energy-adjusted η_s, so combustion/heat-pump (factor 1.0) map straight
 * from their appliance efficiency, while direct electric (CC = 2.5) is penalised
 * — a ~99% resistance boiler lands at class D, not "A+". Also covers the class
 * registry + guard.
 */

import {
  ERP_EFFICIENCY_CLASSES,
  isErpEfficiencyClass,
  resolveErpClass,
} from '../boiler-efficiency';

describe('ERP_EFFICIENCY_CLASSES', () => {
  it('lists ten classes, best → worst', () => {
    expect(ERP_EFFICIENCY_CLASSES).toEqual([
      'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G',
    ]);
  });
});

describe('isErpEfficiencyClass', () => {
  it('accepts known classes', () => {
    expect(isErpEfficiencyClass('A+++')).toBe(true);
    expect(isErpEfficiencyClass('D')).toBe(true);
  });
  it('rejects unknown values', () => {
    expect(isErpEfficiencyClass('A++++')).toBe(false);
    expect(isErpEfficiencyClass('')).toBe(false);
    expect(isErpEfficiencyClass('x')).toBe(false);
  });
});

describe('resolveErpClass — combustion (factor 1.0)', () => {
  it('condensing gas ≈94% → A', () => {
    expect(resolveErpClass(94, 'gas')).toBe('A');
  });
  it('oil ≈89% → B', () => {
    expect(resolveErpClass(89, 'oil')).toBe('B');
  });
  it('a mid-grade ≈98% gas → A+', () => {
    expect(resolveErpClass(98, 'gas')).toBe('A+');
  });
  it('a poor ≈70% boiler → D', () => {
    expect(resolveErpClass(70, 'gas')).toBe('D');
  });
});

describe('resolveErpClass — heat-pump (SCOP-derived η_s, factor 1.0)', () => {
  it('η_s ≈156% → A+++', () => {
    expect(resolveErpClass(156, 'heat-pump')).toBe('A+++');
  });
  it('η_s = 150 lands exactly on A+++ (inclusive)', () => {
    expect(resolveErpClass(150, 'heat-pump')).toBe('A+++');
  });
  it('η_s ≈130% → A++', () => {
    expect(resolveErpClass(130, 'heat-pump')).toBe('A++');
  });
});

describe('resolveErpClass — direct electric (CC = 2.5 penalty)', () => {
  it('≈99% appliance → η_s ≈40% → D', () => {
    expect(resolveErpClass(99, 'electric')).toBe('D');
  });
  it('100% appliance → η_s = 40% → D', () => {
    expect(resolveErpClass(100, 'electric')).toBe('D');
  });
  it('a low-grade ≈80% electric → η_s = 32% → F', () => {
    expect(resolveErpClass(80, 'electric')).toBe('F');
  });
});

describe('resolveErpClass — defaults & edges', () => {
  it('absent fuelType is treated as fossil (factor 1.0)', () => {
    expect(resolveErpClass(94)).toBe('A');
  });
  it('a near-zero efficiency falls through to G', () => {
    expect(resolveErpClass(10, 'gas')).toBe('G');
  });
});
