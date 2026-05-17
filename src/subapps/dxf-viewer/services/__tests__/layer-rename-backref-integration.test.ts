/**
 * ADR-358 Phase 15 — Integration: layer rename → backref stability.
 *
 * Tests that renaming a layer via `LayerOperationsService.renameLayer()` keeps:
 *   1. Scene: entities retain their `layerId` (stable ID, ADR-358 Phase 9D-5a).
 *   2. LayerStore: `getLayer(id)` still resolves → renamed layer.
 *   3. LayerStore: `getLayerByName(newName)` finds the layer.
 *   4. LayerStore: `getLayerByName(oldName)` returns null after store update.
 *   5. Regions (overlay entities using layerId): unaffected by name change.
 *   6. Command-history pattern: operations keyed by layerId survive rename.
 *   7. Multiple renames accumulate correctly (id always stable).
 *   8. Rename into Layer "0" is rejected (RESERVED guard).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LayerOperationsService } from '../LayerOperationsService';
import { createSceneLayer } from '../../types/entities';
import type { SceneLayer, SceneModel } from '../../types/entities';
import {
  __resetLayerStoreForTesting,
  setLayers,
  getLayer,
  getLayerByName,
  upsertLayer,
} from '../../stores/LayerStore';

beforeEach(() => {
  __resetLayerStoreForTesting();
});

const svc = new LayerOperationsService();

function makeScene(layers: SceneLayer[], entityLayerIds: string[] = []): SceneModel {
  const layersById: Record<string, SceneLayer> = {};
  for (const l of layers) layersById[l.id] = l;
  const entities = entityLayerIds.map((lid, i) => ({
    id: `ent_${i}`,
    type: 'line' as const,
    layerId: lid,
    visible: true,
    color: '#ffffff',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  })) as unknown as SceneModel['entities'];
  return {
    entities,
    layersById,
    bounds: { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } },
    units: 'mm',
  };
}

// ─── Part 1: Entity backref stability ────────────────────────────────────────

describe('Integration: rename → entity layerId stable', () => {
  it('entity.layerId unchanged after rename', () => {
    const walls = createSceneLayer({ id: 'lyr_walls', name: 'WALLS', color: '#ff0000' });
    const scene = makeScene([walls], ['lyr_walls', 'lyr_walls']);

    const result = svc.renameLayer('WALLS', 'PARETI', scene);
    expect(result.success).toBe(true);

    const entityIds = result.updatedScene.entities.map(
      (e) => (e as { layerId?: string }).layerId,
    );
    expect(entityIds.every((id) => id === 'lyr_walls')).toBe(true);
  });

  it('entity.layerId not changed for entities on OTHER layers', () => {
    const walls = createSceneLayer({ id: 'lyr_walls', name: 'WALLS', color: '#f00' });
    const dims  = createSceneLayer({ id: 'lyr_dims',  name: 'DIMS',  color: '#0f0' });
    const scene = makeScene([walls, dims], ['lyr_walls', 'lyr_dims', 'lyr_dims']);

    const result = svc.renameLayer('WALLS', 'PARETI', scene);
    const layerIds = result.updatedScene.entities.map(
      (e) => (e as { layerId?: string }).layerId,
    );
    expect(layerIds[0]).toBe('lyr_walls');
    expect(layerIds[1]).toBe('lyr_dims');
    expect(layerIds[2]).toBe('lyr_dims');
  });
});

// ─── Part 2: LayerStore consistency after rename ─────────────────────────────

describe('Integration: rename → LayerStore lookup correctness', () => {
  it('getLayer(id) resolves renamed layer', () => {
    const walls = createSceneLayer({ id: 'lyr_walls', name: 'WALLS', color: '#f00' });
    setLayers([walls]);

    const scene = makeScene([walls]);
    const result = svc.renameLayer('WALLS', 'PARETI', scene);
    expect(result.success).toBe(true);

    // Sync the updated layer into LayerStore (mirrors useLayerOperations behaviour)
    const renamedLayer = Object.values(result.updatedScene.layersById).find(
      (l) => l.id === 'lyr_walls',
    )!;
    upsertLayer(renamedLayer);

    // id-based lookup still works
    expect(getLayer('lyr_walls')?.name).toBe('PARETI');

    // New name lookup works
    expect(getLayerByName('PARETI')).not.toBeNull();
    expect(getLayerByName('PARETI')?.id).toBe('lyr_walls');

    // Old name no longer found
    expect(getLayerByName('WALLS')).toBeNull();
  });

  it('getLayer(id) after two sequential renames → still resolves', () => {
    const layer = createSceneLayer({ id: 'lyr_abc', name: 'ALPHA', color: '#fff' });
    setLayers([layer]);

    let scene = makeScene([layer]);
    let result = svc.renameLayer('ALPHA', 'BETA', scene);
    expect(result.success).toBe(true);
    let renamed = Object.values(result.updatedScene.layersById).find((l) => l.id === 'lyr_abc')!;
    upsertLayer(renamed);

    scene = result.updatedScene;
    result = svc.renameLayer('BETA', 'GAMMA', scene);
    expect(result.success).toBe(true);
    renamed = Object.values(result.updatedScene.layersById).find((l) => l.id === 'lyr_abc')!;
    upsertLayer(renamed);

    expect(getLayer('lyr_abc')?.name).toBe('GAMMA');
    expect(getLayerByName('ALPHA')).toBeNull();
    expect(getLayerByName('BETA')).toBeNull();
    expect(getLayerByName('GAMMA')?.id).toBe('lyr_abc');
  });
});

// ─── Part 3: Region-like entities (overlay) ──────────────────────────────────

describe('Integration: rename → region layerId unaffected', () => {
  it('overlay region entity keeps its layerId after rename', () => {
    const layer = createSceneLayer({ id: 'lyr_floor', name: 'FLOOR', color: '#ccc' });

    // Overlay/region entity — uses layerId just like any other entity
    const scene = makeScene([layer], ['lyr_floor']);
    const result = svc.renameLayer('FLOOR', 'SOUFAS', scene);

    expect(result.success).toBe(true);
    const entityLayerId = (result.updatedScene.entities[0] as { layerId?: string }).layerId;
    expect(entityLayerId).toBe('lyr_floor');
  });
});

// ─── Part 4: Command-history pattern (key-by-id stability) ───────────────────

describe('Integration: rename → command history pattern (layerId-keyed ops)', () => {
  it('undo operation keyed by layerId still resolves renamed layer', () => {
    const layer = createSceneLayer({ id: 'lyr_cmd', name: 'CMD_LAYER', color: '#abc' });
    setLayers([layer]);

    const scene = makeScene([layer]);
    const renamed = svc.renameLayer('CMD_LAYER', 'CMD_LAYER_V2', scene);
    expect(renamed.success).toBe(true);

    const updatedLayer = Object.values(renamed.updatedScene.layersById).find(
      (l) => l.id === 'lyr_cmd',
    )!;
    upsertLayer(updatedLayer);

    // Simulate: a command captures layerId='lyr_cmd' at record time.
    // At undo/redo time, getLayer(capturedId) must still find the layer.
    const capturedLayerId = 'lyr_cmd';
    const atUndoTime = getLayer(capturedLayerId);
    expect(atUndoTime).not.toBeNull();
    expect(atUndoTime!.name).toBe('CMD_LAYER_V2');
  });
});

// ─── Part 5: Rename guards ────────────────────────────────────────────────────

describe('Integration: rename guard enforcement via LayerOperationsService', () => {
  it('renaming to "0" is rejected with RESERVED', () => {
    const layer0 = createSceneLayer({ id: 'lyr_0',  name: '0',    color: '#fff' });
    const walls  = createSceneLayer({ id: 'lyr_w',  name: 'WALLS', color: '#f00' });
    const scene = makeScene([layer0, walls]);

    const result = svc.renameLayer('WALLS', '0', scene);
    expect(result.success).toBe(false);
    expect(result.validationError).toBe('RESERVED');
  });

  it('renaming Layer "0" itself is rejected with RESERVED', () => {
    const layer0 = createSceneLayer({ id: 'lyr_0', name: '0', color: '#fff' });
    const scene = makeScene([layer0]);

    const result = svc.renameLayer('0', 'SOMETHING', scene);
    expect(result.success).toBe(false);
    expect(result.validationError).toBe('RESERVED');
  });

  it('rename to duplicate name is rejected with DUPLICATE', () => {
    const walls = createSceneLayer({ id: 'lyr_w', name: 'WALLS', color: '#f00' });
    const doors = createSceneLayer({ id: 'lyr_d', name: 'DOORS', color: '#00f' });
    const scene = makeScene([walls, doors]);

    const result = svc.renameLayer('WALLS', 'DOORS', scene);
    expect(result.success).toBe(false);
    expect(result.validationError).toBe('DUPLICATE');
  });

  it('idempotent same-name rename succeeds with no-op message', () => {
    const walls = createSceneLayer({ id: 'lyr_w', name: 'WALLS', color: '#f00' });
    const scene = makeScene([walls]);

    const result = svc.renameLayer('WALLS', 'WALLS', scene);
    expect(result.success).toBe(true);
    expect(result.message).toBe('Layer name unchanged');
  });
});
