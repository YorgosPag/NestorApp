/**
 * ADR-358 Phase 9F — CreateEntityCommand replay safety.
 *
 * Validates the 4-level layerId fallback:
 *   1. options.layerId
 *   2. entityData.layerId
 *   3. getLayerByName(DXF_DEFAULT_LAYER)?.id  (real LayerStore, name-based)
 *   4. getCurrentLayerId()
 *   5. '' (safe empty string)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CreateEntityCommand } from '../CreateEntityCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import {
  setLayers,
  setCurrentLayerId,
  __resetLayerStoreForTesting,
} from '../../../../stores/LayerStore';
import { createSceneLayer } from '../../../../types/entities';

function makeFakeSceneManager(): ISceneManager & { added: SceneEntity[] } {
  const added: SceneEntity[] = [];
  return {
    added,
    addEntity: (e: SceneEntity) => { added.push(e); },
    removeEntity: (id: string) => { const idx = added.findIndex(e => e.id === id); if (idx !== -1) added.splice(idx, 1); },
    updateEntity: () => {},
    getEntity: () => undefined,
    getAllEntities: () => added,
  } as unknown as ISceneManager & { added: SceneEntity[] };
}

const baseData: Omit<SceneEntity, 'id'> = {
  type: 'line',
  start: { x: 0, y: 0 },
  end: { x: 10, y: 0 },
  visible: true,
} as unknown as Omit<SceneEntity, 'id'>;

beforeEach(() => {
  __resetLayerStoreForTesting();
});

describe('CreateEntityCommand — Phase 9F layerId fallback chain', () => {
  it('Level 1: options.layerId takes priority over entityData.layerId', () => {
    const sm = makeFakeSceneManager();
    const dataWithId = { ...baseData, layerId: 'lyr_from_data' } as unknown as Omit<SceneEntity, 'id'>;
    const cmd = new CreateEntityCommand(dataWithId, sm, { layerId: 'lyr_from_options' });
    cmd.execute();
    expect(cmd.getEntity()!.layerId).toBe('lyr_from_options');
  });

  it('Level 2: entityData.layerId used when options.layerId absent', () => {
    const sm = makeFakeSceneManager();
    const dataWithId = { ...baseData, layerId: 'lyr_from_data' } as unknown as Omit<SceneEntity, 'id'>;
    const cmd = new CreateEntityCommand(dataWithId, sm, {});
    cmd.execute();
    expect(cmd.getEntity()!.layerId).toBe('lyr_from_data');
  });

  it('Level 3: getLayerByName("0") used when no id in options or data', () => {
    const defaultLayer = createSceneLayer({ name: '0', color: '#ffffff', visible: true, locked: false });
    setLayers([defaultLayer]);

    const sm = makeFakeSceneManager();
    const cmd = new CreateEntityCommand(baseData, sm, {});
    cmd.execute();
    expect(cmd.getEntity()!.layerId).toBe(defaultLayer.id);
  });

  it('Level 4: getCurrentLayerId() used when no default layer in store', () => {
    const otherLayer = createSceneLayer({ name: 'WALLS', color: '#ff0000', visible: true, locked: false });
    setLayers([otherLayer]);
    setCurrentLayerId(otherLayer.id);

    const sm = makeFakeSceneManager();
    const cmd = new CreateEntityCommand(baseData, sm, {});
    cmd.execute();
    expect(cmd.getEntity()!.layerId).toBe(otherLayer.id);
  });

  it('Level 5: empty string fallback when LayerStore is empty', () => {
    // LayerStore reset in beforeEach — no layers, no currentLayerId
    const sm = makeFakeSceneManager();
    const cmd = new CreateEntityCommand(baseData, sm, {});
    cmd.execute();
    expect(cmd.getEntity()!.layerId).toBe('');
  });

  it('no layer name field on created entity (removed from BaseEntity)', () => {
    const sm = makeFakeSceneManager();
    const cmd = new CreateEntityCommand(baseData, sm, { layerId: 'lyr_abc' });
    cmd.execute();
    const created = cmd.getEntity()! as unknown as Record<string, unknown>;
    expect(created.layer).toBeUndefined();
    expect(created.layerId).toBe('lyr_abc');
  });

  it('undo then redo preserves layerId unchanged', () => {
    const sm = makeFakeSceneManager();
    const cmd = new CreateEntityCommand(baseData, sm, { layerId: 'lyr_stable' });
    cmd.execute();
    const idAfterExecute = cmd.getEntity()!.layerId;
    cmd.undo();
    cmd.redo();
    expect(cmd.getEntity()!.layerId).toBe(idAfterExecute);
  });
});
