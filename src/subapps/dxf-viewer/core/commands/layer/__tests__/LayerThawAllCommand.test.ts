/**
 * LayerThawAllCommand tests — ADR-358 §5.6.bis Phase 10.
 *
 * Acts as a proxy for the bulk-snapshot pattern shared with LayerOnAll.
 * Covers: bulk frozen→false mutation, snapshot of mutated layers only,
 * undo restores per-layer, replay safety.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LayerThawAllCommand } from '../LayerThawAllCommand';
import {
  __resetLayerStoreForTesting,
  setLayers,
  getLayer,
} from '../../../../stores/LayerStore';
import { createSceneLayer } from '../../../../types/entities';

beforeEach(() => {
  __resetLayerStoreForTesting();
});

function seedMixed() {
  const A = createSceneLayer({ id: 'lyr_a', name: 'A', frozen: true });
  const B = createSceneLayer({ id: 'lyr_b', name: 'B', frozen: false });
  const C = createSceneLayer({ id: 'lyr_c', name: 'C', frozen: true });
  setLayers([A, B, C]);
}

describe('LayerThawAllCommand', () => {
  it('execute thaws every frozen layer', () => {
    seedMixed();
    const cmd = new LayerThawAllCommand();
    cmd.execute();
    expect(getLayer('lyr_a')?.frozen).toBe(false);
    expect(getLayer('lyr_b')?.frozen).toBe(false);
    expect(getLayer('lyr_c')?.frozen).toBe(false);
  });

  it('undo restores only previously-frozen layers', () => {
    seedMixed();
    const cmd = new LayerThawAllCommand();
    cmd.execute();
    cmd.undo();
    expect(getLayer('lyr_a')?.frozen).toBe(true);
    expect(getLayer('lyr_b')?.frozen).toBeFalsy();
    expect(getLayer('lyr_c')?.frozen).toBe(true);
  });

  it('idempotent on already-thawed state (empty snapshot)', () => {
    const A = createSceneLayer({ id: 'lyr_a', name: 'A', frozen: false });
    setLayers([A]);
    const cmd = new LayerThawAllCommand();
    cmd.execute();
    cmd.undo();
    expect(getLayer('lyr_a')?.frozen).toBeFalsy();
  });

  it('redo replays the thaw without re-capture', () => {
    seedMixed();
    const cmd = new LayerThawAllCommand();
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(getLayer('lyr_a')?.frozen).toBe(false);
    expect(getLayer('lyr_c')?.frozen).toBe(false);
  });

  it('serialize returns layer-thaw-all type', () => {
    const cmd = new LayerThawAllCommand();
    const data = cmd.serialize();
    expect(data.type).toBe('layer-thaw-all');
  });
});
