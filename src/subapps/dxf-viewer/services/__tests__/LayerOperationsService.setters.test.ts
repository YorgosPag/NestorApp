/**
 * LayerOperationsService — Phase 8.5 SSoT property setters (ADR-358 §7.2).
 *
 * Tests the 5 new setters (setLineweight / setLinetype / setTransparency /
 * setPlottable / setFrozen) that mutate via `LayerStore.upsertLayer` SSoT.
 * No mock — exercises the real LayerStore + LinetypeRegistry against seeded
 * fixtures.
 */

import {
  __resetLayerStoreForTesting,
  setLayers,
  getLayer,
  subscribeLayerStore,
} from '../../stores/LayerStore';
import { __resetLinetypeRegistryForTesting, registerLinetype } from '../../stores/LinetypeRegistry';
import { createSceneLayer } from '../../types/entities';
import { LayerOperationsService } from '../LayerOperationsService';
import type { LineweightMm } from '../../types/entities';

const LAYER_ID = 'lyr_test_01';
const OTHER_ID = 'lyr_test_02';

function seed(): void {
  setLayers([
    createSceneLayer({
      id: LAYER_ID,
      name: 'TEST',
      color: '#ffffff',
      visible: true,
      locked: false,
      linetype: 'Continuous',
      lineweight: 0.25 as LineweightMm,
      transparency: 0,
      plottable: true,
      frozen: false,
    }),
    createSceneLayer({
      id: OTHER_ID,
      name: 'OTHER',
      color: '#ff0000',
      visible: true,
      locked: false,
    }),
  ]);
}

let service: LayerOperationsService;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  __resetLayerStoreForTesting();
  __resetLinetypeRegistryForTesting();
  seed();
  service = new LayerOperationsService();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

// ─── setLineweight ──────────────────────────────────────────────────────────

describe('LayerOperationsService.setLineweight', () => {
  it('happy path: writes ISO value via upsertLayer', () => {
    service.setLineweight(LAYER_ID, 0.5 as LineweightMm);
    expect(getLayer(LAYER_ID)?.lineweight).toBe(0.5);
  });

  it('no-op for missing layer', () => {
    const listener = jest.fn();
    const unsub = subscribeLayerStore(listener);
    service.setLineweight('lyr_missing', 0.5 as LineweightMm);
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  it('idempotent: same value triggers no notify', () => {
    const listener = jest.fn();
    const unsub = subscribeLayerStore(listener);
    service.setLineweight(LAYER_ID, 0.25 as LineweightMm);
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  it('special sentinel -2 (ByLayer) passes through', () => {
    service.setLineweight(LAYER_ID, -2 as LineweightMm);
    expect(getLayer(LAYER_ID)?.lineweight).toBe(-2);
  });

  it('special sentinel -3 (Default) passes through', () => {
    service.setLineweight(LAYER_ID, -3 as LineweightMm);
    expect(getLayer(LAYER_ID)?.lineweight).toBe(-3);
  });

  it('rounds-to-ISO via parseDxfCode370 + warns when input differs', () => {
    service.setLineweight(LAYER_ID, 0.249 as unknown as LineweightMm);
    expect(getLayer(LAYER_ID)?.lineweight).toBe(0.25);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Non-ISO'));
  });

  it('out-of-tolerance value snaps to DEFAULT (-3) + warns', () => {
    service.setLineweight(LAYER_ID, 0.27 as unknown as LineweightMm);
    expect(getLayer(LAYER_ID)?.lineweight).toBe(-3);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Non-ISO'));
  });
});

// ─── setLinetype ────────────────────────────────────────────────────────────

describe('LayerOperationsService.setLinetype', () => {
  it('happy path: writes ISO baseline name', () => {
    service.setLinetype(LAYER_ID, 'Dashed');
    expect(getLayer(LAYER_ID)?.linetype).toBe('Dashed');
  });

  it('happy path: writes runtime-registered custom linetype', () => {
    registerLinetype({
      name: 'CustomDashed',
      description: 'Test',
      pattern: [10, -5],
      origin: 'user-created',
    });
    service.setLinetype(LAYER_ID, 'CustomDashed');
    expect(getLayer(LAYER_ID)?.linetype).toBe('CustomDashed');
  });

  it('unknown name → fallback Continuous + warn', () => {
    service.setLinetype(LAYER_ID, 'NotRegistered');
    expect(getLayer(LAYER_ID)?.linetype).toBe('Continuous');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown linetype'));
  });

  it('no-op for missing layer', () => {
    const listener = jest.fn();
    const unsub = subscribeLayerStore(listener);
    service.setLinetype('lyr_missing', 'Dashed');
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  it('idempotent: same name triggers no notify', () => {
    const listener = jest.fn();
    const unsub = subscribeLayerStore(listener);
    service.setLinetype(LAYER_ID, 'Continuous');
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });
});

// ─── setTransparency ────────────────────────────────────────────────────────

describe('LayerOperationsService.setTransparency', () => {
  it('happy path: writes in-range value', () => {
    service.setTransparency(LAYER_ID, 45);
    expect(getLayer(LAYER_ID)?.transparency).toBe(45);
  });

  it('clamps values >90 to 90', () => {
    service.setTransparency(LAYER_ID, 95);
    expect(getLayer(LAYER_ID)?.transparency).toBe(90);
  });

  it('clamps negative values to 0', () => {
    service.setTransparency(LAYER_ID, -5);
    expect(getLayer(LAYER_ID)?.transparency).toBe(0);
  });

  it('no-op for missing layer', () => {
    const listener = jest.fn();
    const unsub = subscribeLayerStore(listener);
    service.setTransparency('lyr_missing', 50);
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  it('idempotent: same value triggers no notify', () => {
    const listener = jest.fn();
    const unsub = subscribeLayerStore(listener);
    service.setTransparency(LAYER_ID, 0);
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });
});

// ─── setPlottable ───────────────────────────────────────────────────────────

describe('LayerOperationsService.setPlottable', () => {
  it('happy path: toggles to false', () => {
    service.setPlottable(LAYER_ID, false);
    expect(getLayer(LAYER_ID)?.plottable).toBe(false);
  });

  it('no-op for missing layer', () => {
    const listener = jest.fn();
    const unsub = subscribeLayerStore(listener);
    service.setPlottable('lyr_missing', false);
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  it('idempotent: same value triggers no notify', () => {
    const listener = jest.fn();
    const unsub = subscribeLayerStore(listener);
    service.setPlottable(LAYER_ID, true);
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });
});

// ─── setFrozen ──────────────────────────────────────────────────────────────

describe('LayerOperationsService.setFrozen', () => {
  it('happy path: toggles to true', () => {
    service.setFrozen(LAYER_ID, true);
    expect(getLayer(LAYER_ID)?.frozen).toBe(true);
  });

  it('no-op for missing layer', () => {
    const listener = jest.fn();
    const unsub = subscribeLayerStore(listener);
    service.setFrozen('lyr_missing', true);
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  it('idempotent: same value triggers no notify', () => {
    const listener = jest.fn();
    const unsub = subscribeLayerStore(listener);
    service.setFrozen(LAYER_ID, false);
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  it('treats undefined frozen as false (idempotent vs false)', () => {
    const listener = jest.fn();
    const unsub = subscribeLayerStore(listener);
    service.setFrozen(OTHER_ID, false); // OTHER has no frozen field
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });
});
