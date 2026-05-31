/**
 * ADR-403 — useBim3DColumnPlacement orchestration tests.
 *
 * Verifies the activation gate (column tool + 3D), the floor-raycast → EventBus
 * bridge on click, the orbit-drag guard, and teardown on tool/view change. All
 * peripheral modules are mocked; the focus is the hook's wiring.
 */

import { act } from 'react';
import { renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';

const mockState = { activeTool: 'select' as string, is3D: false };
const mockToolListeners = new Set<() => void>();
const mockViewListeners = new Set<() => void>();
const mockEmit = jest.fn();

jest.mock('../../../stores/ToolStateStore', () => ({
  toolStateStore: {
    get: () => ({ activeTool: mockState.activeTool }),
    subscribe: (l: () => void) => { mockToolListeners.add(l); return () => mockToolListeners.delete(l); },
  },
}));
jest.mock('../../stores/ViewMode3DStore', () => ({
  selectIs3D: () => mockState.is3D,
  useViewMode3DStore: {
    getState: () => mockState,
    subscribe: (l: () => void) => { mockViewListeners.add(l); return () => mockViewListeners.delete(l); },
  },
}));
jest.mock('../../stores/Bim3DEntitiesStore', () => ({
  useBim3DEntitiesStore: { getState: () => ({ activeLevelId: 'L1' }) },
}));
jest.mock('../../../ui/ribbon/hooks/bridge/column-tool-bridge-store', () => ({
  columnToolBridgeStore: { get: () => ({ getSceneUnits: () => 'm' }) },
}));
jest.mock('../../../systems/events/EventBus', () => ({
  EventBus: { emit: (...a: unknown[]) => mockEmit(...a) },
}));
jest.mock('../ColumnPlacementGhost', () => ({
  ColumnPlacementGhost: class {
    update(): void {}
    setVisible(): void {}
    dispose(): void {}
  },
}));
jest.mock('../raycast-floor-point', () => ({
  raycastFloorPoint: jest.fn(() => ({ x: 1, y: 2, z: 3 })),
  resolveActiveFloorElevationMm: jest.fn(() => 0),
}));
jest.mock('../world-to-scene-point', () => ({
  worldToScenePoint: jest.fn(() => ({ x: 10, y: 20 })),
}));

import { useBim3DColumnPlacement } from '../use-bim3d-column-placement';

function makeParams(canvas: HTMLCanvasElement) {
  const manager = { scene: {}, getCamera: () => ({}), markSceneDirty: jest.fn() };
  return {
    managerRef: { current: manager } as unknown as MutableRefObject<ThreeJsSceneManager | null>,
    canvasEl: canvas,
  };
}

function notifyTool(): void { act(() => { mockToolListeners.forEach((l) => l()); }); }

describe('useBim3DColumnPlacement', () => {
  beforeEach(() => {
    mockState.activeTool = 'select';
    mockState.is3D = false;
    mockToolListeners.clear();
    mockViewListeners.clear();
    mockEmit.mockClear();
  });

  it('does NOT wire click listener when inactive', () => {
    const canvas = document.createElement('canvas');
    const spy = jest.spyOn(canvas, 'addEventListener');
    renderHook(() => useBim3DColumnPlacement(makeParams(canvas)));
    expect(spy.mock.calls.some(([type]) => type === 'click')).toBe(false);
  });

  it('wires listeners when column tool active in 3D', () => {
    const canvas = document.createElement('canvas');
    const spy = jest.spyOn(canvas, 'addEventListener');
    mockState.activeTool = 'column';
    mockState.is3D = true;
    renderHook(() => useBim3DColumnPlacement(makeParams(canvas)));
    const types = spy.mock.calls.map(([type]) => type);
    expect(types).toEqual(expect.arrayContaining(['pointermove', 'pointerdown', 'click']));
  });

  it('click emits bim:place-column-3d with the converted point', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'column';
    mockState.is3D = true;
    renderHook(() => useBim3DColumnPlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    expect(mockEmit).toHaveBeenCalledWith('bim:place-column-3d', { point: { x: 10, y: 20 } });
  });

  it('orbit drag (moved > threshold) does NOT place a column', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'column';
    mockState.is3D = true;
    renderHook(() => useBim3DColumnPlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0, button: 0 }));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100 }));
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('deactivating the tool tears down listeners (no more placement)', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'column';
    mockState.is3D = true;
    renderHook(() => useBim3DColumnPlacement(makeParams(canvas)));
    // Switch away from the column tool → apply() runs teardown via subscription.
    mockState.activeTool = 'select';
    notifyTool();
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
