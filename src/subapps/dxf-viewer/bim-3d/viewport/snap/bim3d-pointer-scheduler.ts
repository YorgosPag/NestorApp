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

/** The heavy work — runs in the RAF slot, NEVER inside the mousemove handler. */
function runPick(input: Bim3DPickInput): void {
  const { manager, clientX, clientY } = input;
  const camera = manager.getCamera();
  const dom = manager.getRendererCanvas();
  if (!camera || !dom) return;
  const group = manager.bimLayer.group;

  // ADR-539 Φ2 — Polygon Mode: hover drives the YELLOW per-face preview, not the entity
  // silhouette, and no snap glyph. Keep this its own raycast (face/material resolution).
  if (usePolygonMode3DStore.getState().active) {
    const faceHit = manager.raycastBimFace(clientX, clientY);
    manager.setHoveredFace(faceHit?.bimId ?? null, faceHit?.faceKey ?? null);
    useSnap3DOverlayStore.getState().setSnap(null);
    manager.markSceneDirty();
    return;
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
  if (hoverId !== lastHoverId) {
    lastHoverId = hoverId;
    setHoveredEntity(hoverId);
    applyBimHover(manager.hoverHighlighter, hit?.bimId ?? null);
    manager.markSceneDirty();
  }

  // ADR-544 — while a placement tool (column/wall) owns the snap glyph, the hover-handler yields.
  const placing = toolStateStore.get().activeTool;
  if (placing === 'column' || placing === 'wall') return;

  // ADR-542 — snap marker reuses the SAME world point from the unified raycast (no 2nd raycast).
  const snap = hit?.worldPoint
    ? computeSnap3DHover(group, camera, dom, clientX, clientY, hit.worldPoint)
    : null;
  useSnap3DOverlayStore.getState().setSnap(snap);
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
    runPick(input);
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
}

/** Stop the scheduler (cursor left the viewport / component unmount). Idempotent. */
export function clearPointerPick(): void {
  latest = null;
  dirty = false;
  // The leave handler clears the hover itself; reset so a re-entry re-applies it.
  lastHoverId = null;
}
