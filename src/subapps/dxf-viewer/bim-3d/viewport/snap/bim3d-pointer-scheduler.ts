/**
 * BIM 3D POINTER SCHEDULER — decoupled hover + snap pick (ADR-040 Φ-3D-pointer).
 *
 * THE PROBLEM: the 3D viewport's `handleMouseMove` ran the hover raycast AND the snap raycast
 * SYNCHRONOUSLY inside the event handler (two full-scene `intersectObjects` passes + an O(N) snap
 * search). On a dense model each move blocked the main thread for tens of ms → the compositor and
 * the crosshair's own window-listener starved → the cursor lagged. The 2D canvas never had this:
 * its heavy snap work is decoupled to a RAF slot (`systems/cursor/snap-scheduler.ts`).
 *
 * THE FIX (mirror of the 2D snap-scheduler): the mousemove handler only ARMS this scheduler with the
 * latest cursor position (cheap: store + flag) and returns immediately — the crosshair (driven
 * imperatively by `BimCrosshairOverlay3D`'s window listener) stays 1:1. The heavy pick then runs in
 * a SEPARATE frame slot on the EXISTING RAF SSoT (`UnifiedFrameScheduler`), at most once per
 * `HOVER_HITTEST` window, coalescing intermediate moves. The pick is UNIFIED: ONE BVH-accelerated
 * raycast (`raycastBimHitAndWorld`) drives BOTH the hover silhouette (ADR-538) AND the snap marker
 * (ADR-542, reusing the same world point — no second raycast).
 *
 * SSoT: sole owner of 3D hover/snap pick scheduling. The hover state (`HoverStore`) and the snap
 * marker (`Snap3DOverlayStore`) remain the result SSoTs.
 *
 * @module bim-3d/viewport/snap/bim3d-pointer-scheduler
 */

import { registerRenderCallback, RENDER_PRIORITIES } from '../../../rendering';
import { DXF_TIMING } from '../../../config/dxf-timing';
import { setHoveredEntity } from '../../../systems/hover/HoverStore';
import { toolStateStore } from '../../../stores/ToolStateStore';
import { usePolygonMode3DStore } from '../../stores/PolygonMode3DStore';
import { useSnap3DOverlayStore } from '../../stores/Snap3DOverlayStore';
import { applyBimHover } from '../../scene/scene-manager-actions';
import { getDxfFloorScope } from '../../scene/dxf-3d-floor-scope';
import { pickDxfEntityAcrossFloors } from '../../grips/dxf-wireframe-hit-test';
import { raycastBimHitAndWorld } from '../../systems/raycaster/BimEntityRaycaster';
import { ensureBoundsTrees } from '../../systems/raycaster/bvh-setup';
import { markPointerMoved, isPointerActive } from '../../systems/pointer-activity';
import { computeSnap3DHover } from './bim-3d-snap-hover';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';

/** Inputs for one pick pass — the manager + the latest cursor position (client px). */
export interface Bim3DPickInput {
  readonly manager: ThreeJsSceneManager;
  readonly clientX: number;
  readonly clientY: number;
}

// ── Module-level SSoT state (zero-React singleton, mirror snap-scheduler) ──
let latest: Bim3DPickInput | null = null;
let dirty = false;
let lastRunMs = 0;
let registered = false;
// 🚀 PERF (2026-06-28) — last resolved hover target (bimId | dxfId | null). The hover
// silhouette + `markSceneDirty` (a FULL WebGL re-render) must fire ONLY when this CHANGES,
// not on every 50ms pick. Re-rendering the whole scene every pick (even with an unchanged
// hover, e.g. over empty space) produced a periodic frame hitch → the crosshair «swam».
let lastHoverId: string | null = null;

/**
 * The heavy work — runs in the RAF slot, NEVER inside the mousemove handler.
 * Returns `true` when a hover-highlight refresh is PENDING (deferred because the cursor is
 * still sweeping) so the scheduler keeps ticking until the cursor settles — see `onPickFrame`.
 */
function runPick(input: Bim3DPickInput): boolean {
  const { manager, clientX, clientY } = input;
  const camera = manager.getCamera();
  const dom = manager.getRendererCanvas();
  if (!camera || !dom) return false;

  // ADR-366 §B.5 — suspend hover/snap picking WHILE NAVIGATING the camera (orbit/zoom/pan).
  // Big-player CAD practice (Revit/Cinema4D): no object snap during view navigation. This skips
  // the per-frame BVH raycast + O(N) snap search — the dominant main-thread cost during rotation,
  // which ALSO starved the crosshair's RAF/window-listener → «stepped»/«swim» (Giorgio 2026-06-28).
  // The snap glyph was already hidden visually by the camera-motion gate; here we drop the wasted
  // compute too and clear any lingering snap so navigation shows a clean crosshair.
  if (manager.isCameraInteracting()) {
    if (useSnap3DOverlayStore.getState().snap) useSnap3DOverlayStore.getState().setSnap(null);
    return false;
  }

  const group = manager.bimLayer.group;

  // ADR-539 Φ2 — Polygon Mode: hover drives the YELLOW per-face preview, not the entity
  // silhouette, and no snap glyph. Keep this its own raycast (face/material resolution).
  if (usePolygonMode3DStore.getState().active) {
    const faceHit = manager.raycastBimFace(clientX, clientY);
    manager.setHoveredFace(faceHit?.bimId ?? null, faceHit?.faceKey ?? null);
    useSnap3DOverlayStore.getState().setSnap(null);
    manager.markSceneDirty();
    return false;
  }

  // ADR-040 Φ-3D-pointer — ONE BVH-accelerated raycast feeds BOTH hover and snap.
  ensureBoundsTrees(group);
  const hit = raycastBimHitAndWorld(group, camera, dom, clientX, clientY);

  // ADR-538 — unified hover: BIM silhouette when a tagged entity is hit, else the raw-DXF glow.
  // Resolve the hover target first; only TOUCH the hover state + request a WebGL re-render when it
  // actually CHANGED (idle hover over the same entity / empty space ⇒ zero renders → no swim).
  const hoverId = hit?.bimId
    ?? pickDxfEntityAcrossFloors(getDxfFloorScope(), camera, dom, clientX, clientY)?.entityId
    ?? null;
  // ADR-366 §B.5 — REFINE-ON-SETTLE hover: the highlight swap is a FULL-scene WebGL re-render
  // (heavy at fullscreen on a weak GPU). While the cursor is still sweeping we DEFER it — we do
  // NOT advance `lastHoverId`, so when the cursor settles the change is still pending and gets
  // applied once. Big-player CAD (Revit/Cinema4D): the hover silhouette resolves on settle, not on
  // every entity the cursor flies over. The snap glyph below is a Canvas2D overlay (no WebGL
  // render) so it keeps updating live — snapping stays responsive while sweeping.
  //
  // COALESCE WITH SHADOW SETTLE (2026-06-28): the settle window is SHADOW_SETTLE (not the shorter
  // POINTER_SETTLE) so this deferred hover render fires at the SAME moment the adaptive shadows turn
  // back ON. Otherwise the scene rendered TWICE per settle — an unshadowed hover frame at
  // POINTER_SETTLE(100ms) THEN a shadowed frame at SHADOW_SETTLE(350ms). Aligning them collapses it
  // to ONE shadowed render with the hover already applied → halves settle work + removes the early
  // render that could block resumed motion during a slow exploratory sweep (the p95 ~75ms tail).
  let resettlePending = false;
  if (hoverId !== lastHoverId) {
    if (isPointerActive(performance.now(), DXF_TIMING.gesture.SHADOW_SETTLE)) {
      resettlePending = true; // keep ticking; apply once the cursor stops
    } else {
      lastHoverId = hoverId;
      setHoveredEntity(hoverId);
      applyBimHover(manager.hoverHighlighter, hit?.bimId ?? null);
      manager.markSceneDirty();
    }
  }

  // ADR-544 — while a placement tool (column/wall) owns the snap glyph, the hover-handler yields.
  const placing = toolStateStore.get().activeTool;
  if (placing === 'column' || placing === 'wall') return resettlePending;

  // ADR-542 — snap marker reuses the SAME world point from the unified raycast (no 2nd raycast).
  const snap = hit?.worldPoint
    ? computeSnap3DHover(group, camera, dom, clientX, clientY, hit.worldPoint)
    : null;
  useSnap3DOverlayStore.getState().setSnap(snap);
  return resettlePending;
}

/**
 * Frame callback registered ONCE with the UnifiedFrameScheduler. Runs only while `dirty`; applies
 * the `HOVER_HITTEST` throttle (same ~20fps cadence as the old inline pick) and keeps `dirty` set
 * when throttled so the scheduler retries next frame. Errors are swallowed — a pick must never
 * break the shared frame loop.
 */
function onPickFrame(): void {
  const input = latest;
  if (!input) { dirty = false; return; }
  const now = performance.now();
  if (now - lastRunMs < DXF_TIMING.frame.HOVER_HITTEST) return; // retry next frame
  lastRunMs = now;
  dirty = false;
  try {
    // A pending hover refresh (cursor still sweeping) keeps the slot armed so the scheduler
    // ticks until the cursor settles and the deferred highlight is applied exactly once.
    if (runPick(input)) dirty = true;
  } catch {
    useSnap3DOverlayStore.getState().setSnap(null);
  }
}

function ensureRegistered(): void {
  if (registered) return;
  registered = true;
  registerRenderCallback(
    'bim3d-pointer-pick',
    'BIM 3D Pointer Pick (decoupled — ADR-040 Φ-3D-pointer)',
    RENDER_PRIORITIES.NORMAL,
    onPickFrame,
    () => dirty,
  );
}

/**
 * Arm the scheduler with the latest cursor position. Called per move — cheap (store + flag); the
 * raycast/snap runs later in the RAF slot. Coalesces: only the latest armed state is computed.
 */
export function requestPointerPick(input: Bim3DPickInput): void {
  ensureRegistered();
  latest = input;
  dirty = true;
  // ADR-452 — flag active pointer motion so the section controller renders the cheap grey caps
  // while sweeping (refine-on-settle restores the coloured 'full' caps). Mirror of camera-motion.
  markPointerMoved(performance.now());
}

/** Stop the scheduler (cursor left the viewport / component unmount). Idempotent. */
export function clearPointerPick(): void {
  latest = null;
  dirty = false;
  // The leave handler clears the hover itself; reset so a re-entry re-applies it.
  lastHoverId = null;
}
