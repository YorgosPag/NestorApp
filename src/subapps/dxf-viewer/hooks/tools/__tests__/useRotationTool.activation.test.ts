/**
 * Characterization tests — useRotationTool activation FSM (ADR-577 FSM SSoT).
 * Locks the activate/select/deactivate transitions after migrating Rotation to
 * the shared `useModifyToolActivation` hook (Rotation had no test before). The
 * previously-dead selection-lost branch now works (behavior alignment).
 */
import { renderHook, act } from '@testing-library/react';
import { useRotationTool } from '../useRotationTool';
import { cadToggleState } from '../../../systems/constraints/cad-toggle-state';

jest.mock('../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: jest.fn(() => ({ getEntity: jest.fn() })),
}));
jest.mock('../../../systems/grip/GripHandoffStore', () => ({
  GripHandoffStore: { consume: jest.fn(() => null) },
}));
jest.mock('../../common/useCadToggles', () => ({ useCadToggles: () => ({ ortho: false }) }));

function defaultProps(overrides: Partial<Parameters<typeof useRotationTool>[0]> = {}) {
  return {
    activeTool: 'select',
    selectedEntityIds: [] as string[],
    levelManager: { currentLevelId: 'l1', getLevelScene: jest.fn(() => ({ entities: [] })), setLevelScene: jest.fn() },
    executeCommand: jest.fn(),
    previewCanvasRef: { current: { clear: jest.fn() } },
    onToolChange: jest.fn(),
    currentOverlays: [],
    overlayUpdate: jest.fn(),
    ...overrides,
  } as unknown as Parameters<typeof useRotationTool>[0];
}

describe('useRotationTool — activation FSM (shared SSoT)', () => {
  it('activates with selection → awaiting-base-point + collecting', () => {
    const { result, rerender } = renderHook((p: Parameters<typeof useRotationTool>[0]) => useRotationTool(p), { initialProps: defaultProps() });
    rerender(defaultProps({ activeTool: 'rotate', selectedEntityIds: ['e1'] }));
    expect(result.current.phase).toBe('awaiting-base-point');
    expect(result.current.isCollectingInput).toBe(true);
  });

  it('activates without selection → awaiting-entity', () => {
    const { result, rerender } = renderHook((p: Parameters<typeof useRotationTool>[0]) => useRotationTool(p), { initialProps: defaultProps() });
    rerender(defaultProps({ activeTool: 'rotate', selectedEntityIds: [] }));
    expect(result.current.phase).toBe('awaiting-entity');
    expect(result.current.isCollectingInput).toBe(false);
  });

  it('advances awaiting-entity → awaiting-base-point when an entity is selected', () => {
    const { result, rerender } = renderHook((p: Parameters<typeof useRotationTool>[0]) => useRotationTool(p), {
      initialProps: defaultProps({ activeTool: 'rotate', selectedEntityIds: [] }),
    });
    rerender(defaultProps({ activeTool: 'rotate', selectedEntityIds: ['e1'] }));
    expect(result.current.phase).toBe('awaiting-base-point');
  });

  it('ALIGNMENT (was dead code): deselecting mid-command falls back to awaiting-entity', () => {
    const { result, rerender } = renderHook((p: Parameters<typeof useRotationTool>[0]) => useRotationTool(p), {
      initialProps: defaultProps({ activeTool: 'rotate', selectedEntityIds: ['e1'] }),
    });
    expect(result.current.phase).toBe('awaiting-base-point');
    rerender(defaultProps({ activeTool: 'rotate', selectedEntityIds: [] }));
    expect(result.current.phase).toBe('awaiting-entity');
  });

  it('deactivates → idle', () => {
    const { result, rerender } = renderHook((p: Parameters<typeof useRotationTool>[0]) => useRotationTool(p), {
      initialProps: defaultProps({ activeTool: 'rotate', selectedEntityIds: ['e1'] }),
    });
    rerender(defaultProps({ activeTool: 'select', selectedEntityIds: ['e1'] }));
    expect(result.current.phase).toBe('idle');
  });
});

describe('useRotationTool — ORTHO (F8) reference-direction lock', () => {
  afterEach(() => { cadToggleState.set(false, false); }); // reset the shared store

  it('locks the reference direction (orange line) to the H axis when ORTHO is ON', () => {
    const { result } = renderHook(() => useRotationTool(defaultProps({ activeTool: 'rotate', selectedEntityIds: ['e1'] })));
    expect(result.current.phase).toBe('awaiting-base-point');

    act(() => { result.current.handleRotationClick({ x: 0, y: 0 }); }); // pivot
    expect(result.current.phase).toBe('awaiting-reference');

    cadToggleState.set(true, false); // ORTHO ON
    // Diagonal reference pick {10,3}: |dx|=10 ≥ |dy|=3 → H-axis lock → {10,0}.
    act(() => { result.current.handleRotationClick({ x: 10, y: 3 }); });

    expect(result.current.phase).toBe('awaiting-angle');
    expect(result.current.referencePoint).toEqual({ x: 10, y: 0 });
  });

  it('leaves the reference direction RAW (diagonal) when ORTHO is OFF', () => {
    const { result } = renderHook(() => useRotationTool(defaultProps({ activeTool: 'rotate', selectedEntityIds: ['e1'] })));
    act(() => { result.current.handleRotationClick({ x: 0, y: 0 }); }); // pivot
    cadToggleState.set(false, false); // ORTHO OFF (explicit)
    act(() => { result.current.handleRotationClick({ x: 10, y: 3 }); });

    expect(result.current.referencePoint).toEqual({ x: 10, y: 3 });
  });
});
