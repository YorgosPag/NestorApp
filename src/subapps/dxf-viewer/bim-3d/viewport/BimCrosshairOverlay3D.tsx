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
import { sizeCanvasToContainerDpr } from '../../rendering/canvas/withCanvasState'; // 🔬 ADR-549 red A/B reference

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
  // 🔬🔴 ADR-549 — TEMPORARY red A/B reference crosshair (UNCOMMITTED, REVERTIBLE). Drawn SYNCHRONOUSLY
  // στο ίδιο onMove με το λευκό (πλέον canvas-based, Phase 6). Σκοπός verification: το λευκό πρέπει να
  // ακολουθεί ΑΚΡΙΒΩΣ το κόκκινο· αν συμπίπτουν → ο shared compositor δεν προσθέτει latency. Αφαίρεσέ
  // το όταν κλείσουν οι έλεγχοι: αυτό το ref + το draw block στον onMove + το import + το <canvas>.
  const expCanvasRef = useRef<HTMLCanvasElement>(null);
  // Last cursor position in canvas-local px (raw mouse), shared by the move handler + RAF.
  const cursorRef = useRef<Point2D | null>(null);
  // Cached canvas client rect. `getBoundingClientRect()` is a LAYOUT READ; calling it on EVERY
  // mousemove (as `toCanvasLocal` used to) forces a synchronous reflow each frame (~30-40ms,
  // browser-verified) because the crosshair's own DOM writes dirty layout first → the cursor
  // «swims». We compute it ONCE and reuse it, invalidating only on resize/scroll (below).
  const rectRef = useRef<DOMRect | null>(null);
  // ADR-549 §2.2 — last VALID projected snap point in canvas-local px (or null when there is no
  // valid jump target this frame: no snap / occluded / off-screen / camera moving). The RAF
  // (`draw`) keeps it fresh by reprojecting through the live camera; the SYNCHRONOUS move handler
  // consumes it to glue the centre WITHOUT re-projecting on the hot path (no GPU depth readback on
  // mousemove). Non-reactive (ADR-040, zero React state).
  const snapProjectedRef = useRef<Point2D | null>(null);
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
  // 1:1 CURSOR TRACKING + SYNC SNAP-GLUE (CAD-grade, ADR-549 §2.2): resolve snap-vs-cursor AND
  // apply the transform SYNCHRONOUSLY on every event, so the crosshair is painted with the mouse,
  // never a frame behind — for BOTH the free cursor AND the snap glue. The handler reads the last
  // projected snap point (`snapProjectedRef`, kept fresh by the RAF) and the pure
  // `resolveCrosshair3DCenter` SSoT picks snap-vs-cursor; the heavy projection (camera + GPU depth
  // readback) stays in the RAF, off this hot path. Previously, while glued the handler yielded
  // ENTIRELY to the RAF, so the centre advanced only at RAF cadence → one extra frame of lag on
  // every BIM snap-hover (the measured BIM > DXF gap). Now the BIM crosshair tracks like the DXF one.
  // The listener is bound once (stable `toCanvasLocal`); it reads the refs live.
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      const cursor = toCanvasLocal(e.clientX, e.clientY);
      cursorRef.current = cursor;
      const { point, snapped } = resolveCrosshair3DCenter({ cursor, snapProjected: snapProjectedRef.current });
      handleRef.current?.setSnapActive(snapped);
      handleRef.current?.applyTransform(point);
      // 🔬🔴 ADR-549 — red A/B reference: full-viewport κόκκινο σταυρόνημα, σύγχρονο, desynchronized.
      const expCanvas = expCanvasRef.current;
      if (expCanvas && point) {
        const ctx = sizeCanvasToContainerDpr(expCanvas, expCanvas, true);
        if (ctx) {
          const w = expCanvas.clientWidth;
          const h = expCanvas.clientHeight;
          ctx.strokeStyle = '#ff2d2d';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(point.x + 0.5, 0); ctx.lineTo(point.x + 0.5, h);
          ctx.moveTo(0, point.y + 0.5); ctx.lineTo(w, point.y + 0.5);
          ctx.stroke();
        }
      }
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
    if (!manager || !camera || !cur) { snapProjectedRef.current = null; return; }

    // ADR-545 — ONE projection SSoT shared with the snap-indicator glyph: the snap is a valid
    // «jump» target only when it is visible (on-screen, camera settled, not occluded). ADR-549
    // §2.2 — cache the result in `snapProjectedRef` so the synchronous move handler glues without
    // re-projecting; the RAF still owns re-projection while the camera moves (the only time a
    // still cursor's snap point shifts on screen).
    const screen = projectSnap3DMarker(manager, cur, isCameraMoving(camera), occluderRef.current);
    const snapProjected = screen && screen.visible ? screen.point : null;
    snapProjectedRef.current = snapProjected;

    const { point, snapped } = resolveCrosshair3DCenter({ cursor: cursorRef.current, snapProjected });
    handleRef.current?.setSnapActive(snapped);
    handleRef.current?.applyTransform(point);
  }, [managerRef, isCameraMoving]);

  // When the snap clears, release the glue + drop the centre square and fall back to cursor follow.
  const onStop = useCallback(() => {
    snapProjectedRef.current = null; // ADR-549 §2.2 — release the cached snap; the move handler now tracks the cursor
    handleRef.current?.setSnapActive(false);
    handleRef.current?.applyTransform(cursorRef.current);
  }, []);
  useRafWhile(snapActive, draw, onStop, 'crosshair'); // 🔬 ADR-549 Phase 0

  return (
    <>
      <CrosshairCompositor
        ref={handleRef}
        rulerMargins={NO_RULER_MARGINS}
        className="absolute inset-0 pointer-events-none"
      />
      {/* 🔬🔴 ADR-549 — TEMPORARY red A/B reference crosshair. Αφαίρεσε όταν κλείσουν οι έλεγχοι. */}
      <canvas
        ref={expCanvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full pointer-events-none z-[9999]"
      />
    </>
  );
}
