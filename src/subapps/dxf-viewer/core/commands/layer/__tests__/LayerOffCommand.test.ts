/**
 * LayerOffCommand tests — ADR-358 §5.6.bis Phase 10.
 *
 * Covers: single-layer visible:false mutation, undo restores, idempotent
 * no-op on already-invisible layers, missing-layer no-op.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LayerOffCommand } from '../LayerOffCommand';
import {
  __resetLayerStoreForTesting,
  setLayers,
  getLayer,
  upsertLayer,
} from '../../../../stores/LayerStore';
import { createSceneLayer } from '../../../../types/entities';

beforeEach(() => {
  __resetLayerStoreForTesting();
});

function seed() {
  const A = createSceneLayer({ id: 'lyr_a', name: 'A', visible: true });
  setLayers([A]);
}

describe('LayerOffCommand', () => {
  it('execute sets visible=false on the target layer', () => {
    seed();
    const cmd = new LayerOffCommand({ layerId: 'lyr_a' });
    cmd.execute();
    expect(getLayer('lyr_a')?.visible).toBe(false);
  });

  it('undo restores visible=true', () => {
    seed();
    const cmd = new LayerOffCommand({ layerId: 'lyr_a' });
    cmd.execute();
    cmd.undo();
    expect(getLayer('lyr_a')?.visible).toBe(true);
  });

  it('idempotent no-op when layer is already invisible', () => {
    const A = createSceneLayer({ id: 'lyr_a', name: 'A', visible: false });
    setLayers([A]);
    const cmd = new LayerOffCommand({ layerId: 'lyr_a' });
    cmd.execute();
    // undo should NOT flip visible (was a no-op)
    upsertLayer({ ...getLayer('lyr_a')!, visible: false });
    cmd.undo();
    expect(getLayer('lyr_a')?.visible).toBe(false);
  });

  it('no-op when layer does not exist', () => {
    seed();
    const cmd = new LayerOffCommand({ layerId: 'lyr_missing' });
    cmd.execute();
    expect(getLayer('lyr_a')?.visible).toBe(true);
  });

  it('redo re-applies after undo', () => {
    seed();
    const cmd = new LayerOffCommand({ layerId: 'lyr_a' });
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(getLayer('lyr_a')?.visible).toBe(false);
  });

  it('serialize returns layer-off type + layerId', () => {
    const cmd = new LayerOffCommand({ layerId: 'lyr_x' });
    const data = cmd.serialize();
    expect(data.type).toBe('layer-off');
    expect(data.data).toEqual({ layerId: 'lyr_x' });
  });
});
