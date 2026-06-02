/**
 * ADR-406 — useBim3DMepFixturePlacement orchestration tests.
 *
 * Mirror of `use-bim3d-column-placement.test.ts`. Verifies the activation gate
 * (fixture tool + 3D), the work-plane raycast → EventBus bridge on click, the
 * orbit-drag guard, and — the regression guard for the «ghost far from cursor»
 * bug — that the raycast plane is the MOUNTING-ELEVATION work-plane (floor +
 * mountingElevationMm), NOT the floor. A ceiling luminaire must project onto the
 * ceiling so the ghost coincides with the cursor (Revit work-plane placement).
 */

import { act } from 'react';
import { renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';

const mockState = { activeTool: 'select' as string, is3D: false };
const mockToolListeners = new Set<() => void>();
const mockViewListeners = new Set<() => void>();
const mockEmit = jest.fn();
const mockOverrides: { mountingElevationMm?: number } = { mountingElevationMm: 2700 };

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
jest.mock('../../../ui/ribbon/hooks/bridge/mep-fixture-tool-bridge-store', () => ({
  mepFixtureToolBridgeStore: {
    get: () => ({ getSceneUnits: () => 'm', overrides: mockOverrides, shape: 'rectangular' }),
  },
}));
jest.mock('../../../systems/events/EventBus', () => ({
  EventBus: { emit: (...a: unknown[]) => mockEmit(...a) },
}));
jest.mock('../MepFixturePlacementGhost', () => ({
  MepFixturePlacementGhost: class {
    update(): void {}
    setVisible(): void {}
    dispose(): void {}
  },
}));
jest.mock('../PlacementSnapMarker', () => ({
  PlacementSnapMarker: class {
    show(): void {}
    hide(): void {}
    dispose(): void {}
  },
}));
jest.mock('../raycast-floor-point', () => ({
  raycastFloorPoint: jest.fn(() => ({ x: 1, y: 2, z: 3 })),
  resolveActiveFloorElevationMm: jest.fn(() => 0),
}));
jest.mock('../world-to-scene-point', () => ({
  worldToPlanMm: jest.fn(() => ({ x: 1, y: 2 })),
  planMmToScenePoint: jest.fn((mm: { x: number; y: number }) => mm),
}));
jest.mock('../placement-snap', () => ({
  resolvePlacementSnap: jest.fn(() => null),
}));
jest.mock('../../viewport/coordinate-transforms', () => ({
  dxfPlanToWorld: jest.fn(() => ({ x: 0, y: 0, z: 0 })),
}));

import { raycastFloorPoint } from '../raycast-floor-point';
import { useBim3DMepFixturePlacement } from '../use-bim3d-mep-fixture-placement';

const mockRaycast = raycastFloorPoint as jest.MockedFunction<typeof raycastFloorPoint>;

function makeParams(canvas: HTMLCanvasElement) {
  const manager = { scene: {}, getCamera: () => ({}), markSceneDirty: jest.fn() };
  return {
    managerRef: { current: manager } as unknown as MutableRefObject<ThreeJsSceneManager | null>,
    canvasEl: canvas,
  };
}

describe('useBim3DMepFixturePlacement', () => {
  beforeEach(() => {
    mockState.activeTool = 'select';
    mockState.is3D = false;
    mockToolListeners.clear();
    mockViewListeners.clear();
    mockEmit.mockClear();
    mockRaycast.mockClear();
    mockOverrides.mountingElevationMm = 2700;
  });

  it('wires listeners when fixture tool active in 3D', () => {
    const canvas = document.createElement('canvas');
    const spy = jest.spyOn(canvas, 'addEventListener');
    mockState.activeTool = 'mep-fixture';
    mockState.is3D = true;
    renderHook(() => useBim3DMepFixturePlacement(makeParams(canvas)));
    const types = spy.mock.calls.map(([type]) => type);
    expect(types).toEqual(expect.arrayContaining(['pointermove', 'pointerdown', 'click']));
  });

  it('click emits bim:place-mep-fixture-3d with the raw point when OSNAP misses', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'mep-fixture';
    mockState.is3D = true;
    renderHook(() => useBim3DMepFixturePlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    expect(mockEmit).toHaveBeenCalledWith('bim:place-mep-fixture-3d', { point: { x: 1, y: 2 } });
  });

  it('raycasts the MOUNTING-ELEVATION work-plane, not the floor (ghost == cursor)', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'mep-fixture';
    mockState.is3D = true;
    renderHook(() => useBim3DMepFixturePlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    // floor elevation 0 + mounting 2700 → plane at 2700mm (the ceiling work-plane).
    const lastCall = mockRaycast.mock.calls[mockRaycast.mock.calls.length - 1];
    expect(lastCall[4]).toBe(2700);
  });

  it('honours a custom mounting elevation override for the work-plane', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'mep-fixture';
    mockState.is3D = true;
    mockOverrides.mountingElevationMm = 3200;
    renderHook(() => useBim3DMepFixturePlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    const lastCall = mockRaycast.mock.calls[mockRaycast.mock.calls.length - 1];
    expect(lastCall[4]).toBe(3200);
  });

  it('orbit drag (moved > threshold) does NOT place a fixture', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'mep-fixture';
    mockState.is3D = true;
    renderHook(() => useBim3DMepFixturePlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0, button: 0 }));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100 }));
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
