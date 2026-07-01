/**
 * useDxfSceneConversion.convertScene (ADR-040 live scene→canvas redraw).
 *
 * `convertScene` is the on-demand converter the DXF render leaf calls on the fresh
 * scene snapshot it reads reactively (`useLevelScene`), so a committed entity paints
 * immediately WITHOUT re-rendering the orchestrator. It MUST reuse the SAME per-entity
 * WeakMap cache as the `dxfScene` memo — otherwise every scene edit re-spreads all N
 * entities (the exact O(N) churn ADR-547 avoids) and the two views could diverge.
 *
 * Guards:
 *   1. convertScene converts a snapshot (entity survives, not dropped).
 *   2. Same entity object → SAME converted reference across memo AND convertScene
 *      (shared cache — no duplication, no divergence).
 *   3. convertScene identity is stable across re-renders (leaf useMemo key stays effective).
 */
import { describe, it, expect } from '@jest/globals';
import { renderHook } from '@testing-library/react';

import { useDxfSceneConversion } from '../useDxfSceneConversion';
import { buildMepFixtureEntity, buildDefaultMepFixtureParams } from '../../drawing/mep-fixture-completion';
import type { SceneModel } from '../../../types/entities';

function makeFixtureScene(): SceneModel {
  const params = buildDefaultMepFixtureParams({ x: 1000, y: 2000 }, { shape: 'rectangular' }, 'mm');
  const result = buildMepFixtureEntity(params, 'lyr_test');
  if (!result.ok) throw new Error('fixture build failed: ' + result.hardErrors.join(', '));
  return {
    entities: [result.entity],
    layersById: {},
    bounds: { min: { x: 0, y: 0 }, max: { x: 5000, y: 5000 } },
    units: 'mm',
  } as unknown as SceneModel;
}

describe('useDxfSceneConversion — convertScene (on-demand, shared cache)', () => {
  it('converts a fresh snapshot (entity is not dropped)', () => {
    const scene = makeFixtureScene();
    const { result } = renderHook(() => useDxfSceneConversion({ currentScene: null }));

    const dxf = result.current.convertScene(scene);
    expect(dxf.entities).toHaveLength(1);
    expect(dxf.entities[0].type).toBe('mep-fixture');
  });

  it('reuses the per-entity cache shared with the dxfScene memo (same ref)', () => {
    const scene = makeFixtureScene();
    // Feed the SAME scene to the memo so its cache is populated first.
    const { result } = renderHook(() => useDxfSceneConversion({ currentScene: scene }));

    const fromMemo = result.current.dxfScene.entities[0];
    const fromConvert = result.current.convertScene(scene).entities[0];
    // Shared WeakMap → the entity converts once and both views point at it.
    expect(fromConvert).toBe(fromMemo);
  });

  it('keeps a stable convertScene identity across re-renders (same units)', () => {
    const { result, rerender } = renderHook(() => useDxfSceneConversion({ currentScene: null }));
    const first = result.current.convertScene;
    rerender();
    expect(result.current.convertScene).toBe(first);
  });
});
