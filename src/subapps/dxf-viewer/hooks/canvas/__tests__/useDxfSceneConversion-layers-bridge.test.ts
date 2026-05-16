/**
 * ADR-358 §G7 Phase 5 — SceneModel → DxfScene.layersById bridge.
 *
 * Validates that `useDxfSceneConversion` propagates the full `SceneLayer`
 * map (Record<string, SceneLayer>) from `SceneModel.layers` onto
 * `DxfScene.layersById`, so the renderer can route entities through the
 * centralized ByLayer/ByBlock resolver (`resolveEntityStyle`). The legacy
 * `layers: string[]` projection is preserved for downstream consumers
 * (bounds calc, FitToView, etc.).
 */

import { describe, it, expect } from '@jest/globals';
import { renderHook } from '@testing-library/react';

import { useDxfSceneConversion } from '../useDxfSceneConversion';
import { createSceneLayer } from '../../../types/entities';
import type { SceneModel, LineEntity } from '../../../types/entities';

function makeLineEntity(id: string, layer: string): LineEntity {
  return {
    id,
    type: 'line',
    layer,
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    visible: true,
  } as LineEntity;
}

function makeScene(layers: Record<string, ReturnType<typeof createSceneLayer>>, entities = [] as LineEntity[]): SceneModel {
  return {
    entities,
    layers,
    bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
    units: 'mm',
  };
}

describe('useDxfSceneConversion — Phase 5 layersById bridge', () => {
  it('exposes full SceneLayer map on layersById (same ref as SceneModel.layers)', () => {
    const layers = {
      WALLS: createSceneLayer({ name: 'WALLS', color: '#FF0000', colorAci: 1, lineweight: 0.5 }),
      DOORS: createSceneLayer({ name: 'DOORS', color: '#00FF00', colorAci: 3, lineweight: 0.25 }),
    };
    const scene = makeScene(layers, [makeLineEntity('e1', 'WALLS')]);

    const { result } = renderHook(({ currentScene }) => useDxfSceneConversion({ currentScene }), {
      initialProps: { currentScene: scene },
    });

    expect(result.current.dxfScene.layersById).toBe(layers);
    expect(result.current.dxfScene.layersById?.WALLS.colorAci).toBe(1);
    expect(result.current.dxfScene.layersById?.WALLS.lineweight).toBe(0.5);
    expect(result.current.dxfScene.layersById?.DOORS.colorAci).toBe(3);
  });

  it('preserves legacy layers: string[] projection alongside layersById', () => {
    const layers = {
      A: createSceneLayer({ name: 'A' }),
      B: createSceneLayer({ name: 'B' }),
    };
    const scene = makeScene(layers);

    const { result } = renderHook(({ currentScene }) => useDxfSceneConversion({ currentScene }), {
      initialProps: { currentScene: scene },
    });

    expect(result.current.dxfScene.layers).toEqual(expect.arrayContaining(['A', 'B']));
    expect(result.current.dxfScene.layersById).toBe(layers);
  });

  it('layersById is undefined when currentScene is null (fallback path)', () => {
    const { result } = renderHook(
      ({ currentScene }: { currentScene: SceneModel | null }) =>
        useDxfSceneConversion({ currentScene }),
      { initialProps: { currentScene: null } },
    );

    expect(result.current.dxfScene.layersById).toBeUndefined();
    expect(result.current.dxfScene.layers).toEqual([]);
    expect(result.current.dxfScene.entities).toEqual([]);
  });

  it('updates layersById ref when SceneModel.layers changes', () => {
    const layersV1 = { L1: createSceneLayer({ name: 'L1', colorAci: 1 }) };
    const layersV2 = { L1: createSceneLayer({ name: 'L1', colorAci: 5 }) };

    const { result, rerender } = renderHook(
      ({ currentScene }: { currentScene: SceneModel }) => useDxfSceneConversion({ currentScene }),
      { initialProps: { currentScene: makeScene(layersV1) } },
    );

    expect(result.current.dxfScene.layersById?.L1.colorAci).toBe(1);

    rerender({ currentScene: makeScene(layersV2) });

    expect(result.current.dxfScene.layersById?.L1.colorAci).toBe(5);
  });
});
