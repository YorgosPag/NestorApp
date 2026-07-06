/**
 * Characterization tests — useRotationTool activation FSM (ADR-577 FSM SSoT).
 * Locks the activate/select/deactivate transitions after migrating Rotation to
 * the shared `useModifyToolActivation` hook (Rotation had no test before). The
 * previously-dead selection-lost branch now works (behavior alignment).
 */
import { renderHook } from '@testing-library/react';
import { useRotationTool } from '../useRotationTool';

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
