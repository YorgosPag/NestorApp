/**
 * resolveEntityLayerName — ADR-358 Phase 9D-5b-iii id-only contract.
 *
 * Post-schema-flip: resolver no longer reads `entity.layer` fallback.
 * Only `entity.layerId` + LayerStore lookup is used.
 *
 * Cases:
 *   1. Entity only has `.layer` (no layerId) → undefined (legacy fallback dropped)
 *   2. Post-9D entity (`.layerId` registered in store) → returns store name
 *   3. Mixed (both set, id resolves) → id wins
 *   4. Stale id (not in store, `.layer` present) → undefined (no fallback post flip)
 *   5. Empty entity → undefined (null-safe)
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

describe('resolveEntityLayerName — ADR-358 Phase 9D-5b-iii id-only', () => {
  it('returns undefined when only legacy `.layer` is set (no layerId fallback post-flip)', () => {
    const entity = { layerId: 'Walls' };
    expect(resolveEntityLayerName(entity)).toBeUndefined();
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

    const entity = { layerId: layer.id, layer: 'StaleOldName' };
    expect(resolveEntityLayerName(entity)).toBe('Foundations');
  });

  it('returns undefined when `.layerId` does not resolve in store (no legacy fallback)', () => {
    const entity = { layerId: 'lyr_missing_xyz', layer: 'FallbackName' };
    expect(resolveEntityLayerName(entity)).toBeUndefined();
  });

  it('returns undefined for entity with neither field set', () => {
    expect(resolveEntityLayerName({})).toBeUndefined();
  });

  it('returns undefined for null/undefined entity (null-safe)', () => {
    expect(resolveEntityLayerName(null)).toBeUndefined();
    expect(resolveEntityLayerName(undefined)).toBeUndefined();
  });
});
