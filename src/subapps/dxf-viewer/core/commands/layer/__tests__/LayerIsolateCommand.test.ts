/**
 * LayerIsolateCommand tests — ADR-358 §5.6.bis Phase 10.
 *
 * Covers: execute captures snapshot + activates effects, undo restores +
 * clears, redo replays without re-capture, snapshot-override flag on second
 * isolate, freeze mode mutates non-isolated layer.frozen, dim mode does not.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LayerIsolateCommand } from '../LayerIsolateCommand';
import {
  __resetLayerStoreForTesting,
  setLayers,
  getLayer,
  getUnisolateSnapshot,
} from '../../../../stores/LayerStore';
import {
  __resetIsolateEffectsForTesting,
  getIsolateEffectsSnapshot,
} from '../../../../systems/isolate/IsolateEffectsStore';
import { createSceneLayer } from '../../../../types/entities';

beforeEach(() => {
  __resetLayerStoreForTesting();
  __resetIsolateEffectsForTesting();
});

function seed() {
  const A = createSceneLayer({ id: 'lyr_a', name: 'A' });
  const B = createSceneLayer({ id: 'lyr_b', name: 'B' });
  const C = createSceneLayer({ id: 'lyr_c', name: 'C' });
  setLayers([A, B, C]);
}

describe('LayerIsolateCommand — execute', () => {
  it('captures snapshot of all layers + activates IsolateEffectsStore', () => {
    seed();
    const cmd = new LayerIsolateCommand({
      targetLayerIds: ['lyr_a'],
      settings: { mode: 'dim', dimOpacityPercent: 30 },
      category: 'general',
    });
    cmd.execute();

    const snap = getUnisolateSnapshot();
    expect(snap).not.toBeNull();
    expect(snap?.length).toBe(3);

    const fx = getIsolateEffectsSnapshot();
    expect(fx.active).toBe(true);
    expect(fx.mode).toBe('dim');
    expect(fx.isolatedLayerIds.has('lyr_a')).toBe(true);
    expect(fx.category).toBe('general');
  });

  it('dim mode does NOT mutate layer.frozen', () => {
    seed();
    new LayerIsolateCommand({
      targetLayerIds: ['lyr_a'],
      settings: { mode: 'dim', dimOpacityPercent: 30 },
    }).execute();
    expect(getLayer('lyr_b')?.frozen).toBeFalsy();
    expect(getLayer('lyr_c')?.frozen).toBeFalsy();
  });

  it('freeze mode mutates layer.frozen on non-isolated layers', () => {
    seed();
    new LayerIsolateCommand({
      targetLayerIds: ['lyr_a'],
      settings: { mode: 'freeze', dimOpacityPercent: 30 },
    }).execute();
    expect(getLayer('lyr_a')?.frozen).toBeFalsy();
    expect(getLayer('lyr_b')?.frozen).toBe(true);
    expect(getLayer('lyr_c')?.frozen).toBe(true);
  });
});

describe('LayerIsolateCommand — undo + redo', () => {
  it('undo restores all layers + clears effects + clears snapshot', () => {
    seed();
    const cmd = new LayerIsolateCommand({
      targetLayerIds: ['lyr_a'],
      settings: { mode: 'freeze', dimOpacityPercent: 30 },
    });
    cmd.execute();
    expect(getLayer('lyr_b')?.frozen).toBe(true);

    cmd.undo();
    expect(getLayer('lyr_b')?.frozen).toBe(false);
    expect(getIsolateEffectsSnapshot().active).toBe(false);
    expect(getUnisolateSnapshot()).toBeNull();
  });

  it('redo replays without re-capturing snapshot (replay-safe)', () => {
    seed();
    const cmd = new LayerIsolateCommand({
      targetLayerIds: ['lyr_a'],
      settings: { mode: 'freeze', dimOpacityPercent: 30 },
    });
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(getLayer('lyr_b')?.frozen).toBe(true);
    expect(getIsolateEffectsSnapshot().active).toBe(true);
  });
});

describe('LayerIsolateCommand — snapshot override flag', () => {
  it('didOverwritePreviousSnapshot=false on first isolate', () => {
    seed();
    const cmd = new LayerIsolateCommand({
      targetLayerIds: ['lyr_a'],
      settings: { mode: 'dim', dimOpacityPercent: 30 },
    });
    cmd.execute();
    expect(cmd.didOverwritePreviousSnapshot()).toBe(false);
  });

  it('didOverwritePreviousSnapshot=true when an active snapshot exists', () => {
    seed();
    new LayerIsolateCommand({
      targetLayerIds: ['lyr_a'],
      settings: { mode: 'dim', dimOpacityPercent: 30 },
    }).execute();

    const second = new LayerIsolateCommand({
      targetLayerIds: ['lyr_b'],
      settings: { mode: 'dim', dimOpacityPercent: 30 },
    });
    second.execute();
    expect(second.didOverwritePreviousSnapshot()).toBe(true);
  });
});

describe('LayerIsolateCommand — serialization', () => {
  it('serialize returns the registered type + input data', () => {
    const cmd = new LayerIsolateCommand({
      targetLayerIds: ['lyr_a'],
      settings: { mode: 'dim', dimOpacityPercent: 30 },
      category: 'cat-x',
    });
    const data = cmd.serialize();
    expect(data.type).toBe('layer-isolate');
    expect(data.data).toMatchObject({
      targetLayerIds: ['lyr_a'],
      settings: { mode: 'dim', dimOpacityPercent: 30 },
      category: 'cat-x',
    });
  });
});
