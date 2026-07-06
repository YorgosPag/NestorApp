/**
 * Characterization tests — useScaleTool activation FSM (ADR-577 FSM SSoT).
 * Scale is STORE-backed (`ScaleToolStore`), so transitions are asserted on the
 * store phase. Migrated to the shared `useModifyToolActivation` hook (Scale had
 * no test before). The previously-absent selection-lost branch now works.
 */
import { renderHook } from '@testing-library/react';
import { useScaleTool } from '../useScaleTool';
import { ScaleToolStore } from '../../../systems/scale/ScaleToolStore';

jest.mock('../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: jest.fn(() => ({ getEntity: jest.fn() })),
}));
jest.mock('../../../systems/grip/GripHandoffStore', () => ({
  GripHandoffStore: { consume: jest.fn(() => null) },
}));
jest.mock('../../common/useCadToggles', () => ({ useCadToggles: () => ({ ortho: false }) }));

function defaultProps(overrides: Partial<Parameters<typeof useScaleTool>[0]> = {}) {
  return {
    activeTool: 'select',
    selectedEntityIds: [] as string[],
    levelManager: { currentLevelId: 'l1', getLevelScene: jest.fn(() => ({ entities: [] })), setLevelScene: jest.fn() },
    executeCommand: jest.fn(),
    previewCanvasRef: { current: { clear: jest.fn() } },
    onToolChange: jest.fn(),
    ...overrides,
  } as unknown as Parameters<typeof useScaleTool>[0];
}

describe('useScaleTool — activation FSM (shared SSoT, store-backed)', () => {
  beforeEach(() => ScaleToolStore.reset());

  it('activates with selection → base_point phase', () => {
    const { rerender } = renderHook((p: Parameters<typeof useScaleTool>[0]) => useScaleTool(p), { initialProps: defaultProps() });
    rerender(defaultProps({ activeTool: 'scale', selectedEntityIds: ['e1'] }));
    expect(ScaleToolStore.getState().phase).toBe('base_point');
  });

  it('activates without selection → selecting phase', () => {
    const { rerender } = renderHook((p: Parameters<typeof useScaleTool>[0]) => useScaleTool(p), { initialProps: defaultProps() });
    rerender(defaultProps({ activeTool: 'scale', selectedEntityIds: [] }));
    expect(ScaleToolStore.getState().phase).toBe('selecting');
  });

  it('advances selecting → base_point when an entity is selected', () => {
    const { rerender } = renderHook((p: Parameters<typeof useScaleTool>[0]) => useScaleTool(p), {
      initialProps: defaultProps({ activeTool: 'scale', selectedEntityIds: [] }),
    });
    expect(ScaleToolStore.getState().phase).toBe('selecting');
    rerender(defaultProps({ activeTool: 'scale', selectedEntityIds: ['e1'] }));
    expect(ScaleToolStore.getState().phase).toBe('base_point');
  });

  it('ALIGNMENT (was absent): deselecting mid-command falls back to selecting', () => {
    const { rerender } = renderHook((p: Parameters<typeof useScaleTool>[0]) => useScaleTool(p), {
      initialProps: defaultProps({ activeTool: 'scale', selectedEntityIds: ['e1'] }),
    });
    expect(ScaleToolStore.getState().phase).toBe('base_point');
    rerender(defaultProps({ activeTool: 'scale', selectedEntityIds: [] }));
    expect(ScaleToolStore.getState().phase).toBe('selecting');
  });

  it('deactivates → store reset (phase → idle)', () => {
    const { rerender } = renderHook((p: Parameters<typeof useScaleTool>[0]) => useScaleTool(p), {
      initialProps: defaultProps({ activeTool: 'scale', selectedEntityIds: ['e1'] }),
    });
    expect(ScaleToolStore.getState().phase).toBe('base_point');
    rerender(defaultProps({ activeTool: 'select', selectedEntityIds: ['e1'] }));
    expect(ScaleToolStore.getState().phase).toBe('idle');
  });
});
