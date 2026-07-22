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
 * `BIM3D_HOVER_PICK` window, coalescing intermediate moves. The pick is UNIFIED: ONE BVH-accelerated
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
import { markPointerMoved } from '../../systems/pointer-activity';
import { computeSnap3DHover } from './bim-3d-snap-hover';
// ADR-366 §B.2.Q1 follow-up — live X/Y/Z status-bar readout, fed from THIS pick's hit world point.
import { updateBim3DCursorReadout } from '../bim3d-cursor-readout-writer';
import { recordOverlayDraw } from '../../scene/bim3d-perf-diag'; // 🔬 ADR-549 Phase 0.3 (revertible)
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
// 🚀 PERF (2026-06-28) — last resolved UNIFIED hover id (bimId | dxfId | null). Drives the DXF
// glow (a Canvas2D overlay, NO WebGL render) so it updates LIVE every pick — like the snap glyph.
let lastHoverId: string | null = null;
// 🚀 PERF (ADR-549 Φ2, 2026-06-29) — last BIM silhouette target (bimId | null). The silhouette
// (`applyBimHover` + `markSceneDirty`) is a FULL WebGL re-render, so it fires ONLY when THIS
// changes AND the cursor has settled (refine-on-settle). Kept SEPARATE from `lastHoverId` so the
// cheap glow can track live while the heavy silhouette defers — otherwise a stale glow stuck on the
// old entity during a sweep kept the overlay RAF running per-frame → the cursor lagged.
let lastBimHoverId: string | null = null;

/**
 * The heavy work — runs in the RAF slot, NEVER inside the mousemove handler.
 * Always returns `false`: with the LIVE silhouette (Giorgio 2026-07-22 «Β») each pick paints
 * immediately, so there is no deferred refresh to keep the scheduler ticking. The boolean is
 * kept so `onPickFrame` can re-arm if a future refine-on-settle mode returns.
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
  const tRay = performance.now(); // 🔬 ADR-549 Phase 0.3
  ensureBoundsTrees(group);
  const hit = raycastBimHitAndWorld(group, camera, dom, clientX, clientY);
  recordOverlayDraw('pick:raycast', performance.now() - tRay); // 🔬

  // ADR-366 §B.2.Q1 follow-up — feed the status-bar X/Y/Z readout from THIS unified raycast:
  // the geometry hit point (Z = real surface height) when over an element, else the active-floor
  // plane (Z = floor elevation). Reuses `hit.worldPoint` — no second raycast.
  updateBim3DCursorReadout(manager, clientX, clientY, hit?.worldPoint ?? null);

  // ADR-680 — «Μέτρηση» (dist): ΚΑΝΕΝΑ hover silhouette/DXF glow (Giorgio 2026-07-22): στη μέτρηση
  // θέλουμε καθαρή εικόνα με ΜΟΝΟ τα διακριτά snap σημεία-γωνίες — όχι κίτρινο περίγραμμα σε όλο το
  // μήκος της ακμής της οντότητας. Το snap glyph το κατέχει αποκλειστικά ο dist hook (yield παρακάτω).
  const placing = toolStateStore.get().activeTool;
  const distActive = placing === 'dist';

  // ADR-538 — unified hover: BIM silhouette when a tagged entity is hit, else the raw-DXF glow.
  const tDxf = performance.now(); // 🔬 ADR-549 Phase 0.3 (DXF wireframe pick only runs on a BIM miss)
  const hoverId = distActive ? null : (hit?.bimId
    ?? pickDxfEntityAcrossFloors(getDxfFloorScope(), camera, dom, clientX, clientY)?.entityId
    ?? null);
  recordOverlayDraw('pick:dxf-resolve', performance.now() - tDxf); // 🔬
  const bimHoverId = distActive ? null : (hit?.bimId ?? null);

  // ADR-549 Φ2 (2026-06-29) — DECOUPLE the cheap hover id from the heavy silhouette. The unified
  // hover id drives the DXF glow, which is a Canvas2D overlay (NO WebGL render) → like the snap
  // glyph it updates LIVE on every pick. The OLD refine-on-settle lumped this with the WebGL
  // re-render and deferred BOTH while sweeping, so the glow stuck on a stale entity and the
  // overlay's RAF kept drawing per-frame → the cursor lagged until the cursor stopped (Giorgio).
  if (hoverId !== lastHoverId) {
    lastHoverId = hoverId;
    setHoveredEntity(hoverId);
  }

  // LIVE BIM SILHOUETTE (Giorgio 2026-07-22, «Β» — αντικαθιστά το refine-on-settle των ADR-549 Φ2 /
  // ADR-366 §B.5): the hover silhouette now paints IMMEDIATELY on every hover-id change — no 350ms
  // SHADOW_SETTLE wait, so το κίτρινο περίγραμμα ανάβει ακαριαία. `applyBimHover` + `markSceneDirty`
  // are a FULL-scene WebGL re-render, but the scheduler's BIM3D_HOVER_PICK throttle (16ms / 60fps)
  // caps it to the RAF cadence even during a fast sweep. Trades the old «coalesce with shadow-on»
  // single settle frame for instant response. (Pure-DXF hover keeps `bimHoverId` null → no WebGL
  // re-render; the glow is Canvas2D and already live.) REVERTIBLE: restore the refine-on-settle
  // block + `isPointerActive(now, SHADOW_SETTLE)` gate for option «Α» (dedicated short settle).
  if (bimHoverId !== lastBimHoverId) {
    lastBimHoverId = bimHoverId;
    applyBimHover(manager.hoverHighlighter, bimHoverId);
    manager.markSceneDirty();
  }

  // ADR-544 — while a placement/measure tool owns the snap glyph, the hover-handler yields. ADR-680:
  // `dist` (3D «Μέτρηση») is the sole snap-glyph owner while active — its hook raycasts the DXF
  // FLOOR plane too (not just the BIM group), so it snaps to DXF endpoint/midpoint on the plan
  // underlay, which THIS BIM-only raycast would miss (→ null clobbering the correct floor snap).
  if (placing === 'column' || placing === 'wall' || placing === 'dist') return false;

  // ADR-542 — snap marker reuses the SAME world point from the unified raycast (no 2nd raycast).
  const tSnap = performance.now(); // 🔬 ADR-549 Phase 0.3
  const snap = hit?.worldPoint
    ? computeSnap3DHover(group, camera, dom, clientX, clientY, hit.worldPoint)
    : null;
  recordOverlayDraw('pick:snap', performance.now() - tSnap); // 🔬
  useSnap3DOverlayStore.getState().setSnap(snap);
  return false;
}

/**
 * Frame callback registered ONCE with the UnifiedFrameScheduler. Runs only while `dirty`; applies
 * the `BIM3D_HOVER_PICK` throttle (60fps — follows the refresh rate for instant hover) and keeps
 * `dirty` set when throttled so the scheduler retries next frame. Errors are swallowed — a pick must
 * never break the shared frame loop.
 */
function onPickFrame(): void {
  const input = latest;
  if (!input) { dirty = false; return; }
  const now = performance.now();
  if (now - lastRunMs < DXF_TIMING.frame.BIM3D_HOVER_PICK) return; // retry next frame
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
  lastBimHoverId = null;
}
