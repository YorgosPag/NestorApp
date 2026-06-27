import * as THREE from 'three';

/**
 * bim3d-pointer-scheduler — decoupling contract (ADR-040 Φ-3D-pointer). We capture the RAF callback
 * registered with the UnifiedFrameScheduler and drive it manually, asserting the unified pick wiring
 * (one raycast → hover + snap), the throttle, and the placement/polygon gates.
 */

// ── capture the registered RAF slot ──
let mockRegisteredCb: (() => void) | null = null;
let mockRegisteredIsDirty: (() => boolean) | null = null;
jest.mock('../../../../rendering', () => ({
  registerRenderCallback: (_id: string, _name: string, _p: number, cb: () => void, isDirty: () => boolean) => {
    mockRegisteredCb = cb;
    mockRegisteredIsDirty = isDirty;
    return () => undefined;
  },
  RENDER_PRIORITIES: { NORMAL: 2 },
}));

// ── store / pure-fn mocks (names must start with `mock` for jest factory hoisting) ──
const mockSetHoveredEntity = jest.fn();
jest.mock('../../../../systems/hover/HoverStore', () => ({ setHoveredEntity: (...a: unknown[]) => mockSetHoveredEntity(...a) }));

let mockActiveTool: string | undefined;
jest.mock('../../../../stores/ToolStateStore', () => ({ toolStateStore: { get: () => ({ activeTool: mockActiveTool }) } }));

let mockPolygonActive = false;
jest.mock('../../../stores/PolygonMode3DStore', () => ({ usePolygonMode3DStore: { getState: () => ({ active: mockPolygonActive }) } }));

const mockSetSnap = jest.fn();
jest.mock('../../../stores/Snap3DOverlayStore', () => ({ useSnap3DOverlayStore: { getState: () => ({ setSnap: mockSetSnap }) } }));

const mockApplyBimHover = jest.fn();
jest.mock('../../../scene/scene-manager-actions', () => ({ applyBimHover: (...a: unknown[]) => mockApplyBimHover(...a) }));

jest.mock('../../../scene/dxf-3d-floor-scope', () => ({ getDxfFloorScope: () => [] }));

let mockDxfPick: { entityId: string } | null = null;
jest.mock('../../../grips/dxf-wireframe-hit-test', () => ({ pickDxfEntityAcrossFloors: () => mockDxfPick }));

let mockBimHit: { bimId: string | null; bimType: string | null; worldPoint: THREE.Vector3 } | null = null;
const mockRaycast = jest.fn(() => mockBimHit);
jest.mock('../../../systems/raycaster/BimEntityRaycaster', () => ({ raycastBimHitAndWorld: () => mockRaycast() }));

const mockEnsureBoundsTrees = jest.fn();
jest.mock('../../../systems/raycaster/bvh-setup', () => ({ ensureBoundsTrees: (...a: unknown[]) => mockEnsureBoundsTrees(...a) }));

const mockComputeSnap = jest.fn(() => ({ view: {}, elevMm: 0 }));
jest.mock('../bim-3d-snap-hover', () => ({ computeSnap3DHover: (...a: unknown[]) => mockComputeSnap(...a) }));

import { requestPointerPick, clearPointerPick } from '../bim3d-pointer-scheduler';
import type { ThreeJsSceneManager } from '../../../scene/ThreeJsSceneManager';

function mockDom(): HTMLElement {
  return { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) } as unknown as HTMLElement;
}

const group = new THREE.Group();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
const dom = mockDom();
const raycastBimFace = jest.fn<{ bimId: string; faceKey: string } | null, []>(() => null);
const setHoveredFace = jest.fn();
const markSceneDirty = jest.fn();
const hoverHighlighter = {};
const manager = {
  getCamera: () => camera,
  getRendererCanvas: () => dom,
  bimLayer: { group },
  hoverHighlighter,
  raycastBimFace: () => raycastBimFace(),
  setHoveredFace: (...a: unknown[]) => setHoveredFace(...a),
  markSceneDirty: () => markSceneDirty(),
} as unknown as ThreeJsSceneManager;

const WORLD = new THREE.Vector3(1, 2, 3);

// Deterministic clock so the throttle is controllable across tests.
let nowMs = 0;
const realNow = performance.now;
beforeAll(() => { performance.now = () => nowMs; });
afterAll(() => { performance.now = realNow; });

beforeEach(() => {
  jest.clearAllMocks();
  mockActiveTool = undefined;
  mockPolygonActive = false;
  mockBimHit = null;
  mockDxfPick = null;
  raycastBimFace.mockReturnValue(null);
  nowMs += 10_000; // jump well past the HOVER_HITTEST throttle window
  clearPointerPick();
});

describe('bim3d-pointer-scheduler — ADR-040 Φ-3D-pointer decoupling', () => {
  it('arming sets dirty; the RAF pick drives hover silhouette + snap from ONE raycast', () => {
    mockBimHit = { bimId: 'c1', bimType: 'column', worldPoint: WORLD };
    requestPointerPick({ manager, clientX: 50, clientY: 50 });
    expect(mockRegisteredIsDirty?.()).toBe(true);

    mockRegisteredCb?.();

    expect(mockEnsureBoundsTrees).toHaveBeenCalledWith(group);
    expect(mockSetHoveredEntity).toHaveBeenCalledWith('c1');
    expect(mockApplyBimHover).toHaveBeenCalledWith(hoverHighlighter, 'c1');
    expect(markSceneDirty).toHaveBeenCalled();
    // Snap reuses the SAME world point — 6th arg — no second raycast.
    expect(mockComputeSnap).toHaveBeenCalledWith(group, camera, dom, 50, 50, WORLD);
    expect(mockSetSnap).toHaveBeenCalledWith({ view: {}, elevMm: 0 });
    expect(mockRegisteredIsDirty?.()).toBe(false); // dirty cleared after a successful run
  });

  it('BIM miss → DXF fallback hover; no world point → snap cleared, no snap compute', () => {
    mockBimHit = null;
    mockDxfPick = { entityId: 'dxf-9' };
    requestPointerPick({ manager, clientX: 10, clientY: 10 });
    mockRegisteredCb?.();

    expect(mockSetHoveredEntity).toHaveBeenCalledWith('dxf-9');
    expect(mockApplyBimHover).toHaveBeenCalledWith(hoverHighlighter, null);
    expect(mockComputeSnap).not.toHaveBeenCalled();
    expect(mockSetSnap).toHaveBeenCalledWith(null);
  });

  it('a placement tool (column/wall) yields the snap glyph — leaves the snap store untouched (ADR-544)', () => {
    mockBimHit = { bimId: 'c1', bimType: 'column', worldPoint: WORLD };
    mockActiveTool = 'column';
    requestPointerPick({ manager, clientX: 50, clientY: 50 });
    mockRegisteredCb?.();

    expect(mockSetHoveredEntity).toHaveBeenCalledWith('c1'); // hover still updates
    expect(mockComputeSnap).not.toHaveBeenCalled();
    expect(mockSetSnap).not.toHaveBeenCalled(); // placement hook owns the glyph
  });

  it('Polygon Mode → per-face hover preview + snap cleared, no entity silhouette', () => {
    mockPolygonActive = true;
    raycastBimFace.mockReturnValue({ bimId: 'f1', faceKey: 'k1' });
    requestPointerPick({ manager, clientX: 50, clientY: 50 });
    mockRegisteredCb?.();

    expect(setHoveredFace).toHaveBeenCalledWith('f1', 'k1');
    expect(mockSetSnap).toHaveBeenCalledWith(null);
    expect(mockSetHoveredEntity).not.toHaveBeenCalled();
    expect(mockRaycast).not.toHaveBeenCalled(); // skips the unified raycast in polygon mode
  });

  it('throttles: a second pick within the HOVER_HITTEST window is skipped, dirty stays set', () => {
    mockBimHit = { bimId: 'c1', bimType: 'column', worldPoint: WORLD };
    requestPointerPick({ manager, clientX: 50, clientY: 50 });
    mockRegisteredCb?.(); // first run executes
    expect(mockSetHoveredEntity).toHaveBeenCalledTimes(1);

    nowMs += 10; // < 50ms HOVER_HITTEST
    requestPointerPick({ manager, clientX: 51, clientY: 51 });
    mockRegisteredCb?.(); // throttled → no pick
    expect(mockSetHoveredEntity).toHaveBeenCalledTimes(1);
    expect(mockRegisteredIsDirty?.()).toBe(true); // retried next frame
  });

  it('clearPointerPick makes the RAF callback a no-op', () => {
    mockBimHit = { bimId: 'c1', bimType: 'column', worldPoint: WORLD };
    requestPointerPick({ manager, clientX: 50, clientY: 50 });
    clearPointerPick();
    mockRegisteredCb?.();
    expect(mockSetHoveredEntity).not.toHaveBeenCalled();
    expect(mockRegisteredIsDirty?.()).toBe(false);
  });
});
