/**
 * ADR-049 / ADR-507 §8 — `cascadeTransformedSlabOpenings` transform-AGNOSTIC engine.
 *
 * Verifies the slab-opening follow WIRING: only slabs in the moved set trigger a scan,
 * the caller-supplied `computePatch` is applied per hosted opening (move delta, rotate,
 * scale, mirror all enter the SAME way), the move-set is excluded, and the engine returns
 * the transformed openings (for the emit) + pre-transform snapshots (for snapshot-symmetric
 * undo). The host partition + hosted-opening scan SSoTs are mocked.
 */

import type { ISceneManager, SceneEntity } from '../../../core/commands/interfaces';

jest.mock('../bim-cascade-resolver', () => ({
  partitionBimHosts: jest.fn(() => ({ wallIds: new Set(), slabIds: new Set() })),
  findHostedSlabOpenings: jest.fn(() => []),
}));

import { cascadeTransformedSlabOpenings } from '../cascade-transformed-slab-openings';
import { partitionBimHosts, findHostedSlabOpenings } from '../bim-cascade-resolver';

const mockPartition = partitionBimHosts as jest.Mock;
const mockFind = findHostedSlabOpenings as jest.Mock;

function opening(id: string): SceneEntity {
  return { id, type: 'slab-opening', params: { outline: { vertices: [] } } } as unknown as SceneEntity;
}

function makeSm(byId: Map<string, SceneEntity> = new Map()): {
  sm: Pick<ISceneManager, 'getEntity' | 'updateEntities'> & { getEntities(): readonly SceneEntity[] };
  updateEntities: jest.Mock;
} {
  const updateEntities = jest.fn();
  return {
    sm: {
      getEntity: (id: string) => byId.get(id),
      getEntities: () => [] as unknown as readonly SceneEntity[],
      updateEntities,
    },
    updateEntities,
  };
}

/** A transform-agnostic geometry patch (rotate/scale produce fresh params + geometry). */
const PATCH = () => ({ params: { rotated: true }, geometry: { g: 1 } });

beforeEach(() => {
  mockPartition.mockReset().mockReturnValue({ wallIds: new Set(), slabIds: new Set() });
  mockFind.mockReset().mockReturnValue([]);
});

describe('cascadeTransformedSlabOpenings (transform-agnostic)', () => {
  it('transforms hosted slab-openings (moved + snapshot)', () => {
    mockPartition.mockReturnValue({ wallIds: new Set(), slabIds: new Set(['s1']) });
    mockFind.mockReturnValue(['o1']);
    const { sm, updateEntities } = makeSm(new Map([['o1', opening('o1')]]));

    const { moved, snapshots } = cascadeTransformedSlabOpenings(['s1'], sm, PATCH);

    expect(moved.map((e) => e.id)).toEqual(['o1']);
    expect(snapshots.map((e) => e.id)).toEqual(['o1']);
    expect((moved[0] as unknown as { params: unknown }).params).toEqual({ rotated: true });
    expect(updateEntities).toHaveBeenCalledTimes(1);
  });

  it('no-op when no slab in the moved set', () => {
    const { sm, updateEntities } = makeSm();
    expect(cascadeTransformedSlabOpenings(['x'], sm, PATCH)).toEqual({ moved: [], snapshots: [] });
    expect(mockFind).not.toHaveBeenCalled();
    expect(updateEntities).not.toHaveBeenCalled();
  });

  it('no-op when no hosted openings', () => {
    mockPartition.mockReturnValue({ wallIds: new Set(), slabIds: new Set(['s1']) });
    mockFind.mockReturnValue([]);
    const { sm, updateEntities } = makeSm();
    expect(cascadeTransformedSlabOpenings(['s1'], sm, PATCH).moved).toEqual([]);
    expect(updateEntities).not.toHaveBeenCalled();
  });

  it('skips an opening whose patch is null', () => {
    mockPartition.mockReturnValue({ wallIds: new Set(), slabIds: new Set(['s1']) });
    mockFind.mockReturnValue(['o1']);
    const { sm, updateEntities } = makeSm(new Map([['o1', opening('o1')]]));
    expect(cascadeTransformedSlabOpenings(['s1'], sm, () => null).moved).toEqual([]);
    expect(updateEntities).not.toHaveBeenCalled();
  });

  it('passes the move-set as the exclude set to the hosted-opening scan', () => {
    mockPartition.mockReturnValue({ wallIds: new Set(), slabIds: new Set(['s1']) });
    mockFind.mockReturnValue([]);
    const { sm } = makeSm();
    cascadeTransformedSlabOpenings(['s1', 'o9'], sm, PATCH);
    const [, , exclude] = mockFind.mock.calls[0];
    expect([...(exclude as Set<string>)]).toEqual(['s1', 'o9']);
  });

  it('no-op when scene manager does not expose getEntities', () => {
    const updateEntities = jest.fn();
    const sm = {
      getEntity: () => undefined,
      updateEntities,
    } as unknown as Pick<ISceneManager, 'getEntity' | 'updateEntities'>;
    expect(cascadeTransformedSlabOpenings(['s1'], sm, PATCH)).toEqual({ moved: [], snapshots: [] });
    expect(updateEntities).not.toHaveBeenCalled();
  });
});
