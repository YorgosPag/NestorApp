/**
 * ADR-408 Φ-C (whole-entity / Alt move-from-point side) — tests for
 * `executeWholeEntityConnectivityMove`.
 *
 * This glue routes the AutoCAD "move from characteristic point" (Alt+drag,
 * `mode === 'move'`) of a plumbing host through the SAME connectivity executor the
 * parametric grip path uses, so connected pipe ends follow. It must:
 *   - return `false` (touching nothing) for a non-plumbing entity or a missing one,
 *     so the caller falls back to its bare move;
 *   - return `true` and execute ONE `CompoundCommand` (host move + pipe follow) when
 *     a pipe end is snapped to the moved host's connector;
 *   - return `true` and execute a BARE `MoveEntityCommand` when the host has no
 *     connected pipe.
 *
 * `calculateBimMovedGeometry` is mocked to a position-only shift (keeps connectors
 * intact, skips the heavy geometry recompute) so the test isolates the glue: the
 * gate, the nextHost build, and the wrap — not the per-kind geometry math.
 */

import type { ICommand, ISceneManager, SceneEntity } from '../../../core/commands/interfaces';
import type { Entity } from '../../../types/entities';
import type { MepSegmentEntity } from '../../types/mep-segment-types';
import { deriveCenterlineElevationMm } from '../../types/mep-segment-types';

// Mock the geometry mover: shift `params.position` by delta, keep everything else
// (incl. host-local connectors) so the real resolver still finds connected pipes.
jest.mock('../../utils/bim-move-geometry', () => ({
  calculateBimMovedGeometry: (entity: { params?: { position?: { x: number; y: number; z?: number } } }, delta: { x: number; y: number }) => {
    const pos = entity?.params?.position;
    if (!pos) return null;
    return { params: { ...entity.params, position: { x: pos.x + delta.x, y: pos.y + delta.y, z: pos.z ?? 0 } } };
  },
}));

import { executeWholeEntityConnectivityMove } from '../build-whole-entity-connectivity-move';

/** Floor manifold with one pipe outlet at host-local (50, 40), datum `mountingElevationMm`. */
function manifold(position: { x: number; y: number }, mountingElevationMm: number): Entity {
  return {
    id: 'mfld-1',
    type: 'mep-manifold',
    kind: 'floor-manifold',
    params: {
      position: { x: position.x, y: position.y, z: 0 },
      rotation: 0,
      mountingElevationMm,
      connectors: [
        { connectorId: 'm-out-0', domain: 'pipe', flow: 'out', localPosition: { x: 50, y: 40, z: 0 } },
      ],
    },
  } as unknown as Entity;
}

/** A non-plumbing entity (no mounting datum → gate rejects it). */
function wall(): Entity {
  return { id: 'wall-1', type: 'wall', params: { position: { x: 0, y: 0, z: 0 } } } as unknown as Entity;
}

/** Pipe segment between two plan points. */
function pipe(id: string, start: { x: number; y: number }, end: { x: number; y: number }): MepSegmentEntity {
  return {
    id,
    type: 'mep-segment',
    kind: 'pipe',
    params: {
      domain: 'pipe',
      sectionKind: 'round',
      startPoint: { x: start.x, y: start.y, z: 400 },
      endPoint: { x: end.x, y: end.y, z: 400 },
      diameter: 50,
      centerlineElevationMm: deriveCenterlineElevationMm(400, 400),
    },
  } as unknown as MepSegmentEntity;
}

/** Minimal ISceneManager over a fixed entity list; records nothing (read-only here). */
function sceneManagerOf(entities: readonly Entity[]): ISceneManager {
  return {
    getEntity: (id: string) => entities.find((e) => e.id === id) as unknown as SceneEntity | undefined,
    getEntities: () => entities as unknown as readonly SceneEntity[],
    addEntity: () => {},
    removeEntity: () => {},
    updateEntity: () => {},
    updateEntities: () => {},
    updateVertex: () => {},
    insertVertex: () => {},
    removeVertex: () => {},
    getVertices: () => undefined,
    getEntityIndex: () => -1,
    reorderEntity: () => {},
    moveEntityToIndex: () => {},
  } as unknown as ISceneManager;
}

describe('executeWholeEntityConnectivityMove', () => {
  const delta = { x: 100, y: 0 };

  it('returns false and does not execute for a non-plumbing entity', () => {
    const execute = jest.fn();
    const sm = sceneManagerOf([wall()]);

    const handled = executeWholeEntityConnectivityMove({ entityId: 'wall-1', delta, sceneManager: sm, execute });

    expect(handled).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('returns false and does not execute for a missing entity', () => {
    const execute = jest.fn();
    const sm = sceneManagerOf([]);

    const handled = executeWholeEntityConnectivityMove({ entityId: 'ghost', delta, sceneManager: sm, execute });

    expect(handled).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('wraps host + connected pipe in one CompoundCommand when a pipe is snapped to the outlet', () => {
    const execute = jest.fn();
    // Outlet world pose = position (0,0) + local (50,40) = (50,40); pipe starts there.
    const host = manifold({ x: 0, y: 0 }, 400);
    const connectedPipe = pipe('p1', { x: 50, y: 40 }, { x: 1000, y: 40 });
    const sm = sceneManagerOf([host, connectedPipe]);

    const handled = executeWholeEntityConnectivityMove({ entityId: 'mfld-1', delta, sceneManager: sm, execute });

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    const command = execute.mock.calls[0][0] as ICommand;
    expect(command.type).toBe('compound');
    expect(command.getAffectedEntityIds().sort()).toEqual(['mfld-1', 'p1']);
  });

  it('executes a bare MoveEntityCommand when the host has no connected pipe', () => {
    const execute = jest.fn();
    const host = manifold({ x: 0, y: 0 }, 400);
    const farPipe = pipe('p2', { x: 5000, y: 0 }, { x: 6000, y: 0 }); // not snapped
    const sm = sceneManagerOf([host, farPipe]);

    const handled = executeWholeEntityConnectivityMove({ entityId: 'mfld-1', delta, sceneManager: sm, execute });

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    const command = execute.mock.calls[0][0] as ICommand;
    expect(command.type).toBe('move-entity');
    expect(command.getAffectedEntityIds()).toEqual(['mfld-1']);
  });
});
