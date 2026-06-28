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

export interface BimCrosshairOverlay3DProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

/** 3D has no rulers — the crosshair area is the whole canvas-local viewport. */
const NO_RULER_MARGINS = { left: 0, top: 0, bottom: 0 } as const;

export function BimCrosshairOverlay3D({ managerRef }: BimCrosshairOverlay3DProps) {
  const handleRef = useRef<CrosshairCompositorHandle>(null);
  // Last cursor position in canvas-local px (raw mouse), shared by the move handler + RAF.
  const cursorRef = useRef<Point2D | null>(null);
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

  /** Convert client px → canvas-local px (same base as the snap projector's rebase). */
  const toCanvasLocal = useCallback((clientX: number, clientY: number): Point2D | null => {
    const canvas = managerRef.current?.getRendererCanvas();
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, [managerRef]);

  // Cursor follow — the compositor is pointer-events:none, so we read the raw mouse.
  // ⚠️ CAPTURE phase (3rd arg `true`): the 3D viewport's `handleMouseMove` calls
  // `e.stopPropagation()` on the root div, which kills BUBBLE-phase window listeners
  // (the native event never reaches `window` in bubble). The capture phase runs BEFORE
  // that stopPropagation, so the cursor is always updated — over BIM, over raw DXF, and
  // over the empty 3D canvas alike (previously the crosshair only appeared over BIM,
  // because only BIM produced a snap → the RAF path; the cursor path was dead).
  // While a snap is glued the RAF owns the centre, so the move handler only drives the
  // cursor case to avoid fighting the RAF.
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      cursorRef.current = toCanvasLocal(e.clientX, e.clientY);
      if (!snapActive) handleRef.current?.applyTransform(cursorRef.current);
    };
    window.addEventListener('mousemove', onMove, true);
    return () => window.removeEventListener('mousemove', onMove, true);
  }, [toCanvasLocal, snapActive]);

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
    handleRef.current?.setSnapActive(snapped);
    handleRef.current?.applyTransform(point);
  }, [managerRef, isCameraMoving]);

  // When the snap clears, drop the centre square and fall back to cursor follow.
  const onStop = useCallback(() => {
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
