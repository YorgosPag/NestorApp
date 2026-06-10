/**
 * ADR-422 L0 — thermal-space-use-catalog resolvers (ΤΟΤΕΕ 20701-1 defaults +
 * per-space overrides «type default, instance override»).
 */

import {
  listThermalSpaceUseTypes,
  getThermalSpaceUseDefaults,
  resolveThermalSpaceSetpointC,
  resolveThermalSpaceAch,
  resolveThermalSpaceThermalBridgeSurcharge,
  resolveThermalSpaceReheatFactor,
  resolveThermalSpaceAirTightnessN50,
  resolveThermalSpaceHeatRecovery,
  resolveSolarShadingLevel,
  THERMAL_SPACE_USE_DEFAULTS,
} from '../thermal-space-use-catalog';
import {
  THERMAL_BRIDGE_SURCHARGE_PRESETS,
  REHEAT_FACTOR_PRESETS,
} from '../heat-load/heat-load-config';
import { THERMAL_SPACE_USE_TYPES } from '../../types/thermal-space-types';

describe('thermal-space-use-catalog', () => {
  it('lists every use type once, in the catalog order', () => {
    const list = listThermalSpaceUseTypes();
    expect(list).toHaveLength(THERMAL_SPACE_USE_TYPES.length);
    expect(list.map((d) => d.id)).toEqual([...THERMAL_SPACE_USE_TYPES]);
  });

  it('has an exhaustive defaults record (every use type has Ti + ACH)', () => {
    for (const useType of THERMAL_SPACE_USE_TYPES) {
      const def = getThermalSpaceUseDefaults(useType);
      expect(def.setpointTempC).toBeGreaterThan(0);
      expect(def.airChangesPerHour).toBeGreaterThan(0);
      expect(def.labelKey).toContain('thermalSpace.useTypes.');
    }
  });

  it('uses ΤΟΤΕΕ defaults when no override is present', () => {
    expect(resolveThermalSpaceSetpointC({ useType: 'bedroom' })).toBe(
      THERMAL_SPACE_USE_DEFAULTS.bedroom.setpointTempC,
    );
    expect(resolveThermalSpaceSetpointC({ useType: 'bathroom' })).toBe(24);
    expect(resolveThermalSpaceAch({ useType: 'kitchen' })).toBe(
      THERMAL_SPACE_USE_DEFAULTS.kitchen.airChangesPerHour,
    );
  });

  it('honours per-space overrides (Revit instance over type)', () => {
    expect(resolveThermalSpaceSetpointC({ useType: 'bedroom', setpointTempC: 22 })).toBe(22);
    expect(resolveThermalSpaceAch({ useType: 'bedroom', airChangesPerHour: 1.5 })).toBe(1.5);
  });

  it('ignores undefined overrides and falls back to the default', () => {
    expect(
      resolveThermalSpaceSetpointC({ useType: 'office', setpointTempC: undefined }),
    ).toBe(THERMAL_SPACE_USE_DEFAULTS.office.setpointTempC);
  });

  // ─── L1.5 — θερμογέφυρες + reheat resolvers ───────────────────────────────────

  it('θερμογέφυρες: default (απουσία override) → none = 0 (zero-regression)', () => {
    expect(resolveThermalSpaceThermalBridgeSurcharge({})).toBe(0);
    expect(resolveThermalSpaceThermalBridgeSurcharge({ thermalBridgeLevel: undefined })).toBe(0);
  });

  it('θερμογέφυρες: override → preset ΔU_TB από το config', () => {
    expect(resolveThermalSpaceThermalBridgeSurcharge({ thermalBridgeLevel: 'medium' })).toBe(
      THERMAL_BRIDGE_SURCHARGE_PRESETS.medium,
    );
    expect(resolveThermalSpaceThermalBridgeSurcharge({ thermalBridgeLevel: 'high' })).toBe(0.15);
  });

  it('reheat: default (απουσία override) → continuous = 0 (zero-regression)', () => {
    expect(resolveThermalSpaceReheatFactor({})).toBe(0);
    expect(resolveThermalSpaceReheatFactor({ reheatMode: undefined })).toBe(0);
  });

  it('reheat: override → preset f_RH από το config', () => {
    expect(resolveThermalSpaceReheatFactor({ reheatMode: 'night-setback' })).toBe(
      REHEAT_FACTOR_PRESETS['night-setback'],
    );
    expect(resolveThermalSpaceReheatFactor({ reheatMode: 'intermittent' })).toBe(22);
  });

  // ─── L1.7 — αερισμός/διείσδυση resolvers ──────────────────────────────────────

  it('αεροστεγανότητα: default (απουσία override) → unspecified n50=0 (zero-regression)', () => {
    expect(resolveThermalSpaceAirTightnessN50({})).toBe(0);
    expect(resolveThermalSpaceAirTightnessN50({ airTightnessLevel: undefined })).toBe(0);
  });

  it('αεροστεγανότητα: override → preset n50 από το config', () => {
    expect(resolveThermalSpaceAirTightnessN50({ airTightnessLevel: 'leaky' })).toBe(6.0);
    expect(resolveThermalSpaceAirTightnessN50({ airTightnessLevel: 'tight' })).toBe(1.0);
  });

  it('ανάκτηση: default (απουσία override) → natural η=0 (zero-regression)', () => {
    expect(resolveThermalSpaceHeatRecovery({})).toBe(0);
    expect(resolveThermalSpaceHeatRecovery({ ventilationSystem: undefined })).toBe(0);
    expect(resolveThermalSpaceHeatRecovery({ ventilationSystem: 'mechanical' })).toBe(0);
  });

  it('ανάκτηση: override → preset η από το config', () => {
    expect(resolveThermalSpaceHeatRecovery({ ventilationSystem: 'mechanical-hr-high' })).toBeCloseTo(0.8, 6);
    expect(resolveThermalSpaceHeatRecovery({ ventilationSystem: 'mechanical-hr-passive' })).toBeCloseTo(0.9, 6);
  });

  // ─── L7.3 — σκίαση εξωτ. εμποδίων resolver ─────────────────────────────────────

  it('σκίαση: default (απουσία override) → none (zero-regression)', () => {
    expect(resolveSolarShadingLevel({})).toBe('none');
    expect(resolveSolarShadingLevel({ solarShadingLevel: undefined })).toBe('none');
  });

  it('σκίαση: override → pass-through του επιπέδου', () => {
    expect(resolveSolarShadingLevel({ solarShadingLevel: 'light' })).toBe('light');
    expect(resolveSolarShadingLevel({ solarShadingLevel: 'moderate' })).toBe('moderate');
    expect(resolveSolarShadingLevel({ solarShadingLevel: 'heavy' })).toBe('heavy');
  });
});
