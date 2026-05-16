/**
 * LayerStore contract tests — ADR-358 Phase 1.
 *
 * Covers the micro-leaf store API surface:
 *   - initial empty snapshot
 *   - setLayers / upsertLayer / removeLayer
 *   - currentLayerId set/clear, auto-clear on removal
 *   - subscribe fires on change, skip-if-unchanged
 *   - getLayer lookup by id or name
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  getLayerStoreSnapshot,
  subscribeLayerStore,
  getLayer,
  getAllLayers,
  getCurrentLayerId,
  setLayers,
  upsertLayer,
  removeLayer,
  setCurrentLayerId,
  __resetLayerStoreForTesting,
} from '../LayerStore';
import { createSceneLayer } from '../../types/entities';

beforeEach(() => {
  __resetLayerStoreForTesting();
});

describe('LayerStore — initial state', () => {
  it('starts with empty layer list and null currentLayerId', () => {
    const snap = getLayerStoreSnapshot();
    expect(snap.layers).toEqual([]);
    expect(snap.currentLayerId).toBeNull();
    expect(getAllLayers()).toEqual([]);
    expect(getCurrentLayerId()).toBeNull();
  });

  it('returns stable snapshot reference across calls when nothing changes', () => {
    const a = getLayerStoreSnapshot();
    const b = getLayerStoreSnapshot();
    expect(a).toBe(b);
  });
});

describe('LayerStore — setLayers', () => {
  it('replaces full layer set, preserves order', () => {
    const a = createSceneLayer({ id: 'lyr_a', name: 'A' });
    const b = createSceneLayer({ id: 'lyr_b', name: 'B' });
    setLayers([a, b]);
    const list = getAllLayers();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('lyr_a');
    expect(list[1].id).toBe('lyr_b');
  });

  it('clears currentLayerId if the active layer is dropped', () => {
    const a = createSceneLayer({ id: 'lyr_a', name: 'A' });
    setLayers([a]);
    setCurrentLayerId('lyr_a');
    expect(getCurrentLayerId()).toBe('lyr_a');
    setLayers([createSceneLayer({ id: 'lyr_b', name: 'B' })]);
    expect(getCurrentLayerId()).toBeNull();
  });

  it('keys every layer by id (Phase 9C: factory auto-gen guarantees id presence)', () => {
    const withId = createSceneLayer({ id: 'lyr_x', name: 'X' });
    const autoId = createSceneLayer({ name: 'Y' });
    setLayers([withId, autoId]);
    expect(getLayer('lyr_x')).toBe(withId);
    expect(getLayer(autoId.id)).toBe(autoId);
    expect(getLayer('Y')).toBeNull();
  });

  it('deduplicates by key — first occurrence wins', () => {
    const a1 = createSceneLayer({ id: 'lyr_a', name: 'A1' });
    const a2 = createSceneLayer({ id: 'lyr_a', name: 'A2' });
    setLayers([a1, a2]);
    expect(getAllLayers()).toHaveLength(1);
    expect(getLayer('lyr_a')?.name).toBe('A1');
  });
});

describe('LayerStore — upsertLayer', () => {
  it('inserts a new layer at end', () => {
    upsertLayer(createSceneLayer({ id: 'lyr_a', name: 'A' }));
    upsertLayer(createSceneLayer({ id: 'lyr_b', name: 'B' }));
    expect(getAllLayers().map((l) => l.id)).toEqual(['lyr_a', 'lyr_b']);
  });

  it('replaces existing layer in place (no reorder)', () => {
    upsertLayer(createSceneLayer({ id: 'lyr_a', name: 'A' }));
    upsertLayer(createSceneLayer({ id: 'lyr_b', name: 'B' }));
    upsertLayer(createSceneLayer({ id: 'lyr_a', name: 'A-renamed', visible: false }));
    const list = getAllLayers();
    expect(list.map((l) => l.id)).toEqual(['lyr_a', 'lyr_b']);
    expect(list[0].name).toBe('A-renamed');
    expect(list[0].visible).toBe(false);
  });
});

describe('LayerStore — removeLayer', () => {
  it('drops the matching layer', () => {
    upsertLayer(createSceneLayer({ id: 'lyr_a', name: 'A' }));
    upsertLayer(createSceneLayer({ id: 'lyr_b', name: 'B' }));
    removeLayer('lyr_a');
    expect(getAllLayers().map((l) => l.id)).toEqual(['lyr_b']);
    expect(getLayer('lyr_a')).toBeNull();
  });

  it('no-ops for unknown id', () => {
    upsertLayer(createSceneLayer({ id: 'lyr_a', name: 'A' }));
    removeLayer('lyr_zzz');
    expect(getAllLayers()).toHaveLength(1);
  });

  it('clears currentLayerId when the active layer is removed', () => {
    upsertLayer(createSceneLayer({ id: 'lyr_a', name: 'A' }));
    setCurrentLayerId('lyr_a');
    removeLayer('lyr_a');
    expect(getCurrentLayerId()).toBeNull();
  });
});

describe('LayerStore — currentLayerId', () => {
  it('rejects setting to an unknown id', () => {
    setCurrentLayerId('lyr_ghost');
    expect(getCurrentLayerId()).toBeNull();
  });

  it('accepts known id and exposes via snapshot', () => {
    upsertLayer(createSceneLayer({ id: 'lyr_a', name: 'A' }));
    setCurrentLayerId('lyr_a');
    expect(getCurrentLayerId()).toBe('lyr_a');
    expect(getLayerStoreSnapshot().currentLayerId).toBe('lyr_a');
  });

  it('accepts null to clear', () => {
    upsertLayer(createSceneLayer({ id: 'lyr_a', name: 'A' }));
    setCurrentLayerId('lyr_a');
    setCurrentLayerId(null);
    expect(getCurrentLayerId()).toBeNull();
  });
});

describe('LayerStore — subscriptions', () => {
  it('fires on layer set', () => {
    let calls = 0;
    subscribeLayerStore(() => {
      calls += 1;
    });
    upsertLayer(createSceneLayer({ id: 'lyr_a', name: 'A' }));
    expect(calls).toBe(1);
  });

  it('fires on currentLayerId change', () => {
    upsertLayer(createSceneLayer({ id: 'lyr_a', name: 'A' }));
    let calls = 0;
    subscribeLayerStore(() => {
      calls += 1;
    });
    setCurrentLayerId('lyr_a');
    expect(calls).toBe(1);
  });

  it('skips notification when setCurrentLayerId is called with unchanged value', () => {
    upsertLayer(createSceneLayer({ id: 'lyr_a', name: 'A' }));
    setCurrentLayerId('lyr_a');
    let calls = 0;
    subscribeLayerStore(() => {
      calls += 1;
    });
    setCurrentLayerId('lyr_a');
    expect(calls).toBe(0);
  });

  it('unsubscribe removes the listener', () => {
    let calls = 0;
    const unsub = subscribeLayerStore(() => {
      calls += 1;
    });
    upsertLayer(createSceneLayer({ id: 'lyr_a', name: 'A' }));
    unsub();
    upsertLayer(createSceneLayer({ id: 'lyr_b', name: 'B' }));
    expect(calls).toBe(1);
  });

  it('issues a fresh snapshot reference after mutation', () => {
    const before = getLayerStoreSnapshot();
    upsertLayer(createSceneLayer({ id: 'lyr_a', name: 'A' }));
    const after = getLayerStoreSnapshot();
    expect(after).not.toBe(before);
    expect(after.layers).toHaveLength(1);
  });
});
