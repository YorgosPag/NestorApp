/**
 * ADR-049 / ADR-408 Φ-C / ADR-507 §8 — `cascadeConnectedPipes` transform-AGNOSTIC engine.
 *
 * Verifies the pipe-follow WIRING independent of the transform: the caller-supplied
 * `computeNextParams` feeds the pose-based resolvers (move delta, rotate, scale, mirror
 * all enter the SAME way), dedup across multiple transformed hosts, exclusion of pipes
 * already in the move set, the moved pipes returned for the emit, AND the pre-transform
 * snapshots returned for snapshot-symmetric undo. The pure anchor-retarget math
 * (`resolve*ConnectedPipePatches`) and the segment geometry SSoT are mocked.
 */

import type { ISceneManager, SceneEntity } from '../../../core/commands/interfaces';
import type { Entity } from '../../../types/entities';

jest.mock('../../geometry/mep-segment-geometry', () => ({
  computeMepSegmentGeometry: () => ({ geom: true }),
}));
jest.mock('../mep-move-propagation', () => ({
  resolveHostMoveConnectedPipePatches: jest.fn(() => []),
  resolveSegmentMoveConnectedPipePatches: jest.fn(() => []),
}));

import { cascadeConnectedPipes } from '../cascade-connected-pipes';
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

/** A transform-agnostic next-params (rotate/scale/mirror produce a fresh params object). */
const NEXT = () => ({ transformed: true });

beforeEach(() => {
  mockHost.mockReset().mockReturnValue([]);
  mockSeg.mockReset().mockReturnValue([]);
});

describe('cascadeConnectedPipes (transform-agnostic)', () => {
  it('retargets pipes connected to a transformed host (moved + snapshot)', () => {
    const pA = pipe('pA');
    mockHost.mockReturnValue([{ segment: pA, nextParams: pA.params }]);
    const { sm, updateEntities } = makeSm([manifold('m1'), pA]);

    const { moved, snapshots } = cascadeConnectedPipes(['m1'], sm, NEXT);

    expect(moved.map((e) => e.id)).toEqual(['pA']);
    expect(snapshots.map((e) => e.id)).toEqual(['pA']);
    expect(updateEntities).toHaveBeenCalledTimes(1);
    expect([...(updateEntities.mock.calls[0][0] as Map<string, unknown>).keys()]).toEqual(['pA']);
  });

  it('hands the computeNextParams result to the resolver as the NEW host pose', () => {
    const pA = pipe('pA');
    mockHost.mockReturnValue([{ segment: pA, nextParams: pA.params }]);
    const { sm } = makeSm([manifold('m1'), pA]);

    cascadeConnectedPipes(['m1'], sm, () => ({ rotated: 42 }));

    const [, , nextHost] = mockHost.mock.calls[0];
    expect((nextHost as { params: unknown }).params).toEqual({ rotated: 42 });
  });

  it('skips the resolve when computeNextParams returns null', () => {
    const { sm, updateEntities } = makeSm([manifold('m1'), pipe('pA')]);
    const { moved } = cascadeConnectedPipes(['m1'], sm, () => null);
    expect(moved).toEqual([]);
    expect(mockHost).not.toHaveBeenCalled();
    expect(updateEntities).not.toHaveBeenCalled();
  });

  it('dedups a pipe connected to two transformed hosts (emitted once)', () => {
    const pA = pipe('pA');
    mockHost.mockReturnValue([{ segment: pA, nextParams: pA.params }]);
    const { sm } = makeSm([manifold('m1'), manifold('m2'), pA]);

    const { moved, snapshots } = cascadeConnectedPipes(['m1', 'm2'], sm, NEXT);

    expect(moved.map((e) => e.id)).toEqual(['pA']);
    expect(snapshots.map((e) => e.id)).toEqual(['pA']);
  });

  it('excludes pipes already in the transform set (no double-transform)', () => {
    const pA = pipe('pA');
    mockHost.mockReturnValue([{ segment: pA, nextParams: pA.params }]);
    const { sm, updateEntities } = makeSm([manifold('m1'), pA]);

    const { moved } = cascadeConnectedPipes(['m1', 'pA'], sm, NEXT);

    expect(moved).toEqual([]);
    expect(updateEntities).not.toHaveBeenCalled();
  });

  it('routes a transformed pipe through the segment resolver', () => {
    const pA = pipe('pA');
    const pB = pipe('pB');
    mockSeg.mockReturnValue([{ segment: pB, nextParams: pB.params }]);
    const { sm } = makeSm([pA, pB]);

    const { moved } = cascadeConnectedPipes(['pA'], sm, NEXT);

    expect(mockSeg).toHaveBeenCalledTimes(1);
    expect(moved.map((e) => e.id)).toEqual(['pB']);
  });

  it('skips non-MEP entities (no resolve call)', () => {
    const { sm, updateEntities } = makeSm([wall('w1')]);
    expect(cascadeConnectedPipes(['w1'], sm, NEXT).moved).toEqual([]);
    expect(mockHost).not.toHaveBeenCalled();
    expect(updateEntities).not.toHaveBeenCalled();
  });

  it('no-op when scene manager does not expose getEntities', () => {
    const updateEntities = jest.fn();
    const sm = { updateEntities } as unknown as Pick<ISceneManager, 'updateEntities'>;
    expect(cascadeConnectedPipes(['m1'], sm, NEXT)).toEqual({ moved: [], snapshots: [] });
    expect(updateEntities).not.toHaveBeenCalled();
  });
});
