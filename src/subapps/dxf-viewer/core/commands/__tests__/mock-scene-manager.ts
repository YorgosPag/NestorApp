/**
 * ADR-527 — SSoT test helper: ONE Map-backed `ISceneManager` mock.
 *
 * Before this, ~47 test files each defined their own near-identical inline
 * `ISceneManager` stub (`makeMockScene` / `mockSceneManager` / `sceneManagerOf` / a bare
 * `{} as unknown as ISceneManager`, etc.) — classic copy-paste duplication of test
 * scaffolding. This is the single implementation; tests import `createMockSceneManager`
 * instead of re-declaring the shape.
 *
 * NOT a `*.test.ts` file → jest never runs it as a suite (only `*.test.*` match,
 * see jest.config.js `testMatch`). Lives under `__tests__/` so the SSoT ratchet /
 * production checks treat it as test-only.
 *
 * Usage:
 * ```ts
 * const sm = createMockSceneManager([entityA, entityB]);
 * new SomeCommand(sm).execute();
 * expect(sm.store.get(entityA.id)).toBeDefined();
 *
 * // partial / capturing override:
 * const sm = createMockSceneManager([], { updateEntity: jest.fn() });
 * ```
 */
import type { ISceneManager, SceneEntity } from '../interfaces';

/** ISceneManager mock that also exposes its backing `store` for assertions. */
export type MockSceneManager = ISceneManager & { store: Map<string, SceneEntity> };

/**
 * Build a Map-backed `ISceneManager` mock. `entities` seed the store; `overrides`
 * replace any subset of methods (e.g. inject a `jest.fn()` to assert calls).
 */
export function createMockSceneManager(
  entities: readonly SceneEntity[] = [],
  overrides: Partial<ISceneManager> = {},
): MockSceneManager {
  const store = new Map<string, SceneEntity>();
  for (const e of entities) store.set(e.id, e);

  const base: ISceneManager = {
    addEntity: (e) => { store.set(e.id, e); },
    removeEntity: (id) => { store.delete(id); },
    getEntity: (id) => store.get(id),
    getEntities: () => [...store.values()],
    updateEntity: (id, updates) => {
      const cur = store.get(id);
      if (cur) store.set(id, { ...cur, ...updates });
    },
    updateEntities: (updates) => {
      for (const [id, u] of updates) {
        const cur = store.get(id);
        if (cur) store.set(id, { ...cur, ...u });
      }
    },
    updateVertex: () => {},
    insertVertex: () => {},
    removeVertex: () => {},
    getVertices: () => undefined,
    getEntityIndex: (id) => [...store.keys()].indexOf(id),
    reorderEntity: () => {},
    moveEntityToIndex: () => {},
  };

  return Object.assign(base, overrides, { store });
}
