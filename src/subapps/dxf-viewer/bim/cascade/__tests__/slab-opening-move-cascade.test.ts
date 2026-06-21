/**
 * ADR-049 — `cascadeMovedSlabOpenings` unit tests.
 *
 * Verifies the in-command slab→slab-opening translation cascade: which openings
 * are selected (hosted by a moved slab), exclusion of openings already in the
 * move set (no double-move), and the returned entities for the emit. The actual
 * delta-apply (`calculateBimMovedGeometry`) is mocked — geometry math is covered
 * by bim-move-geometry's own suite; here we test the cascade wiring.
 */

import type { ISceneManager, SceneEntity } from '../../../core/commands/interfaces';
import type { Entity } from '../../../types/entities';

// Mock the geometry SSoT so the cascade test stays focused on selection/exclusion.
jest.mock('../../utils/bim-move-geometry', () => ({
  calculateBimMovedGeometry: (entity: { id: string }, delta: { x: number; y: number }) => ({
    params: { moved: true, dx: delta.x, dy: delta.y, of: entity.id },
  }),
}));

import { cascadeMovedSlabOpenings } from '../slab-opening-move-cascade';

function slab(id: string): Entity {
  return { id, type: 'slab', kind: 'flat', params: {} } as unknown as Entity;
}
function slabOpening(id: string, slabId: string): Entity {
  return { id, type: 'slab-opening', params: { slabId } } as unknown as Entity;
}
function wall(id: string): Entity {
  return { id, type: 'wall', kind: 'straight', params: {} } as unknown as Entity;
}

/** Minimal scene-manager mock backed by an in-memory entity array. */
function makeSm(entities: Entity[]): {
  sm: Pick<ISceneManager, 'getEntity' | 'updateEntities'> & { getEntities(): readonly SceneEntity[] };
  updateEntities: jest.Mock;
} {
  const updateEntities = jest.fn();
  const sm = {
    getEntities: () => entities as unknown as readonly SceneEntity[],
    getEntity: (id: string) => entities.find((e) => e.id === id) as unknown as SceneEntity | undefined,
    updateEntities,
  };
  return { sm, updateEntities };
}

const DELTA = { x: 10, y: 5 };

describe('cascadeMovedSlabOpenings', () => {
  it('translates slab-openings hosted by a moved slab', () => {
    const entities = [slab('s1'), slabOpening('so1', 's1'), slabOpening('so2', 's1')];
    const { sm, updateEntities } = makeSm(entities);

    const moved = cascadeMovedSlabOpenings(['s1'], DELTA, sm);

    expect(moved.map((e) => e.id).sort()).toEqual(['so1', 'so2']);
    expect(updateEntities).toHaveBeenCalledTimes(1);
    const patchMap = updateEntities.mock.calls[0][0] as Map<string, Partial<SceneEntity>>;
    expect([...patchMap.keys()].sort()).toEqual(['so1', 'so2']);
  });

  it('excludes slab-openings already in the move set (no double-move)', () => {
    const entities = [slab('s1'), slabOpening('so1', 's1')];
    const { sm, updateEntities } = makeSm(entities);

    const moved = cascadeMovedSlabOpenings(['s1', 'so1'], DELTA, sm);

    expect(moved).toEqual([]);
    expect(updateEntities).not.toHaveBeenCalled();
  });

  it('no-op when the move set has no slab', () => {
    const entities = [wall('w1'), slabOpening('so1', 's1')];
    const { sm, updateEntities } = makeSm(entities);

    expect(cascadeMovedSlabOpenings(['w1'], DELTA, sm)).toEqual([]);
    expect(updateEntities).not.toHaveBeenCalled();
  });

  it('no-op for empty move set', () => {
    const { sm, updateEntities } = makeSm([slab('s1'), slabOpening('so1', 's1')]);
    expect(cascadeMovedSlabOpenings([], DELTA, sm)).toEqual([]);
    expect(updateEntities).not.toHaveBeenCalled();
  });

  it('no-op when scene manager does not expose getEntities', () => {
    const updateEntities = jest.fn();
    const sm = {
      getEntity: () => undefined,
      updateEntities,
    } as unknown as Pick<ISceneManager, 'getEntity' | 'updateEntities'>;
    expect(cascadeMovedSlabOpenings(['s1'], DELTA, sm)).toEqual([]);
    expect(updateEntities).not.toHaveBeenCalled();
  });
});
