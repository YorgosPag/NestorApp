/**
 * ADR-422 L0 — thermal-space-use-catalog resolvers (ΤΟΤΕΕ 20701-1 defaults +
 * per-space overrides «type default, instance override»).
 */

import {
  listThermalSpaceUseTypes,
  getThermalSpaceUseDefaults,
  resolveThermalSpaceSetpointC,
  resolveThermalSpaceAch,
  THERMAL_SPACE_USE_DEFAULTS,
} from '../thermal-space-use-catalog';
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
});
