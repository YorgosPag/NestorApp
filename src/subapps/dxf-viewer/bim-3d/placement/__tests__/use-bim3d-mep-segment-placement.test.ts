/**
 * ADR-403 / ADR-408 Φ8 — useBim3DMepSegmentPlacement orchestration tests.
 *
 * Mirror of `use-bim3d-mep-fixture-placement.test.ts`, adapted for the 2-click
 * LINEAR segment tool. Verifies the activation gate (segment tool + 3D), the
 * work-plane raycast → EventBus bridge on click (each click carries its endpoint
 * elevation `z`: the centreline offset for a free point, or a snapped connector's
 * true z — Φ-B1 connector-mate / Revit per-click elevation), that the raycast plane
 * is the CENTRELINE work-plane (floor + centreline), the centreline override, and
 * the orbit-drag guard.
 */

import { renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';
import { DEFAULT_SEGMENT_CENTERLINE_ELEVATION_MM } from '../../../bim/types/mep-segment-types';

const mockState = { activeTool: 'select' as string, is3D: false };
const mockToolListeners = new Set<() => void>();
const mockViewListeners = new Set<() => void>();
const mockEmit = jest.fn();
const mockOverrides: { centerlineElevationMm?: number } = {};

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
jest.mock('../../../ui/ribbon/hooks/bridge/mep-segment-tool-bridge-store', () => ({
  mepSegmentToolBridgeStore: {
    get: () => ({
      getSceneUnits: () => 'm',
      overrides: mockOverrides,
      domain: 'pipe',
      phase: 'awaitingStart',
      startPoint: null,
      startElevationMm: null,
      isActive: true,
    }),
  },
}));
jest.mock('../../../systems/events/EventBus', () => ({
  EventBus: { emit: (...a: unknown[]) => mockEmit(...a) },
}));
jest.mock('../MepSegmentPlacementGhost', () => ({
  MepSegmentPlacementGhost: class {
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
const mockConnectorZ: { value: number | null } = { value: null };
jest.mock('../../../bim/mep-segments/mep-snap-connector-elevation', () => ({
  resolveSnapConnectorElevationMm: () => mockConnectorZ.value,
}));
jest.mock('../../viewport/coordinate-transforms', () => ({
  dxfPlanToWorld: jest.fn(() => ({ x: 0, y: 0, z: 0 })),
}));

import { raycastFloorPoint } from '../raycast-floor-point';
import { resolvePlacementSnap } from '../placement-snap';
import { DEFAULT_SEGMENT_CENTERLINE_ELEVATION_MM as DEFAULT_CL } from '../../../bim/types/mep-segment-types';
import { useBim3DMepSegmentPlacement } from '../use-bim3d-mep-segment-placement';

const mockRaycast = raycastFloorPoint as jest.MockedFunction<typeof raycastFloorPoint>;
const mockSnap = resolvePlacementSnap as jest.MockedFunction<typeof resolvePlacementSnap>;

function makeParams(canvas: HTMLCanvasElement) {
  const manager = { scene: {}, getCamera: () => ({}), markSceneDirty: jest.fn() };
  return {
    managerRef: { current: manager } as unknown as MutableRefObject<ThreeJsSceneManager | null>,
    canvasEl: canvas,
  };
}

describe('useBim3DMepSegmentPlacement', () => {
  beforeEach(() => {
    mockState.activeTool = 'select';
    mockState.is3D = false;
    mockToolListeners.clear();
    mockViewListeners.clear();
    mockEmit.mockClear();
    mockRaycast.mockClear();
    mockSnap.mockReset();
    mockSnap.mockReturnValue(null);
    mockConnectorZ.value = null;
    delete mockOverrides.centerlineElevationMm;
  });

  it('wires listeners when a segment tool is active in 3D', () => {
    const canvas = document.createElement('canvas');
    const spy = jest.spyOn(canvas, 'addEventListener');
    mockState.activeTool = 'mep-pipe';
    mockState.is3D = true;
    renderHook(() => useBim3DMepSegmentPlacement(makeParams(canvas)));
    const types = spy.mock.calls.map(([type]) => type);
    expect(types).toEqual(expect.arrayContaining(['pointermove', 'pointerdown', 'click']));
  });

  it('does NOT wire when the segment tool is active in 2D', () => {
    const canvas = document.createElement('canvas');
    const spy = jest.spyOn(canvas, 'addEventListener');
    mockState.activeTool = 'mep-pipe';
    mockState.is3D = false;
    renderHook(() => useBim3DMepSegmentPlacement(makeParams(canvas)));
    const types = spy.mock.calls.map(([type]) => type);
    expect(types).not.toEqual(expect.arrayContaining(['click']));
  });

  it('free-point click emits z = centreline default (OSNAP miss)', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'mep-pipe';
    mockState.is3D = true;
    renderHook(() => useBim3DMepSegmentPlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    expect(mockEmit).toHaveBeenCalledWith('bim:place-mep-segment-3d', { point: { x: 1, y: 2, z: DEFAULT_CL } });
  });

  it('free-point click emits z = the centreline override (Revit per-click elevation)', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'mep-pipe';
    mockState.is3D = true;
    mockOverrides.centerlineElevationMm = 250;
    renderHook(() => useBim3DMepSegmentPlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    expect(mockEmit).toHaveBeenCalledWith('bim:place-mep-segment-3d', { point: { x: 1, y: 2, z: 250 } });
  });

  it('connector snap emits z = the connector elevation (Φ-B1 connector-mate)', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'mep-pipe';
    mockState.is3D = true;
    mockOverrides.centerlineElevationMm = 250; // overridden by the connector z below
    mockSnap.mockReturnValue({
      snappedMm: { x: 1, y: 2 },
      markerMm: { x: 1, y: 2 },
      snapEntityId: 'host-1',
      snapType: 'bim_mep_connector' as never,
    });
    mockConnectorZ.value = 2800; // resolved by the (mocked) connector-elevation SSoT
    renderHook(() => useBim3DMepSegmentPlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    expect(mockEmit).toHaveBeenCalledWith('bim:place-mep-segment-3d', { point: { x: 1, y: 2, z: 2800 } });
  });

  it('raycasts the CENTRELINE work-plane (floor + default centreline)', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'mep-pipe';
    mockState.is3D = true;
    renderHook(() => useBim3DMepSegmentPlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    const lastCall = mockRaycast.mock.calls[mockRaycast.mock.calls.length - 1];
    expect(lastCall[4]).toBe(DEFAULT_SEGMENT_CENTERLINE_ELEVATION_MM);
  });

  it('honours a centreline elevation override for the work-plane', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'mep-drain-pipe';
    mockState.is3D = true;
    mockOverrides.centerlineElevationMm = 250;
    renderHook(() => useBim3DMepSegmentPlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    const lastCall = mockRaycast.mock.calls[mockRaycast.mock.calls.length - 1];
    expect(lastCall[4]).toBe(250);
  });

  it('ADR-408 Φ8 #2b — changing the elevation override between clicks authors a riser', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'mep-pipe';
    mockState.is3D = true;
    renderHook(() => useBim3DMepSegmentPlacement(makeParams(canvas)));
    // Click 1 at elevation 0 (base of the riser).
    mockOverrides.centerlineElevationMm = 0;
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    // Click 2 at elevation 3000 (top) — the user raised the draw-time field.
    mockOverrides.centerlineElevationMm = 3000;
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    expect(mockEmit).toHaveBeenNthCalledWith(1, 'bim:place-mep-segment-3d', { point: { x: 1, y: 2, z: 0 } });
    expect(mockEmit).toHaveBeenNthCalledWith(2, 'bim:place-mep-segment-3d', { point: { x: 1, y: 2, z: 3000 } });
  });

  it('orbit drag (moved > threshold) does NOT place a segment', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'mep-pipe';
    mockState.is3D = true;
    renderHook(() => useBim3DMepSegmentPlacement(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0, button: 0 }));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100 }));
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
