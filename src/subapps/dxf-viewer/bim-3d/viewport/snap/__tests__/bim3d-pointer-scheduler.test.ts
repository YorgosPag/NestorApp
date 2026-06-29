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
let mockCurrentSnap: unknown = null;
jest.mock('../../../stores/Snap3DOverlayStore', () => ({ useSnap3DOverlayStore: { getState: () => ({ setSnap: mockSetSnap, snap: mockCurrentSnap }) } }));

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
let mockInteracting = false;
const raycastBimFace = jest.fn<{ bimId: string; faceKey: string } | null, []>(() => null);
const setHoveredFace = jest.fn();
const markSceneDirty = jest.fn();
const hoverHighlighter = {};
const manager = {
  getCamera: () => camera,
  getRendererCanvas: () => dom,
  // ADR-366 §B.5 — default: not navigating, so hover/snap picking runs (the suspend-on-orbit
  // gate is exercised by the dedicated test below).
  isCameraInteracting: () => mockInteracting,
  bimLayer: { group },
  hoverHighlighter,
  raycastBimFace: () => raycastBimFace(),
  setHoveredFace: (...a: unknown[]) => setHoveredFace(...a),
  markSceneDirty: () => markSceneDirty(),
} as unknown as ThreeJsSceneManager;

const WORLD = new THREE.Vector3(1, 2, 3);

/** SHADOW_SETTLE (DXF_TIMING.gesture) — the refine-on-settle window the scheduler reads. The hover
 *  highlight defers to this (not the shorter POINTER_SETTLE) so it COALESCES with the shadow-on
 *  render into ONE settle frame (ADR-366 §B.5, 2026-06-28). */
const SETTLE_MS = 350;

/**
 * Drive one pick AFTER the cursor has settled (past SHADOW_SETTLE) so the DEFERRED hover-highlight
 * refresh is applied — mirrors the real refine-on-settle timing (the hover silhouette resolves when
 * the cursor stops, not on every entity it sweeps over). Snap is NOT gated and applies on any pick.
 */
function settledPick(clientX: number, clientY: number): void {
  requestPointerPick({ manager, clientX, clientY });
  nowMs += SETTLE_MS + 50; // > SHADOW_SETTLE (350) and > HOVER_HITTEST (50)
  mockRegisteredCb?.();
}

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
  mockInteracting = false;
  mockCurrentSnap = null;
  raycastBimFace.mockReturnValue(null);
  nowMs += 10_000; // jump well past the HOVER_HITTEST throttle window
  clearPointerPick();
});

describe('bim3d-pointer-scheduler — ADR-040 Φ-3D-pointer decoupling', () => {
  it('arming sets dirty; the RAF pick drives hover silhouette + snap from ONE raycast', () => {
    mockBimHit = { bimId: 'c1', bimType: 'column', worldPoint: WORLD };
    requestPointerPick({ manager, clientX: 50, clientY: 50 });
    expect(mockRegisteredIsDirty?.()).toBe(true);

    nowMs += SETTLE_MS + 50; // cursor settles → the deferred hover refresh applies
    mockRegisteredCb?.();

    expect(mockEnsureBoundsTrees).toHaveBeenCalledWith(group);
    expect(mockSetHoveredEntity).toHaveBeenCalledWith('c1');
    expect(mockApplyBimHover).toHaveBeenCalledWith(hoverHighlighter, 'c1');
    expect(markSceneDirty).toHaveBeenCalled();
    // Snap reuses the SAME world point — 6th arg — no second raycast.
    expect(mockComputeSnap).toHaveBeenCalledWith(group, camera, dom, 50, 50, WORLD);
    expect(mockSetSnap).toHaveBeenCalledWith({ view: {}, elevMm: 0 });
    expect(mockRegisteredIsDirty?.()).toBe(false); // dirty cleared after a settled run
  });

  it('DECOUPLED (ADR-549 Φ2): the unified hover id updates LIVE while sweeping; only the BIM silhouette defers (ADR-366 §B.5)', () => {
    mockBimHit = { bimId: 'c1', bimType: 'column', worldPoint: WORLD };

    // Pick FIRES right after a move (cursor still sweeping). The cheap unified hover id (drives the
    // Canvas2D glow) updates LIVE — like the snap glyph — so the highlight never sticks on a stale
    // entity. The heavy BIM silhouette WebGL re-render is DEFERRED and the slot stays armed.
    requestPointerPick({ manager, clientX: 50, clientY: 50 });
    mockRegisteredCb?.();
    expect(mockSetSnap).toHaveBeenCalledWith({ view: {}, elevMm: 0 }); // snap live while sweeping
    expect(mockSetHoveredEntity).toHaveBeenCalledWith('c1');           // hover id LIVE while sweeping
    expect(mockApplyBimHover).not.toHaveBeenCalled();                  // silhouette deferred
    expect(markSceneDirty).not.toHaveBeenCalled();                     // no WebGL re-render while sweeping
    expect(mockRegisteredIsDirty?.()).toBe(true);                      // re-armed → waits for settle

    // Cursor settles (no further moves): the next pick past SHADOW_SETTLE applies the silhouette once.
    nowMs += SETTLE_MS + 50;
    mockRegisteredCb?.();
    expect(mockApplyBimHover).toHaveBeenCalledWith(hoverHighlighter, 'c1');
    expect(markSceneDirty).toHaveBeenCalledTimes(1);
    expect(mockSetHoveredEntity).toHaveBeenCalledTimes(1); // id unchanged → not written again
    expect(mockRegisteredIsDirty?.()).toBe(false); // settled → slot disarmed
  });

  it('DXF-only hover updates the glow id live with ZERO WebGL re-render (Canvas2D overlay — ADR-549 Φ2)', () => {
    mockBimHit = null;
    mockDxfPick = { entityId: 'dxf-7' };

    // Sweeping over a raw DXF entity: the glow id is written live; no BIM silhouette → no markSceneDirty.
    requestPointerPick({ manager, clientX: 20, clientY: 20 });
    mockRegisteredCb?.();
    expect(mockSetHoveredEntity).toHaveBeenCalledWith('dxf-7');
    expect(mockApplyBimHover).not.toHaveBeenCalled();
    expect(markSceneDirty).not.toHaveBeenCalled();

    // Move to empty space (still sweeping): the glow id clears live — it does NOT wait for settle.
    mockDxfPick = null;
    nowMs += 60; // past HOVER_HITTEST, still within SHADOW_SETTLE (pointer active)
    requestPointerPick({ manager, clientX: 300, clientY: 300 });
    mockRegisteredCb?.();
    expect(mockSetHoveredEntity).toHaveBeenLastCalledWith(null);
    expect(markSceneDirty).not.toHaveBeenCalled(); // still zero WebGL renders for pure-DXF hover
  });

  it('suspends ALL picking while the camera is navigating (ADR-366 §B.5) — clears a lingering snap', () => {
    mockBimHit = { bimId: 'c1', bimType: 'column', worldPoint: WORLD };
    mockInteracting = true;     // orbit/zoom/pan in flight
    mockCurrentSnap = { view: {}, elevMm: 0 }; // a snap glyph was up before navigation began
    requestPointerPick({ manager, clientX: 50, clientY: 50 });
    mockRegisteredCb?.();

    // No BVH raycast, no hover write, no snap search — pure wasted work during navigation.
    expect(mockEnsureBoundsTrees).not.toHaveBeenCalled();
    expect(mockRaycast).not.toHaveBeenCalled();
    expect(mockSetHoveredEntity).not.toHaveBeenCalled();
    expect(mockComputeSnap).not.toHaveBeenCalled();
    // The lingering snap glyph is cleared so navigation shows a clean crosshair.
    expect(mockSetSnap).toHaveBeenCalledWith(null);
  });

  it('does not re-clear the snap while navigating when none is set (no redundant store write)', () => {
    mockInteracting = true;
    mockCurrentSnap = null;
    requestPointerPick({ manager, clientX: 50, clientY: 50 });
    mockRegisteredCb?.();

    expect(mockSetSnap).not.toHaveBeenCalled();
  });

  it('BIM miss → DXF fallback hover; no world point → snap cleared, no snap compute', () => {
    mockBimHit = null;
    mockDxfPick = { entityId: 'dxf-9' };
    settledPick(10, 10);

    expect(mockSetHoveredEntity).toHaveBeenCalledWith('dxf-9');
    // ADR-549 Φ2 — no BIM hit and no prior silhouette → the WebGL silhouette path is untouched.
    expect(mockApplyBimHover).not.toHaveBeenCalled();
    expect(mockComputeSnap).not.toHaveBeenCalled();
    expect(mockSetSnap).toHaveBeenCalledWith(null);
  });

  it('leaving a BIM entity for empty space clears the silhouette once on settle (ADR-549 Φ2)', () => {
    mockBimHit = { bimId: 'c1', bimType: 'column', worldPoint: WORLD };
    settledPick(50, 50); // silhouette ON for c1
    expect(mockApplyBimHover).toHaveBeenLastCalledWith(hoverHighlighter, 'c1');

    mockBimHit = null;
    mockDxfPick = null;
    settledPick(300, 300); // empty space → silhouette cleared exactly once
    expect(mockApplyBimHover).toHaveBeenLastCalledWith(hoverHighlighter, null);
    expect(mockApplyBimHover).toHaveBeenCalledTimes(2);
  });

  it('a placement tool (column/wall) yields the snap glyph — leaves the snap store untouched (ADR-544)', () => {
    mockBimHit = { bimId: 'c1', bimType: 'column', worldPoint: WORLD };
    mockActiveTool = 'column';
    settledPick(50, 50);

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
    settledPick(50, 50); // first run executes (settled → hover applied)
    expect(mockSetHoveredEntity).toHaveBeenCalledTimes(1);

    nowMs += 10; // < 50ms HOVER_HITTEST
    requestPointerPick({ manager, clientX: 51, clientY: 51 });
    mockRegisteredCb?.(); // throttled → no pick
    expect(mockSetHoveredEntity).toHaveBeenCalledTimes(1);
    expect(mockRegisteredIsDirty?.()).toBe(true); // retried next frame
  });

  it('re-renders the scene ONLY when the hover target changes (no swim — ADR-040 Φ-3D-pointer)', () => {
    mockBimHit = { bimId: 'c1', bimType: 'column', worldPoint: WORLD };
    settledPick(50, 50);
    expect(markSceneDirty).toHaveBeenCalledTimes(1);
    expect(mockSetHoveredEntity).toHaveBeenCalledTimes(1);

    // Second settled pick over the SAME entity → NO extra render / hover write.
    settledPick(51, 51);
    expect(markSceneDirty).toHaveBeenCalledTimes(1);
    expect(mockSetHoveredEntity).toHaveBeenCalledTimes(1);

    // Hover changes to empty space → exactly one more render + a null hover write.
    mockBimHit = null;
    mockDxfPick = null;
    settledPick(300, 300);
    expect(markSceneDirty).toHaveBeenCalledTimes(2);
    expect(mockSetHoveredEntity).toHaveBeenLastCalledWith(null);
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
