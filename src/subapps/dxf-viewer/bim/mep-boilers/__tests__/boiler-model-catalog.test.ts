/**
 * ADR-408 Εύρος Β — Boiler Model Catalog unit tests.
 *
 * Coverage:
 *   - listBoilerModels: non-empty, unique ids
 *   - resolveBoilerModel: hit / miss
 *   - applyBoilerModelToParams: writes all catalog fields into params
 *   - clearBoilerModel: strips modelId + fuelType, preserves the rest
 */

import {
  BOILER_MODEL_CATALOG,
  BOILER_FUEL_TYPES,
  isBoilerFuelType,
  listBoilerModels,
  resolveBoilerModel,
  applyBoilerModelToParams,
  clearBoilerModel,
  type BoilerFuelType,
} from '../boiler-model-catalog';
import type { MepBoilerParams } from '../../types/mep-boiler-types';

// ─── Minimal boiler params fixture ────────────────────────────────────────────

const BASE_PARAMS: MepBoilerParams = {
  kind: 'wall-boiler',
  shape: 'rectangular',
  position: { x: 0, y: 0, z: 0 },
  rotation: 0,
  width: 500,
  length: 400,
  bodyHeightMm: 800,
  mountingElevationMm: 1200,
  connectorDiameterMm: 22,
  systemClassification: 'hydronic-supply',
  sceneUnits: 'mm',
  connectors: [],
};

// ─── listBoilerModels ─────────────────────────────────────────────────────────

describe('listBoilerModels', () => {
  it('returns a non-empty list', () => {
    expect(listBoilerModels().length).toBeGreaterThan(0);
  });

  it('returns the same reference as BOILER_MODEL_CATALOG', () => {
    expect(listBoilerModels()).toBe(BOILER_MODEL_CATALOG);
  });

  it('all entries have unique ids', () => {
    const ids = listBoilerModels().map((m) => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all entries have positive thermalOutputW', () => {
    listBoilerModels().forEach((m) => {
      expect(m.thermalOutputW).toBeGreaterThan(0);
    });
  });

  it('all entries have positive dimension values', () => {
    listBoilerModels().forEach((m) => {
      expect(m.widthMm).toBeGreaterThan(0);
      expect(m.depthMm).toBeGreaterThan(0);
      expect(m.bodyHeightMm).toBeGreaterThan(0);
      expect(m.connectorDiameterMm).toBeGreaterThan(0);
    });
  });

  it('all entries have a positive seasonal efficiency', () => {
    listBoilerModels().forEach((m) => {
      expect(m.seasonalEfficiencyPercent).toBeGreaterThan(0);
    });
  });

  it('marks the gas presets condensing and the rest non-condensing', () => {
    // Gas presets (94/93/91%) are condensing appliances → produce condensate to drain.
    // Traditional floor-standing oil, heat-pumps and direct-electric do not.
    listBoilerModels().forEach((m) => {
      expect(m.condensing).toBe(m.fuelType === 'gas');
    });
  });
});

// ─── resolveBoilerModel ───────────────────────────────────────────────────────

describe('resolveBoilerModel', () => {
  it('returns the correct preset for a known id', () => {
    const preset = resolveBoilerModel('gas-condensing-24');
    expect(preset).toBeDefined();
    expect(preset?.id).toBe('gas-condensing-24');
    expect(preset?.thermalOutputW).toBe(24000);
    expect(preset?.fuelType).toBe('gas');
  });

  it('returns undefined for an unknown id', () => {
    expect(resolveBoilerModel('non-existent-boiler')).toBeUndefined();
  });

  it('resolves every id in the catalog', () => {
    listBoilerModels().forEach((m) => {
      expect(resolveBoilerModel(m.id)).toBe(m);
    });
  });
});

// ─── applyBoilerModelToParams ─────────────────────────────────────────────────

describe('applyBoilerModelToParams', () => {
  const model = resolveBoilerModel('gas-condensing-24');

  it('writes thermalOutputW from the preset', () => {
    const next = applyBoilerModelToParams(BASE_PARAMS, model!);
    expect(next.thermalOutputW).toBe(24000);
  });

  it('writes width from preset.widthMm', () => {
    const next = applyBoilerModelToParams(BASE_PARAMS, model!);
    expect(next.width).toBe(model!.widthMm);
  });

  it('writes length from preset.depthMm', () => {
    const next = applyBoilerModelToParams(BASE_PARAMS, model!);
    expect(next.length).toBe(model!.depthMm);
  });

  it('writes bodyHeightMm from the preset', () => {
    const next = applyBoilerModelToParams(BASE_PARAMS, model!);
    expect(next.bodyHeightMm).toBe(model!.bodyHeightMm);
  });

  it('writes connectorDiameterMm from the preset', () => {
    const next = applyBoilerModelToParams(BASE_PARAMS, model!);
    expect(next.connectorDiameterMm).toBe(model!.connectorDiameterMm);
  });

  it('writes modelId as the preset id', () => {
    const next = applyBoilerModelToParams(BASE_PARAMS, model!);
    expect(next.modelId).toBe('gas-condensing-24');
  });

  it('writes fuelType from the preset', () => {
    const next = applyBoilerModelToParams(BASE_PARAMS, model!);
    expect(next.fuelType).toBe('gas');
  });

  it('writes seasonalEfficiencyPercent from the preset', () => {
    const next = applyBoilerModelToParams(BASE_PARAMS, model!);
    expect(next.seasonalEfficiencyPercent).toBe(model!.seasonalEfficiencyPercent);
  });

  it('writes condensing from the preset (gas condensing → true)', () => {
    const next = applyBoilerModelToParams(BASE_PARAMS, model!);
    expect(next.condensing).toBe(true);
  });

  it('writes minThermalOutputW for a modulating preset (gas condensing 24 → 6000)', () => {
    const next = applyBoilerModelToParams(BASE_PARAMS, model!);
    expect(next.minThermalOutputW).toBe(6000);
  });

  it('clears minThermalOutputW for an on/off preset (oil floor → undefined)', () => {
    const oil = resolveBoilerModel('oil-floor-30');
    const next = applyBoilerModelToParams(BASE_PARAMS, oil!);
    expect(next.minThermalOutputW).toBeUndefined();
  });

  it('is pure — does not mutate the original params', () => {
    const before = { ...BASE_PARAMS };
    applyBoilerModelToParams(BASE_PARAMS, model!);
    expect(BASE_PARAMS.width).toBe(before.width);
    expect(BASE_PARAMS.modelId).toBeUndefined();
  });

  it('preserves fields not in the preset (position, rotation, mountingElevation)', () => {
    const next = applyBoilerModelToParams(BASE_PARAMS, model!);
    expect(next.position).toBe(BASE_PARAMS.position);
    expect(next.rotation).toBe(BASE_PARAMS.rotation);
    expect(next.mountingElevationMm).toBe(BASE_PARAMS.mountingElevationMm);
  });

  it('works for every catalog entry', () => {
    listBoilerModels().forEach((m) => {
      const next = applyBoilerModelToParams(BASE_PARAMS, m);
      expect(next.modelId).toBe(m.id);
      expect(next.fuelType).toBe(m.fuelType);
      expect(next.thermalOutputW).toBe(m.thermalOutputW);
    });
  });
});

// ─── clearBoilerModel ─────────────────────────────────────────────────────────

describe('clearBoilerModel', () => {
  const withModel = applyBoilerModelToParams(BASE_PARAMS, resolveBoilerModel('oil-floor-30')!);

  it('sets modelId to undefined', () => {
    const cleared = clearBoilerModel(withModel);
    expect(cleared.modelId).toBeUndefined();
  });

  it('sets fuelType to undefined', () => {
    const cleared = clearBoilerModel(withModel);
    expect(cleared.fuelType).toBeUndefined();
  });

  it('sets seasonalEfficiencyPercent to undefined (a Type-Catalog property)', () => {
    const cleared = clearBoilerModel(withModel);
    expect(cleared.seasonalEfficiencyPercent).toBeUndefined();
  });

  it('sets condensing to undefined (a Type-Catalog property)', () => {
    const cleared = clearBoilerModel(withModel);
    expect(cleared.condensing).toBeUndefined();
  });

  it('sets minThermalOutputW to undefined (a Type-Catalog property)', () => {
    const withModulating = applyBoilerModelToParams(
      BASE_PARAMS,
      resolveBoilerModel('gas-condensing-24')!,
    );
    expect(withModulating.minThermalOutputW).toBe(6000);
    expect(clearBoilerModel(withModulating).minThermalOutputW).toBeUndefined();
  });

  it('preserves all other params (width, thermalOutputW, position, etc.)', () => {
    const cleared = clearBoilerModel(withModel);
    // geometry fields set by applyBoilerModelToParams remain (user can then adjust)
    expect(cleared.width).toBe(withModel.width);
    expect(cleared.thermalOutputW).toBe(withModel.thermalOutputW);
    expect(cleared.position).toBe(withModel.position);
    expect(cleared.rotation).toBe(withModel.rotation);
  });

  it('is idempotent — clearing an already-clear params is safe', () => {
    const cleared = clearBoilerModel(BASE_PARAMS);
    expect(cleared.modelId).toBeUndefined();
    expect(cleared.fuelType).toBeUndefined();
  });

  it('is pure — does not mutate the original params', () => {
    clearBoilerModel(withModel);
    expect(withModel.modelId).toBe('oil-floor-30');
  });
});

// ─── BOILER_FUEL_TYPES + isBoilerFuelType (standalone fuel-type picker SSoT) ───

describe('BOILER_FUEL_TYPES', () => {
  it('lists exactly the four BoilerFuelType members', () => {
    expect(BOILER_FUEL_TYPES).toEqual(['gas', 'oil', 'electric', 'heat-pump']);
  });

  it('has no duplicate entries', () => {
    expect(new Set(BOILER_FUEL_TYPES).size).toBe(BOILER_FUEL_TYPES.length);
  });

  it('covers every fuelType used in the model catalog', () => {
    listBoilerModels().forEach((m) => {
      expect(BOILER_FUEL_TYPES).toContain(m.fuelType);
    });
  });

  it('is assignable to BoilerFuelType[] (compile-time membership)', () => {
    const fuels: readonly BoilerFuelType[] = BOILER_FUEL_TYPES;
    expect(fuels.length).toBe(4);
  });
});

describe('isBoilerFuelType', () => {
  it('returns true for every member of BOILER_FUEL_TYPES', () => {
    BOILER_FUEL_TYPES.forEach((fuel) => {
      expect(isBoilerFuelType(fuel)).toBe(true);
    });
  });

  it('returns false for unrelated strings', () => {
    expect(isBoilerFuelType('')).toBe(false);
    expect(isBoilerFuelType('biomass')).toBe(false);
    expect(isBoilerFuelType('GAS')).toBe(false);
    expect(isBoilerFuelType('heat_pump')).toBe(false);
  });
});
