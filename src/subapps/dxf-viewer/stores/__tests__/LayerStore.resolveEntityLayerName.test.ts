/**
 * resolveEntityLayerName — ADR-358 Phase 9D-3 dual-read contract.
 *
 * Verifies the id-first / name-fallback resolution helper used by all
 * reader sites during the transitional Phase 9D-3 → 9D-5 sweep.
 *
 * Cases:
 *   1. Legacy entity (only `.layer`) → returns `.layer`
 *   2. Post-9D entity (only `.layerId` registered in store) → returns store name
 *   3. Mixed (both set, id resolves) → id wins
 *   4. Stale id (not in store) → falls back to `.layer`
 *   5. Empty entity → returns undefined (null-safe)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  resolveEntityLayerName,
  setLayers,
  __resetLayerStoreForTesting,
} from '../LayerStore';
import { createSceneLayer } from '../../types/entities';

beforeEach(() => {
  __resetLayerStoreForTesting();
});

describe('resolveEntityLayerName — ADR-358 Phase 9D-3 dual-read', () => {
  it('returns legacy `.layer` when only legacy field is set', () => {
    const entity = { layer: 'Walls' };
    expect(resolveEntityLayerName(entity)).toBe('Walls');
  });

  it('returns SceneLayer.name when `.layerId` resolves via LayerStore', () => {
    const layer = createSceneLayer({ id: 'lyr_walls_001', name: 'Walls' });
    setLayers([layer]);

    const entity = { layerId: layer.id };
    expect(resolveEntityLayerName(entity)).toBe('Walls');
  });

  it('id wins over legacy `.layer` when both are set (id-first)', () => {
    const layer = createSceneLayer({ id: 'lyr_foundations_001', name: 'Foundations' });
    setLayers([layer]);

    // entity.layer is stale legacy name — id-first must override
    const entity = { layerId: layer.id, layer: 'StaleOldName' };
    expect(resolveEntityLayerName(entity)).toBe('Foundations');
  });

  it('falls back to `.layer` when `.layerId` does not resolve in store', () => {
    // stale id not registered; legacy `.layer` is the safety net
    const entity = { layerId: 'lyr_missing_xyz', layer: 'FallbackName' };
    expect(resolveEntityLayerName(entity)).toBe('FallbackName');
  });

  it('returns undefined for entity with neither field set', () => {
    expect(resolveEntityLayerName({})).toBeUndefined();
  });

  it('returns undefined for null/undefined entity (null-safe)', () => {
    expect(resolveEntityLayerName(null)).toBeUndefined();
    expect(resolveEntityLayerName(undefined)).toBeUndefined();
  });
});
