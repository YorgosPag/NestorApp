/**
 * Characterization tests — useMirrorTool activation FSM (ADR-577 FSM SSoT).
 * Locks the activate/select/deactivate transitions after migrating Mirror to the
 * shared `useModifyToolActivation` hook (Mirror had no test before).
 */
import { renderHook } from '@testing-library/react';
import { useMirrorTool } from '../useMirrorTool';

jest.mock('../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: jest.fn(() => ({ getEntity: jest.fn() })),
}));
jest.mock('../../../systems/grip/GripHandoffStore', () => ({
  GripHandoffStore: { consume: jest.fn(() => null) },
}));
// Avoid the firebase-auth import chain (useCadToggles → user-settings → firestore).
jest.mock('../../common/useCadToggles', () => ({ useCadToggles: () => ({ ortho: false }) }));

function defaultProps(overrides: Partial<Parameters<typeof useMirrorTool>[0]> = {}) {
  return {
    activeTool: 'select',
    selectedEntityIds: [] as string[],
    levelManager: { currentLevelId: 'l1', getLevelScene: jest.fn(() => ({ entities: [] })), setLevelScene: jest.fn() },
    executeCommand: jest.fn(),
    previewCanvasRef: { current: { clear: jest.fn() } },
    onToolChange: jest.fn(),
    ...overrides,
  } as unknown as Parameters<typeof useMirrorTool>[0];
}

describe('useMirrorTool — activation FSM (shared SSoT)', () => {
  it('activates with selection → awaiting-first-point + collecting', () => {
    const { result, rerender } = renderHook((p: Parameters<typeof useMirrorTool>[0]) => useMirrorTool(p), { initialProps: defaultProps() });
    rerender(defaultProps({ activeTool: 'mirror', selectedEntityIds: ['e1'] }));
    expect(result.current.phase).toBe('awaiting-first-point');
    expect(result.current.isCollectingInput).toBe(true);
  });

  it('activates without selection → awaiting-entity (clicks fall through)', () => {
    const { result, rerender } = renderHook((p: Parameters<typeof useMirrorTool>[0]) => useMirrorTool(p), { initialProps: defaultProps() });
    rerender(defaultProps({ activeTool: 'mirror', selectedEntityIds: [] }));
    expect(result.current.phase).toBe('awaiting-entity');
    expect(result.current.isCollectingInput).toBe(false);
  });

  it('advances awaiting-entity → awaiting-first-point when an entity is selected', () => {
    const { result, rerender } = renderHook((p: Parameters<typeof useMirrorTool>[0]) => useMirrorTool(p), {
      initialProps: defaultProps({ activeTool: 'mirror', selectedEntityIds: [] }),
    });
    rerender(defaultProps({ activeTool: 'mirror', selectedEntityIds: ['e1'] }));
    expect(result.current.phase).toBe('awaiting-first-point');
  });

  it('ALIGNMENT: deselecting mid-command falls back to awaiting-entity', () => {
    const { result, rerender } = renderHook((p: Parameters<typeof useMirrorTool>[0]) => useMirrorTool(p), {
      initialProps: defaultProps({ activeTool: 'mirror', selectedEntityIds: ['e1'] }),
    });
    expect(result.current.phase).toBe('awaiting-first-point');
    rerender(defaultProps({ activeTool: 'mirror', selectedEntityIds: [] }));
    expect(result.current.phase).toBe('awaiting-entity');
  });

  it('deactivates → idle', () => {
    const { result, rerender } = renderHook((p: Parameters<typeof useMirrorTool>[0]) => useMirrorTool(p), {
      initialProps: defaultProps({ activeTool: 'mirror', selectedEntityIds: ['e1'] }),
    });
    rerender(defaultProps({ activeTool: 'select', selectedEntityIds: ['e1'] }));
    expect(result.current.phase).toBe('idle');
  });
});
