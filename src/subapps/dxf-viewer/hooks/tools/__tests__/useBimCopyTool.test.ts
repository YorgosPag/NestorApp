/**
 * Tests for useBimCopyTool — ADR-363 R1
 */
import { renderHook, act } from '@testing-library/react';
import { useBimCopyTool } from '../useBimCopyTool';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  LevelSceneManagerAdapter: jest.fn().mockImplementation(() => ({
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    getEntity: jest.fn().mockReturnValue(null),
    getEntities: jest.fn().mockReturnValue([]),
    updateEntity: jest.fn(),
  })),
}));

jest.mock('../../../core/commands/entity-commands/BimCopyCommand', () => ({
  BimCopyCommand: jest.fn().mockImplementation(() => ({
    execute: jest.fn(),
    undo: jest.fn(),
    redo: jest.fn(),
    getDescription: jest.fn().mockReturnValue('Copy BIM entities'),
    getAffectedEntityIds: jest.fn().mockReturnValue([]),
    validate: jest.fn().mockReturnValue(null),
    serialize: jest.fn().mockReturnValue({}),
    id: 'test-cmd-id',
    name: 'BimCopyEntities',
    type: 'bim-copy-entities',
    timestamp: Date.now(),
  })),
}));

jest.mock('../toolHintOverrideStore', () => ({
  toolHintOverrideStore: { setOverride: jest.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const WALL_ENTITY = { id: 'wall_1', type: 'wall', params: {}, geometry: {} };
const NON_BIM_ENTITY = { id: 'line_1', type: 'line' };

function makeLevel(entities: Array<{ id: string; type: string }> = [WALL_ENTITY]) {
  return {
    currentLevelId: 'level_1',
    getLevelScene: jest.fn().mockReturnValue({ entities }),
    setLevelScene: jest.fn(),
  };
}

function defaultProps(overrides: Partial<Parameters<typeof useBimCopyTool>[0]> = {}) {
  return {
    activeTool: 'select',
    selectedEntityIds: [],
    levelManager: makeLevel(),
    executeCommand: jest.fn(),
    onToolChange: jest.fn(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useBimCopyTool', () => {
  describe('activation', () => {
    it('is idle when activeTool !== bim-copy', () => {
      const { result } = renderHook(() => useBimCopyTool(defaultProps()));
      expect(result.current.isActive).toBe(false);
      expect(result.current.phase).toBe('idle');
    });

    it('transitions to awaiting-base-point when BIM entity selected', () => {
      const props = defaultProps({
        activeTool: 'bim-copy',
        selectedEntityIds: ['wall_1'],
      });
      const { result } = renderHook(() => useBimCopyTool(props));
      expect(result.current.isActive).toBe(true);
      expect(result.current.phase).toBe('awaiting-base-point');
    });

    it('reverts to select when no BIM entities in selection', () => {
      const onToolChange = jest.fn();
      const props = defaultProps({
        activeTool: 'bim-copy',
        selectedEntityIds: ['line_1'],
        levelManager: makeLevel([NON_BIM_ENTITY]),
        onToolChange,
      });
      renderHook(() => useBimCopyTool(props));
      expect(onToolChange).toHaveBeenCalledWith('select');
    });

    it('reverts to select when selection is empty', () => {
      const onToolChange = jest.fn();
      const props = defaultProps({
        activeTool: 'bim-copy',
        selectedEntityIds: [],
        onToolChange,
      });
      renderHook(() => useBimCopyTool(props));
      expect(onToolChange).toHaveBeenCalledWith('select');
    });
  });

  describe('click FSM', () => {
    it('sets base point on first click → transitions to awaiting-target-point', () => {
      const props = defaultProps({
        activeTool: 'bim-copy',
        selectedEntityIds: ['wall_1'],
      });
      const { result } = renderHook(() => useBimCopyTool(props));
      act(() => {
        result.current.handleBimCopyClick({ x: 10, y: 20 });
      });
      expect(result.current.phase).toBe('awaiting-target-point');
    });

    it('executes BimCopyCommand on second click with correct delta', () => {
      const executeCommand = jest.fn();
      const { BimCopyCommand } = jest.requireMock('../../../core/commands/entity-commands/BimCopyCommand');
      const props = defaultProps({
        activeTool: 'bim-copy',
        selectedEntityIds: ['wall_1'],
        executeCommand,
      });
      const { result } = renderHook(() => useBimCopyTool(props));

      act(() => { result.current.handleBimCopyClick({ x: 10, y: 20 }); }); // base
      act(() => { result.current.handleBimCopyClick({ x: 30, y: 50 }); }); // target

      expect(BimCopyCommand).toHaveBeenCalledWith(
        ['wall_1'],
        { kind: 'translate', delta: { x: 20, y: 30 } },
        expect.anything(),
      );
      expect(executeCommand).toHaveBeenCalledTimes(1);
    });

    it('stays in awaiting-target-point after execute (continuous mode)', () => {
      const props = defaultProps({
        activeTool: 'bim-copy',
        selectedEntityIds: ['wall_1'],
      });
      const { result } = renderHook(() => useBimCopyTool(props));
      act(() => { result.current.handleBimCopyClick({ x: 0, y: 0 }); });
      act(() => { result.current.handleBimCopyClick({ x: 5, y: 5 }); });
      expect(result.current.phase).toBe('awaiting-target-point');
    });

    it('ignores clicks when not active', () => {
      const executeCommand = jest.fn();
      const props = defaultProps({ executeCommand });
      const { result } = renderHook(() => useBimCopyTool(props));
      act(() => { result.current.handleBimCopyClick({ x: 0, y: 0 }); });
      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('escape', () => {
    it('resets to idle and calls onToolChange(select)', () => {
      const onToolChange = jest.fn();
      const props = defaultProps({
        activeTool: 'bim-copy',
        selectedEntityIds: ['wall_1'],
        onToolChange,
      });
      const { result } = renderHook(() => useBimCopyTool(props));
      act(() => { result.current.handleBimCopyClick({ x: 5, y: 5 }); }); // base
      act(() => { result.current.handleBimCopyEscape(); });
      expect(result.current.phase).toBe('idle');
      expect(onToolChange).toHaveBeenCalledWith('select');
    });
  });

  describe('BIM type filter', () => {
    it.each([
      ['wall'],
      ['opening'],
      ['slab'],
      ['slab-opening'],
      ['column'],
      ['beam'],
      ['stair'],
    ])('accepts %s entity as BIM-copyable', (type) => {
      const onToolChange = jest.fn();
      const entity = { id: `${type}_1`, type };
      const props = defaultProps({
        activeTool: 'bim-copy',
        selectedEntityIds: [`${type}_1`],
        levelManager: makeLevel([entity]),
        onToolChange,
      });
      renderHook(() => useBimCopyTool(props));
      expect(onToolChange).not.toHaveBeenCalledWith('select');
    });

    it('filters out non-BIM entities, uses only BIM ones', () => {
      const { BimCopyCommand } = jest.requireMock('../../../core/commands/entity-commands/BimCopyCommand');
      BimCopyCommand.mockClear();
      const executeCommand = jest.fn();
      const entities = [
        WALL_ENTITY,
        NON_BIM_ENTITY,
      ];
      const props = defaultProps({
        activeTool: 'bim-copy',
        selectedEntityIds: ['wall_1', 'line_1'],
        levelManager: makeLevel(entities),
        executeCommand,
      });
      const { result } = renderHook(() => useBimCopyTool(props));
      act(() => { result.current.handleBimCopyClick({ x: 0, y: 0 }); });
      act(() => { result.current.handleBimCopyClick({ x: 10, y: 10 }); });
      expect(BimCopyCommand).toHaveBeenCalledWith(
        ['wall_1'],  // only wall, not line_1
        expect.anything(),
        expect.anything(),
      );
    });
  });
});
