/**
 * LayerUnisolateCommand tests — ADR-358 §5.6.bis Phase 10.
 *
 * Covers: restores LayerStore from snapshot, clears IsolateEffectsStore,
 * undo re-isolates with the conserved snapshot.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LayerIsolateCommand } from '../LayerIsolateCommand';
import { LayerUnisolateCommand } from '../LayerUnisolateCommand';
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

function isolateFreeze(targetId: string) {
  const A = createSceneLayer({ id: 'lyr_a', name: 'A' });
  const B = createSceneLayer({ id: 'lyr_b', name: 'B' });
  setLayers([A, B]);
  new LayerIsolateCommand({
    targetLayerIds: [targetId],
    settings: { mode: 'freeze', dimOpacityPercent: 30 },
  }).execute();
}

describe('LayerUnisolateCommand — execute', () => {
  it('restores frozen flag + clears effects + clears snapshot', () => {
    isolateFreeze('lyr_a');
    expect(getLayer('lyr_b')?.frozen).toBe(true);

    const cmd = new LayerUnisolateCommand();
    cmd.execute();

    expect(getLayer('lyr_b')?.frozen).toBe(false);
    expect(getIsolateEffectsSnapshot().active).toBe(false);
    expect(getUnisolateSnapshot()).toBeNull();
  });

  it('no-op when no active snapshot', () => {
    const cmd = new LayerUnisolateCommand();
    cmd.execute();
    expect(getIsolateEffectsSnapshot().active).toBe(false);
  });
});

describe('LayerUnisolateCommand — undo + redo', () => {
  it('undo re-isolates via conserved snapshot + re-activates effects', () => {
    isolateFreeze('lyr_a');
    const cmd = new LayerUnisolateCommand();
    cmd.execute();
    expect(getLayer('lyr_b')?.frozen).toBe(false);

    cmd.undo();
    expect(getLayer('lyr_b')?.frozen).toBe(true);
    expect(getIsolateEffectsSnapshot().active).toBe(true);
  });

  it('redo clears again (replay-safe)', () => {
    isolateFreeze('lyr_a');
    const cmd = new LayerUnisolateCommand();
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(getLayer('lyr_b')?.frozen).toBe(false);
    expect(getIsolateEffectsSnapshot().active).toBe(false);
  });
});
