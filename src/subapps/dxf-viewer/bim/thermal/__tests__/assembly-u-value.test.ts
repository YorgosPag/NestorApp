/**
 * ADR-396 Phase P8 — tests για assembly U-value + ΚΕΝΑΚ config.
 * jest globals (describe/it/expect) — ΟΧΙ vitest import (P4 παγίδα).
 */

import {
  computeAssemblyRValue,
  computeAssemblyUValue,
  RSI_WALL_DEFAULT,
  RSE_WALL_DEFAULT,
  type ThermalLayer,
} from '../assembly-u-value';
import {
  KENAK_MAX_U_WALL,
  REFERENCE_BARE_WALL_LAYERS,
  CLIMATE_ZONE_OPTIONS,
  getKenakMaxUWall,
  isAboveKenakUMax,
  type ClimateZone,
} from '../kenak-thermal-config';

describe('computeAssemblyRValue', () => {
  it('αθροίζει Rsi + d/λ + Rse', () => {
    const layers: ThermalLayer[] = [{ thickness_m: 0.1, lambda: 0.04 }];
    // 0.13 + 0.1/0.04 + 0.04 = 0.13 + 2.5 + 0.04 = 2.67
    expect(computeAssemblyRValue(layers)).toBeCloseTo(2.67, 5);
  });

  it('χρησιμοποιεί custom surface resistances', () => {
    const r = computeAssemblyRValue([{ thickness_m: 0.2, lambda: 1 }], { rsi: 0, rse: 0 });
    expect(r).toBeCloseTo(0.2, 5);
  });

  it('αγνοεί degenerate στρώσεις (λ≤0, d≤0, μη-πεπερασμένα)', () => {
    const layers: ThermalLayer[] = [
      { thickness_m: 0.1, lambda: 0 },
      { thickness_m: 0, lambda: 0.04 },
      { thickness_m: -0.1, lambda: 0.04 },
      { thickness_m: Number.NaN, lambda: 0.04 },
      { thickness_m: 0.1, lambda: Number.POSITIVE_INFINITY },
    ];
    // καμία έγκυρη στρώση → μόνο Rsi + Rse
    expect(computeAssemblyRValue(layers)).toBeCloseTo(RSI_WALL_DEFAULT + RSE_WALL_DEFAULT, 5);
  });
});

describe('computeAssemblyUValue', () => {
  it('U = 1 / R_total', () => {
    const u = computeAssemblyUValue([{ thickness_m: 0.1, lambda: 0.04 }]);
    expect(u).toBeCloseTo(1 / 2.67, 5);
  });

  it('reference τοίχος + 10εκ Neopor → U ≈ 0.26 W/m²K', () => {
    const u = computeAssemblyUValue([
      ...REFERENCE_BARE_WALL_LAYERS,
      { thickness_m: 0.1, lambda: 0.031 },
    ]);
    expect(u).toBeCloseTo(0.26, 2);
  });

  it('πιο παχιά μόνωση → χαμηλότερο U (μονότονο)', () => {
    const u10 = computeAssemblyUValue([...REFERENCE_BARE_WALL_LAYERS, { thickness_m: 0.1, lambda: 0.031 }]);
    const u20 = computeAssemblyUValue([...REFERENCE_BARE_WALL_LAYERS, { thickness_m: 0.2, lambda: 0.031 }]);
    expect(u20).toBeLessThan(u10);
  });

  it('default Rsi/Rse = ISO 6946 wall', () => {
    expect(RSI_WALL_DEFAULT).toBe(0.13);
    expect(RSE_WALL_DEFAULT).toBe(0.04);
  });
});

describe('ΚΕΝΑΚ config', () => {
  it('getKenakMaxUWall ΤΟΤΕΕ τιμές ανά ζώνη', () => {
    expect(getKenakMaxUWall('A')).toBe(0.55);
    expect(getKenakMaxUWall('B')).toBe(0.45);
    expect(getKenakMaxUWall('C')).toBe(0.4);
    expect(getKenakMaxUWall('D')).toBe(0.35);
  });

  it('μονότονο: αυστηρότερο όριο σε ψυχρότερη ζώνη', () => {
    const zones: ClimateZone[] = ['A', 'B', 'C', 'D'];
    for (let i = 1; i < zones.length; i++) {
      expect(KENAK_MAX_U_WALL[zones[i]]).toBeLessThan(KENAK_MAX_U_WALL[zones[i - 1]]);
    }
  });

  it('isAboveKenakUMax soft-warn boundary', () => {
    expect(isAboveKenakUMax(0.5, 'B')).toBe(true); // 0.50 > 0.45
    expect(isAboveKenakUMax(0.45, 'B')).toBe(false); // ίσο = pass
    expect(isAboveKenakUMax(0.3, 'B')).toBe(false);
  });

  it('reference τοίχος + 10εκ Neopor περνά ΟΛΕΣ τις ζώνες', () => {
    const u = computeAssemblyUValue([...REFERENCE_BARE_WALL_LAYERS, { thickness_m: 0.1, lambda: 0.031 }]);
    (['A', 'B', 'C', 'D'] as ClimateZone[]).forEach((z) => {
      expect(isAboveKenakUMax(u, z)).toBe(false);
    });
  });

  it('γυμνός reference τοίχος (χωρίς μόνωση) ΑΠΟΤΥΓΧΑΝΕΙ παντού', () => {
    const u = computeAssemblyUValue([...REFERENCE_BARE_WALL_LAYERS]);
    (['A', 'B', 'C', 'D'] as ClimateZone[]).forEach((z) => {
      expect(isAboveKenakUMax(u, z)).toBe(true);
    });
  });

  it('CLIMATE_ZONE_OPTIONS καλύπτει 4 ζώνες με i18n keys', () => {
    expect(CLIMATE_ZONE_OPTIONS).toHaveLength(4);
    expect(CLIMATE_ZONE_OPTIONS.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D']);
    CLIMATE_ZONE_OPTIONS.forEach((o) => {
      expect(o.labelKey).toContain('thermalEnvelope.climateZone.zones.');
    });
  });
});
