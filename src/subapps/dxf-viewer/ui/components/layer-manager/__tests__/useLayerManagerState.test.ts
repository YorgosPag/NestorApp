/**
 * useLayerManagerState hook tests — ADR-358 Phase 8.
 *
 * Covers:
 *   - empty store → empty layers
 *   - populated store → derive elements + categories dynamically
 *   - element count derivation from SceneModel.entities
 *   - category derivation from unique SceneLayer.category union
 *   - setCurrentLayer action wires LayerStore.setCurrentLayerId
 */

// jest globals (describe/it/expect/beforeEach/jest) are injected — NOT imported from
// '@jest/globals': @swc/jest only hoists `jest.mock` above imports when `jest` is the
// global binding. Importing it would leave the mock below the hook import → real module
// loads → "fetch is not defined" (firebase). Matches the repo-wide convention.
import { renderHook, act } from '@testing-library/react';
import { useLayerManagerState } from '../useLayerManagerState';
import {
  setLayers,
  setCurrentLayerId,
  __resetLayerStoreForTesting,
} from '../../../../stores/LayerStore';
import { createSceneLayer } from '../../../../types/entities';
import type { SceneModel } from '../../../../types/entities';

// Mock useLevels to avoid Firebase import. The hook reads `getLevelScene(levelId)`
// (ADR-358 Phase 9D-5b — Level interface has no `scene` field; scene access is via
// the SSoT action). Element counts below drive the "elements: 2/1" assertions.
// Entities keyed by layerId — `resolveEntityLayerName` (LayerStore SSoT) resolves
// strictly via `layersById` lookup (no entity.layer name fallback), so the ids MUST
// match the layers the "element count" test registers (lyr_e ×2, lyr_p ×1).
const MOCK_SCENE = {
  entities: [
    { layerId: 'lyr_e', type: 'line' },
    { layerId: 'lyr_e', type: 'polyline' },
    { layerId: 'lyr_p', type: 'circle' },
  ],
} as unknown as SceneModel;

const mockGetLevelScene = jest.fn(() => MOCK_SCENE);

jest.mock('../../../../systems/levels/useLevels', () => ({
  useLevels: () => ({
    currentLevelId: 'level_1',
    getLevelScene: mockGetLevelScene,
  }),
}));

// Mock i18n
jest.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'layerPicker.category.all': 'All',
        'layerPicker.category.electrical': 'Electrical',
        'layerPicker.category.plumbing': 'Plumbing',
        'layerPicker.category.general': 'General',
      };
      return map[key] || key;
    },
  }),
}));

beforeEach(() => {
  __resetLayerStoreForTesting();
  jest.clearAllMocks();
});

describe('useLayerManagerState — empty store', () => {
  it('returns empty layers when store has no layers', () => {
    const { result } = renderHook(() => useLayerManagerState());
    expect(result.current.layers).toEqual([]);
    // The hook always seeds the 'all' filter option (even with zero layers) — the
    // populated-store test relies on it too. No layer-derived categories are added.
    expect(result.current.categories).toEqual([{ value: 'all', label: 'All' }]);
  });
});

describe('useLayerManagerState — populated store', () => {
  it('derives layers from LayerStore with element count from scene', () => {
    const elec = createSceneLayer({
      id: 'lyr_e',
      name: 'Electrical',
      category: 'electrical',
    });
    const plumb = createSceneLayer({
      id: 'lyr_p',
      name: 'Plumbing',
      category: 'plumbing',
    });
    setLayers([elec, plumb]);

    const { result } = renderHook(() => useLayerManagerState());

    expect(result.current.layers).toHaveLength(2);
    expect(result.current.layers[0]).toMatchObject({
      id: 'lyr_e',
      name: 'Electrical',
      category: 'electrical',
      elements: 2,
    });
    expect(result.current.layers[1]).toMatchObject({
      id: 'lyr_p',
      name: 'Plumbing',
      category: 'plumbing',
      elements: 1,
    });
  });

  it('sets isCurrent flag on matching currentLayerId', () => {
    const lyr = createSceneLayer({ id: 'lyr_a', name: 'A' });
    setLayers([lyr]);
    setCurrentLayerId('lyr_a');

    const { result } = renderHook(() => useLayerManagerState());

    expect(result.current.layers[0].isCurrent).toBe(true);
  });

  it('derives categories dynamically from unique layer categories', () => {
    const lyr1 = createSceneLayer({
      id: 'lyr_e',
      name: 'E',
      category: 'electrical',
    });
    const lyr2 = createSceneLayer({
      id: 'lyr_p',
      name: 'P',
      category: 'plumbing',
    });
    setLayers([lyr1, lyr2]);

    const { result } = renderHook(() => useLayerManagerState());

    const categories = result.current.categories;
    expect(categories).toContainEqual({ value: 'all', label: 'All' });
    expect(categories.find((c) => c.value === 'electrical')).toBeDefined();
    expect(categories.find((c) => c.value === 'plumbing')).toBeDefined();
    expect(categories.find((c) => c.value === 'mechanical')).toBeUndefined();
  });
});

describe('useLayerManagerState — setCurrentLayer action', () => {
  it('calls LayerStore.setCurrentLayerId on setCurrentLayer action', () => {
    const lyr = createSceneLayer({ id: 'lyr_a', name: 'A' });
    setLayers([lyr]);

    const { result } = renderHook(() => useLayerManagerState());

    act(() => {
      result.current.actions.setCurrentLayer('lyr_a');
    });

    expect(result.current.layers[0].isCurrent).toBe(true);
  });
});

describe('useLayerManagerState — toggleLayerVisibility action', () => {
  it('toggles layer visibility and reflects in LayerStore', () => {
    const lyr = createSceneLayer({
      id: 'lyr_a',
      name: 'A',
      visible: true,
    });
    setLayers([lyr]);

    const { result } = renderHook(() => useLayerManagerState());

    expect(result.current.layers[0].visible).toBe(true);

    act(() => {
      result.current.actions.toggleLayerVisibility('lyr_a');
    });

    expect(result.current.layers[0].visible).toBe(false);
  });
});
