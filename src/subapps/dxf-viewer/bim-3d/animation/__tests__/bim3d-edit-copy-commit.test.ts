/**
 * ADR-688 Φ3 — commitCopyDrag orchestration tests.
 *
 * Verifies the Ctrl copy-drag commit wiring: a move outcome with a nonzero plan delta
 * clones the edited selection via the clone SSoT, executes the undoable command and
 * re-selects the clones; a non-move outcome / zero plan delta / empty source / null
 * clone all short-circuit to false (the caller then performs a normal move + restore).
 * The delta math (`resolveMovePlanDeltaCanvas`), scene lookup, clone SSoT and command
 * history are mocked — the focus is this module's orchestration.
 */

import type { BridgeOutcome } from '../../gizmo/bim-gizmo-drag-bridge';
import type { EditInteractionCtx } from '../bim3d-edit-interaction-handlers';
import type { CopyDragDeps } from '../bim3d-edit-copy-commit';

const mockEntities: Array<{ id: string }> = [];
let mockPlanDelta = { x: 100, y: 0 };
const mockBuild = jest.fn();
const mockExecute = jest.fn();

jest.mock('../bim3d-edit-live-preview-apply', () => ({
  sceneEntitiesForEdit: () => mockEntities,
}));
jest.mock('../bim3d-edit-command-builders', () => ({
  resolveMovePlanDeltaCanvas: () => mockPlanDelta,
}));
jest.mock('../../../bim/transforms/build-entity-clone-command', () => ({
  buildEntityCloneCommand: (...a: unknown[]) => mockBuild(...a),
}));
jest.mock('../../../core/commands', () => ({
  getGlobalCommandHistory: () => ({ execute: mockExecute }),
}));

import { commitCopyDrag } from '../bim3d-edit-copy-commit';

const MOVE: BridgeOutcome = { kind: 'move', deltaDxf: { x: 100, y: 0 }, deltaUpMm: 0 };
const ROTATE: BridgeOutcome = { kind: 'rotate', pivotDxf: { x: 0, y: 0 }, angleDeg: 15 };

function makeCtx(reselect: jest.Mock): EditInteractionCtx {
  return { reselect } as unknown as EditInteractionCtx;
}
function makeDeps(entityIds: string[]): CopyDragDeps {
  return { entityIds, entityId: entityIds[0], axisLock: null, sm: { tag: 'sm' } as never };
}

beforeEach(() => {
  mockEntities.length = 0;
  mockEntities.push({ id: 'a' }, { id: 'b' }, { id: 'c' });
  mockPlanDelta = { x: 100, y: 0 };
  mockBuild.mockReset();
  mockExecute.mockReset();
});

describe('commitCopyDrag (ADR-688 Φ3)', () => {
  it('clones the edited selection, executes and re-selects on a move outcome', () => {
    mockBuild.mockReturnValue({ command: { tag: 'paste' }, cloneIds: ['a2', 'b2'] });
    const reselect = jest.fn();
    const ok = commitCopyDrag(makeCtx(reselect), MOVE, makeDeps(['a', 'b']));
    expect(ok).toBe(true);
    // clone SSoT got the two edited sources + the resolved plan delta.
    expect(mockBuild).toHaveBeenCalledTimes(1);
    const [sources, delta] = mockBuild.mock.calls[0];
    expect((sources as Array<{ id: string }>).map((e) => e.id)).toEqual(['a', 'b']);
    expect(delta).toEqual({ x: 100, y: 0 });
    expect(mockExecute).toHaveBeenCalledWith({ tag: 'paste' });
    expect(reselect).toHaveBeenCalledWith(['a2', 'b2']);
  });

  it('returns false for a non-move outcome (rotate copy is out of scope)', () => {
    const reselect = jest.fn();
    expect(commitCopyDrag(makeCtx(reselect), ROTATE, makeDeps(['a']))).toBe(false);
    expect(mockBuild).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
    expect(reselect).not.toHaveBeenCalled();
  });

  it('returns false on a zero plan delta (pure-vertical drag → caller falls through to move)', () => {
    mockPlanDelta = { x: 0, y: 0 };
    const reselect = jest.fn();
    expect(commitCopyDrag(makeCtx(reselect), MOVE, makeDeps(['a']))).toBe(false);
    expect(mockBuild).not.toHaveBeenCalled();
  });

  it('returns false when no edited id matches the scene (nothing clonable)', () => {
    const reselect = jest.fn();
    expect(commitCopyDrag(makeCtx(reselect), MOVE, makeDeps(['missing']))).toBe(false);
    expect(mockBuild).not.toHaveBeenCalled();
  });

  it('returns false when the clone SSoT produces nothing (null result)', () => {
    mockBuild.mockReturnValue(null);
    const reselect = jest.fn();
    expect(commitCopyDrag(makeCtx(reselect), MOVE, makeDeps(['a']))).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
    expect(reselect).not.toHaveBeenCalled();
  });
});
