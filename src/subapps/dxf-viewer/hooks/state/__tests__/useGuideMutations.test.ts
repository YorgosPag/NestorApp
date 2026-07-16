/**
 * ADR-040 (2026-07-16) — useGuideMutations SSoT extraction tests.
 *
 * Locks the shared mutation contract now consumed by BOTH `useGuideState()`
 * (reactive) and `useGuideActions()` (imperative, orchestrator-safe). Every
 * mutation must:
 *   - route through the injected `history.execute(cmd)` with the command it
 *     constructed (undo/redo stack correctness), and
 *   - emit the correct EventBus event + payload (rest-of-system sync).
 *
 * Store + CommandHistory are fully mocked — `useGuideMutations` only takes
 * type-only imports from `guide-store.ts` / `CommandHistory.ts`, so no real
 * store/history construction is needed here.
 *
 * NOTE (repo gotcha): do NOT `import { jest } from '@jest/globals'` — it
 * breaks `jest.mock` hoisting. Use the ambient `jest` global instead.
 */

import { renderHook, act } from '@testing-library/react';
import { useGuideMutations } from '../useGuideMutations';
import type { GuideStore } from '../../../systems/guides/guide-store';
import type { CommandHistory } from '../../../core/commands/CommandHistory';

// ── Mock every guide command as a generic, introspectable stub ─────────────
// isValid=true by default so the `if (cmd.isValid)` gated mutations
// (equalize/polar/scale/mirror/copy-pattern) always take the execute path
// unless a test overrides `mockCommandIsValid`.
let mockCommandIsValid = true;

jest.mock('../../../systems/guides/commands', () => {
  class MockGuideCommand {
    args: unknown[];
    isValid: boolean;
    spacing = 111;
    angleIncrement = 22;
    constructor(...args: unknown[]) {
      this.args = args;
      this.isValid = mockCommandIsValid;
    }
    getCreatedGuide() {
      return { id: 'created-guide-id', axis: 'X' };
    }
    getAffectedEntityIds() {
      return ['aff-1', 'aff-2'];
    }
  }
  return {
    CreateGuideCommand: MockGuideCommand,
    DeleteGuideCommand: MockGuideCommand,
    CreateParallelGuideCommand: MockGuideCommand,
    CreateDiagonalGuideCommand: MockGuideCommand,
    RotateGuideCommand: MockGuideCommand,
    RotateAllGuidesCommand: MockGuideCommand,
    RotateGuideGroupCommand: MockGuideCommand,
    EqualizeGuidesCommand: MockGuideCommand,
    PolarArrayGuidesCommand: MockGuideCommand,
    ScaleAllGuidesCommand: MockGuideCommand,
    MirrorGuidesCommand: MockGuideCommand,
    GuideFromEntityCommand: MockGuideCommand,
    BatchDeleteGuidesCommand: MockGuideCommand,
    CopyGuidePatternCommand: MockGuideCommand,
    GuideOffsetFromEntityCommand: MockGuideCommand,
    CreateGridFromPresetCommand: MockGuideCommand,
    BatchGuideFromEntitiesCommand: MockGuideCommand,
  };
});

jest.mock('../../../systems/events/EventBus', () => ({
  EventBus: { emit: jest.fn() },
}));

import { EventBus } from '../../../systems/events/EventBus';

const mockEmit = EventBus.emit as jest.Mock;

const GUIDES_FIXTURE = [
  { id: 'axis-1', axis: 'Y' },
  { id: 'axis-2', axis: 'X' },
];

function createMockStore() {
  return {
    getGuides: jest.fn(() => GUIDES_FIXTURE),
    isVisible: jest.fn(() => true),
    setVisible: jest.fn(),
    isSnapEnabled: jest.fn(() => false),
    setSnapEnabled: jest.fn(),
    clear: jest.fn(),
    removeTemporaryGuides: jest.fn(),
    count: 2,
  } as unknown as GuideStore & {
    getGuides: jest.Mock;
    isVisible: jest.Mock;
    setVisible: jest.Mock;
    isSnapEnabled: jest.Mock;
    setSnapEnabled: jest.Mock;
    clear: jest.Mock;
    removeTemporaryGuides: jest.Mock;
  };
}

function createMockHistory() {
  return { execute: jest.fn() } as unknown as CommandHistory & { execute: jest.Mock };
}

function setup() {
  const store = createMockStore();
  const history = createMockHistory();
  const { result } = renderHook(() => useGuideMutations(store, history));
  return { store, history, result };
}

beforeEach(() => {
  mockCommandIsValid = true;
  mockEmit.mockClear();
});

describe('useGuideMutations — unconditional command mutations', () => {
  it('addGuide executes CreateGuideCommand and emits grid:guide-added', () => {
    const { history, result } = setup();
    const cmd = result.current.addGuide('X', 100, 'A');
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:guide-added', {
      guide: { id: 'created-guide-id', axis: 'X' },
    });
  });

  it('removeGuide executes DeleteGuideCommand and emits grid:guide-removed', () => {
    const { history, result } = setup();
    const cmd = result.current.removeGuide('g1');
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:guide-removed', { guideId: 'g1' });
  });

  it('addParallelGuide executes CreateParallelGuideCommand and emits grid:guide-added', () => {
    const { history, result } = setup();
    const cmd = result.current.addParallelGuide('ref-1', 50);
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:guide-added', {
      guide: { id: 'created-guide-id', axis: 'X' },
    });
  });

  it('addDiagonalGuide executes CreateDiagonalGuideCommand and emits grid:guide-added', () => {
    const { history, result } = setup();
    const cmd = result.current.addDiagonalGuide({ x: 0, y: 0 }, { x: 10, y: 10 }, 'D');
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:guide-added', {
      guide: { id: 'created-guide-id', axis: 'X' },
    });
  });

  it('rotateGuide executes RotateGuideCommand and emits grid:guide-rotated', () => {
    const { history, result } = setup();
    const cmd = result.current.rotateGuide('g1', { x: 0, y: 0 }, 45);
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:guide-rotated', { guideId: 'g1', angleDeg: 45 });
  });

  it('rotateAllGuides executes RotateAllGuidesCommand and emits grid:all-guides-rotated', () => {
    const { history, result } = setup();
    const pivot = { x: 1, y: 2 };
    const cmd = result.current.rotateAllGuides(pivot, 90);
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:all-guides-rotated', { angleDeg: 90, pivot });
  });

  it('rotateGuideGroup executes RotateGuideGroupCommand and emits grid:guide-group-rotated', () => {
    const { history, result } = setup();
    const pivot = { x: 1, y: 2 };
    const cmd = result.current.rotateGuideGroup(['g1', 'g2'], pivot, 30);
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:guide-group-rotated', {
      guideIds: ['g1', 'g2'],
      angleDeg: 30,
      pivot,
    });
  });

  it('createGuideFromEntity executes GuideFromEntityCommand and emits grid:guide-from-entity', () => {
    const { history, result } = setup();
    const params = { entityType: 'CIRCLE', center: { x: 0, y: 0 } } as never;
    const cmd = result.current.createGuideFromEntity(params);
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:guide-from-entity', {
      entityType: 'CIRCLE',
      createdCount: 2,
    });
  });

  it('batchDeleteGuides executes BatchDeleteGuidesCommand and emits grid:guides-batch-deleted', () => {
    const { history, result } = setup();
    const cmd = result.current.batchDeleteGuides(['g1', 'g2']);
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:guides-batch-deleted', { count: 2 });
  });

  it('createGuideOffsetFromEntity executes GuideOffsetFromEntityCommand and emits grid:guide-offset-from-entity', () => {
    const { history, result } = setup();
    const params = { entityType: 'LINE', lineStart: { x: 0, y: 0 }, lineEnd: { x: 1, y: 1 } } as never;
    const cmd = result.current.createGuideOffsetFromEntity(params, 25);
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:guide-offset-from-entity', {
      entityType: 'LINE',
      offset: 25,
      createdCount: 2,
    });
  });

  it('createGridFromPreset executes CreateGridFromPresetCommand and emits grid:preset-applied', () => {
    const { history, result } = setup();
    const cmd = result.current.createGridFromPreset([0, 100], [0, 200, 400], null, null, 'MyGrid');
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:preset-applied', {
      presetId: 'MyGrid',
      xCount: 2,
      yCount: 3,
    });
  });

  it('createGuidesFromSelection executes BatchGuideFromEntitiesCommand and emits grid:guide-from-entity (BATCH)', () => {
    const { history, result } = setup();
    const cmd = result.current.createGuidesFromSelection([{ entityType: 'CIRCLE', center: { x: 0, y: 0 } } as never]);
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:guide-from-entity', {
      entityType: 'BATCH',
      createdCount: 2,
    });
  });
});

describe('useGuideMutations — isValid-gated command mutations', () => {
  it('equalizeGuides executes + emits grid:guides-equalized when cmd.isValid', () => {
    const { history, result } = setup();
    const cmd = result.current.equalizeGuides(['g1', 'g2']);
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:guides-equalized', { guideIds: ['g1', 'g2'], spacing: 111 });
  });

  it('equalizeGuides skips execute + emit when cmd.isValid is false', () => {
    mockCommandIsValid = false;
    const { history, result } = setup();
    result.current.equalizeGuides(['g1', 'g2']);
    expect(history.execute).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('createPolarArray executes + emits grid:polar-array-created when cmd.isValid', () => {
    const { history, result } = setup();
    const center = { x: 0, y: 0 };
    const cmd = result.current.createPolarArray(center, 4, 15);
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:polar-array-created', { center, count: 4, angleIncrement: 22 });
  });

  it('scaleAllGuides executes + emits grid:all-guides-scaled when cmd.isValid', () => {
    const { history, result } = setup();
    const origin = { x: 0, y: 0 };
    const cmd = result.current.scaleAllGuides(origin, 2);
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:all-guides-scaled', { origin, scaleFactor: 2 });
  });

  it('copyGuidePattern executes + emits grid:guide-pattern-copied when cmd.isValid', () => {
    const { history, result } = setup();
    const cmd = result.current.copyGuidePattern(['g1'], 50, 3);
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:guide-pattern-copied', {
      sourceCount: 1,
      repetitions: 3,
      offset: 50,
    });
  });

  it('mirrorGuides executes + emits grid:guides-mirrored with mirrorAxis="Y" for a Y-axis guide', () => {
    const { store, history, result } = setup();
    const cmd = result.current.mirrorGuides('axis-1');
    expect(store.getGuides).toHaveBeenCalled();
    expect(history.execute).toHaveBeenCalledWith(cmd);
    expect(mockEmit).toHaveBeenCalledWith('grid:guides-mirrored', {
      axisGuideId: 'axis-1',
      mirrorAxis: 'Y',
      createdCount: 2,
    });
  });

  it('mirrorGuides defaults mirrorAxis to "X" for a non-Y-axis guide', () => {
    const { result } = setup();
    result.current.mirrorGuides('axis-2');
    expect(mockEmit).toHaveBeenCalledWith('grid:guides-mirrored', {
      axisGuideId: 'axis-2',
      mirrorAxis: 'X',
      createdCount: 2,
    });
  });
});

describe('useGuideMutations — direct store mutations (no command)', () => {
  it('toggleVisibility flips store.isVisible() via setVisible', () => {
    const { store, result } = setup();
    result.current.toggleVisibility();
    expect(store.setVisible).toHaveBeenCalledWith(false);
  });

  it('toggleSnap flips store.isSnapEnabled() and emits grid:snap-toggled', () => {
    const { store, result } = setup();
    result.current.toggleSnap();
    expect(store.setSnapEnabled).toHaveBeenCalledWith(true);
    expect(mockEmit).toHaveBeenCalledWith('grid:snap-toggled', { enabled: true });
  });

  it('clearAll calls store.clear()', () => {
    const { store, result } = setup();
    result.current.clearAll();
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it('removeTemporaryGuides calls store.removeTemporaryGuides()', () => {
    const { store, result } = setup();
    result.current.removeTemporaryGuides();
    expect(store.removeTemporaryGuides).toHaveBeenCalledTimes(1);
  });
});

describe('useGuideMutations — local state + store accessor', () => {
  it('temporaryMode starts false and flips on toggleTemporaryMode', () => {
    const { result } = setup();
    expect(result.current.temporaryMode).toBe(false);
    act(() => {
      result.current.toggleTemporaryMode();
    });
    expect(result.current.temporaryMode).toBe(true);
  });

  it('getStore returns the injected store reference', () => {
    const { store, result } = setup();
    expect(result.current.getStore()).toBe(store);
  });
});
