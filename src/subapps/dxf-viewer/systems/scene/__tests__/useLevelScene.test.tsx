/**
 * useLevelScene (ADR-040 live scene→canvas redraw) — REGRESSION GUARD.
 *
 * The blocker this hook fixes: a committed entity (e.g. a new wall via
 * `addWallToScene` → `SceneStore.setLevelScene`) did NOT repaint until an
 * unrelated re-render (tool change), because the canvas read the scene through a
 * NON-reactive `getLevelScene()` prop. This hook is the reactive read the DXF
 * render leaf uses so the mutation triggers an immediate re-render → repaint.
 *
 * Load-bearing invariants tested here:
 *   1. A `setLevelScene` mutation makes the hook return the NEW scene (the exact
 *      thing that was broken — mutation → reactive update).
 *   2. Reference-stable across reads/re-renders when nothing changed (no
 *      useSyncExternalStore tearing / no needless downstream bitmap rebuild).
 *   3. Editing ANOTHER level does not disturb this level's snapshot.
 *   4. Null level → null.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';

import { SceneStore } from '../SceneStore';
import { useLevelScene } from '../useSceneSelectors';
import type { SceneModel, AnySceneEntity } from '../../../types/scene';

function makeScene(entities: AnySceneEntity[]): SceneModel {
  return {
    entities,
    layersById: {},
    bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
    units: 'mm',
  };
}

function ent(id: string, type = 'wall'): AnySceneEntity {
  return { id, type } as unknown as AnySceneEntity;
}

beforeEach(() => {
  SceneStore._resetForTests();
});

describe('useLevelScene — reactive scene read', () => {
  it('returns the level scene, then the UPDATED scene after a mutation (the fix)', () => {
    SceneStore.setLevelScene('L', makeScene([ent('w1')]));

    const { result } = renderHook(() => useLevelScene('L'));
    expect(result.current?.entities.map((e) => e.id)).toEqual(['w1']);

    // Simulate `addWallToScene`: append a new entity → new SceneModel ref.
    act(() => {
      const prev = SceneStore.getLevelScene('L')!;
      SceneStore.setLevelScene('L', { ...prev, entities: [...prev.entities, ent('w2')] });
    });

    // Without the reactive subscription this stayed at ['w1'] until a tool change.
    expect(result.current?.entities.map((e) => e.id)).toEqual(['w1', 'w2']);
  });

  it('is reference-stable across re-renders when the scene did not change', () => {
    SceneStore.setLevelScene('L', makeScene([ent('w1')]));
    const { result, rerender } = renderHook(() => useLevelScene('L'));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('ignores mutations to a different level', () => {
    SceneStore.setLevelScene('L', makeScene([ent('w1')]));
    const { result } = renderHook(() => useLevelScene('L'));
    const before = result.current;

    act(() => {
      SceneStore.setLevelScene('OTHER', makeScene([ent('x1')]));
    });

    expect(result.current).toBe(before);
  });

  it('returns null for a null level', () => {
    const { result } = renderHook(() => useLevelScene(null));
    expect(result.current).toBeNull();
  });
});
