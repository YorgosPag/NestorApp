/**
 * ADR-535 Φ1 — grip-3d-commit: 3D grip drag → view-agnostic slab command.
 *
 * Locks the bridge onto the 2D commit SSoT: a `GripInfo` + plan-mm delta becomes a
 * `UnifiedGripInfo` (source 'dxf', slabGripKind preserved, 'midpoint'→'edge') routed
 * through `commitDxfGripDragModeAware` in `'stretch'` mode. Risk #1 (§6.1): the
 * overridden `execute` actually dispatches via the global command history (buildDeps'
 * own execute is a no-op). A zero delta is a no-op (returns null, never dispatches).
 */

import type { LevelsHookReturn } from '../../../systems/levels/useLevels';
import type { GripInfo } from '../../../hooks/grip-types';
import type { DxfCommitDeps, UnifiedGripInfo } from '../../../hooks/grips/unified-grip-types';

const mockHistoryExecute = jest.fn();
const mockCommit = jest.fn();

jest.mock('../../../core/commands', () => ({
  getGlobalCommandHistory: () => ({ execute: mockHistoryExecute }),
}));
jest.mock('../../animation/bim3d-edit-interaction-helpers', () => ({
  buildDeps: () => ({
    currentLevelId: 'L1', getLevelScene: () => null, setLevelScene: () => {},
    execute: () => {}, moveEntities: () => {}, onToolChange: () => {},
  }),
}));
jest.mock('../../../hooks/grips/grip-commit-adapters', () => ({
  commitDxfGripDragModeAware: (...args: unknown[]) => mockCommit(...args),
}));

import { commitGrip3DReshape } from '../grip-3d-commit';

const LEVELS = {} as unknown as LevelsHookReturn;

function slabVertexGrip(): GripInfo {
  return {
    entityId: 's1', gripIndex: 0, type: 'vertex',
    position: { x: 100, y: 200 }, movesEntity: false, slabGripKind: 'slab-vertex-0',
  };
}

beforeEach(() => {
  mockHistoryExecute.mockClear();
  mockCommit.mockReset();
});

describe('commitGrip3DReshape', () => {
  it('no-ops on a zero delta (no command dispatched)', () => {
    const result = commitGrip3DReshape(slabVertexGrip(), { x: 0, y: 0 }, LEVELS, 'L1');
    expect(result).toBeNull();
    expect(mockCommit).not.toHaveBeenCalled();
  });

  it('routes a slab vertex drag through commitDxfGripDragModeAware in stretch mode', () => {
    const fakeCmd = { id: 'cmd-1' };
    mockCommit.mockImplementation((_g: UnifiedGripInfo, _d, deps: DxfCommitDeps) => deps.execute(fakeCmd as never));
    const result = commitGrip3DReshape(slabVertexGrip(), { x: 50, y: 0 }, LEVELS, 'L1');

    expect(mockCommit).toHaveBeenCalledTimes(1);
    const [unified, delta, , mode] = mockCommit.mock.calls[0] as [UnifiedGripInfo, unknown, unknown, string];
    expect(unified.source).toBe('dxf');
    expect(unified.slabGripKind).toBe('slab-vertex-0');
    expect(unified.type).toBe('vertex');
    expect(delta).toEqual({ x: 50, y: 0 });
    expect(mode).toBe('stretch');
    // Risk #1 — the override dispatches via the global history; result is that command.
    expect(mockHistoryExecute).toHaveBeenCalledWith(fakeCmd);
    expect(result).toBe(fakeCmd);
  });

  it("maps an edge-midpoint grip's type to 'edge'", () => {
    mockCommit.mockImplementation(() => {});
    const midpoint: GripInfo = {
      entityId: 's1', gripIndex: 4, type: 'midpoint',
      position: { x: 0, y: 0 }, movesEntity: false,
      edgeVertexIndices: [0, 1], slabGripKind: 'slab-edge-midpoint-0',
    };
    commitGrip3DReshape(midpoint, { x: 10, y: 10 }, LEVELS, 'L1');
    const [unified] = mockCommit.mock.calls[0] as [UnifiedGripInfo];
    expect(unified.type).toBe('edge');
    expect(unified.edgeVertexIndices).toEqual([0, 1]);
  });
});
