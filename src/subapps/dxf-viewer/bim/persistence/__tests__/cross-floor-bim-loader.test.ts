/**
 * ADR-469 — cross-floor per-entity BIM loader unit tests.
 *
 * Locks the orchestration invariants of `loadFloorBimEntities` (the hydration
 * itself lives in each kind's `docToEntity`, tested separately):
 *  - one `getAll` per registered BIM kind, under the scope constraints (tenant
 *    companyId is NOT in the constraints — auto-applied by `getAll`);
 *  - results merged (flattened) across kinds;
 *  - a failing kind degrades to `[]` instead of rejecting the whole load.
 */

import type { Entity } from '../../../types/entities';

const SENTINEL_CONSTRAINTS = [{ __scope: 'sentinel' }];

const getAll = jest.fn();
jest.mock('@/services/firestore', () => ({
  firestoreQueryService: { getAll: (...args: unknown[]) => getAll(...args) },
}));
jest.mock('../bim-floor-scope', () => ({
  buildBimScopeConstraints: jest.fn(() => SENTINEL_CONSTRAINTS),
}));

// Identity converters — isolate the loader's orchestration from real hydration.
jest.mock('../../../hooks/data/column-persistence-helpers', () => ({ columnDocToEntity: (d: unknown) => d }));
jest.mock('../../../hooks/data/wall-persistence-helpers', () => ({ docToEntity: (d: unknown) => d }));
jest.mock('../../../hooks/data/beam-persistence-helpers', () => ({ beamDocToEntity: (d: unknown) => d }));
jest.mock('../../../hooks/data/slab-persistence-helpers', () => ({ docToEntity: (d: unknown) => d }));
jest.mock('../../../hooks/data/roof-persistence-helpers', () => ({ docToEntity: (d: unknown) => d }));
jest.mock('../../stairs/stair-doc-hydration', () => ({ stairDocToEntity: (d: unknown) => d }));
jest.mock('../../foundations/foundation-firestore-service', () => ({ foundationDocToEntity: (d: unknown) => d }));
jest.mock('../../floor-finishes/floor-finish-firestore-service', () => ({ floorFinishDocToEntity: (d: unknown) => d }));
jest.mock('../../thermal-spaces/thermal-space-firestore-service', () => ({ thermalSpaceDocToEntity: (d: unknown) => d }));
jest.mock('../../space-separators/space-separator-firestore-service', () => ({ spaceSeparatorDocToEntity: (d: unknown) => d }));

import { loadFloorBimEntities } from '../cross-floor-bim-loader';
import { buildBimScopeConstraints } from '../bim-floor-scope';

const scope = {
  companyId: 'comp_x',
  projectId: 'proj_x',
  userId: 'user_x',
  floorId: 'flr_x',
  floorplanId: 'file_x',
} as const;

const ent = (id: string, type: string): Entity => ({ id, type } as unknown as Entity);

beforeEach(() => {
  getAll.mockReset();
  (buildBimScopeConstraints as jest.Mock).mockClear();
});

describe('loadFloorBimEntities', () => {
  it('issues one getAll per registered kind, under the scope constraints (no companyId in constraints)', async () => {
    getAll.mockResolvedValue({ documents: [] });
    await loadFloorBimEntities(scope);
    // 10 covered kinds (column, wall, beam, slab, roof, stair, foundation,
    // floor-finish, thermal-space, space-separator).
    expect(getAll).toHaveBeenCalledTimes(10);
    for (const call of getAll.mock.calls) {
      expect(call[1]).toEqual({ constraints: SENTINEL_CONSTRAINTS });
    }
    // Scope built from durable identity (projectId + floorId/floorplanId).
    expect(buildBimScopeConstraints).toHaveBeenCalledWith({
      projectId: 'proj_x',
      floorplanId: 'file_x',
      floorId: 'flr_x',
    });
  });

  it('merges (flattens) entities across kinds', async () => {
    getAll.mockImplementation((key: string) =>
      Promise.resolve({
        documents:
          key === 'FLOORPLAN_COLUMNS'
            ? [ent('c1', 'column'), ent('c2', 'column')]
            : key === 'FLOORPLAN_WALLS'
              ? [ent('w1', 'wall')]
              : [],
      }),
    );
    const result = await loadFloorBimEntities(scope);
    expect(result.map((e) => e.id).sort()).toEqual(['c1', 'c2', 'w1']);
  });

  it('degrades a failing kind to [] without rejecting the whole load', async () => {
    getAll.mockImplementation((key: string) =>
      key === 'FLOORPLAN_COLUMNS'
        ? Promise.reject(new Error('permission-denied'))
        : key === 'FLOORPLAN_BEAMS'
          ? Promise.resolve({ documents: [ent('b1', 'beam')] })
          : Promise.resolve({ documents: [] }),
    );
    const result = await loadFloorBimEntities(scope);
    expect(result.map((e) => e.id)).toEqual(['b1']);
  });

  it('returns [] for a floor with no persisted BIM', async () => {
    getAll.mockResolvedValue({ documents: [] });
    expect(await loadFloorBimEntities(scope)).toEqual([]);
  });
});
