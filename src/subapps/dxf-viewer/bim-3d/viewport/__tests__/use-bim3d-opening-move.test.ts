/**
 * ADR-363 Φ1G.5 Slice 2d — useBim3DOpeningMove orchestration tests.
 *
 * Verifies the activation gate (single opening selected + 3D), the press-on-opening
 * guard, the live ghost wiring on drag, the slide/re-host commit on release, the
 * click-vs-drag threshold, and teardown on deselect. The move SSoT, the ghost, the
 * command + adapter are mocked; the focus is the hook's wiring.
 */

import { act } from 'react';
import { renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';

interface Hit { bimId: string; bimType: string }
const mockSel = { ids: [] as string[], type: null as string | null };
const mockState = { is3D: false };
const mockSelListeners = new Set<() => void>();
const mockViewListeners = new Set<() => void>();
const mockWallUpdate = jest.fn();
const mockWallCommit = jest.fn();
const mockWallCancel = jest.fn();
const mockDimUpdate = jest.fn();
const mockDimHide = jest.fn();
const mockExecute = jest.fn();
let mockHit: Hit | null = null;
let mockPoint: { x: number; y: number; z: number } | null = null;
let mockResolved: { params: Record<string, unknown>; host: { id: string } } | null = null;
let mockOpenings: { id: string; params: { wallId: string }; geometry: { position: { x: number; y: number } } }[] = [];
let mockWalls: { id: string; type: string; params: { sceneUnits: string } }[] = [];

jest.mock('../../stores/ViewMode3DStore', () => ({
  selectIs3D: () => mockState.is3D,
  useViewMode3DStore: {
    getState: () => mockState,
    subscribe: (l: () => void) => { mockViewListeners.add(l); return () => mockViewListeners.delete(l); },
  },
}));
jest.mock('../../stores/Selection3DStore', () => ({
  useSelection3DStore: {
    getState: () => ({ selectedBimIds: mockSel.ids, selectedBimType: mockSel.type }),
    subscribe: (l: () => void) => { mockSelListeners.add(l); return () => mockSelListeners.delete(l); },
  },
}));
jest.mock('../../stores/Bim3DEntitiesStore', () => ({
  useBim3DEntitiesStore: { getState: () => ({ openings: mockOpenings, walls: mockWalls, floors: [], buildings: [] }) },
}));
jest.mock('../../systems/raycaster/BimEntityRaycaster', () => ({ raycastWorldPoint: () => mockPoint }));
jest.mock('../../placement/OpeningHostWallPreview', () => ({
  OpeningHostWallPreview: class {
    update(...a: unknown[]): void { mockWallUpdate(...a); }
    commit(): void { mockWallCommit(); }
    cancel(): void { mockWallCancel(); }
    dispose(): void {}
  },
}));
jest.mock('../../animation/bim3d-preview-rebuild', () => ({
  buildOpeningHostWallPreview: () => ({}),
}));
jest.mock('../../placement/TempOpeningDimOverlay', () => ({
  TempOpeningDimOverlay: class {
    update(...a: unknown[]): void { mockDimUpdate(...a); }
    hide(): void { mockDimHide(); }
    dispose(): void {}
  },
}));
// ADR-363 — live move-distance readout overlay (ίδιο pattern με το dim overlay· mocked ώστε
// να μην αγγίζει την πραγματική THREE.Scene στα unit tests — ο ctor του κάνει `scene.add`).
jest.mock('../../placement/TempMoveReadoutOverlay', () => ({
  TempMoveReadoutOverlay: class {
    update(): void {}
    hide(): void {}
    dispose(): void {}
  },
}));
jest.mock('../../../bim/walls/opening-grips', () => ({
  resolveOpeningAltMove: () => mockResolved,
  openingRehostToleranceWorld: () => 600,
}));
jest.mock('../../../bim/utils/bim-floor-utils', () => ({ resolveEntityBuilding: () => ({ baseElevation: 0 }) }));
jest.mock('../../placement/raycast-floor-point', () => ({ resolveActiveFloorElevationMm: () => 0 }));
jest.mock('../../animation/bim3d-edit-live-preview-apply', () => ({ resolveEntityLevelId: () => 'level-1' }));
jest.mock('../../../hooks/grips/grip-commit-adapters', () => ({ createSceneManagerAdapter: () => ({}) }));
jest.mock('../../../core/commands', () => ({ getGlobalCommandHistory: () => ({ execute: (c: unknown) => mockExecute(c) }) }));
jest.mock('../../../core/commands/entity-commands/UpdateOpeningParamsCommand', () => ({
  UpdateOpeningParamsCommand: class { constructor(public id: string, public next: unknown) {} },
}));
jest.mock('../../../systems/levels/useLevels', () => ({
  useLevelsOptional: () => ({ currentLevelId: 'level-1', getLevelScene: () => null, setLevelScene: () => {} }),
}));

import { useBim3DOpeningMove } from '../use-bim3d-opening-move';
import { UpdateOpeningParamsCommand } from '../../../core/commands/entity-commands/UpdateOpeningParamsCommand';

function makeParams(canvas: HTMLCanvasElement) {
  const manager = {
    scene: {},
    markSceneDirty: jest.fn(),
    raycastBimEntities: () => mockHit,
    getCamera: () => ({}),
    getRendererCanvas: () => canvas,
    viewport: { setControlsEnabled: jest.fn() },
    bimLayer: { group: { traverse: jest.fn() } },
  };
  return {
    managerRef: { current: manager } as unknown as MutableRefObject<ThreeJsSceneManager | null>,
    canvasEl: canvas,
  };
}

function selectOpening(): void {
  mockSel.ids = ['op-1'];
  mockSel.type = 'opening';
  mockState.is3D = true;
  mockOpenings = [{ id: 'op-1', params: { wallId: 'wall-1' }, geometry: { position: { x: 100, y: 50 } } }];
  mockWalls = [{ id: 'wall-1', type: 'wall', params: { sceneUnits: 'mm' } }];
}

function press(canvas: HTMLCanvasElement, x = 0, y = 0): void {
  canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: x, clientY: y, button: 0 }));
}

describe('useBim3DOpeningMove', () => {
  beforeEach(() => {
    mockSel.ids = []; mockSel.type = null; mockState.is3D = false;
    mockSelListeners.clear(); mockViewListeners.clear();
    mockWallUpdate.mockClear(); mockWallCommit.mockClear(); mockWallCancel.mockClear(); mockExecute.mockClear();
    mockDimUpdate.mockClear(); mockDimHide.mockClear();
    mockHit = null; mockPoint = null; mockResolved = null; mockOpenings = []; mockWalls = [];
  });

  it('does NOT wire pointerdown when no opening is selected', () => {
    const canvas = document.createElement('canvas');
    const spy = jest.spyOn(canvas, 'addEventListener');
    renderHook(() => useBim3DOpeningMove(makeParams(canvas)));
    expect(spy.mock.calls.some(([t]) => t === 'pointerdown')).toBe(false);
  });

  it('wires listeners when a single opening is selected in 3D', () => {
    const canvas = document.createElement('canvas');
    const spy = jest.spyOn(canvas, 'addEventListener');
    selectOpening();
    renderHook(() => useBim3DOpeningMove(makeParams(canvas)));
    const types = spy.mock.calls.map(([t]) => t);
    expect(types).toEqual(expect.arrayContaining(['pointerdown', 'pointermove', 'pointerup', 'click']));
  });

  it('drag on the opening rebuilds the host wall live then commits on release', () => {
    const canvas = document.createElement('canvas');
    selectOpening();
    mockHit = { bimId: 'op-1', bimType: 'opening' }; // press lands on the opening
    renderHook(() => useBim3DOpeningMove(makeParams(canvas)));
    press(canvas, 0, 0);
    mockPoint = { x: 0.2, y: 0, z: -0.05 };
    mockHit = { bimId: 'wall-1', bimType: 'wall' }; // cursor over a wall
    mockResolved = { params: { wallId: 'wall-1', offsetFromStart: 300 }, host: { id: 'wall-1' } };
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 40, clientY: 0 }));
    expect(mockWallUpdate).toHaveBeenCalled(); // the moving hole follows the drag
    expect(mockDimUpdate).toHaveBeenCalled(); // temporary dimensions follow the drag
    canvas.dispatchEvent(new MouseEvent('pointerup', { clientX: 40, clientY: 0 }));
    expect(mockWallCommit).toHaveBeenCalled(); // commit keeps the originals hidden for the re-sync
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute.mock.calls[0][0]).toBeInstanceOf(UpdateOpeningParamsCommand);
    expect(mockDimHide).toHaveBeenCalled(); // dimensions vanish on release
  });

  it('press NOT on the opening does not start a drag (no commit)', () => {
    const canvas = document.createElement('canvas');
    selectOpening();
    mockHit = { bimId: 'wall-1', bimType: 'wall' }; // cursor on a wall, not the opening
    renderHook(() => useBim3DOpeningMove(makeParams(canvas)));
    press(canvas, 0, 0);
    mockPoint = { x: 0.2, y: 0, z: -0.05 };
    mockResolved = { params: { wallId: 'wall-1' }, host: { id: 'wall-1' } };
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 40, clientY: 0 }));
    canvas.dispatchEvent(new MouseEvent('pointerup', { clientX: 40, clientY: 0 }));
    expect(mockWallUpdate).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('a click (no drag past threshold) does NOT commit', () => {
    const canvas = document.createElement('canvas');
    selectOpening();
    mockHit = { bimId: 'op-1', bimType: 'opening' };
    renderHook(() => useBim3DOpeningMove(makeParams(canvas)));
    press(canvas, 10, 10);
    mockResolved = { params: { wallId: 'wall-1' }, host: { id: 'wall-1' } };
    canvas.dispatchEvent(new MouseEvent('pointerup', { clientX: 11, clientY: 11 })); // moved ~1px
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('deselecting tears down listeners (no commit on a later press)', () => {
    const canvas = document.createElement('canvas');
    selectOpening();
    mockHit = { bimId: 'op-1', bimType: 'opening' };
    renderHook(() => useBim3DOpeningMove(makeParams(canvas)));
    mockSel.ids = []; mockSel.type = null;
    act(() => { mockSelListeners.forEach((l) => l()); });
    press(canvas, 0, 0);
    canvas.dispatchEvent(new MouseEvent('pointerup', { clientX: 40, clientY: 0 }));
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
