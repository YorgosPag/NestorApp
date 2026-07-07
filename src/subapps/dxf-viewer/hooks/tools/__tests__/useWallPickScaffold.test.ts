/**
 * Characterization tests — `useWallPickScaffold` (item E SSoT).
 * Locks the two-wall dual-flow FSM extracted byte-for-byte out of `useWallMergeTool`
 * and `useWallGapOpeningTool`: Flow B (selection-first) + Flow A (command-first pick
 * loop) + escape, plus the injected `execute(a, b, ctx)` contract.
 */
import { renderHook, act } from '@testing-library/react';
import { useWallPickScaffold } from '../useWallPickScaffold';
import type { WallEntity } from '../../../bim/types/wall-types';

jest.mock('../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: jest.fn(() => ({ __sm: true })),
}));

const mockHover: { id: string | null } = { id: null };
jest.mock('../../../systems/hover/HoverStore', () => ({
  getHoveredEntity: () => mockHover.id,
}));

jest.mock('../../../systems/selection', () => ({
  SelectedEntitiesStore: { getSelectedEntityIds: () => [] as string[] },
}));

const w1 = { id: 'w1', type: 'wall' } as unknown as WallEntity;
const w2 = { id: 'w2', type: 'wall' } as unknown as WallEntity;

type Props = Parameters<typeof useWallPickScaffold>[0];

function props(overrides: Partial<Props> = {}): Props {
  return {
    activeTool: 'select',
    toolId: 'wall-merge',
    levelManager: {
      currentLevelId: 'l1',
      getLevelScene: () => ({ entities: [w1, w2] }),
      setLevelScene: jest.fn(),
    },
    selectedEntityIds: [],
    transformScale: 1,
    onToolChange: jest.fn(),
    selectEntities: jest.fn(),
    hints: { pickFirst: 'h.first', pickSecond: 'h.second' },
    execute: jest.fn(() => true),
    ...overrides,
  } as unknown as Props;
}

beforeEach(() => { mockHover.id = null; });

describe('useWallPickScaffold — dual-flow FSM (SSoT)', () => {
  it('Flow B: activation with 2 selected walls → execute(a,b) + exit to select', () => {
    const execute = jest.fn(() => true);
    const onToolChange = jest.fn();
    const base = { execute, onToolChange };
    const { rerender } = renderHook((p: Props) => useWallPickScaffold(p), { initialProps: props(base) });
    rerender(props({ ...base, activeTool: 'wall-merge', selectedEntityIds: ['w1', 'w2'] }));

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toBe(w1);
    expect(execute.mock.calls[0][1]).toBe(w2);
    expect(onToolChange).toHaveBeenCalledWith('select');
  });

  it('Flow B: 1 selected → arm wall A (highlight), execute NOT called', () => {
    const execute = jest.fn(() => true);
    const selectEntities = jest.fn();
    const base = { execute, selectEntities };
    const { rerender } = renderHook((p: Props) => useWallPickScaffold(p), { initialProps: props(base) });
    rerender(props({ ...base, activeTool: 'wall-merge', selectedEntityIds: ['w1'] }));

    expect(execute).not.toHaveBeenCalled();
    expect(selectEntities).toHaveBeenCalledWith(['w1']);
  });

  it('Flow B: 2 selected but execute() rejects → stays picking (no exit)', () => {
    const execute = jest.fn(() => false);
    const onToolChange = jest.fn();
    const base = { execute, onToolChange };
    const { rerender } = renderHook((p: Props) => useWallPickScaffold(p), { initialProps: props(base) });
    rerender(props({ ...base, activeTool: 'wall-merge', selectedEntityIds: ['w1', 'w2'] }));

    expect(execute).toHaveBeenCalledTimes(1);
    expect(onToolChange).not.toHaveBeenCalled();
  });

  it('Flow A: click wall1 → arm A; click wall2 → execute(A,B) + loop', () => {
    const execute = jest.fn(() => true);
    const selectEntities = jest.fn();
    const base = { execute, selectEntities };
    const { result, rerender } = renderHook((p: Props) => useWallPickScaffold(p), { initialProps: props(base) });
    rerender(props({ ...base, activeTool: 'wall-merge' }));

    mockHover.id = 'w1';
    act(() => result.current.handleClick({ x: 0, y: 0 }));
    expect(execute).not.toHaveBeenCalled();
    expect(selectEntities).toHaveBeenCalledWith(['w1']);

    mockHover.id = 'w2';
    act(() => result.current.handleClick({ x: 1, y: 1 }));
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toBe(w1);
    expect(execute.mock.calls[0][1]).toBe(w2);
  });

  it('execute receives a ctx with scene access + the level manager', () => {
    const execute = jest.fn(() => true);
    const lm = { currentLevelId: 'l1', getLevelScene: () => ({ entities: [w1, w2] }), setLevelScene: jest.fn() };
    const base = { execute, levelManager: lm as unknown as Props['levelManager'] };
    const { rerender } = renderHook((p: Props) => useWallPickScaffold(p), { initialProps: props(base) });
    rerender(props({ ...base, activeTool: 'wall-merge', selectedEntityIds: ['w1', 'w2'] }));

    const ctx = execute.mock.calls[0][2] as Parameters<Props['execute']>[2];
    expect(typeof ctx.getSceneManager).toBe('function');
    expect(ctx.getScene()).toEqual({ entities: [w1, w2] });
    expect(ctx.levelManager).toBe(lm);
    expect(typeof ctx.setHint).toBe('function');
  });

  it('escape → clears selection + exits to select', () => {
    const onToolChange = jest.fn();
    const selectEntities = jest.fn();
    const base = { onToolChange, selectEntities };
    const { result, rerender } = renderHook((p: Props) => useWallPickScaffold(p), { initialProps: props(base) });
    rerender(props({ ...base, activeTool: 'wall-merge' }));

    act(() => result.current.handleEscape());
    expect(selectEntities).toHaveBeenCalledWith([]);
    expect(onToolChange).toHaveBeenCalledWith('select');
  });
});
