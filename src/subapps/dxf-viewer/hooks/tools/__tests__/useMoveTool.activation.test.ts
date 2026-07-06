/**
 * Characterization tests — useMoveTool activation FSM (ADR-577).
 *
 * Added when the shared `useModifyToolActivation` SSoT replaced Move's inline
 * activation effect, to lock the activate/select/deactivate transitions the
 * refactor must preserve (Move had no test before). Click execution is covered
 * elsewhere; these assert only the activation invariant + preview clearing.
 */
import { renderHook } from '@testing-library/react';
import { useMoveTool } from '../useMoveTool';

// ── Mocks (heavy collaborators — activation tests never reach them) ────────────
jest.mock('../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: jest.fn(() => ({ getEntity: jest.fn() })),
}));
jest.mock('../../../core/commands', () => ({
  MoveEntityCommand: jest.fn(), MoveMultipleEntitiesCommand: jest.fn(), CompoundCommand: jest.fn(),
}));
jest.mock('../../dimensions/dim-alignment-tracking', () => ({ resolveActionAlignmentTracking: jest.fn(() => null) }));
jest.mock('../../../systems/cursor/ImmediateTransformStore', () => ({ getImmediateTransform: jest.fn(() => ({ scale: 1 })) }));
jest.mock('../../../bim/grips/grip-move-constraints', () => ({ applyOrthoToDelta: jest.fn((d: unknown) => d) }));

function makeClear() { return jest.fn(); }

function defaultProps(overrides: Partial<Parameters<typeof useMoveTool>[0]> = {}) {
  return {
    activeTool: 'select',
    selectedEntityIds: [] as string[],
    selectedOverlayIds: [] as string[],
    levelManager: {
      currentLevelId: 'l1',
      getLevelScene: jest.fn(() => ({ entities: [] })),
      setLevelScene: jest.fn(),
    },
    executeCommand: jest.fn(),
    previewCanvasRef: { current: { clear: makeClear() } },
    onToolChange: jest.fn(),
    ...overrides,
  } as unknown as Parameters<typeof useMoveTool>[0];
}

describe('useMoveTool — activation FSM (shared SSoT)', () => {
  it('activates with a selection → awaiting-base-point + collecting + preview cleared', () => {
    const clear = makeClear();
    const p = defaultProps({ previewCanvasRef: { current: { clear } } as never });
    const { result, rerender } = renderHook((props: Parameters<typeof useMoveTool>[0]) => useMoveTool(props), { initialProps: p });
    rerender(defaultProps({ activeTool: 'move', selectedEntityIds: ['e1'], previewCanvasRef: { current: { clear } } as never }));
    expect(result.current.phase).toBe('awaiting-base-point');
    expect(result.current.isCollectingInput).toBe(true);
    expect(clear).toHaveBeenCalled();
  });

  it('activates WITHOUT a selection → awaiting-entity, not collecting (clicks fall through)', () => {
    const { result, rerender } = renderHook((props: Parameters<typeof useMoveTool>[0]) => useMoveTool(props), { initialProps: defaultProps() });
    rerender(defaultProps({ activeTool: 'move', selectedEntityIds: [] }));
    expect(result.current.phase).toBe('awaiting-entity');
    expect(result.current.isCollectingInput).toBe(false);
  });

  it('advances awaiting-entity → awaiting-base-point once an entity is selected', () => {
    const { result, rerender } = renderHook((props: Parameters<typeof useMoveTool>[0]) => useMoveTool(props), {
      initialProps: defaultProps({ activeTool: 'move', selectedEntityIds: [] }),
    });
    expect(result.current.phase).toBe('awaiting-entity');
    rerender(defaultProps({ activeTool: 'move', selectedEntityIds: ['e1'] }));
    expect(result.current.phase).toBe('awaiting-base-point');
  });

  it('counts overlays toward the selection (activate with only an overlay)', () => {
    const { result, rerender } = renderHook((props: Parameters<typeof useMoveTool>[0]) => useMoveTool(props), { initialProps: defaultProps() });
    rerender(defaultProps({ activeTool: 'move', selectedEntityIds: [], selectedOverlayIds: ['o1'] }));
    expect(result.current.phase).toBe('awaiting-base-point');
  });

  it('deactivates → idle', () => {
    const { result, rerender } = renderHook((props: Parameters<typeof useMoveTool>[0]) => useMoveTool(props), {
      initialProps: defaultProps({ activeTool: 'move', selectedEntityIds: ['e1'] }),
    });
    expect(result.current.phase).toBe('awaiting-base-point');
    rerender(defaultProps({ activeTool: 'select', selectedEntityIds: ['e1'] }));
    expect(result.current.phase).toBe('idle');
  });
});
