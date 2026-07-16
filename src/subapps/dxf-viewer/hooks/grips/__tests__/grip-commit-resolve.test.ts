/**
 * grip-commit-resolve SSoT (ADR-584 CHECK 3.28, cluster A) — the two preambles
 * every parametric grip-commit / hot-grip-copy handler shares:
 *   1. `resolveParametricGripEntity` — adapter + typed entity resolution + guards.
 *   2. `resolveGripCommitAnchor` — rotate-pivot-vs-plain-anchor resolution.
 *
 * These pins nail the exact null/guard boundaries + the rotate-pivot vs
 * grip-position anchor selection the 20+ inlined copies used to encode by hand,
 * so a future edit to the shared helper cannot silently regress every commit.
 */

// Firebase auth mock — the scene/entity type barrels touch auth on the import
// path (shared handoff trap, mirror grip-parametric-dispatch-coverage.test.ts).
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import type { Point2D } from '../../../rendering/types/Types';
import type { SceneModel } from '../../../types/scene';
import type { DxfCommitDeps } from '../unified-grip-types';
import { BimRotateHotGripStore } from '../../../bim/grips/bim-rotate-hotgrip-store';
import { resolveParametricGripEntity, resolveGripCommitAnchor } from '../grip-commit-resolve';

/** Minimal parametric entity used across the resolution pins. */
interface TestWall {
  readonly id: string;
  readonly type: 'wall';
  readonly params: { readonly length: number };
}

function makeDeps(entities: readonly unknown[], levelId: string | null = 'level-1'): DxfCommitDeps {
  const scene = { entities } as unknown as SceneModel;
  return {
    moveEntities: jest.fn(),
    execute: jest.fn(),
    currentLevelId: levelId,
    getLevelScene: (id: string) => (id === 'level-1' ? scene : null),
    setLevelScene: jest.fn(),
    onToolChange: jest.fn(),
  };
}

const WALL: TestWall = { id: 'w1', type: 'wall', params: { length: 3000 } };

describe('resolveParametricGripEntity — adapter + typed entity + guard SSoT', () => {
  it('resolves the scene-manager adapter + the typed entity for a matching id/type', () => {
    const deps = makeDeps([WALL]);
    const resolved = resolveParametricGripEntity<TestWall>(deps, 'w1', 'wall');
    expect(resolved).not.toBeNull();
    expect(resolved!.entity).toBe(WALL); // same reference, byte-identical to `candidate as T`
    expect(resolved!.entity.params.length).toBe(3000);
    expect(typeof resolved!.sceneManager.getEntity).toBe('function');
  });

  it('null when the adapter is unavailable (currentLevelId === null)', () => {
    const deps = makeDeps([WALL], null);
    expect(resolveParametricGripEntity<TestWall>(deps, 'w1', 'wall')).toBeNull();
  });

  it('null when the entity id is missing from the scene', () => {
    const deps = makeDeps([WALL]);
    expect(resolveParametricGripEntity<TestWall>(deps, 'nope', 'wall')).toBeNull();
  });

  it('null when the entity is the wrong type (discriminant mismatch)', () => {
    const deps = makeDeps([WALL]);
    expect(resolveParametricGripEntity<TestWall>(deps, 'w1', 'column' as 'wall')).toBeNull();
  });

  it('null when the resolved entity carries no params', () => {
    const deps = makeDeps([{ id: 'w1', type: 'wall' }]);
    expect(resolveParametricGripEntity<TestWall>(deps, 'w1', 'wall')).toBeNull();
  });
});

describe('resolveGripCommitAnchor — rotate-pivot vs plain-anchor SSoT', () => {
  const GRIP_POS: Point2D = { x: 10, y: 20 };
  const DELTA: Point2D = { x: 3, y: -4 };

  afterEach(() => BimRotateHotGripStore.clear());

  it('non-rotation grip → anchors at the grip position, empty pivot patch', () => {
    BimRotateHotGripStore.set({ x: 999, y: 999 }, { x: 500, y: 500 });
    const { anchor, currentPos, pivotPatch } = resolveGripCommitAnchor(false, GRIP_POS, DELTA);
    expect(anchor).toEqual(GRIP_POS);
    expect(currentPos).toEqual({ x: 13, y: 16 }); // gripPos + delta
    expect(pivotPatch).toEqual({});
  });

  it('rotation grip but store empty → falls back to grip position, empty pivot patch', () => {
    BimRotateHotGripStore.clear();
    const { anchor, currentPos, pivotPatch } = resolveGripCommitAnchor(true, GRIP_POS, DELTA);
    expect(anchor).toEqual(GRIP_POS);
    expect(currentPos).toEqual({ x: 13, y: 16 });
    expect(pivotPatch).toEqual({});
  });

  it('rotation grip + published {pivot, anchor} → orbits the picked pivot', () => {
    const pivot: Point2D = { x: 100, y: 100 };
    const storeAnchor: Point2D = { x: 40, y: 50 };
    BimRotateHotGripStore.set(pivot, storeAnchor);
    const { anchor, currentPos, pivotPatch } = resolveGripCommitAnchor(true, GRIP_POS, DELTA);
    expect(anchor).toEqual(storeAnchor); // published anchor, NOT grip position
    expect(currentPos).toEqual({ x: 43, y: 46 }); // storeAnchor + delta
    expect(pivotPatch).toEqual({ pivot });
  });
});
