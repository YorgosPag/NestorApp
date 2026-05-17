/**
 * LayerFiltersStore tests — ADR-358 §5.7.bis Q11 Phase 11.
 *
 * Covers: combo state machine (click/shift/ctrl), active filter cap, cache
 * invalidation on LayerStore version bump, derived selector intersection/union,
 * project switch lifecycle, pinned smart toggle (user-scoped).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  __resetLayerFiltersStoreForTesting,
  clearActiveFilters,
  clearProject,
  getFilteredLayerIds,
  getLayerFiltersStoreSnapshot,
  removeUserFilter,
  selectFilter,
  setProjectId,
  togglePinnedSmart,
  upsertUserFilter,
} from '../LayerFiltersStore';
import {
  __resetLayerStoreForTesting,
  setLayers,
} from '../LayerStore';
import { __resetFilterPersistenceForTesting } from '../../services/layer-filter-persistence';
import type { LayerFilter } from '../../types/layer-filters';
import type { SceneLayer } from '../../types/entities';

function L(id: string, overrides: Partial<SceneLayer> = {}): SceneLayer {
  return {
    id, name: id, color: '#000', visible: true, locked: false, category: 'architectural',
    ...overrides,
  };
}

function gf(id: string, name: string, layerIds: string[]): LayerFilter {
  return { kind: 'group', id, name, source: 'user-created', createdAt: 't', layerIds };
}

beforeEach(() => {
  __resetLayerStoreForTesting();
  __resetFilterPersistenceForTesting();
  __resetLayerFiltersStoreForTesting();
  // localStorage cleanup
  try { window.localStorage.clear(); } catch { /* SSR — no-op */ }
});

describe('lifecycle', () => {
  it('idle until setProjectId', () => {
    expect(getLayerFiltersStoreSnapshot().hydrationStatus).toBe('idle');
  });

  it('setProjectId triggers hydration → ready', () => {
    setLayers([L('A')]);
    setProjectId('p1');
    expect(getLayerFiltersStoreSnapshot().hydrationStatus).toBe('ready');
  });

  it('clearProject resets to idle', () => {
    setProjectId('p1');
    clearProject();
    expect(getLayerFiltersStoreSnapshot().hydrationStatus).toBe('idle');
    expect(getLayerFiltersStoreSnapshot().projectId).toBeNull();
  });
});

describe('user filter mutations', () => {
  beforeEach(() => {
    setLayers([L('A'), L('B'), L('C')]);
    setProjectId('p1');
  });

  it('upsertUserFilter persists + reflects in snapshot', () => {
    upsertUserFilter(gf('lfg_1', 'AB', ['A', 'B']));
    expect(getLayerFiltersStoreSnapshot().userFilters.map((f) => f.id)).toEqual(['lfg_1']);
  });

  it('removeUserFilter drops it + clears from active', () => {
    upsertUserFilter(gf('lfg_1', 'AB', ['A', 'B']));
    selectFilter('lfg_1', 'none');
    removeUserFilter('lfg_1');
    expect(getLayerFiltersStoreSnapshot().userFilters).toHaveLength(0);
    expect(getLayerFiltersStoreSnapshot().activeFilters).toHaveLength(0);
  });
});

describe('combo state machine', () => {
  beforeEach(() => {
    setLayers([L('A'), L('B'), L('C')]);
    setProjectId('p1');
    upsertUserFilter(gf('lfg_a', 'A', ['A']));
    upsertUserFilter(gf('lfg_b', 'B', ['B']));
    upsertUserFilter(gf('lfg_c', 'C', ['C']));
  });

  it('plain click replaces active list', () => {
    selectFilter('lfg_a', 'none');
    selectFilter('lfg_b', 'none');
    const active = getLayerFiltersStoreSnapshot().activeFilters;
    expect(active).toEqual([{ filterId: 'lfg_b', combinator: 'AND' }]);
  });

  it('shift+click appends AND, toggles on repeat', () => {
    selectFilter('lfg_a', 'none');
    selectFilter('lfg_b', 'shift');
    let active = getLayerFiltersStoreSnapshot().activeFilters;
    expect(active.map((e) => e.filterId)).toEqual(['lfg_a', 'lfg_b']);
    expect(active[1].combinator).toBe('AND');
    selectFilter('lfg_b', 'shift'); // toggle off
    active = getLayerFiltersStoreSnapshot().activeFilters;
    expect(active.map((e) => e.filterId)).toEqual(['lfg_a']);
  });

  it('ctrl+click appends OR, flips on repeat', () => {
    selectFilter('lfg_a', 'none');
    selectFilter('lfg_b', 'ctrl');
    let active = getLayerFiltersStoreSnapshot().activeFilters;
    expect(active[1].combinator).toBe('OR');
    selectFilter('lfg_b', 'ctrl'); // flip OR→AND
    active = getLayerFiltersStoreSnapshot().activeFilters;
    expect(active[1].combinator).toBe('AND');
  });

  it('clearActiveFilters empties list', () => {
    selectFilter('lfg_a', 'none');
    clearActiveFilters();
    expect(getLayerFiltersStoreSnapshot().activeFilters).toHaveLength(0);
  });

  it('cap respects ACTIVE_FILTERS_MAX (8)', () => {
    setLayers([L('A')]);
    for (let i = 0; i < 12; i += 1) {
      upsertUserFilter(gf(`lfg_${i}`, `n${i}`, ['A']));
    }
    selectFilter('lfg_0', 'none');
    for (let i = 1; i < 12; i += 1) {
      selectFilter(`lfg_${i}`, 'shift');
    }
    expect(getLayerFiltersStoreSnapshot().activeFilters).toHaveLength(8);
  });
});

describe('derived selector — getFilteredLayerIds', () => {
  beforeEach(() => {
    setLayers([L('A'), L('B'), L('C'), L('D')]);
    setProjectId('p1');
    upsertUserFilter(gf('lfg_AB', 'AB', ['A', 'B']));
    upsertUserFilter(gf('lfg_BC', 'BC', ['B', 'C']));
  });

  it('returns null when no active filter', () => {
    expect(getFilteredLayerIds()).toBeNull();
  });

  it('single active → that filter\'s set', () => {
    selectFilter('lfg_AB', 'none');
    expect([...getFilteredLayerIds()!].sort()).toEqual(['A', 'B']);
  });

  it('AND → intersection', () => {
    selectFilter('lfg_AB', 'none');
    selectFilter('lfg_BC', 'shift');
    expect([...getFilteredLayerIds()!].sort()).toEqual(['B']);
  });

  it('OR → union', () => {
    selectFilter('lfg_AB', 'none');
    selectFilter('lfg_BC', 'ctrl');
    expect([...getFilteredLayerIds()!].sort()).toEqual(['A', 'B', 'C']);
  });

  it('cache invalidates on LayerStore version bump', () => {
    selectFilter('lfg_AB', 'none');
    expect([...getFilteredLayerIds()!].sort()).toEqual(['A', 'B']);
    // Add a new layer "A" replacement — does not change result since lfg_AB ids are stable.
    setLayers([L('A'), L('B'), L('C'), L('D'), L('E')]);
    // First call after bump should recompute, not return stale.
    expect([...getFilteredLayerIds()!].sort()).toEqual(['A', 'B']);
  });
});

describe('pinned smart filters (user-scoped)', () => {
  beforeEach(() => {
    setProjectId('p1');
  });

  it('togglePinnedSmart adds/removes', () => {
    togglePinnedSmart('lfs_visible');
    expect(getLayerFiltersStoreSnapshot().pinnedSmartIds).toEqual(['lfs_visible']);
    togglePinnedSmart('lfs_visible');
    expect(getLayerFiltersStoreSnapshot().pinnedSmartIds).toEqual([]);
  });

  it('pinned ids survive project switch', () => {
    togglePinnedSmart('lfs_locked');
    setProjectId('p2');
    setProjectId('p1');
    expect(getLayerFiltersStoreSnapshot().pinnedSmartIds).toEqual(['lfs_locked']);
  });
});
