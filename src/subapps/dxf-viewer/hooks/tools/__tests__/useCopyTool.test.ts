/**
 * Tests for useCopyTool — ADR-363 R1 / ADR-577 (unified interactive COPY)
 *
 * The tool now copies ANY resolvable entity (DXF + BIM + group) through the
 * shared clone SSoT `buildEntityCloneCommand`, so these tests assert the FSM +
 * that the unified clone builder receives the whole selection and the right delta.
 */
import { renderHook, act } from '@testing-library/react';
import { useCopyTool } from '../useCopyTool';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../systems/entity-creation/LevelSceneManagerAdapter', () => {
  // ADR-527: production constructs via the cached factory (not `new`); reuse the SSoT
  // mock-scene-manager helper instead of re-declaring an inline adapter stub.
  const { createMockSceneManager } = require('../../../core/commands/__tests__/mock-scene-manager');
  const makeAdapter = () => createMockSceneManager();
  return {
    LevelSceneManagerAdapter: jest.fn().mockImplementation(makeAdapter),
    createLevelSceneManagerAdapter: jest.fn(makeAdapter),
    levelSceneManagerFor: jest.fn(makeAdapter),
  };
});

jest.mock('../../../bim/transforms/build-entity-clone-command', () => ({
  buildEntityCloneCommand: jest.fn().mockReturnValue({
    command: {
      execute: jest.fn(),
      undo: jest.fn(),
      getDescription: jest.fn().mockReturnValue('Paste entities'),
      id: 'test-cmd-id',
    },
    cloneIds: ['clone_1'],
  }),
}));

jest.mock('../../toolHintOverrideStore', () => ({
  toolHintOverrideStore: { setOverride: jest.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const WALL_ENTITY = { id: 'wall_1', type: 'wall', params: {}, geometry: {} };
const LINE_ENTITY = { id: 'line_1', type: 'line' };
const GROUP_ENTITY = { id: 'group_1', type: 'group', members: [] };

function makeLevel(entities: Array<{ id: string; type: string }> = [WALL_ENTITY]) {
  return {
    currentLevelId: 'level_1',
    getLevelScene: jest.fn().mockReturnValue({ entities }),
    setLevelScene: jest.fn(),
  };
}

function defaultProps(overrides: Partial<Parameters<typeof useCopyTool>[0]> = {}) {
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

describe('useCopyTool', () => {
  describe('activation', () => {
    it('is idle when activeTool !== copy', () => {
      const { result } = renderHook(() => useCopyTool(defaultProps()));
      expect(result.current.isActive).toBe(false);
      expect(result.current.phase).toBe('idle');
    });

    it('transitions to awaiting-base-point when a BIM entity is selected', () => {
      const props = defaultProps({ activeTool: 'copy', selectedEntityIds: ['wall_1'] });
      const { result } = renderHook(() => useCopyTool(props));
      expect(result.current.isActive).toBe(true);
      expect(result.current.phase).toBe('awaiting-base-point');
    });

    it('ACCEPTS a plain DXF entity (unified copy — no longer BIM-only)', () => {
      const onToolChange = jest.fn();
      const props = defaultProps({
        activeTool: 'copy',
        selectedEntityIds: ['line_1'],
        levelManager: makeLevel([LINE_ENTITY]),
        onToolChange,
      });
      const { result } = renderHook(() => useCopyTool(props));
      expect(result.current.phase).toBe('awaiting-base-point');
      expect(onToolChange).not.toHaveBeenCalledWith('select');
    });

    it('reverts to select when nothing in the selection resolves to an entity', () => {
      const onToolChange = jest.fn();
      const props = defaultProps({
        activeTool: 'copy',
        selectedEntityIds: ['ghost_1'],
        levelManager: makeLevel([WALL_ENTITY]),
        onToolChange,
      });
      renderHook(() => useCopyTool(props));
      expect(onToolChange).toHaveBeenCalledWith('select');
    });

    it('reverts to select when the selection is empty', () => {
      const onToolChange = jest.fn();
      const props = defaultProps({ activeTool: 'copy', selectedEntityIds: [], onToolChange });
      renderHook(() => useCopyTool(props));
      expect(onToolChange).toHaveBeenCalledWith('select');
    });
  });

  describe('click FSM', () => {
    it('sets base point on first click → transitions to awaiting-target-point', () => {
      const props = defaultProps({ activeTool: 'copy', selectedEntityIds: ['wall_1'] });
      const { result } = renderHook(() => useCopyTool(props));
      act(() => { result.current.handleCopyClick({ x: 10, y: 20 }); });
      expect(result.current.phase).toBe('awaiting-target-point');
    });

    it('clones through buildEntityCloneCommand on second click with correct delta', () => {
      const executeCommand = jest.fn();
      const { buildEntityCloneCommand } = jest.requireMock('../../../bim/transforms/build-entity-clone-command');
      buildEntityCloneCommand.mockClear();
      const props = defaultProps({
        activeTool: 'copy',
        selectedEntityIds: ['wall_1'],
        executeCommand,
      });
      const { result } = renderHook(() => useCopyTool(props));

      act(() => { result.current.handleCopyClick({ x: 10, y: 20 }); }); // base
      act(() => { result.current.handleCopyClick({ x: 30, y: 50 }); }); // target

      expect(buildEntityCloneCommand).toHaveBeenCalledWith(
        expect.any(Array),
        { x: 20, y: 30 },
        expect.anything(),
      );
      expect(executeCommand).toHaveBeenCalledTimes(1);
    });

    it('stays in awaiting-target-point after execute (continuous mode)', () => {
      const props = defaultProps({ activeTool: 'copy', selectedEntityIds: ['wall_1'] });
      const { result } = renderHook(() => useCopyTool(props));
      act(() => { result.current.handleCopyClick({ x: 0, y: 0 }); });
      act(() => { result.current.handleCopyClick({ x: 5, y: 5 }); });
      expect(result.current.phase).toBe('awaiting-target-point');
    });

    it('ignores clicks when not active', () => {
      const executeCommand = jest.fn();
      const props = defaultProps({ executeCommand });
      const { result } = renderHook(() => useCopyTool(props));
      act(() => { result.current.handleCopyClick({ x: 0, y: 0 }); });
      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('escape', () => {
    it('resets to idle and calls onToolChange(select)', () => {
      const onToolChange = jest.fn();
      const props = defaultProps({
        activeTool: 'copy',
        selectedEntityIds: ['wall_1'],
        onToolChange,
      });
      const { result } = renderHook(() => useCopyTool(props));
      act(() => { result.current.handleCopyClick({ x: 5, y: 5 }); }); // base
      act(() => { result.current.handleCopyEscape(); });
      expect(result.current.phase).toBe('idle');
      expect(onToolChange).toHaveBeenCalledWith('select');
    });
  });

  describe('unified entity support', () => {
    it.each([
      ['wall'], ['opening'], ['slab'], ['column'], ['beam'], ['stair'],
      ['line'], ['polyline'], ['circle'], ['rect'], ['text'], ['group'],
    ])('accepts a %s entity as copyable', (type) => {
      const onToolChange = jest.fn();
      const entity = { id: `${type}_1`, type };
      const props = defaultProps({
        activeTool: 'copy',
        selectedEntityIds: [`${type}_1`],
        levelManager: makeLevel([entity]),
        onToolChange,
      });
      renderHook(() => useCopyTool(props));
      expect(onToolChange).not.toHaveBeenCalledWith('select');
    });

    it('keeps a mixed BIM + DXF + group selection (no silent filtering)', () => {
      const onToolChange = jest.fn();
      const props = defaultProps({
        activeTool: 'copy',
        selectedEntityIds: ['wall_1', 'line_1', 'group_1'],
        levelManager: makeLevel([WALL_ENTITY, LINE_ENTITY, GROUP_ENTITY]),
        onToolChange,
      });
      const { result } = renderHook(() => useCopyTool(props));
      expect(result.current.phase).toBe('awaiting-base-point');
      expect(onToolChange).not.toHaveBeenCalledWith('select');
    });
  });
});
