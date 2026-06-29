/**
 * ADR-549 Phase 1 — useBim3DWireWaypointInteraction arming + spurious-dirty regression.
 *
 * Root cause of the 3D cursor «swim»: this hook was armed in the DEFAULT `select`
 * tool and called `markSceneDirty()` on EVERY pointermove (measured ×150 / 6s →
 * 42 full re-renders → ~60ms cursor lag), even when no MEP circuit was being
 * edited. These tests lock in the two fixes:
 *   1. ARM ONLY when a circuit is active (`activeSystemId !== null`).
 *   2. Idempotent redraw — never `markSceneDirty()` on a no-op hover.
 * The heavy THREE/store/command deps are mocked; the focus is the hook's wiring.
 */

import { act } from 'react';
import { renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';

const mockView = { is3D: false };
const mockTool = { activeTool: 'select' as string };
const mockCircuit = { activeSystemId: null as string | null };
const mockViewListeners = new Set<() => void>();
const mockToolListeners = new Set<() => void>();
const mockCircuitListeners = new Set<() => void>();
let mockSystems: { id: string; params: Record<string, unknown> }[] = [];
let mockFixtures: unknown[] = [];
let mockPanels: unknown[] = [];

jest.mock('three', () => ({
  Raycaster: class { setFromCamera(): void {} intersectObjects(): unknown[] { return []; } ray = { intersectPlane: () => null }; },
  Vector3: class { constructor(public x = 0, public y = 0, public z = 0) {} clone(): unknown { return this; } },
  Plane: class {},
}));
jest.mock('../../systems/raycaster/BimEntityRaycaster', () => ({ clientToNdc: () => ({ x: 0, y: 0 }) }));
jest.mock('../../../stores/ToolStateStore', () => ({
  toolStateStore: {
    get: () => mockTool,
    subscribe: (l: () => void) => { mockToolListeners.add(l); return () => mockToolListeners.delete(l); },
  },
}));
jest.mock('../../stores/ViewMode3DStore', () => ({
  selectIs3D: () => mockView.is3D,
  useViewMode3DStore: {
    getState: () => mockView,
    subscribe: (l: () => void) => { mockViewListeners.add(l); return () => mockViewListeners.delete(l); },
  },
}));
jest.mock('../../stores/Bim3DEntitiesStore', () => ({
  useBim3DEntitiesStore: { getState: () => ({ fixtures: mockFixtures, panels: mockPanels }) },
}));
jest.mock('../../../bim/mep-systems/mep-system-store', () => ({
  useMepSystemStore: { getState: () => ({ systems: mockSystems, upsertSystem: jest.fn() }) },
}));
jest.mock('../../../bim/mep-systems/mep-circuit-editor-store', () => ({
  useMepCircuitEditorStore: {
    getState: () => mockCircuit,
    subscribe: (l: () => void) => { mockCircuitListeners.add(l); return () => mockCircuitListeners.delete(l); },
  },
}));
jest.mock('../../../core/commands', () => ({ getGlobalCommandHistory: () => ({ execute: jest.fn() }) }));
jest.mock('../../../core/commands/entity-commands/UpdateMepSystemParamsCommand', () => ({ UpdateMepSystemParamsCommand: class {} }));
jest.mock('../../../bim/mep-systems/mep-wire-routing', () => ({ computeCircuitHostSegments: () => [], splicedSegmentInterior: () => [] }));
jest.mock('../../../bim/mep-systems/mep-wire-resolver', () => ({ resolverFromHosts: () => ({}) }));
jest.mock('../../../bim/mep-systems/mep-wire-waypoint-hit', () => ({ hitTestInsertion: () => null }));
jest.mock('../../../bim/mep-systems/mep-wire-waypoints', () => ({ getOrientedWaypoints: () => [], deleteWaypointOriented: () => new Map() }));
jest.mock('../../../bim/mep-systems/mep-wire-waypoint-gesture', () => ({ applyWaypointGesture: () => ({}) }));
jest.mock('../../placement/world-to-scene-point', () => ({ worldToPlanMm: () => ({ x: 0, y: 0 }), planMmToScenePoint: () => ({ x: 0, y: 0 }) }));
jest.mock('../../placement/raycast-floor-point', () => ({ resolveActiveFloorElevationMm: () => 0 }));
jest.mock('../../../utils/scene-units', () => ({ sceneUnitsToMeters: () => 0.001 }));
jest.mock('../../../bim/types/mep-system-types', () => ({ isElectricalSystemParams: () => true }));
jest.mock('../WireWaypointHandles3D', () => ({
  WireWaypointHandles3D: class {
    updateNodes(): void {}
    setHoveredIndex(): void {}
    showInsert(): void {}
    hideInsert(): void {}
    getPickables(): unknown[] { return []; }
    hideAll(): void {}
    dispose(): void {}
  },
}));

import { useBim3DWireWaypointInteraction } from '../use-bim3d-wire-waypoint-interaction-3d';

function makeParams(canvas: HTMLCanvasElement, markSceneDirty: jest.Mock) {
  const manager = {
    scene: { traverse: jest.fn() },
    markSceneDirty,
    getCamera: () => ({}),
    viewport: { setControlsEnabled: jest.fn() },
  };
  return {
    managerRef: { current: manager } as unknown as MutableRefObject<ThreeJsSceneManager | null>,
    canvasEl: canvas,
  };
}

function move(canvas: HTMLCanvasElement, x: number): void {
  canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: 0 }));
}

describe('useBim3DWireWaypointInteraction (ADR-549 Phase 1)', () => {
  beforeEach(() => {
    mockView.is3D = true; mockTool.activeTool = 'select'; mockCircuit.activeSystemId = null;
    mockViewListeners.clear(); mockToolListeners.clear(); mockCircuitListeners.clear();
    mockSystems = []; mockFixtures = []; mockPanels = [];
  });

  it('does NOT arm pointermove in select+3D when no circuit is active', () => {
    const canvas = document.createElement('canvas');
    const spy = jest.spyOn(canvas, 'addEventListener');
    renderHook(() => useBim3DWireWaypointInteraction(makeParams(canvas, jest.fn())));
    expect(spy.mock.calls.some(([t]) => t === 'pointermove')).toBe(false);
  });

  it('arms listeners once a circuit becomes active (re-evaluated via the circuit store)', () => {
    const canvas = document.createElement('canvas');
    const spy = jest.spyOn(canvas, 'addEventListener');
    renderHook(() => useBim3DWireWaypointInteraction(makeParams(canvas, jest.fn())));
    expect(spy.mock.calls.some(([t]) => t === 'pointermove')).toBe(false);
    mockCircuit.activeSystemId = 'sys-1';
    act(() => { mockCircuitListeners.forEach((l) => l()); });
    const types = spy.mock.calls.map(([t]) => t);
    expect(types).toEqual(expect.arrayContaining(['pointermove', 'pointerdown', 'pointerup']));
  });

  it('does NOT mark the scene dirty on no-op hovers (idempotent redraw)', () => {
    const canvas = document.createElement('canvas');
    const markSceneDirty = jest.fn();
    // Circuit active but no fixtures/panels → getActiveContext() resolves null:
    // the hover handler must stay completely silent (this is the «swim» regression).
    mockCircuit.activeSystemId = 'sys-1';
    mockSystems = [{ id: 'sys-1', params: { kind: 'electrical' } }];
    renderHook(() => useBim3DWireWaypointInteraction(makeParams(canvas, markSceneDirty)));
    markSceneDirty.mockClear();
    move(canvas, 10); move(canvas, 20); move(canvas, 30); move(canvas, 40);
    expect(markSceneDirty).not.toHaveBeenCalled();
  });

  it('tears down (clears handles, one final redraw) when the circuit is deactivated', () => {
    const canvas = document.createElement('canvas');
    const markSceneDirty = jest.fn();
    mockCircuit.activeSystemId = 'sys-1';
    renderHook(() => useBim3DWireWaypointInteraction(makeParams(canvas, markSceneDirty)));
    markSceneDirty.mockClear();
    mockCircuit.activeSystemId = null;
    act(() => { mockCircuitListeners.forEach((l) => l()); });
    // Deactivation → teardown: hides the handles layer and requests one final redraw.
    expect(markSceneDirty).toHaveBeenCalledTimes(1);
    // A later hover stays silent — the listener was removed via the AbortController.
    markSceneDirty.mockClear();
    move(canvas, 10);
    expect(markSceneDirty).not.toHaveBeenCalled();
  });
});
