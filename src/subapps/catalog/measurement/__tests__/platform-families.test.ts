import { PLATFORM_MEASUREMENT_FAMILIES } from '../platform-families';
import { convertMeasurement, fromStandardUnit, toStandardUnit } from '../conversion';
import {
  createMeasurementRegistry,
  createMeasurementRegistryFromRecords,
  PLATFORM_MEASUREMENT_REGISTRY,
} from '../measurement-registry';
import { validateMeasurementFamily } from '../validate-measurement-family';
import type { MeasurementFamilyDefinition } from '../../types/measurement-family';

const family = (code: string): MeasurementFamilyDefinition => {
  const found = PLATFORM_MEASUREMENT_REGISTRY.get(code);
  if (!found) throw new Error(`missing family ${code}`);
  return found;
};

describe('platform measurement library', () => {
  it('every platform family passes the same validator that guards workspace families', () => {
    for (const definition of PLATFORM_MEASUREMENT_FAMILIES) {
      expect({ code: definition.code, issues: validateMeasurementFamily(definition, { forbidPlatformCodes: false }) })
        .toEqual({ code: definition.code, issues: [] });
    }
  });

  it('family codes are unique', () => {
    const codes = PLATFORM_MEASUREMENT_FAMILIES.map((definition) => definition.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('every unit round-trips through the standard unit', () => {
    for (const definition of PLATFORM_MEASUREMENT_FAMILIES) {
      for (const unit of definition.units) {
        for (const value of [0, 1, -12.5, 1234.567]) {
          const back = fromStandardUnit(definition, toStandardUnit(definition, value, unit.code), unit.code);
          // Η μηχανή κρατά 12 σημαντικά ψηφία σε κάθε σκέλος (stripFloatNoise) — με μετατόπιση
          // (°F → K ≈ 256) το σφάλμα κλιμακώνεται με το μέγεθος του προτύπου, όχι της τιμής.
          // 1e-7 = μία τάξη κάτω από το CATALOG_LIMITS.maxDecimals (6): αόρατο σε κάθε προβολή.
          expect(Math.abs(back - value)).toBeLessThanOrEqual(Math.max(Math.abs(value), 1) * 1e-7);
        }
      }
    }
  });
});

describe('conversion — known reference values', () => {
  it('converts power the way HVAC catalogs print it', () => {
    expect(convertMeasurement(family('power'), 2.1, 'kW', 'W')).toBe(2100);
    expect(convertMeasurement(family('power'), 12000, 'BTU_h', 'kW')).toBeCloseTo(3.5168528421, 9);
    expect(convertMeasurement(family('power'), 1, 'TR', 'BTU_h')).toBeCloseTo(12000, 6);
  });

  it('handles temperature offsets and keeps temperature difference offset-free', () => {
    expect(convertMeasurement(family('temperature'), 20, 'C', 'K')).toBe(293.15);
    expect(convertMeasurement(family('temperature'), 32, 'F', 'C')).toBeCloseTo(0, 9);
    expect(convertMeasurement(family('temperature'), 100, 'C', 'F')).toBeCloseTo(212, 9);
    expect(convertMeasurement(family('temperature_difference'), 5, 'C', 'K')).toBe(5);
    expect(convertMeasurement(family('temperature_difference'), 9, 'F', 'K')).toBeCloseTo(5, 9);
  });

  it('converts air flow and pressure', () => {
    expect(convertMeasurement(family('volume_flow'), 680, 'm3_h', 'l_s')).toBeCloseTo(188.888888889, 6);
    expect(convertMeasurement(family('pressure'), 1, 'bar', 'kPa')).toBe(100);
    expect(convertMeasurement(family('pressure'), 10, 'mH2O', 'kPa')).toBeCloseTo(98.0665, 9);
  });

  it('strips floating-point noise', () => {
    expect(convertMeasurement(family('power'), 0.1, 'kW', 'W')).toBe(100);
  });

  it('throws a named error for an unknown unit or a non-finite value', () => {
    expect(() => toStandardUnit(family('power'), 1, 'hp_imperial')).toThrow('unknown unit');
    expect(() => toStandardUnit(family('power'), Number.NaN, 'W')).toThrow('non-finite');
  });
});

describe('workspace measurement families', () => {
  const custom: MeasurementFamilyDefinition = {
    code: 'luminous_efficacy',
    source: 'workspace',
    label: { kind: 'text', text: { el: 'Φωτεινή απόδοση' } },
    standardUnitCode: 'lm_W',
    comparable: false,
    units: [{ code: 'lm_W', symbol: 'lm/W', factor: 1 }],
  };

  it('accepts a valid custom family and merges it into the registry', () => {
    expect(validateMeasurementFamily(custom, { forbidPlatformCodes: true })).toEqual([]);
    const registry = createMeasurementRegistry([custom]);
    expect(registry.get('luminous_efficacy')?.source).toBe('workspace');
    expect(registry.has('power')).toBe(true);
  });

  it('builds a workspace registry from stored records, skipping deleted ones and never trusting comparability', () => {
    const stored = { code: 'luminous_efficacy', labels: { el: 'Απόδοση' }, standardUnitCode: 'lm_W', units: custom.units, singleUnit: false };
    const registry = createMeasurementRegistryFromRecords([
      { ...stored, isDeleted: false },
      { ...stored, code: 'retired_family', isDeleted: true },
    ]);
    expect(registry.get('luminous_efficacy')).toEqual(expect.objectContaining({ source: 'workspace', comparable: false }));
    expect(registry.has('retired_family')).toBe(false);
  });

  it('reserves platform codes and lets the platform win on collision', () => {
    const impostor: MeasurementFamilyDefinition = { ...custom, code: 'power' };
    expect(validateMeasurementFamily(impostor, { forbidPlatformCodes: true }).map((issue) => issue.code))
      .toContain('reservedPlatformCode');
    expect(createMeasurementRegistry([impostor]).get('power')?.source).toBe('platform');
  });

  it('reports a non-identity standard unit, bad factors and duplicate unit codes', () => {
    const broken: MeasurementFamilyDefinition = {
      ...custom,
      units: [
        { code: 'lm_W', symbol: 'lm/W', factor: 2 },
        { code: 'x', symbol: 'x', factor: 0 },
        { code: 'x', symbol: 'x', factor: 1 },
      ],
    };
    const codes = validateMeasurementFamily(broken, { forbidPlatformCodes: true }).map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(['unitStandardNotIdentity', 'unitInvalidFactor', 'duplicateCode']));
  });
});
