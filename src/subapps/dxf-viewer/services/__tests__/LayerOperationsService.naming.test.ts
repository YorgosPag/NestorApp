/**
 * LayerOperationsService — Phase 9B naming trust boundary (ADR-358 §5.6 Q9).
 *
 * Verifies that `createLayer`, `renameLayer`, and `deleteLayer` reject invalid
 * names at the service layer (defender hierarchy line 993-998). The validator
 * itself is unit-tested in `layer-name-validator.test.ts`; here we only assert
 * that the service wires it correctly and that Layer "0" delete is guarded.
 */

import { describe, it, expect } from '@jest/globals';
import { createSceneLayer } from '../../types/entities';
import type { SceneLayer, SceneModel } from '../../types/entities';
import { LayerOperationsService } from '../LayerOperationsService';

function makeScene(layers: SceneLayer[], entityLayers: string[] = []): SceneModel {
  const layerMap: Record<string, SceneLayer> = {};
  for (const l of layers) layerMap[l.name] = l;
  const entities = entityLayers.map((name, i) => ({
    id: `ent_${i}`,
    type: 'line' as const,
    layer: name,
    visible: true,
    color: '#ffffff',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  })) as unknown as SceneModel['entities'];
  return {
    entities,
    layers: layerMap,
    bounds: { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } },
    units: 'mm',
  };
}

const layer0 = (): SceneLayer =>
  createSceneLayer({ id: 'lyr_0', name: '0', color: '#ffffff' });
const layerA = (): SceneLayer =>
  createSceneLayer({ id: 'lyr_a', name: 'Walls', color: '#ff0000' });
const layerB = (): SceneLayer =>
  createSceneLayer({ id: 'lyr_b', name: 'Doors', color: '#00ff00' });

let service: LayerOperationsService;
beforeEach(() => {
  service = new LayerOperationsService();
});

// ─── renameLayer ────────────────────────────────────────────────────────────

describe('LayerOperationsService.renameLayer — name guard (ADR-358 §5.6 Q9)', () => {
  it('rejects renaming Layer "0" → other name with RESERVED', () => {
    const scene = makeScene([layer0(), layerA()]);
    const r = service.renameLayer('0', 'NewZero', scene);
    expect(r.success).toBe(false);
    expect(r.validationError).toBe('RESERVED');
    expect(r.updatedScene).toBe(scene);
  });

  it('rejects rename onto duplicate name with DUPLICATE', () => {
    const scene = makeScene([layerA(), layerB()]);
    const r = service.renameLayer('Walls', 'Doors', scene);
    expect(r.success).toBe(false);
    expect(r.validationError).toBe('DUPLICATE');
  });

  it('rejects rename to invalid char with INVALID_CHARS', () => {
    const scene = makeScene([layerA()]);
    const r = service.renameLayer('Walls', 'Wall<s>', scene);
    expect(r.success).toBe(false);
    expect(r.validationError).toBe('INVALID_CHARS');
  });

  it('rejects rename to empty with EMPTY', () => {
    const scene = makeScene([layerA()]);
    const r = service.renameLayer('Walls', '', scene);
    expect(r.success).toBe(false);
    expect(r.validationError).toBe('EMPTY');
  });

  it('rejects rename to whitespace-padded with LEADING_TRAILING_WS', () => {
    const scene = makeScene([layerA()]);
    const r = service.renameLayer('Walls', '  Foo', scene);
    expect(r.success).toBe(false);
    expect(r.validationError).toBe('LEADING_TRAILING_WS');
  });

  it('rejects rename of other layer into "0" with RESERVED', () => {
    const scene = makeScene([layer0(), layerA()]);
    const r = service.renameLayer('Walls', '0', scene);
    expect(r.success).toBe(false);
    expect(r.validationError).toBe('RESERVED');
  });

  it('accepts a valid rename — updates layers + entity layer refs', () => {
    const scene = makeScene([layerA()], ['Walls', 'Walls']);
    const r = service.renameLayer('Walls', 'Pareti', scene);
    expect(r.success).toBe(true);
    expect(r.validationError).toBeUndefined();
    expect(r.updatedScene.layers['Pareti']).toBeDefined();
    expect(r.updatedScene.layers['Walls']).toBeUndefined();
    expect(r.updatedScene.entities.every((e) => e.layer === 'Pareti')).toBe(true);
  });

  it('idempotent no-op for oldName === newName', () => {
    const scene = makeScene([layerA()]);
    const r = service.renameLayer('Walls', 'Walls', scene);
    expect(r.success).toBe(true);
    expect(r.message).toBe('Layer name unchanged');
  });
});

// ─── createLayer ────────────────────────────────────────────────────────────

describe('LayerOperationsService.createLayer — name guard (ADR-358 §5.6 Q9)', () => {
  it('rejects creating name "0" with RESERVED', () => {
    const scene = makeScene([layer0()]);
    const r = service.createLayer({ name: '0', color: '#ffffff' }, scene);
    expect(r.success).toBe(false);
    expect(r.validationError).toBe('RESERVED');
  });

  it('rejects duplicate name with DUPLICATE', () => {
    const scene = makeScene([layerA()]);
    const r = service.createLayer({ name: 'Walls', color: '#fff' }, scene);
    expect(r.success).toBe(false);
    expect(r.validationError).toBe('DUPLICATE');
  });

  it('rejects invalid char with INVALID_CHARS', () => {
    const scene = makeScene([]);
    const r = service.createLayer({ name: 'Bad*Name', color: '#fff' }, scene);
    expect(r.success).toBe(false);
    expect(r.validationError).toBe('INVALID_CHARS');
  });

  it('accepts a valid create — extends scene.layers', () => {
    const scene = makeScene([layerA()]);
    const r = service.createLayer({ name: 'Roof', color: '#0000ff' }, scene);
    expect(r.success).toBe(true);
    expect(r.validationError).toBeUndefined();
    expect(r.updatedScene.layers['Roof']).toBeDefined();
    expect(r.updatedScene.layers['Roof']!.color).toBe('#0000ff');
  });
});

// ─── deleteLayer ────────────────────────────────────────────────────────────

describe('LayerOperationsService.deleteLayer — Layer "0" guard (ADR-358 §5.6 line 1000-1005)', () => {
  it('rejects deleting Layer "0" with RESERVED', () => {
    const scene = makeScene([layer0(), layerA()]);
    const r = service.deleteLayer('0', scene);
    expect(r.success).toBe(false);
    expect(r.validationError).toBe('RESERVED');
    expect(r.updatedScene).toBe(scene);
  });

  it('accepts deleting a non-reserved layer — purges layer + entities', () => {
    const scene = makeScene([layerA(), layerB()], ['Walls', 'Walls', 'Doors']);
    const r = service.deleteLayer('Walls', scene);
    expect(r.success).toBe(true);
    expect(r.updatedScene.layers['Walls']).toBeUndefined();
    expect(r.updatedScene.entities.every((e) => e.layer !== 'Walls')).toBe(true);
    expect(r.affectedEntityIds?.length).toBe(2);
  });

  it('returns failure for non-existent layer (no validation error)', () => {
    const scene = makeScene([layerA()]);
    const r = service.deleteLayer('Ghost', scene);
    expect(r.success).toBe(false);
    expect(r.validationError).toBeUndefined();
  });
});
