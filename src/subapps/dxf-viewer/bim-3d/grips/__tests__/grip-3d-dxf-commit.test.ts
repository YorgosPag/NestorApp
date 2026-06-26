/**
 * ADR-537 — grip-3d-dxf-commit: raw DXF 3D grip drag → StretchEntityCommand via the
 * 2D commit SSoT. Forwards NO BIM `*GripKind` (so the commit lands on the default
 * stretch/bulge leg), keeps `polylineGripKind`, maps 'midpoint'→'edge', preserves
 * 'center', and dispatches via the global history (buildDeps.execute is a no-op).
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

import { commitDxfGrip3D } from '../grip-3d-dxf-commit';

const LEVELS = {} as unknown as LevelsHookReturn;

beforeEach(() => {
  mockHistoryExecute.mockClear();
  mockCommit.mockReset();
});

describe('commitDxfGrip3D', () => {
  it('no-ops on a zero delta', () => {
    const grip: GripInfo = { entityId: 'l1', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false };
    expect(commitDxfGrip3D(grip, { x: 0, y: 0 }, LEVELS, 'L1')).toBeNull();
    expect(mockCommit).not.toHaveBeenCalled();
  });

  it('routes a line endpoint drag through stretch + dispatches via global history', () => {
    const fakeCmd = { id: 'cmd-1' };
    mockCommit.mockImplementation((_g: UnifiedGripInfo, _d, deps: DxfCommitDeps) => deps.execute(fakeCmd as never));
    const grip: GripInfo = { entityId: 'l1', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false };
    const result = commitDxfGrip3D(grip, { x: 50, y: 0 }, LEVELS, 'L1');

    const [unified, delta, , mode] = mockCommit.mock.calls[0] as [UnifiedGripInfo, unknown, unknown, string];
    expect(unified.source).toBe('dxf');
    expect(unified.entityId).toBe('l1');
    expect(delta).toEqual({ x: 50, y: 0 });
    expect(mode).toBe('stretch');
    expect(mockHistoryExecute).toHaveBeenCalledWith(fakeCmd);
    expect(result).toBe(fakeCmd);
  });

  it('does NOT forward BIM gripKinds (raw DXF lands on the default stretch path)', () => {
    mockCommit.mockImplementation(() => {});
    // Defensive: even if a BIM kind sneaks in, the raw commit must strip it.
    const grip = { entityId: 'x', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, slabGripKind: 'slab-vertex-0' } as unknown as GripInfo;
    commitDxfGrip3D(grip, { x: 1, y: 0 }, LEVELS, 'L1');
    const [unified] = mockCommit.mock.calls[0] as [UnifiedGripInfo];
    expect(unified.slabGripKind).toBeUndefined();
  });

  it('forwards polylineGripKind (raw-DXF arc-apex bulge vs vertex stretch)', () => {
    mockCommit.mockImplementation(() => {});
    const grip: GripInfo = {
      entityId: 'p1', gripIndex: 3, type: 'edge', position: { x: 0, y: 0 }, movesEntity: false,
      edgeVertexIndices: [0, 1], polylineGripKind: 'polyline-arc-midpoint-0',
    };
    commitDxfGrip3D(grip, { x: 0, y: 10 }, LEVELS, 'L1');
    const [unified] = mockCommit.mock.calls[0] as [UnifiedGripInfo];
    expect(unified.polylineGripKind).toBe('polyline-arc-midpoint-0');
    expect(unified.type).toBe('edge');
  });

  it("preserves a circle centre grip's 'center' type + movesEntity", () => {
    mockCommit.mockImplementation(() => {});
    const grip: GripInfo = { entityId: 'c1', gripIndex: 0, type: 'center', position: { x: 0, y: 0 }, movesEntity: true };
    commitDxfGrip3D(grip, { x: 5, y: 5 }, LEVELS, 'L1');
    const [unified] = mockCommit.mock.calls[0] as [UnifiedGripInfo];
    expect(unified.type).toBe('center');
    expect(unified.movesEntity).toBe(true);
  });
});
