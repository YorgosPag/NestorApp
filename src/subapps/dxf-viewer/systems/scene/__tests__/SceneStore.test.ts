/**
 * SceneStore (ADR-547 Stage 0) — zero-React per-level scene SSoT.
 * Verifies reference-stable snapshots, the no-op guard, version/subscribe
 * semantics, and that getLevelScene reflects writes synchronously (the
 * CompoundCommand invariant the old `levelScenesRef` provided).
 */
import { SceneStore, getSceneRecord, getSceneVersion } from '../SceneStore';
import type { SceneModel } from '../../../types/scene';
import type { Entity } from '../../../types/entities';

function makeScene(entities: Entity[] = []): SceneModel {
  return {
    entities,
    layersById: {},
    bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
    units: 'mm',
  };
}

function fakeEntity(id: string): Entity {
  return { id, type: 'line' } as unknown as Entity;
}

beforeEach(() => {
  SceneStore._resetForTests();
});

describe('SceneStore — getters / mutators', () => {
  it('starts empty', () => {
    expect(getSceneRecord()).toEqual({});
    expect(SceneStore.getLevelScene('L1')).toBeNull();
    expect(SceneStore.hasSceneForLevel('L1')).toBe(false);
    expect(SceneStore.getSceneEntityCount('L1')).toBe(0);
  });

  it('setLevelScene stores + getLevelScene reads it back synchronously', () => {
    const scene = makeScene([fakeEntity('e1')]);
    SceneStore.setLevelScene('L1', scene);
    expect(SceneStore.getLevelScene('L1')).toBe(scene); // same reference
    expect(SceneStore.hasSceneForLevel('L1')).toBe(true);
    expect(SceneStore.getSceneEntityCount('L1')).toBe(1);
  });

  it('isolates scenes per level', () => {
    const a = makeScene([fakeEntity('a')]);
    const b = makeScene([fakeEntity('b1'), fakeEntity('b2')]);
    SceneStore.setLevelScene('A', a);
    SceneStore.setLevelScene('B', b);
    expect(SceneStore.getLevelScene('A')).toBe(a);
    expect(SceneStore.getLevelScene('B')).toBe(b);
    expect(SceneStore.getSceneEntityCount('B')).toBe(2);
  });
});

describe('SceneStore — reference stability + no-op guard', () => {
  it('getRecord is reference-stable between mutations, new on mutation', () => {
    const r0 = getSceneRecord();
    const scene = makeScene();
    SceneStore.setLevelScene('L1', scene);
    const r1 = getSceneRecord();
    expect(r1).not.toBe(r0);          // changed on mutation
    expect(getSceneRecord()).toBe(r1); // stable on re-read (no infinite-loop risk)
  });

  it('setLevelScene with the SAME pointer is a no-op (no version bump, no notify)', () => {
    const scene = makeScene();
    SceneStore.setLevelScene('L1', scene);
    const v = getSceneVersion();
    const r = getSceneRecord();
    SceneStore.setLevelScene('L1', scene); // identical pointer
    expect(getSceneVersion()).toBe(v);
    expect(getSceneRecord()).toBe(r);
  });

  it('replacing a level scene with a new pointer bumps the record + version', () => {
    SceneStore.setLevelScene('L1', makeScene());
    const v = getSceneVersion();
    SceneStore.setLevelScene('L1', makeScene([fakeEntity('x')]));
    expect(getSceneVersion()).toBe(v + 1);
    expect(SceneStore.getSceneEntityCount('L1')).toBe(1);
  });
});

describe('SceneStore — clear', () => {
  it('clearLevelScene removes only that level', () => {
    SceneStore.setLevelScene('A', makeScene());
    SceneStore.setLevelScene('B', makeScene());
    SceneStore.clearLevelScene('A');
    expect(SceneStore.getLevelScene('A')).toBeNull();
    expect(SceneStore.hasSceneForLevel('B')).toBe(true);
  });

  it('clearAllScenes empties the record', () => {
    SceneStore.setLevelScene('A', makeScene());
    SceneStore.setLevelScene('B', makeScene());
    SceneStore.clearAllScenes();
    expect(getSceneRecord()).toEqual({});
  });
});

describe('SceneStore — subscription', () => {
  it('notifies subscribers on mutation and stops after unsubscribe', () => {
    let calls = 0;
    const unsub = SceneStore.subscribe(() => { calls += 1; });
    SceneStore.setLevelScene('L1', makeScene());
    SceneStore.setLevelScene('L2', makeScene());
    expect(calls).toBe(2);
    unsub();
    SceneStore.setLevelScene('L3', makeScene());
    expect(calls).toBe(2); // no further notifications
  });

  it('a no-op setLevelScene does NOT notify', () => {
    const scene = makeScene();
    SceneStore.setLevelScene('L1', scene);
    let calls = 0;
    SceneStore.subscribe(() => { calls += 1; });
    SceneStore.setLevelScene('L1', scene); // identical → no-op
    expect(calls).toBe(0);
  });
});
