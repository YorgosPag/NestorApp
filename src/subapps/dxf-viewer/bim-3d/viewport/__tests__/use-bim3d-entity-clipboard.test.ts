/**
 * ADR-688 — useBim3DEntityClipboard orchestration tests.
 *
 * Verifies the priority gating (3D-only, Polygon-Mode-off, not-in-form-field), the
 * Ctrl+C reuse (clipboard:copy-requested emit), the Ctrl+V paste-at-pick delta
 * (cursor work-plane hit − snapshot centre) and the Ctrl+D in-place offset
 * duplicate. The clone SSoT, clipboard store, pick machinery, command history and
 * selection are mocked; the focus is the hook's wiring + delta math.
 */

import { renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';
import type { SceneEntity } from '../../../core/commands/interfaces';

const mockState = { is3D: true, polygonActive: false, typing: false };
const mockSel = { ids: [] as string[] };
const mockClipboard = { snapshots: [] as SceneEntity[] };
const mockSceneEntities: Array<{ id: string }> = [];
let mockWorkPlaneHit: { planMm: { x: number; y: number } } | null = null;

const mockEmit = jest.fn();
const mockBuild = jest.fn();
const mockExecute = jest.fn();
const mockReplaceSelection = jest.fn();
const mockSm = { tag: 'scene-manager' };

jest.mock('../../../systems/events/EventBus', () => ({
  EventBus: { emit: (...a: unknown[]) => mockEmit(...a), on: () => () => {} },
}));
jest.mock('../../../systems/clipboard/EntityClipboardStore', () => ({
  EntityClipboardStore: { read: () => mockClipboard.snapshots.slice(), copy: jest.fn() },
}));
jest.mock('../../../bim/transforms/build-entity-clone-command', () => ({
  buildEntityCloneCommand: (...a: unknown[]) => mockBuild(...a),
}));
jest.mock('../../../systems/entity-creation/useSceneManagerAdapter', () => ({
  useSceneManagerAdapter: () => () => mockSm,
}));
jest.mock('../../../systems/levels/useLevels', () => ({
  useLevelsOptional: () => ({
    currentLevelId: 'L1',
    getLevelScene: () => ({ entities: mockSceneEntities, units: 'mm' }),
    setLevelScene: () => {},
  }),
}));
jest.mock('../../../core/commands/useCommandHistory', () => ({
  useCommandHistory: () => ({ execute: mockExecute }),
}));
jest.mock('../../../systems/selection/SelectionSystem', () => ({
  useUniversalSelectionStable: () => ({
    getSelectedEntityIds: () => mockSel.ids.slice(),
    replaceEntitySelection: (...a: unknown[]) => mockReplaceSelection(...a),
  }),
}));
jest.mock('../../../utils/scene-units', () => ({ resolveSceneUnits: () => 'mm' }));
jest.mock('../../../types/entities', () => ({
  // Snapshot AABB centre = (5, 5) for a 0..10 box.
  getEntityBounds: () => ({ minX: 0, minY: 0, maxX: 10, maxY: 10 }),
}));
jest.mock('../../stores/PolygonMode3DStore', () => ({
  usePolygonMode3DStore: { getState: () => ({ active: mockState.polygonActive }) },
}));
jest.mock('../../stores/ViewMode3DStore', () => ({
  selectIs3D: () => mockState.is3D,
  useViewMode3DStore: { getState: () => mockState },
}));
jest.mock('../../ui/is-typing-in-form-field', () => ({
  isTypingInFormField: () => mockState.typing,
}));
jest.mock('../../placement/resolve-work-plane-hit', () => ({
  resolveWorkPlaneHit: () => mockWorkPlaneHit,
}));
jest.mock('../../placement/world-to-scene-point', () => ({
  // Identity for a mm scene (mmToSceneUnits('mm') === 1).
  planMmToScenePoint: (p: { x: number; y: number }) => ({ x: p.x, y: p.y }),
}));

import { useBim3DEntityClipboard } from '../use-bim3d-entity-clipboard';

function mount(canvasEl: HTMLCanvasElement | null) {
  const managerRef = { current: {} as ThreeJsSceneManager } as MutableRefObject<ThreeJsSceneManager | null>;
  return renderHook(() => useBim3DEntityClipboard({ managerRef, canvasEl }));
}

function pressCtrl(key: string): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true, bubbles: true });
  window.dispatchEvent(ev);
  return ev;
}

function movePointer(canvasEl: HTMLCanvasElement, clientX: number, clientY: number): void {
  canvasEl.dispatchEvent(new MouseEvent('pointermove', { clientX, clientY }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState.is3D = true; mockState.polygonActive = false; mockState.typing = false;
  mockSel.ids = [];
  mockClipboard.snapshots = [];
  mockSceneEntities.length = 0;
  mockWorkPlaneHit = null;
  mockBuild.mockReturnValue({ command: { id: 'cmd' }, cloneIds: ['clone1'] });
});

describe('useBim3DEntityClipboard — ADR-688', () => {
  it('Ctrl+C reuses the existing clipboard via clipboard:copy-requested', () => {
    const canvas = document.createElement('canvas');
    const { unmount } = mount(canvas);
    const ev = pressCtrl('c');
    expect(mockEmit).toHaveBeenCalledWith('clipboard:copy-requested', {});
    expect(ev.defaultPrevented).toBe(true);
    unmount();
  });

  it('Ctrl+V pastes clones at the cursor work-plane point (delta = pick − centre)', () => {
    const canvas = document.createElement('canvas');
    mockClipboard.snapshots = [{ id: 'a', type: 'column' } as unknown as SceneEntity];
    mockWorkPlaneHit = { planMm: { x: 100, y: 50 } };
    const { unmount } = mount(canvas);
    movePointer(canvas, 640, 360);
    const ev = pressCtrl('v');
    expect(mockBuild).toHaveBeenCalledTimes(1);
    // delta = pick(100,50) − snapshot centre(5,5) = (95, 45)
    expect(mockBuild).toHaveBeenCalledWith(mockClipboard.snapshots, { x: 95, y: 45 }, mockSm);
    expect(mockExecute).toHaveBeenCalledWith({ id: 'cmd' });
    expect(mockReplaceSelection).toHaveBeenCalledWith(['clone1']);
    expect(ev.defaultPrevented).toBe(true);
    unmount();
  });

  it('Ctrl+V with no cursor hit falls back to the offset delta (300mm)', () => {
    const canvas = document.createElement('canvas');
    mockClipboard.snapshots = [{ id: 'a', type: 'column' } as unknown as SceneEntity];
    mockWorkPlaneHit = null; // ray misses the floor
    const { unmount } = mount(canvas);
    movePointer(canvas, 10, 10);
    pressCtrl('v');
    expect(mockBuild).toHaveBeenCalledWith(mockClipboard.snapshots, { x: 300, y: 300 }, mockSm);
    unmount();
  });

  it('Ctrl+V with an empty clipboard is a no-op (nothing handled)', () => {
    const canvas = document.createElement('canvas');
    mockClipboard.snapshots = [];
    const { unmount } = mount(canvas);
    const ev = pressCtrl('v');
    expect(mockBuild).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
    unmount();
  });

  it('Ctrl+D duplicates the current selection in place with the offset delta', () => {
    const canvas = document.createElement('canvas');
    mockSel.ids = ['x'];
    mockSceneEntities.push({ id: 'x' });
    const { unmount } = mount(canvas);
    const ev = pressCtrl('d');
    expect(mockBuild).toHaveBeenCalledWith([{ id: 'x' }], { x: 300, y: 300 }, mockSm);
    expect(mockExecute).toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(true);
    unmount();
  });

  it('is a no-op in Polygon Mode (face-appearance owns Ctrl+C/V)', () => {
    const canvas = document.createElement('canvas');
    mockState.polygonActive = true;
    mockClipboard.snapshots = [{ id: 'a', type: 'column' } as unknown as SceneEntity];
    const { unmount } = mount(canvas);
    const ev = pressCtrl('v');
    expect(mockBuild).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
    unmount();
  });

  it('is a no-op when the 3D view is not active', () => {
    const canvas = document.createElement('canvas');
    mockState.is3D = false;
    mockClipboard.snapshots = [{ id: 'a', type: 'column' } as unknown as SceneEntity];
    const { unmount } = mount(canvas);
    const ev = pressCtrl('v');
    expect(mockBuild).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
    unmount();
  });

  it('is a no-op while typing in a form field', () => {
    const canvas = document.createElement('canvas');
    mockState.typing = true;
    const { unmount } = mount(canvas);
    const ev = pressCtrl('c');
    expect(mockEmit).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
    unmount();
  });
});
