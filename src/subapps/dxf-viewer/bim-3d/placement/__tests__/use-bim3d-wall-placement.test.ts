/**
 * ADR-543 — useBim3DWallPlacement orchestration tests.
 *
 * Verifies the activation gate (wall tool + 3D), the floor-raycast → EventBus
 * bridge on click, the OSNAP raw/snapped point selection, the orbit-drag guard,
 * and teardown on tool change. Mirror of `use-bim3d-column-placement.test.ts`.
 * All peripheral modules are mocked; the focus is the hook's wiring.
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
jest.mock('../../stores/Selection3DStore', () => ({
  useSelection3DStore: { getState: () => ({ clearSelection: jest.fn() }) },
}));
jest.mock('../../../ui/ribbon/hooks/bridge/wall-tool-bridge-store', () => ({
  // ADR-543 COL-traces-3D: the bridge also exposes the ambient member set (empty here, so
  // tracking resolves to null and the emitted point stays the OSNAP/raw point under test).
  wallToolBridgeStore: { get: () => ({ getSceneUnits: () => 'm', getSceneEntities: () => [] }) },
}));
jest.mock('../../../systems/events/EventBus', () => ({
  EventBus: { emit: (...a: unknown[]) => mockEmit(...a) },
}));
jest.mock('../WallPlacementGhost', () => ({
  WallPlacementGhost: class {
    update(): void {}
    setVisible(): void {}
    dispose(): void {}
  },
}));
// ADR-544/542 — the cube marker is gone; the hook publishes the OSNAP view to Snap3DOverlayStore.
const mockSetSnap = jest.fn();
jest.mock('../../stores/Snap3DOverlayStore', () => ({
  useSnap3DOverlayStore: { getState: () => ({ setSnap: mockSetSnap }) },
}));
jest.mock('../raycast-floor-point', () => ({
  raycastFloorPoint: jest.fn(() => ({ x: 1, y: 2, z: 3 })),
  resolveActiveFloorElevationMm: jest.fn(() => 0),
}));
jest.mock('../world-to-scene-point', () => ({
  worldToPlanMm: jest.fn(() => ({ x: 1, y: 2 })),
  // Identity so the emitted point reveals whether the raw or snapped mm flowed.
  planMmToScenePoint: jest.fn((mm: { x: number; y: number }) => mm),
}));
// OSNAP off by default → raw point flows through (free-placement path under test).
jest.mock('../placement-snap', () => ({
  resolvePlacementSnapWithView: jest.fn(() => null),
}));
import { resolvePlacementSnapWithView } from '../placement-snap';
const mockResolvePlacementSnap = resolvePlacementSnapWithView as jest.MockedFunction<typeof resolvePlacementSnapWithView>;
jest.mock('../../viewport/coordinate-transforms', () => ({
  // ADR-543 COL-traces-3D: camera-derived scene-units-per-pixel for the ambient screen scale.
  getPixelWorldSize: jest.fn(() => 0.01),
  cameraSceneUnitsPerPixel: jest.fn(() => 0.01),
}));
jest.mock('../placement-cursor', () => ({
  acquirePlacementCursor: jest.fn(),
  releasePlacementCursor: jest.fn(),
}));

import { useBim3DWallPlacement } from '../use-bim3d-wall-placement';

function makeParams(canvas: HTMLCanvasElement) {
  // Camera exposes the `position.distanceTo` the ambient tracking screen-scale needs.
  const camera = { position: { distanceTo: () => 10 } };
  const manager = { scene: {}, getCamera: () => camera, markSceneDirty: jest.fn() };
  return {
    managerRef: { current: manager } as unknown as MutableRefObject<ThreeJsSceneManager | null>,
    canvasEl: canvas,
  };
}

function notifyTool(): void { act(() => { mockToolListeners.forEach((l) => l()); }); }

describe('useBim3DWallPlacement', () => {
  beforeEach(() => {
    mockState.activeTool = 'select';
    mockState.is3D = false;
    mockToolListeners.clear();
    mockViewListeners.clear();
    mockEmit.mockClear();
    mockSetSnap.mockClear();
    mockResolvePlacementSnap.mockReset();
    mockResolvePlacementSnap.mockReturnValue(null);
  });

  it('does NOT wire click listener when inactive', () => {
    const canvas = document.createElement('canvas');
    const spy = jest.spyOn(canvas, 'addEventListener');
    renderHook(() => useBim3DWallPlacement(makeParams(canvas)));
    expect(spy.mock.calls.some(([type]) => type === 'click')).toBe(false);
  });

  it('does NOT arm in 2D even when the wall tool is active', () => {
    const canvas = document.createElement('canvas');
    const spy = jest.spyOn(canvas, 'addEventListener');
    mockState.activeTool = 'wall';
    mockState.is3D = false;
    renderHook(() => useBim3DWallPlacement(makeParams(canvas)));
    expect(spy.mock.calls.some(([type]) => type === 'click')).toBe(false);
  });

  it('wires listeners when wall tool active in 3D', () => {
    const canvas = document.createElement('canvas');
    const spy = jest.spyOn(canvas, 'addEventListener');
    mockState.activeTool = 'wall';
    mockState.is3D = true;
    renderHook(() => useBim3DWallPlacement(makeParams(canvas)));
    const types = spy.mock.calls.map(([type]) => type);
    expect(types).toEqual(expect.arrayContaining(['pointermove', 'pointerdown', 'click']));
  });

  it('click emits bim:place-wall-3d with the raw point when OSNAP misses', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'wall';
    mockState.is3D = true;
    renderHook(() => useBim3DWallPlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    // snap → null, so the raw worldToPlanMm point ({x:1,y:2}) is emitted verbatim.
    expect(mockEmit).toHaveBeenCalledWith('bim:place-wall-3d', { point: { x: 1, y: 2 } });
  });

  it('click emits the SNAPPED point when OSNAP hits (WYSIWYG ghost == commit)', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'wall';
    mockState.is3D = true;
    mockResolvePlacementSnap.mockReturnValue({ snappedMm: { x: 42, y: -7 }, markerMm: { x: 42, y: -7 }, view: null });
    renderHook(() => useBim3DWallPlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    expect(mockEmit).toHaveBeenCalledWith('bim:place-wall-3d', { point: { x: 42, y: -7 } });
  });

  it('two clicks emit twice (the 2-click chain feeds the same FSM)', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'wall';
    mockState.is3D = true;
    renderHook(() => useBim3DWallPlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 6, clientY: 6 }));
    expect(mockEmit).toHaveBeenCalledTimes(2);
    expect(mockEmit).toHaveBeenNthCalledWith(2, 'bim:place-wall-3d', { point: { x: 1, y: 2 } });
  });

  it('orbit drag (moved > threshold) does NOT place a wall endpoint', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'wall';
    mockState.is3D = true;
    renderHook(() => useBim3DWallPlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0, button: 0 }));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100 }));
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('deactivating the tool tears down listeners (no more placement)', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'wall';
    mockState.is3D = true;
    renderHook(() => useBim3DWallPlacement(makeParams(canvas)));
    mockState.activeTool = 'select';
    notifyTool();
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
