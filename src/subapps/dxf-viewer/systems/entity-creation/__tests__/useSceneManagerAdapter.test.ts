/**
 * ADR-577 — `useSceneManagerAdapter` SSoT hook.
 *
 * The ONE memoized `getSceneManager` builder that 20 interactive tool hooks used
 * to copy-paste inline. Behaviour must stay byte-identical to the old block:
 *   - no active level → getSceneManager() returns null
 *   - active level → the ADR-527 cached singleton adapter for that level
 *   - same levelManager identity across re-renders → same getSceneManager (memo)
 *   - changing levelManager identity → fresh getSceneManager
 *   - the adapter reads/writes the live scene SSoT (read-after-write)
 */
import { renderHook, act } from '@testing-library/react';
import { useSceneManagerAdapter } from '../useSceneManagerAdapter';
import { clearLevelSceneManagerCache } from '../LevelSceneManagerAdapter';
import type { SceneModel } from '../../../types/scene';
import type { SceneEntity } from '../../../core/commands/interfaces';

const LEVEL = 'L1';

function makeLiveAccessor() {
  const store: Record<string, SceneModel> = {};
  return {
    getLevelScene: (levelId: string): SceneModel | null => store[levelId] ?? null,
    setLevelScene: (levelId: string, scene: SceneModel): void => {
      store[levelId] = scene;
    },
  };
}

function emptyScene(): SceneModel {
  return { entities: [], layersById: {}, bounds: { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } }, units: 'mm' };
}

function ent(id: string): SceneEntity {
  return { id, type: 'line', visible: true } as unknown as SceneEntity;
}

/** Builds the `levelManager`-like arg the hook consumes. */
function levelManager(acc: ReturnType<typeof makeLiveAccessor>, currentLevelId: string | null) {
  return { ...acc, currentLevelId };
}

describe('ADR-577 — useSceneManagerAdapter', () => {
  it('returns null while no level is active', () => {
    const acc = makeLiveAccessor();
    const { result } = renderHook(() => useSceneManagerAdapter(levelManager(acc, null)));
    expect(result.current()).toBeNull();
  });

  it('returns an ISceneManager bound to the active level', () => {
    const acc = makeLiveAccessor();
    clearLevelSceneManagerCache(acc.getLevelScene);
    const { result } = renderHook(() => useSceneManagerAdapter(levelManager(acc, LEVEL)));
    const sm = result.current();
    expect(sm).not.toBeNull();
    expect(sm?.getLevelId()).toBe(LEVEL);
  });

  it('yields the ADR-527 singleton adapter across repeated calls', () => {
    const acc = makeLiveAccessor();
    clearLevelSceneManagerCache(acc.getLevelScene);
    const { result } = renderHook(() => useSceneManagerAdapter(levelManager(acc, LEVEL)));
    expect(result.current()).toBe(result.current());
  });

  it('keeps getSceneManager stable while levelManager identity is unchanged', () => {
    const acc = makeLiveAccessor();
    const lm = levelManager(acc, LEVEL);
    const { result, rerender } = renderHook(({ mgr }) => useSceneManagerAdapter(mgr), {
      initialProps: { mgr: lm },
    });
    const first = result.current;
    rerender({ mgr: lm });
    expect(result.current).toBe(first);
  });

  it('rebuilds getSceneManager when levelManager identity changes', () => {
    const acc = makeLiveAccessor();
    const { result, rerender } = renderHook(({ mgr }) => useSceneManagerAdapter(mgr), {
      initialProps: { mgr: levelManager(acc, LEVEL) },
    });
    const first = result.current;
    rerender({ mgr: levelManager(acc, LEVEL) });
    expect(result.current).not.toBe(first);
  });

  it('the adapter reads/writes the live scene SSoT (read-after-write)', () => {
    const acc = makeLiveAccessor();
    clearLevelSceneManagerCache(acc.getLevelScene);
    acc.setLevelScene(LEVEL, emptyScene());
    const { result } = renderHook(() => useSceneManagerAdapter(levelManager(acc, LEVEL)));
    act(() => {
      result.current()?.addEntity(ent('line_1'));
    });
    expect(acc.getLevelScene(LEVEL)?.entities.map((e) => e.id)).toEqual(['line_1']);
  });
});
