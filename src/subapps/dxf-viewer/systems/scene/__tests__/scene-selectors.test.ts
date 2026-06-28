/**
 * scene-selectors (ADR-547 Stage 2/3) — granular, reference-stable reads.
 *
 * The load-bearing invariant: editing an entity of one type must leave the slice
 * of ANOTHER type reference-identical, so a host subscribed to the other type
 * does not re-render. Also covers per-id stability and version gating.
 */
import { SceneStore } from '../SceneStore';
import {
  getSceneEntitiesByType,
  getSceneEntityById,
  _resetSelectorCachesForTests,
} from '../scene-selectors';
import type { SceneModel, AnySceneEntity } from '../../../types/scene';

function makeScene(entities: AnySceneEntity[]): SceneModel {
  return {
    entities,
    layersById: {},
    bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
    units: 'mm',
  };
}

const isWall = (e: AnySceneEntity): e is AnySceneEntity => e.type === 'wall';
const isColumn = (e: AnySceneEntity): e is AnySceneEntity => e.type === 'column';

function ent(id: string, type: string): AnySceneEntity {
  return { id, type } as unknown as AnySceneEntity;
}

/** Mirror LevelSceneManagerAdapter.updateEntity: only the edited entity is a new
 *  object; every other entity keeps its reference. */
function editEntity(scene: SceneModel, id: string): SceneModel {
  return {
    ...scene,
    entities: scene.entities.map((e) => (e.id === id ? { ...e } : e)),
  };
}

beforeEach(() => {
  SceneStore._resetForTests();
  _resetSelectorCachesForTests();
});

describe('getSceneEntitiesByType — reference stability', () => {
  it('returns a stable empty array for a null level', () => {
    expect(getSceneEntitiesByType(null, isWall)).toHaveLength(0);
    expect(getSceneEntitiesByType(null, isWall)).toBe(getSceneEntitiesByType(null, isWall));
  });

  it('filters to the requested type', () => {
    SceneStore.setLevelScene('L', makeScene([ent('w1', 'wall'), ent('c1', 'column'), ent('w2', 'wall')]));
    const walls = getSceneEntitiesByType('L', isWall);
    expect(walls.map((w) => w.id)).toEqual(['w1', 'w2']);
  });

  it('returns the SAME reference across reads when nothing changed', () => {
    SceneStore.setLevelScene('L', makeScene([ent('w1', 'wall')]));
    expect(getSceneEntitiesByType('L', isWall)).toBe(getSceneEntitiesByType('L', isWall));
  });

  it('keeps the wall slice reference stable when a COLUMN is edited', () => {
    const scene = makeScene([ent('w1', 'wall'), ent('c1', 'column')]);
    SceneStore.setLevelScene('L', scene);
    const wallsBefore = getSceneEntitiesByType('L', isWall);

    SceneStore.setLevelScene('L', editEntity(scene, 'c1'));
    const wallsAfter = getSceneEntitiesByType('L', isWall);

    expect(wallsAfter).toBe(wallsBefore); // ← the whole point: no wall re-render
  });

  it('changes the wall slice reference when a WALL is edited', () => {
    const scene = makeScene([ent('w1', 'wall'), ent('c1', 'column')]);
    SceneStore.setLevelScene('L', scene);
    const wallsBefore = getSceneEntitiesByType('L', isWall);

    SceneStore.setLevelScene('L', editEntity(scene, 'w1'));
    const wallsAfter = getSceneEntitiesByType('L', isWall);

    expect(wallsAfter).not.toBe(wallsBefore);
    expect(wallsAfter.map((w) => w.id)).toEqual(['w1']);
  });

  it('changes reference when a wall is added or removed', () => {
    const scene = makeScene([ent('w1', 'wall')]);
    SceneStore.setLevelScene('L', scene);
    const before = getSceneEntitiesByType('L', isWall);

    SceneStore.setLevelScene('L', makeScene([ent('w1', 'wall'), ent('w2', 'wall')]));
    expect(getSceneEntitiesByType('L', isWall)).not.toBe(before);
    expect(getSceneEntitiesByType('L', isWall)).toHaveLength(2);
  });

  it('isolates caches across guards and levels', () => {
    SceneStore.setLevelScene('L', makeScene([ent('w1', 'wall'), ent('c1', 'column')]));
    expect(getSceneEntitiesByType('L', isWall).map((e) => e.id)).toEqual(['w1']);
    expect(getSceneEntitiesByType('L', isColumn).map((e) => e.id)).toEqual(['c1']);
    expect(getSceneEntitiesByType('OTHER', isWall)).toHaveLength(0);
  });
});

describe('getSceneEntityById — per-entity stability', () => {
  it('returns null for null inputs', () => {
    expect(getSceneEntityById(null, 'x')).toBeNull();
    expect(getSceneEntityById('L', null)).toBeNull();
  });

  it('returns the same reference until that entity changes', () => {
    const scene = makeScene([ent('w1', 'wall'), ent('c1', 'column')]);
    SceneStore.setLevelScene('L', scene);
    const before = getSceneEntityById('L', 'w1');
    expect(before?.id).toBe('w1');

    // Edit a DIFFERENT entity → w1 reference is unchanged.
    SceneStore.setLevelScene('L', editEntity(scene, 'c1'));
    expect(getSceneEntityById('L', 'w1')).toBe(before);

    // Edit w1 itself → new reference.
    SceneStore.setLevelScene('L', editEntity(scene, 'w1'));
    expect(getSceneEntityById('L', 'w1')).not.toBe(before);
  });

  it('returns null for an absent id', () => {
    SceneStore.setLevelScene('L', makeScene([ent('w1', 'wall')]));
    expect(getSceneEntityById('L', 'ghost')).toBeNull();
  });
});
