/**
 * ADR-363 «Δοκάρι από τοίχο» — useBim3DBeamFromWallPick orchestration tests.
 *
 * Verifies the activation gate (beam-from-wall tool + 3D), the wall-raycast →
 * EventBus bridge on click, the wall-type guard, the orbit-drag guard, the
 * hover ghost wiring, and teardown on tool/view change. Peripheral modules are
 * mocked; the focus is the hook's wiring.
 */

import { act } from 'react';
import { renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';

interface Hit { bimId: string; bimType: string }
const mockState = { activeTool: 'select' as string, is3D: false };
const mockToolListeners = new Set<() => void>();
const mockViewListeners = new Set<() => void>();
const mockEmit = jest.fn();
const mockShowForWall = jest.fn();
const mockHide = jest.fn();
let mockHit: Hit | null = null;
let mockWalls: { id: string }[] = [];

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
  useBim3DEntitiesStore: { getState: () => ({ walls: mockWalls }) },
}));
jest.mock('../../../systems/events/EventBus', () => ({
  EventBus: { emit: (...a: unknown[]) => mockEmit(...a) },
}));
jest.mock('../../placement/BeamFromWallGhost', () => ({
  BeamFromWallGhost: class {
    showForWall(...a: unknown[]): void { mockShowForWall(...a); }
    hide(): void { mockHide(); }
    dispose(): void {}
  },
}));

import { useBim3DBeamFromWallPick } from '../use-bim3d-beam-from-wall-pick';

function makeParams(canvas: HTMLCanvasElement) {
  const manager = {
    scene: {},
    markSceneDirty: jest.fn(),
    raycastBimEntities: () => mockHit,
  };
  return {
    managerRef: { current: manager } as unknown as MutableRefObject<ThreeJsSceneManager | null>,
    canvasEl: canvas,
  };
}

function notifyTool(): void { act(() => { mockToolListeners.forEach((l) => l()); }); }

describe('useBim3DBeamFromWallPick', () => {
  beforeEach(() => {
    mockState.activeTool = 'select';
    mockState.is3D = false;
    mockToolListeners.clear();
    mockViewListeners.clear();
    mockEmit.mockClear();
    mockShowForWall.mockClear();
    mockHide.mockClear();
    mockHit = null;
    mockWalls = [];
  });

  it('does NOT wire click listener when inactive', () => {
    const canvas = document.createElement('canvas');
    const spy = jest.spyOn(canvas, 'addEventListener');
    renderHook(() => useBim3DBeamFromWallPick(makeParams(canvas)));
    expect(spy.mock.calls.some(([type]) => type === 'click')).toBe(false);
  });

  it('wires listeners when beam-from-wall tool active in 3D', () => {
    const canvas = document.createElement('canvas');
    const spy = jest.spyOn(canvas, 'addEventListener');
    mockState.activeTool = 'beam-from-wall';
    mockState.is3D = true;
    renderHook(() => useBim3DBeamFromWallPick(makeParams(canvas)));
    const types = spy.mock.calls.map(([type]) => type);
    expect(types).toEqual(expect.arrayContaining(['pointermove', 'pointerleave', 'pointerdown', 'click']));
  });

  it('click on a wall emits bim:beam-from-wall-picked-3d with the wallId', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'beam-from-wall';
    mockState.is3D = true;
    mockHit = { bimId: 'wall-7', bimType: 'wall' };
    mockWalls = [{ id: 'wall-7' }];
    renderHook(() => useBim3DBeamFromWallPick(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    expect(mockEmit).toHaveBeenCalledWith('bim:beam-from-wall-picked-3d', { wallId: 'wall-7' });
  });

  it('click on a non-wall hit does NOT emit', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'beam-from-wall';
    mockState.is3D = true;
    mockHit = { bimId: 'col-1', bimType: 'column' };
    renderHook(() => useBim3DBeamFromWallPick(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('pointer move over a wall shows the ghost; off a wall hides it', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'beam-from-wall';
    mockState.is3D = true;
    mockHit = { bimId: 'wall-7', bimType: 'wall' };
    mockWalls = [{ id: 'wall-7' }];
    renderHook(() => useBim3DBeamFromWallPick(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 5, clientY: 5 }));
    expect(mockShowForWall).toHaveBeenCalledWith({ id: 'wall-7' });
    mockHit = null;
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 9, clientY: 9 }));
    expect(mockHide).toHaveBeenCalled();
  });

  it('orbit drag (moved > threshold) does NOT emit', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'beam-from-wall';
    mockState.is3D = true;
    mockHit = { bimId: 'wall-7', bimType: 'wall' };
    mockWalls = [{ id: 'wall-7' }];
    renderHook(() => useBim3DBeamFromWallPick(makeParams(canvas)));
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0, button: 0 }));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100 }));
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('deactivating the tool tears down listeners (no more pick)', () => {
    const canvas = document.createElement('canvas');
    mockState.activeTool = 'beam-from-wall';
    mockState.is3D = true;
    mockHit = { bimId: 'wall-7', bimType: 'wall' };
    mockWalls = [{ id: 'wall-7' }];
    renderHook(() => useBim3DBeamFromWallPick(makeParams(canvas)));
    mockState.activeTool = 'select';
    notifyTool();
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5 }));
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
