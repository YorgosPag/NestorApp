/**
 * ADR-448 Phase 3 — ensureLevelsForBuilding SSoT unit tests.
 *
 * Locks the all-floors loop over the per-floor SSoT (`findOrCreateLevelForFloor`):
 * every floor gets a Level, basement → roof order, idempotent re-runs create no
 * duplicates, and floor-less inputs are ignored.
 */

import { ensureLevelsForBuilding, type BuildingFloorInput } from '../ensure-levels-for-building';
import type { LevelFloorResolver } from '../level-floor-resolution';
import type { Level } from '../config';

// Out-of-order floors so the test proves the basement → roof sort.
const FLOORS: BuildingFloorInput[] = [
  { id: 'upr', number: 1, label: 'Όροφος 1' },
  { id: 'fnd', number: -2, label: 'Θεμελίωση' },
  { id: 'grd', number: 0, label: 'Ισόγειο' },
  { id: 'bsm', number: -1, label: 'Υπόγειο' },
];

function makeLevel(id: string, name: string, floorId?: string, buildingId?: string): Level {
  return { id, name, order: 0, isDefault: false, visible: true, floorId, buildingId };
}

/**
 * In-memory resolver mirroring `useLevels`: `addLevel` appends a Level and returns
 * an id, `linkLevelToFloor` writes the floor link. The `levels` array is mutated
 * so a single call sees its own writes (the real hook re-renders between calls).
 */
function makeResolver(initial: Level[] = []): LevelFloorResolver & { levels: Level[] } {
  const levels: Level[] = [...initial];
  let counter = 0;
  return {
    levels,
    addLevel: async (name, _setAsDefault, floorId) => {
      const id = `level-${++counter}`;
      levels.push(makeLevel(id, name, floorId));
      return id;
    },
    linkLevelToFloor: async (levelId, floorId, buildingId) => {
      const target = levels.find((l) => l.id === levelId);
      if (target) {
        target.floorId = floorId ?? undefined;
        target.buildingId = buildingId ?? undefined;
      }
    },
  };
}

describe('ensureLevelsForBuilding (ADR-448 Phase 3)', () => {
  it('creates one Level per floor of the building', async () => {
    const resolver = makeResolver();
    const results = await ensureLevelsForBuilding(resolver, FLOORS, 'bld-1');

    expect(results).toHaveLength(4);
    expect(results.every((r) => r.levelId !== null)).toBe(true);
    expect(results.every((r) => r.created)).toBe(true);
    // Every floor now owns exactly one linked Level.
    const linked = resolver.levels.filter((l) => l.floorId);
    expect(linked).toHaveLength(4);
    expect(linked.every((l) => l.buildingId === 'bld-1')).toBe(true);
  });

  it('processes floors basement → roof (deterministic order)', async () => {
    const resolver = makeResolver();
    const results = await ensureLevelsForBuilding(resolver, FLOORS, 'bld-1');
    expect(results.map((r) => r.floorId)).toEqual(['fnd', 'bsm', 'grd', 'upr']);
  });

  it('is idempotent — re-import creates no duplicate Levels', async () => {
    const resolver = makeResolver();
    await ensureLevelsForBuilding(resolver, FLOORS, 'bld-1');
    const countAfterFirst = resolver.levels.length;

    const second = await ensureLevelsForBuilding(resolver, FLOORS, 'bld-1');
    expect(resolver.levels.length).toBe(countAfterFirst); // no new levels
    expect(second.every((r) => !r.created)).toBe(true); // all reused
  });

  it('reuses a pre-existing Level for a floor and creates only the rest', async () => {
    const resolver = makeResolver([makeLevel('pre', 'Ισόγειο', 'grd')]);
    const results = await ensureLevelsForBuilding(resolver, FLOORS, 'bld-1');

    const ground = results.find((r) => r.floorId === 'grd');
    expect(ground?.levelId).toBe('pre');
    expect(ground?.created).toBe(false);
    // 4 floors total, 1 pre-existing → 3 freshly created.
    expect(results.filter((r) => r.created)).toHaveLength(3);
  });

  it('skips floor-less inputs (no id)', async () => {
    const resolver = makeResolver();
    const dirty: BuildingFloorInput[] = [...FLOORS, { id: '', number: 5 }];
    const results = await ensureLevelsForBuilding(resolver, dirty, 'bld-1');
    expect(results).toHaveLength(4);
  });
});
