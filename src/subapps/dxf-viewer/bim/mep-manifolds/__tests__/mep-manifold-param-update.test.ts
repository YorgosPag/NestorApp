/**
 * ADR-408 Φ12 — `buildManifoldParamUpdate` SSoT tests.
 *
 * The single command-builder shared by the «Έξοδοι» tab and the on-canvas outlet
 * add/remove grips. Verifies: (1) connectors are re-seeded (1 inlet + N outlets)
 * from the next params, (2) a plain `UpdateMepManifoldParamsCommand` when no pipe
 * is connected, (3) a `CompoundCommand` + the connected-pipe ids when pipes follow.
 * `resolveManifoldConnectedPipePatches` is mocked so the compound branch is tested
 * without staging real pipe geometry.
 */

import { buildManifoldParamUpdate } from '../mep-manifold-param-update';
import {
  buildMepManifoldEntity,
  buildDefaultMepManifoldParams,
} from '../../../hooks/drawing/mep-manifold-completion';
import { CompoundCommand } from '../../../core/commands';
import { UpdateMepManifoldParamsCommand } from '../../../core/commands/entity-commands/UpdateMepManifoldParamsCommand';
import type { MepManifoldEntity, MepManifoldParams } from '../../types/mep-manifold-types';
import type { ISceneManager } from '../../../core/commands/interfaces';
import { resolveManifoldConnectedPipePatches } from '../../mep-segments/mep-elevation-propagation';

jest.mock('../../mep-segments/mep-elevation-propagation', () => ({
  resolveManifoldConnectedPipePatches: jest.fn(() => []),
}));
const mockResolve = resolveManifoldConnectedPipePatches as jest.MockedFunction<
  typeof resolveManifoldConnectedPipePatches
>;

function manifold(outletCount = 4): MepManifoldEntity {
  const params = { ...buildDefaultMepManifoldParams({ x: 100, y: 100 }), outletCount };
  const res = buildMepManifoldEntity(params, 'mfld-1');
  if (!res.ok) throw new Error('invalid');
  return res.entity;
}

/** Minimal scene manager — only `updateEntity` is exercised (on `command.execute`). */
function capturingSceneManager(captured: { params?: MepManifoldParams }): ISceneManager {
  return {
    updateEntity: (_id: string, updates: unknown) => {
      captured.params = (updates as { params?: MepManifoldParams }).params;
    },
    getEntity: () => undefined,
    getEntities: () => [],
  } as unknown as ISceneManager;
}

beforeEach(() => {
  mockResolve.mockReset();
  mockResolve.mockReturnValue([]);
});

describe('buildManifoldParamUpdate', () => {
  it('re-seeds connectors (1 inlet + N outlets) from the next params', () => {
    const m = manifold(4);
    const next: MepManifoldParams = { ...m.params, outletCount: 6 };
    const captured: { params?: MepManifoldParams } = {};
    const { command, segmentIds } = buildManifoldParamUpdate([m], m, next, capturingSceneManager(captured));

    expect(segmentIds).toEqual([]);
    expect(command).toBeInstanceOf(UpdateMepManifoldParamsCommand);
    command.execute();
    expect(captured.params?.outletCount).toBe(6);
    expect(captured.params?.connectors).toHaveLength(7); // 1 inlet + 6 outlets
  });

  it('returns a plain command (not compound) when no pipe is connected', () => {
    const m = manifold(4);
    const { command } = buildManifoldParamUpdate(
      [m],
      m,
      { ...m.params, outletCount: 5 },
      capturingSceneManager({}),
    );
    expect(command).toBeInstanceOf(UpdateMepManifoldParamsCommand);
    expect(command).not.toBeInstanceOf(CompoundCommand);
  });

  it('wraps the manifold + connected pipes in a CompoundCommand and returns their ids', () => {
    const m = manifold(4);
    mockResolve.mockReturnValue([
      { segment: { id: 'pipe-1', params: {} } as never, nextParams: {} as never },
      { segment: { id: 'pipe-2', params: {} } as never, nextParams: {} as never },
    ]);
    const { command, segmentIds } = buildManifoldParamUpdate(
      [m],
      m,
      { ...m.params, outletCount: 5 },
      capturingSceneManager({}),
    );
    expect(command).toBeInstanceOf(CompoundCommand);
    expect(segmentIds).toEqual(['pipe-1', 'pipe-2']);
  });
});
