'use client';

/**
 * BimCrosshairOverlay3D — the CAD crosshair for the 3D BIM viewport (ADR-545).
 *
 * Full 2D parity: it mounts the SHARED `CrosshairCompositor` (one render code with the
 * 2D canvas — same arms/gap/colours/aperture and the «+/−» hover badge) and drives it
 * with the 3D-specific position + snap source:
 *
 *   - Follows the cursor (canvas-local px) on every move — zero-lag, like the 2D crosshair.
 *   - «Κουμπώνει» to the active snap point: each RAF frame (while a snap is published) it
 *     reprojects the stored plan-mm snap point through the LIVE camera (the SAME projector
 *     + depth-occluder + camera-motion gate the 3D snap marker uses), and the
 *     `resolveCrosshair3DCenter` SSoT decides snap-vs-cursor. The centre square hides while
 *     glued to a snap (ADR-515), exactly as in 2D.
 *
 * It subsumes the old `HoverAddBadge3D` (the badge now comes from the shared compositor —
 * one badge code path). ADR-040: zero high-frequency React state; the compositor is driven
 * imperatively through its ref, and the RAF runs only while a snap is active.
 */

import { useRef, useEffect, useSyncExternalStore, useCallback, type MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import type { Point2D } from '../../rendering/types/Types';
import { CrosshairCompositor, type CrosshairCompositorHandle } from '../../canvas-v2/overlays/CrosshairCompositor';
import { isSnapMarkerVisible } from '../../snapping/extended-types';
import { useRafWhile, useCameraMotionGate, useGripDepthOccluder } from './overlay-raf';
import { projectSnap3DMarker } from './snap/project-snap3d-marker';
import { useSnap3DOverlayStore } from '../stores/Snap3DOverlayStore';
import { resolveCrosshair3DCenter } from './crosshair-3d-center';
import { isPerfEnabled, recordSample, perfTick } from '../../systems/cursor/mouse-handler-perf';

export interface BimCrosshairOverlay3DProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

/** 3D has no rulers — the crosshair area is the whole canvas-local viewport. */
const NO_RULER_MARGINS = { left: 0, top: 0, bottom: 0 } as const;

/**
 * Dev-only cursor↔crosshair PHASE probe (Chrome INP / Event Timing method, ADR-040 Phase A
 * reuse). Measures — on the SAME event that drives the crosshair — the lag between the
 * OS-stamped pointer move and its delivery + paint, so the phase difference is MEASURED, not
 * guessed. Samples land in the shared `mouse-handler-perf` report (toggle `dxf-perf-trace`):
 *
 *   - cursor.inputLatency = now − e.timeStamp        → event-queue wait. Large ⇒ the main
 *       thread is busy (heavy render) and BOTH mouse + crosshair lag together (render-bound).
 *       ~0 while the crosshair still lags ⇒ the crosshair's own update path is at fault.
 *   - cursor.totalLag     = paint(rAF) − e.timeStamp → OS → painted crosshair (whole chain).
 *
 * `getCoalescedEvents()` (the "swim" count) lives only on PointerEvent, so it rides a separate
 * gated `pointermove` probe below. Caller guards with `isPerfEnabled()` ⇒ no-op in production.
 */
function probeCursorLag(e: MouseEvent): void {
  const stamp = e.timeStamp;
  recordSample('cursor.inputLatency', performance.now() - stamp);
  requestAnimationFrame(() => {
    recordSample('cursor.totalLag', performance.now() - stamp);
    perfTick();
  });
}

export function BimCrosshairOverlay3D({ managerRef }: BimCrosshairOverlay3DProps) {
  const handleRef = useRef<CrosshairCompositorHandle>(null);
  // Last cursor position in canvas-local px (raw mouse), shared by the move handler + RAF.
  const cursorRef = useRef<Point2D | null>(null);
  // Cached canvas client rect. `getBoundingClientRect()` is a LAYOUT READ; calling it on EVERY
  // mousemove (as `toCanvasLocal` used to) forces a synchronous reflow each frame (~30-40ms,
  // browser-verified) because the crosshair's own DOM writes dirty layout first → the cursor
  // «swims». We compute it ONCE and reuse it, invalidating only on resize/scroll (below).
  const rectRef = useRef<DOMRect | null>(null);
  // ADR-545 — true ONLY while the RAF currently has the centre glued to a live, projected snap
  // point. Distinct from `snapActive` (a snap is merely PUBLISHED): a snap can be published yet
  // not a valid jump target this frame (occluded / off-screen / camera moving) → the crosshair
  // must still track the cursor 1:1. The move handler reads this (not `snapActive`) so it only
  // yields to the RAF when the centre is ACTUALLY magnetised. Non-reactive (ADR-040, zero React).
  const gluedRef = useRef(false);
  // GPU depth-occluder via το shared lifecycle SSoT (overlay-raf, ADR-544 dedup) — same as grips.
  const occluderRef = useGripDepthOccluder();
  // Hide the snap glue during camera motion (shared SSoT with BimSnapIndicatorOverlay3D).
  const isCameraMoving = useCameraMotionGate();

  // ADR-040 — subscribe ONLY to the on/off boolean (snap present + visual). The crosshair reads
  // nothing else from the marker reactively: its centre position is owned by the RAF, so a marker
  // whose position/type changes mid-hover must NOT re-render here. `Object.is` on the boolean
  // snapshot ⇒ a re-render only on the off→on / on→off transition.
  const snapActive = useSyncExternalStore(
    useSnap3DOverlayStore.subscribe,
    () => isSnapMarkerVisible(useSnap3DOverlayStore.getState().snap?.view ?? null),
    () => false,
  );

  /**
   * Convert client px → canvas-local px (same base as the snap projector's rebase). Reads the
   * CACHED canvas rect — computed lazily once (the canvas may not exist at mount: the parent sets
   * `managerRef` in a later effect) and reused on every move, so the hot path does ZERO layout
   * reads. The cache is invalidated on resize/scroll by the effect below.
   */
  const toCanvasLocal = useCallback((clientX: number, clientY: number): Point2D | null => {
    let rect = rectRef.current;
    if (!rect) {
      const canvas = managerRef.current?.getRendererCanvas();
      if (!canvas) return null;
      rect = canvas.getBoundingClientRect();
      rectRef.current = rect;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, [managerRef]);

  // Invalidate the cached canvas rect ONLY when layout can actually change (resize / scroll on any
  // ancestor / the canvas itself resizing) — never per mousemove. `toCanvasLocal` then recomputes
  // it lazily on the next move. This removes the per-move `getBoundingClientRect` forced reflow
  // (the «swim» root). The ResizeObserver attaches once the canvas exists (rAF retry — the parent
  // creates the SceneManager in an effect that runs AFTER this child's effects). ADR-040.
  useEffect(() => {
    const invalidate = (): void => { rectRef.current = null; };
    window.addEventListener('resize', invalidate);
    window.addEventListener('scroll', invalidate, true);
    let ro: ResizeObserver | null = null;
    let raf = 0;
    const attach = (): void => {
      const canvas = managerRef.current?.getRendererCanvas();
      if (canvas) {
        ro = new ResizeObserver(invalidate);
        ro.observe(canvas);
      } else {
        raf = requestAnimationFrame(attach);
      }
    };
    attach();
    return () => {
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('scroll', invalidate, true);
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [managerRef]);

  // Cursor follow — the compositor is pointer-events:none, so we read the raw mouse.
  // ⚠️ CAPTURE phase (3rd arg `true`): the 3D viewport's `handleMouseMove` calls
  // `e.stopPropagation()` on the root div, which kills BUBBLE-phase window listeners
  // (the native event never reaches `window` in bubble). The capture phase runs BEFORE
  // that stopPropagation, so the cursor is always updated — over BIM, over raw DXF, and
  // over the empty 3D canvas alike (previously the crosshair only appeared over BIM,
  // because only BIM produced a snap → the RAF path; the cursor path was dead).
  // 1:1 CURSOR TRACKING (CAD-grade): apply the move SYNCHRONOUSLY on every event so the crosshair
  // is painted with the mouse, never a frame behind. We yield to the RAF ONLY while the centre is
  // ACTUALLY glued to a snap (`gluedRef`) — then the RAF keeps it pinned to the snap point instead
  // of it being yanked back to the raw cursor each move. Gating on `gluedRef` (not `snapActive`)
  // means hovering over geometry whose snap is momentarily not a valid jump target still tracks 1:1.
  // The listener is bound once (stable `toCanvasLocal`); it reads `gluedRef.current` live.
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      cursorRef.current = toCanvasLocal(e.clientX, e.clientY);
      if (!gluedRef.current) handleRef.current?.applyTransform(cursorRef.current);
      if (isPerfEnabled()) probeCursorLag(e);
    };
    window.addEventListener('mousemove', onMove, true);
    return () => window.removeEventListener('mousemove', onMove, true);
  }, [toCanvasLocal]);

  // Dev-only coalesced-events probe (the "swim" count). `getCoalescedEvents()` exists only on
  // PointerEvent, never on the mousemove that drives the crosshair — so it rides its own gated
  // capture-phase listener and feeds the SAME perf report. No-op in production.
  useEffect(() => {
    const onPointer = (e: PointerEvent): void => {
      if (!isPerfEnabled()) return;
      recordSample('cursor.coalesced', e.getCoalescedEvents().length);
    };
    window.addEventListener('pointermove', onPointer, true);
    return () => window.removeEventListener('pointermove', onPointer, true);
  }, []);

  // One frame while a snap is active: reproject the stored plan point through the live camera,
  // occlusion-cull + camera-gate, then let the SSoT pick snap-vs-cursor and apply it.
  const draw = useCallback(() => {
    const manager = managerRef.current;
    const camera = manager?.getCamera();
    const cur = useSnap3DOverlayStore.getState().snap;
    if (!manager || !camera || !cur) return;

    // ADR-545 — ONE projection SSoT shared with the snap-indicator glyph: the snap is a valid
    // «jump» target only when it is visible (on-screen, camera settled, not occluded).
    const screen = projectSnap3DMarker(manager, cur, isCameraMoving(camera), occluderRef.current);
    const snapProjected = screen && screen.visible ? screen.point : null;

    const { point, snapped } = resolveCrosshair3DCenter({ cursor: cursorRef.current, snapProjected });
    gluedRef.current = snapped; // tell the move handler whether the centre is magnetised this frame
    handleRef.current?.setSnapActive(snapped);
    handleRef.current?.applyTransform(point);
  }, [managerRef, isCameraMoving]);

  // When the snap clears, release the glue + drop the centre square and fall back to cursor follow.
  const onStop = useCallback(() => {
    gluedRef.current = false;
    handleRef.current?.setSnapActive(false);
    handleRef.current?.applyTransform(cursorRef.current);
  }, []);
  useRafWhile(snapActive, draw, onStop);

  return (
    <CrosshairCompositor
      ref={handleRef}
      rulerMargins={NO_RULER_MARGINS}
      className="absolute inset-0 pointer-events-none"
    />
  );
}
