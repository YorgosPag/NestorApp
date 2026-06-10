/**
 * ADR-408 Εύρος Β #2 — Boiler NOx emission compliance SSoT unit tests.
 *
 * Pins the pure `resolveNoxClass` + `boilerNoxLimit`: the EU Ecodesign 813/2013 per-fuel
 * NOx ceiling (gas ≤56, oil ≤120 mg/kWh) gates the verdict. Combustion fuels resolve a
 * compliant/exceeds verdict against their ceiling; non-combustion fuels (electric/heat-pump)
 * and absent/invalid figures resolve to `null` (the concept does not apply).
 */

import {
  NOX_LIMIT_GAS_MG_KWH,
  NOX_LIMIT_OIL_MG_KWH,
  boilerNoxLimit,
  resolveNoxClass,
} from '../boiler-nox';

describe('NOx limits', () => {
  it('exposes the Ecodesign 813/2013 ceilings', () => {
    expect(NOX_LIMIT_GAS_MG_KWH).toBe(56);
    expect(NOX_LIMIT_OIL_MG_KWH).toBe(120);
  });
});

describe('boilerNoxLimit', () => {
  it('returns the per-fuel ceiling for combustion fuels', () => {
    expect(boilerNoxLimit('gas')).toBe(56);
    expect(boilerNoxLimit('oil')).toBe(120);
  });
  it('returns null for non-combustion fuels (no NOx)', () => {
    expect(boilerNoxLimit('electric')).toBeNull();
    expect(boilerNoxLimit('heat-pump')).toBeNull();
  });
  it('returns null when the fuel is absent', () => {
    expect(boilerNoxLimit(undefined)).toBeNull();
  });
});

describe('resolveNoxClass — gas (≤56 mg/kWh)', () => {
  it('a clean condensing figure is compliant', () => {
    expect(resolveNoxClass(32, 'gas')).toBe('compliant');
  });
  it('exactly at the ceiling is compliant (≤ inclusive)', () => {
    expect(resolveNoxClass(56, 'gas')).toBe('compliant');
  });
  it('above the ceiling exceeds', () => {
    expect(resolveNoxClass(70, 'gas')).toBe('exceeds');
  });
});

describe('resolveNoxClass — oil (≤120 mg/kWh)', () => {
  it('a typical oil figure is compliant', () => {
    expect(resolveNoxClass(110, 'oil')).toBe('compliant');
  });
  it('exactly at the ceiling is compliant', () => {
    expect(resolveNoxClass(120, 'oil')).toBe('compliant');
  });
  it('above the ceiling exceeds', () => {
    expect(resolveNoxClass(130, 'oil')).toBe('exceeds');
  });
  it('a gas-compliant figure can exceed the gas ceiling but pass for oil', () => {
    expect(resolveNoxClass(80, 'gas')).toBe('exceeds');
    expect(resolveNoxClass(80, 'oil')).toBe('compliant');
  });
});

describe('resolveNoxClass — non-combustion & edges', () => {
  it('electric / heat-pump have no combustion NOx → null', () => {
    expect(resolveNoxClass(40, 'electric')).toBeNull();
    expect(resolveNoxClass(40, 'heat-pump')).toBeNull();
  });
  it('absent fuel → null (no ceiling to compare against)', () => {
    expect(resolveNoxClass(40, undefined)).toBeNull();
  });
  it('absent measured value → null', () => {
    expect(resolveNoxClass(undefined, 'gas')).toBeNull();
  });
  it('a negative figure is invalid → null', () => {
    expect(resolveNoxClass(-5, 'gas')).toBeNull();
  });
  it('zero emissions is compliant (≤ limit)', () => {
    expect(resolveNoxClass(0, 'gas')).toBe('compliant');
  });
});
