/**
 * ADR-561 — dispatch tests for the plain-primitive move/rotation grips inside
 * `commitDxfGripDragModeAware`:
 *   - `arc-rotation`      → `commitArcGripDrag`.
 *   - `polyline-rotation` → `commitPolylineRotationGripDrag`.
 *   - `arc-move` / `circle-move` / `polyline-move` → NEITHER rotation handler (they
 *     are whole-entity translates that fall through to the move/stretch path).
 */

import { commitDxfGripDragModeAware } from '../grip-commit-adapters';
import type { DxfCommitDeps, UnifiedGripInfo } from '../unified-grip-types';
import { GripAltMoveStore } from '../../../systems/grip/GripAltMoveStore';
import { GripCopyModeStore } from '../../../systems/grip/GripCopyModeStore';

const commitArcGripDrag = jest.fn();
const commitPolylineRotationGripDrag = jest.fn();

// Mock the parametric-commits barrel: the two rotation handlers we assert on, plus
// the whole-entity move path (`commitDxfGripDragViaStretchCommand` lives in
// grip-commit-adapters itself, but the fall-through builds a StretchEntityCommand
// via the scene adapter, mocked below to a no-op).
jest.mock('../grip-parametric-commits', () => ({
  commitArcGripDrag: (...a: unknown[]) => commitArcGripDrag(...a),
  commitPolylineRotationGripDrag: (...a: unknown[]) => commitPolylineRotationGripDrag(...a),
}));

// Neutralise the stretch/move fall-through so a `*-move` grip does not touch real
// scene geometry — we only care that NO rotation handler fired.
jest.mock('../grip-scene-manager-adapter', () => ({ createSceneManagerAdapter: () => null }));

const DELTA = { x: 100, y: 50 };

function makeDeps(): DxfCommitDeps {
  return { moveEntities: jest.fn(), execute: jest.fn(), onToolChange: jest.fn() } as unknown as DxfCommitDeps;
}

function grip(over: Partial<UnifiedGripInfo>): UnifiedGripInfo {
  return { id: 'g', source: 'dxf', type: 'center', entityId: 'e1', position: { x: 0, y: 0 }, movesEntity: true, ...over } as unknown as UnifiedGripInfo;
}

describe('ADR-561 — primitive move/rotation dispatch', () => {
  afterEach(() => {
    commitArcGripDrag.mockClear();
    commitPolylineRotationGripDrag.mockClear();
    GripAltMoveStore.clear();
    GripCopyModeStore.clear();
  });

  it('arc-rotation → commitArcGripDrag', () => {
    commitDxfGripDragModeAware(grip({ type: 'vertex', gripKind: { on: 'arc', kind: 'arc-rotation' }, movesEntity: false }), DELTA, makeDeps(), 'stretch');
    expect(commitArcGripDrag).toHaveBeenCalledTimes(1);
    expect(commitPolylineRotationGripDrag).not.toHaveBeenCalled();
  });

  it('polyline-rotation → commitPolylineRotationGripDrag', () => {
    commitDxfGripDragModeAware(grip({ type: 'vertex', gripKind: { on: 'polyline', kind: 'polyline-rotation' }, movesEntity: false }), DELTA, makeDeps(), 'stretch');
    expect(commitPolylineRotationGripDrag).toHaveBeenCalledTimes(1);
    expect(commitArcGripDrag).not.toHaveBeenCalled();
  });

  it('arc-move → neither rotation handler (whole-entity translate falls through)', () => {
    commitDxfGripDragModeAware(grip({ gripKind: { on: 'arc', kind: 'arc-move' } }), DELTA, makeDeps(), 'stretch');
    expect(commitArcGripDrag).not.toHaveBeenCalled();
    expect(commitPolylineRotationGripDrag).not.toHaveBeenCalled();
  });

  it('circle-move → neither rotation handler', () => {
    commitDxfGripDragModeAware(grip({ gripKind: { on: 'circle', kind: 'circle-move' } }), DELTA, makeDeps(), 'stretch');
    expect(commitArcGripDrag).not.toHaveBeenCalled();
    expect(commitPolylineRotationGripDrag).not.toHaveBeenCalled();
  });

  it('polyline-move → neither rotation handler', () => {
    commitDxfGripDragModeAware(grip({ gripKind: { on: 'polyline', kind: 'polyline-move' } }), DELTA, makeDeps(), 'stretch');
    expect(commitArcGripDrag).not.toHaveBeenCalled();
    expect(commitPolylineRotationGripDrag).not.toHaveBeenCalled();
  });
});
