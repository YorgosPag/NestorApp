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
  listBoilerModels,
  resolveBoilerModel,
  applyBoilerModelToParams,
  clearBoilerModel,
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
