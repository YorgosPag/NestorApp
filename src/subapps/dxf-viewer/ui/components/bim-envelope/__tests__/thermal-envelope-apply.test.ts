/**
 * ADR-396 Phase P6 — Thermal Envelope authoring: pure conversion + apply
 * orchestration unit tests. Καλύπτει τη λογική του command «Εφαρμογή
 * Θερμοπρόσοψης» χωρίς React render (jest globals — ΟΧΙ vitest, P4/P5 παγίδα).
 */

import {
  mmToClampedMeters,
  metersToMm,
  isBelowKenakAdvisory,
  MIN_ENVELOPE_THICKNESS_M,
  KENAK_MIN_THICKNESS_M,
  ENVELOPE_MATERIAL_OPTIONS,
  GRAPHITE_EPS_MATERIAL_ID,
  type ThermalEnvelopeSpec,
} from '../../../../bim/types/thermal-envelope-types';
import {
  buildDefaultSpec,
  getEnvelopeSpec,
  setEnvelopeSpec,
  subscribeEnvelopeSpec,
  __resetEnvelopeSpecStore,
} from '../../../../bim/stores/envelope-spec-store';

describe('ADR-396 P6 — mm ↔ m conversion (UI input ↔ spec SSoT)', () => {
  it('mm → m: 100mm = 0.10m, 70mm = 0.07m', () => {
    expect(mmToClampedMeters(100, 0.1)).toBeCloseTo(0.1, 6);
    expect(mmToClampedMeters('70', 0.1)).toBeCloseTo(0.07, 6);
  });

  it('clamps below D6 minimum (≥5εκ)', () => {
    expect(mmToClampedMeters(30, 0.1)).toBe(MIN_ENVELOPE_THICKNESS_M);
    expect(mmToClampedMeters(0, 0.1)).toBe(MIN_ENVELOPE_THICKNESS_M);
  });

  it('non-finite input keeps the fallback', () => {
    expect(mmToClampedMeters('', 0.123)).toBe(0.123);
    expect(mmToClampedMeters('abc', 0.08)).toBe(0.08);
    expect(mmToClampedMeters(Number.NaN, 0.09)).toBe(0.09);
  });

  it('m → mm: rounds to integer', () => {
    expect(metersToMm(0.1)).toBe(100);
    expect(metersToMm(0.0701)).toBe(70);
  });
});

describe('ADR-396 P6 — ΚΕΝΑΚ advisory boundary (soft-warn, no block)', () => {
  it('facade (Z1) below 7εκ warns, at/above does not', () => {
    expect(isBelowKenakAdvisory(KENAK_MIN_THICKNESS_M.facade - 0.001, 'Z1')).toBe(true);
    expect(isBelowKenakAdvisory(KENAK_MIN_THICKNESS_M.facade, 'Z1')).toBe(false);
    expect(isBelowKenakAdvisory(0.1, 'Z1')).toBe(false);
  });

  it('reveal (Z4) uses the smaller 2εκ threshold', () => {
    expect(isBelowKenakAdvisory(0.015, 'Z4')).toBe(true);
    expect(isBelowKenakAdvisory(KENAK_MIN_THICKNESS_M.reveal, 'Z4')).toBe(false);
  });
});

describe('ADR-396 P6 — material picker options (SSoT)', () => {
  it('offers exactly Neopor + XPS (§2.2 scope)', () => {
    const ids = ENVELOPE_MATERIAL_OPTIONS.map((o) => o.id);
    expect(ids).toEqual([GRAPHITE_EPS_MATERIAL_ID, 'mat-xps']);
    for (const opt of ENVELOPE_MATERIAL_OPTIONS) {
      expect(opt.labelKey).toMatch(/^ribbon\.commands\.thermalEnvelope\.materials\./);
    }
  });
});

describe('ADR-396 P6 — apply orchestration (per-floor / all floors)', () => {
  beforeEach(() => __resetEnvelopeSpecStore());

  const customSpec: ThermalEnvelopeSpec = {
    materialId: 'mat-xps',
    thickness_m: 0.08,
    revealThickness_m: 0.04,
    zones: { Z1: true, Z2: false, Z3: true, Z4: false },
  };

  it('apply to current floor writes only that level', () => {
    setEnvelopeSpec('level-1', customSpec);
    expect(getEnvelopeSpec('level-1')).toEqual(customSpec);
    expect(getEnvelopeSpec('level-2')).toBeNull();
  });

  it('apply to all floors writes every level (D3)', () => {
    const levelIds = ['level-1', 'level-2', 'level-3'];
    for (const id of levelIds) setEnvelopeSpec(id, customSpec);
    for (const id of levelIds) expect(getEnvelopeSpec(id)).toEqual(customSpec);
  });

  it('notifies subscribers on apply (drives 2D overlay + 3D resync)', () => {
    let hits = 0;
    const unsub = subscribeEnvelopeSpec(() => { hits += 1; });
    setEnvelopeSpec('level-1', customSpec);
    setEnvelopeSpec('level-2', customSpec);
    unsub();
    setEnvelopeSpec('level-3', customSpec);
    expect(hits).toBe(2);
  });

  it('default spec = Neopor, all zones on, 10εκ / 5εκ', () => {
    const def = buildDefaultSpec();
    expect(def.materialId).toBe(GRAPHITE_EPS_MATERIAL_ID);
    expect(def.thickness_m).toBeCloseTo(0.1, 6);
    expect(def.revealThickness_m).toBeCloseTo(0.05, 6);
    expect(def.zones).toEqual({ Z1: true, Z2: true, Z3: true, Z4: true });
  });
});
