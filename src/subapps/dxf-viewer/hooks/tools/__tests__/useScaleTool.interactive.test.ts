/**
 * Interactive-click tests — useScaleTool (ADR-646 Phase 1).
 *   #1 direct drag: a click locks the live factor (was a silent no-op).
 *   #2 reference mode: a click supplies the "new length" (was typing-only).
 * The scene-manager adapter is mocked truthy so `executeScale` reaches `executeCommand`.
 */
import { renderHook, act } from '@testing-library/react';
import { useScaleTool } from '../useScaleTool';
import { ScaleToolStore } from '../../../systems/scale/ScaleToolStore';
import { ScaleEntityCommand } from '../../../core/commands/entity-commands/ScaleEntityCommand';

jest.mock('../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: jest.fn(() => ({ getEntity: jest.fn() })),
}));
jest.mock('../../../systems/grip/GripHandoffStore', () => ({
  GripHandoffStore: { consume: jest.fn(() => null) },
}));
jest.mock('../../common/useCadToggles', () => ({ useCadToggles: () => ({ ortho: false }) }));

function defaultProps(overrides: Partial<Parameters<typeof useScaleTool>[0]> = {}) {
  return {
    activeTool: 'scale',
    selectedEntityIds: ['e1'] as string[],
    levelManager: { currentLevelId: 'l1', getLevelScene: jest.fn(() => ({ entities: [] })), setLevelScene: jest.fn() },
    executeCommand: jest.fn(),
    previewCanvasRef: { current: { clear: jest.fn() } },
    onToolChange: jest.fn(),
    ...overrides,
  } as unknown as Parameters<typeof useScaleTool>[0];
}

function lastCommand(executeCommand: jest.Mock): ScaleEntityCommand {
  return executeCommand.mock.calls[executeCommand.mock.calls.length - 1][0];
}

describe('useScaleTool — interactive click (ADR-646 Phase 1)', () => {
  beforeEach(() => ScaleToolStore.reset());

  it('#1 direct click commits the live ratio (uniform factor from cursor distance)', () => {
    const props = defaultProps();
    const { result } = renderHook(() => useScaleTool(props));

    act(() => {
      ScaleToolStore.setSelectedEntityIds(['e1']);
      ScaleToolStore.setBasePoint({ x: 0, y: 0 });
      ScaleToolStore.setDragRefPoint({ x: 10, y: 0 }); // captured by the preview during the drag
      ScaleToolStore.setPhase('scale_input', 'direct');
    });

    act(() => result.current.handleScaleClick({ x: 20, y: 0 })); // dist 20 / ref 10 → ×2

    expect(props.executeCommand).toHaveBeenCalledTimes(1);
    expect(lastCommand(props.executeCommand as jest.Mock)).toBeInstanceOf(ScaleEntityCommand);
    // Command resets the FSM back to idle afterwards.
    expect(ScaleToolStore.getState().phase).toBe('idle');
  });

  it('#1 direct click without a captured reference is ignored (no stray no-op commit)', () => {
    const props = defaultProps();
    const { result } = renderHook(() => useScaleTool(props));

    act(() => {
      ScaleToolStore.setBasePoint({ x: 0, y: 0 });
      ScaleToolStore.setPhase('scale_input', 'direct'); // dragRefPoint still null
    });

    act(() => result.current.handleScaleClick({ x: 20, y: 0 }));

    expect(props.executeCommand).not.toHaveBeenCalled();
    expect(ScaleToolStore.getState().phase).toBe('scale_input');
  });

  it('#2 reference picks route p1 → p2 → new-length, then commit on the third click', () => {
    const props = defaultProps();
    const { result } = renderHook(() => useScaleTool(props));

    act(() => {
      ScaleToolStore.setSelectedEntityIds(['e1']);
      ScaleToolStore.setBasePoint({ x: 0, y: 0 });
      ScaleToolStore.setPhase('scale_input', 'ref_p1_x');
    });

    act(() => result.current.handleScaleClick({ x: 0, y: 0 }));  // refP1x
    expect(ScaleToolStore.getState().subPhase).toBe('ref_p2_x');

    act(() => result.current.handleScaleClick({ x: 0, y: 2 }));  // refP2x → refLen 2
    expect(ScaleToolStore.getState().subPhase).toBe('ref_new_x');

    act(() => result.current.handleScaleClick({ x: 0, y: 4 }));  // new length 4 → ×2
    expect(props.executeCommand).toHaveBeenCalledTimes(1);
    expect(ScaleToolStore.getState().phase).toBe('idle');
  });
});

describe('useScaleTool — parametric BIM skip-with-message (ADR-646 #3)', () => {
  beforeEach(() => ScaleToolStore.reset());

  function withScene(entities: Array<{ id: string; type: string }>, ids: string[]) {
    return defaultProps({
      selectedEntityIds: ids,
      levelManager: {
        currentLevelId: 'l1',
        getLevelScene: jest.fn(() => ({ entities, layersById: {} })),
        setLevelScene: jest.fn(),
      },
    } as Partial<Parameters<typeof useScaleTool>[0]>);
  }

  function armDirectDrag(ids: string[]) {
    ScaleToolStore.setSelectedEntityIds(ids);
    ScaleToolStore.setBasePoint({ x: 0, y: 0 });
    ScaleToolStore.setDragRefPoint({ x: 10, y: 0 });
    ScaleToolStore.setPhase('scale_input', 'direct');
  }

  it('scales the CAD entity but skips the parametric BIM one', () => {
    const props = withScene([{ id: 'ln', type: 'line' }, { id: 'wl', type: 'wall' }], ['ln', 'wl']);
    const { result } = renderHook(() => useScaleTool(props));
    act(() => armDirectDrag(['ln', 'wl']));
    act(() => result.current.handleScaleClick({ x: 20, y: 0 }));
    expect(props.executeCommand).toHaveBeenCalledTimes(1); // line committed, wall skipped
    expect(ScaleToolStore.getState().phase).toBe('idle');
  });

  it('aborts with NO commit when every selected entity is parametric BIM', () => {
    const props = withScene([{ id: 'wl', type: 'wall' }, { id: 'col', type: 'column' }], ['wl', 'col']);
    const { result } = renderHook(() => useScaleTool(props));
    act(() => armDirectDrag(['wl', 'col']));
    act(() => result.current.handleScaleClick({ x: 20, y: 0 }));
    expect(props.executeCommand).not.toHaveBeenCalled();
    expect(ScaleToolStore.getState().phase).toBe('idle'); // reset + return to select
  });
});
