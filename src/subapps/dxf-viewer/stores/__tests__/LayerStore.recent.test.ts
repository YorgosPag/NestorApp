/**
 * LayerStore recent-layers FIFO tests — ADR-358 Phase 7 §5.5.bis Q8.
 *
 * Covers:
 *   - setCurrentLayerId auto-pushes onto recent stack
 *   - pushRecentLayer dedupes top entry
 *   - FIFO cap at RECENT_LAYERS_MAX
 *   - removeLayer / setLayers prune unknown recents
 *   - setRecentLayerIds hydration filters unknowns + trims
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  getLayerStoreSnapshot,
  getRecentLayerIds,
  setLayers,
  upsertLayer,
  removeLayer,
  setCurrentLayerId,
  pushRecentLayer,
  setRecentLayerIds,
  __resetLayerStoreForTesting,
  RECENT_LAYERS_MAX,
} from '../LayerStore';
import { createSceneLayer } from '../../types/entities';

beforeEach(() => {
  __resetLayerStoreForTesting();
});

function seed(count: number): void {
  const layers = Array.from({ length: count }, (_, i) =>
    createSceneLayer({ id: `lyr_${i}`, name: `L${i}` }),
  );
  setLayers(layers);
}

describe('LayerStore — recent FIFO', () => {
  it('starts empty', () => {
    expect(getRecentLayerIds()).toEqual([]);
    expect(getLayerStoreSnapshot().recentLayerIds).toEqual([]);
  });

  it('setCurrentLayerId pushes onto recent stack — most-recent first', () => {
    seed(3);
    setCurrentLayerId('lyr_0');
    setCurrentLayerId('lyr_1');
    setCurrentLayerId('lyr_2');
    expect(getRecentLayerIds()).toEqual(['lyr_2', 'lyr_1', 'lyr_0']);
  });

  it('re-selecting an existing recent layer moves it to top without duplication', () => {
    seed(3);
    setCurrentLayerId('lyr_0');
    setCurrentLayerId('lyr_1');
    setCurrentLayerId('lyr_2');
    setCurrentLayerId('lyr_0');
    expect(getRecentLayerIds()).toEqual(['lyr_0', 'lyr_2', 'lyr_1']);
  });

  it('caps recent stack at RECENT_LAYERS_MAX', () => {
    seed(RECENT_LAYERS_MAX + 5);
    for (let i = 0; i < RECENT_LAYERS_MAX + 5; i += 1) {
      setCurrentLayerId(`lyr_${i}`);
    }
    const recent = getRecentLayerIds();
    expect(recent).toHaveLength(RECENT_LAYERS_MAX);
    expect(recent[0]).toBe(`lyr_${RECENT_LAYERS_MAX + 4}`);
    expect(recent[recent.length - 1]).toBe('lyr_5');
  });

  it('pushRecentLayer is idempotent on top entry', () => {
    seed(2);
    pushRecentLayer('lyr_0');
    pushRecentLayer('lyr_0');
    pushRecentLayer('lyr_0');
    expect(getRecentLayerIds()).toEqual(['lyr_0']);
  });

  it('pushRecentLayer rejects unknown ids', () => {
    seed(1);
    pushRecentLayer('lyr_ghost');
    expect(getRecentLayerIds()).toEqual([]);
  });

  it('removeLayer prunes the id from recents', () => {
    seed(3);
    setCurrentLayerId('lyr_0');
    setCurrentLayerId('lyr_1');
    setCurrentLayerId('lyr_2');
    removeLayer('lyr_1');
    expect(getRecentLayerIds()).toEqual(['lyr_2', 'lyr_0']);
  });

  it('setLayers prunes recents whose layer disappeared', () => {
    seed(3);
    setCurrentLayerId('lyr_0');
    setCurrentLayerId('lyr_1');
    setCurrentLayerId('lyr_2');
    setLayers([createSceneLayer({ id: 'lyr_1', name: 'L1' })]);
    expect(getRecentLayerIds()).toEqual(['lyr_1']);
  });

  it('setRecentLayerIds hydrates from persistence — filters unknowns, dedupes, trims', () => {
    seed(3);
    setRecentLayerIds([
      'lyr_2',
      'lyr_ghost',
      'lyr_0',
      'lyr_2',
      'lyr_1',
      ...Array.from({ length: RECENT_LAYERS_MAX + 2 }, (_, i) => `extra_${i}`),
    ]);
    expect(getRecentLayerIds()).toEqual(['lyr_2', 'lyr_0', 'lyr_1']);
  });

  it('setRecentLayerIds is a no-op when order is unchanged', () => {
    seed(2);
    setCurrentLayerId('lyr_0');
    setCurrentLayerId('lyr_1');
    const before = getLayerStoreSnapshot();
    setRecentLayerIds(['lyr_1', 'lyr_0']);
    const after = getLayerStoreSnapshot();
    expect(after).toBe(before);
  });
});
