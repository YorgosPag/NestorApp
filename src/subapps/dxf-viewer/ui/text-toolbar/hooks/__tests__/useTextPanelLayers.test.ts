/**
 * ADR-344 Phase 6.D — useTextPanelLayers tests.
 */

import { describe, it, expect } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import type { SceneModel, SceneLayer } from '../../../../types/scene';

jest.mock('../useCurrentSceneModel', () => {
  let scene: SceneModel | null = null;
  return {
    __esModule: true,
    __setSceneForTest: (s: SceneModel | null) => {
      scene = s;
    },
    useCurrentSceneModel: () => scene,
  };
});

import { useTextPanelLayers } from '../useTextPanelLayers';

const { __setSceneForTest } = jest.requireMock('../useCurrentSceneModel') as {
  __setSceneForTest: (s: SceneModel | null) => void;
};

function makeLayer(over: Partial<SceneLayer>): SceneLayer {
  return { name: 'L', color: '#fff', visible: true, locked: false, ...over };
}

function makeScene(layers: Record<string, SceneLayer>): SceneModel {
  return {
    entities: [],
    layers,
    bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
    units: 'mm',
  };
}

describe('useTextPanelLayers', () => {
  afterEach(() => __setSceneForTest(null));

  it('returns empty when no scene is loaded', () => {
    __setSceneForTest(null);
    const { result } = renderHook(() => useTextPanelLayers());
    expect(result.current).toEqual([]);
  });

  it('maps every SceneLayer to a LayerSelectorEntry with frozen=false', () => {
    __setSceneForTest(
      makeScene({
        '0': makeLayer({ name: '0', locked: false }),
        wall: makeLayer({ name: 'wall', locked: true }),
      }),
    );
    const { result } = renderHook(() => useTextPanelLayers());
    expect(result.current).toHaveLength(2);
    const byName = Object.fromEntries(result.current.map((e) => [e.name, e]));
    expect(byName['0']).toMatchObject({ id: '0', locked: false, frozen: false });
    expect(byName.wall).toMatchObject({ id: 'wall', locked: true, frozen: false });
  });
});
