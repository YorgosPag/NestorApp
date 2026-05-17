/**
 * layer-smart-filters tests — ADR-358 §5.7.bis Q11 Phase 11.
 *
 * Covers: deterministic id set, presence-of-category emission, icon mapping,
 * empty-snapshot fallback.
 */

import { describe, it, expect } from '@jest/globals';
import {
  SMART_FILTER_IDS,
  getCategoryIcon,
  getCategorySmartFilterId,
  getSmartFilters,
  isSmartFilterId,
} from '../layer-smart-filters';
import type { SceneLayer } from '../../types/entities';
import type { LayerStoreSnapshot } from '../../stores/LayerStore';

function makeLayer(overrides: Partial<SceneLayer> = {}): SceneLayer {
  return {
    id: overrides.id ?? `lyr_${Math.random().toString(36).slice(2)}`,
    name: overrides.name ?? 'L',
    color: overrides.color ?? '#000',
    visible: overrides.visible ?? true,
    locked: overrides.locked ?? false,
    category: overrides.category ?? 'architectural',
  };
}

function makeSnapshot(layers: SceneLayer[]): LayerStoreSnapshot {
  return { layers, currentLayerId: null, recentLayerIds: [], version: 1 };
}

describe('smart filters — fixed ids', () => {
  it('exposes 5 fixed smart ids', () => {
    expect(SMART_FILTER_IDS).toEqual({
      visible: 'lfs_visible',
      locked: 'lfs_locked',
      frozen: 'lfs_frozen',
      notPlotted: 'lfs_not_plotted',
      emptyLayers: 'lfs_empty_layers',
    });
  });

  it('all start with lfs_ prefix', () => {
    for (const id of Object.values(SMART_FILTER_IDS)) {
      expect(isSmartFilterId(id)).toBe(true);
    }
  });

  it('getCategorySmartFilterId is deterministic', () => {
    expect(getCategorySmartFilterId('architectural')).toBe('lfs_category_architectural');
    expect(getCategorySmartFilterId('mechanical')).toBe('lfs_category_mechanical');
  });

  it('isSmartFilterId rejects non-smart ids', () => {
    expect(isSmartFilterId('lfg_abc')).toBe(false);
    expect(isSmartFilterId('lfp_xyz')).toBe(false);
    expect(isSmartFilterId('lyr_xxx')).toBe(false);
  });
});

describe('smart filters — emission', () => {
  it('emits 5 fixed + 0 categories on empty snapshot', () => {
    const filters = getSmartFilters(makeSnapshot([]));
    expect(filters.length).toBe(5);
    expect(filters.every((f) => f.source === 'system-smart')).toBe(true);
  });

  it('emits 1 category filter per distinct category present', () => {
    const layers = [
      makeLayer({ category: 'architectural' }),
      makeLayer({ category: 'architectural' }),
      makeLayer({ category: 'structural' }),
      makeLayer({ category: 'electrical' }),
    ];
    const filters = getSmartFilters(makeSnapshot(layers));
    expect(filters.length).toBe(5 + 3);
    const categoryIds = filters
      .map((f) => f.id)
      .filter((id) => id.startsWith('lfs_category_'));
    expect(categoryIds.sort()).toEqual([
      'lfs_category_architectural',
      'lfs_category_electrical',
      'lfs_category_structural',
    ]);
  });

  it('all smart filters are properties kind', () => {
    const filters = getSmartFilters(makeSnapshot([makeLayer()]));
    expect(filters.every((f) => f.kind === 'properties')).toBe(true);
  });
});

describe('smart filters — icon mapping', () => {
  it('every AEC category has an icon', () => {
    const categories = [
      'architectural', 'structural', 'electrical', 'mechanical', 'plumbing',
      'fire', 'civil', 'telecom', 'interior', 'general',
    ] as const;
    for (const c of categories) {
      expect(typeof getCategoryIcon(c)).toBe('string');
      expect(getCategoryIcon(c).length).toBeGreaterThan(0);
    }
  });
});
