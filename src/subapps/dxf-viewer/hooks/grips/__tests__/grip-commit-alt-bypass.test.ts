/**
 * ADR-363 Phase 1G.5 — Alt «move-from-characteristic-point» bypass tests.
 *
 * Verifies that, inside `commitDxfGripDragModeAware`, holding Alt re-routes ANY
 * grip drag to a WHOLE-entity move (AutoCAD base-point move) instead of the
 * entity's parametric grip edit:
 *   - Alt held + wall grip → `deps.moveEntities([id], delta)`, parametric
 *     `commitWallGripDrag` NOT called (the wall translates, never widens).
 *   - Alt NOT held + wall grip → parametric `commitWallGripDrag` runs as before
 *     (zero regression to the stretch/thickness path).
 *   - Alt + Copy (toggle OR Ctrl) → clone-with-base via CopyEntityCommand.
 *   - Alt + zero-delta (click, no drag) → no-op (drag guard precedes the bypass).
 */

import { commitDxfGripDragModeAware } from '../grip-commit-adapters';
import type { DxfCommitDeps } from '../unified-grip-types';
import type { UnifiedGripInfo } from '../unified-grip-types';
import { GripAltMoveStore } from '../../../systems/grip/GripAltMoveStore';
import { CtrlKeyTracker } from '../../../keyboard/CtrlKeyTracker';
import { GripCopyModeStore } from '../../../systems/grip/GripCopyModeStore';

// Mock the parametric commits so we can assert the wall path is (not) taken
// without running real geometry math.
const commitWallGripDrag = jest.fn();
jest.mock('../grip-parametric-commits', () => ({
  commitWallGripDrag: (...args: unknown[]) => commitWallGripDrag(...args),
}));

// Mock the scene-manager adapter + CopyEntityCommand for the copy path.
jest.mock('../grip-scene-manager-adapter', () => ({
  createSceneManagerAdapter: () => ({}),
}));
jest.mock('../../../core/commands/entity-commands/CopyEntityCommand', () => ({
  CopyEntityCommand: class {
    validate(): string | null { return null; }
  },
}));

const DELTA = { x: 1000, y: 500 };

function makeDeps(): { deps: DxfCommitDeps; moveEntities: jest.Mock; execute: jest.Mock } {
  const moveEntities = jest.fn();
  const execute = jest.fn();
  const deps = { moveEntities, execute } as unknown as DxfCommitDeps;
  return { deps, moveEntities, execute };
}

function wallGrip(): UnifiedGripInfo {
  return {
    id: 'g1',
    source: 'dxf',
    type: 'vertex',
    entityId: 'wall_1',
    wallGripKind: 'wall-midpoint',
    position: { x: 0, y: 0 },
    movesEntity: false,
  } as unknown as UnifiedGripInfo;
}

describe('ADR-363 Phase 1G.5 — Alt move-from-characteristic-point bypass', () => {
  afterEach(() => {
    GripAltMoveStore.clear();
    CtrlKeyTracker._setForTest(false);
    GripCopyModeStore.clear();
    commitWallGripDrag.mockClear();
  });

  it('Alt-armed → whole-entity move (moveEntities), parametric path bypassed', () => {
    GripAltMoveStore.arm();
    const { deps, moveEntities } = makeDeps();
    commitDxfGripDragModeAware(wallGrip(), DELTA, deps, 'stretch');
    expect(moveEntities).toHaveBeenCalledWith(['wall_1'], DELTA, { isDragging: false });
    expect(commitWallGripDrag).not.toHaveBeenCalled();
  });

  it('NOT Alt-armed → parametric wall path runs (zero regression)', () => {
    const { deps, moveEntities } = makeDeps();
    commitDxfGripDragModeAware(wallGrip(), DELTA, deps, 'stretch');
    expect(commitWallGripDrag).toHaveBeenCalledTimes(1);
    expect(moveEntities).not.toHaveBeenCalled();
  });

  it('Alt-armed + Copy toggle → clone-with-base (CopyEntityCommand), no plain move', () => {
    GripAltMoveStore.arm();
    GripCopyModeStore.toggle(); // enable
    const { deps, moveEntities, execute } = makeDeps();
    commitDxfGripDragModeAware(wallGrip(), DELTA, deps, 'stretch');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(moveEntities).not.toHaveBeenCalled();
    expect(commitWallGripDrag).not.toHaveBeenCalled();
  });

  it('Alt-armed + Ctrl → clone-with-base (AutoCAD MOVE→COPY composition)', () => {
    GripAltMoveStore.arm();
    CtrlKeyTracker._setForTest(true);
    const { deps, moveEntities, execute } = makeDeps();
    commitDxfGripDragModeAware(wallGrip(), DELTA, deps, 'stretch');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(moveEntities).not.toHaveBeenCalled();
  });

  it('Alt-armed + zero delta (click, no drag) → no-op (drag guard precedes bypass)', () => {
    GripAltMoveStore.arm();
    const { deps, moveEntities, execute } = makeDeps();
    commitDxfGripDragModeAware(wallGrip(), { x: 0, y: 0 }, deps, 'stretch');
    expect(moveEntities).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(commitWallGripDrag).not.toHaveBeenCalled();
  });
});
