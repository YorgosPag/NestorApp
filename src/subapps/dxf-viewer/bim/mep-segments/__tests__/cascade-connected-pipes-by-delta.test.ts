/**
 * ADR-049 / ADR-408 Φ-C — `cascadeConnectedPipesByDelta` unit tests.
 *
 * Verifies the in-command pipe-follow WIRING: which moved entities trigger a
 * resolve (MEP host / segment only), dedup across multiple moved hosts, exclusion
 * of pipes already in the move set, and the returned entities for the emit. The
 * pure anchor-retarget math (`resolve*ConnectedPipePatches`) and the geometry/
 * delta SSoTs are mocked — they have their own suites.
 */

import type { ISceneManager, SceneEntity } from '../../../core/commands/interfaces';
import type { Entity } from '../../../types/entities';

jest.mock('../../utils/bim-move-geometry', () => ({
  calculateBimMovedGeometry: () => ({ params: { moved: true } }),
}));
jest.mock('../../geometry/mep-segment-geometry', () => ({
  computeMepSegmentGeometry: () => ({ geom: true }),
}));
jest.mock('../mep-move-propagation', () => ({
  resolveHostMoveConnectedPipePatches: jest.fn(() => []),
  resolveSegmentMoveConnectedPipePatches: jest.fn(() => []),
}));

import { cascadeConnectedPipesByDelta } from '../cascade-connected-pipes-by-delta';
import {
  resolveHostMoveConnectedPipePatches,
  resolveSegmentMoveConnectedPipePatches,
} from '../mep-move-propagation';

const mockHost = resolveHostMoveConnectedPipePatches as jest.Mock;
const mockSeg = resolveSegmentMoveConnectedPipePatches as jest.Mock;

function manifold(id: string): Entity {
  return { id, type: 'mep-manifold', params: { position: { x: 0, y: 0, z: 0 } } } as unknown as Entity;
}
function pipe(id: string): Entity {
  return {
    id, type: 'mep-segment',
    params: { domain: 'pipe', startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 1, y: 0, z: 0 } },
  } as unknown as Entity;
}
function wall(id: string): Entity {
  return { id, type: 'wall', kind: 'straight', params: {} } as unknown as Entity;
}

function makeSm(entities: Entity[]): {
  sm: Pick<ISceneManager, 'updateEntities'> & { getEntities(): readonly SceneEntity[] };
  updateEntities: jest.Mock;
} {
  const updateEntities = jest.fn();
  return {
    sm: { getEntities: () => entities as unknown as readonly SceneEntity[], updateEntities },
    updateEntities,
  };
}

const DELTA = { x: 10, y: 0 };

beforeEach(() => {
  mockHost.mockReset().mockReturnValue([]);
  mockSeg.mockReset().mockReturnValue([]);
});

describe('cascadeConnectedPipesByDelta', () => {
  it('retargets pipes connected to a moved host', () => {
    const pA = pipe('pA');
    mockHost.mockReturnValue([{ segment: pA, nextParams: pA.params }]);
    const { sm, updateEntities } = makeSm([manifold('m1'), pA]);

    const moved = cascadeConnectedPipesByDelta(['m1'], DELTA, sm);

    expect(moved.map((e) => e.id)).toEqual(['pA']);
    expect(updateEntities).toHaveBeenCalledTimes(1);
    expect([...(updateEntities.mock.calls[0][0] as Map<string, unknown>).keys()]).toEqual(['pA']);
  });

  it('dedups a pipe connected to two moved hosts (emitted once)', () => {
    const pA = pipe('pA');
    mockHost.mockReturnValue([{ segment: pA, nextParams: pA.params }]);
    const { sm } = makeSm([manifold('m1'), manifold('m2'), pA]);

    const moved = cascadeConnectedPipesByDelta(['m1', 'm2'], DELTA, sm);

    expect(moved.map((e) => e.id)).toEqual(['pA']);
  });

  it('excludes pipes already in the move set (no double-move)', () => {
    const pA = pipe('pA');
    mockHost.mockReturnValue([{ segment: pA, nextParams: pA.params }]);
    const { sm, updateEntities } = makeSm([manifold('m1'), pA]);

    const moved = cascadeConnectedPipesByDelta(['m1', 'pA'], DELTA, sm);

    expect(moved).toEqual([]);
    expect(updateEntities).not.toHaveBeenCalled();
  });

  it('skips non-MEP entities (no resolve call)', () => {
    const { sm, updateEntities } = makeSm([wall('w1')]);
    expect(cascadeConnectedPipesByDelta(['w1'], DELTA, sm)).toEqual([]);
    expect(mockHost).not.toHaveBeenCalled();
    expect(updateEntities).not.toHaveBeenCalled();
  });

  it('routes a moved pipe through the segment resolver', () => {
    const pB = pipe('pB');
    const pA = pipe('pA');
    mockSeg.mockReturnValue([{ segment: pB, nextParams: pB.params }]);
    const { sm } = makeSm([pA, pB]);

    const moved = cascadeConnectedPipesByDelta(['pA'], DELTA, sm);

    expect(mockSeg).toHaveBeenCalledTimes(1);
    expect(moved.map((e) => e.id)).toEqual(['pB']);
  });

  it('no-op when scene manager does not expose getEntities', () => {
    const updateEntities = jest.fn();
    const sm = { updateEntities } as unknown as Pick<ISceneManager, 'updateEntities'>;
    expect(cascadeConnectedPipesByDelta(['m1'], DELTA, sm)).toEqual([]);
    expect(updateEntities).not.toHaveBeenCalled();
  });
});
