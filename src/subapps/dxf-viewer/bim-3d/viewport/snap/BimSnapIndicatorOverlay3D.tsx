'use client';

/**
 * BimSnapIndicatorOverlay3D — draws the snap marker in the 3D viewport with the EXACT 2D
 * glyph + label (ADR-542). Mirror of `DxfHoverGlowOverlay2D` / `BimGripOverlay2D`: a
 * `pointer-events-none` layer over the WebGL viewport that, each RAF frame, reads the LIVE
 * camera and projects the stored snap point (plan mm at its surface elevation) to screen px.
 *
 * The visual is the shared `SnapIndicatorGlyph` (one render code with the 2D canvas — same
 * ┘/▲/⊕ glyph, same «Γωνία/Μέσο κολώνας» label, same colour). The glyph re-renders (React)
 * only when the snap IDENTITY changes (type/description); its per-frame screen position is
 * applied imperatively to a wrapper `transform` (ADR-040: zero high-frequency React state),
 * so it tracks the camera at 60fps without re-rendering.
 *
 * Occlusion (Giorgio «μόνο μπροστινά»): the SAME GPU depth-occluder the 3D grips use
 * (`GripDepthOccluder`) culls a marker that sits behind a solid surface — one occlusion SSoT.
 * During camera motion the marker hides and snaps back (correctly occluded) on settle, mirror
 * of the grip overlay's «hide handles during navigation» pattern.
 */

import { useRef, useEffect, useSyncExternalStore, useCallback, type MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';
import { SnapIndicatorGlyph } from '../../../canvas-v2/overlays/SnapIndicatorGlyph';
import { isSnapMarkerVisible } from '../../../snapping/extended-types';
import { makeGripPlanToCanvas, GRIP_OFFSCREEN } from '../../grips/grip-3d-screen-project';
import { GripDepthOccluder } from '../../grips/grip-3d-depth-occluder';
import { dxfPlanToWorld } from '../coordinate-transforms';
import { useRafWhile, useCameraMotionGate } from '../overlay-raf';
import { useSnap3DOverlayStore } from '../../stores/Snap3DOverlayStore';

export interface BimSnapIndicatorOverlay3DProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

/** The glyph lays out around (0,0); the wrapper `transform` supplies the real screen position. */
const ORIGIN = { x: 0, y: 0 } as const;

export function BimSnapIndicatorOverlay3D({ managerRef }: BimSnapIndicatorOverlay3DProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  // GPU depth-occluder (one instance, lazy GL resources, disposed on unmount) — same as grips.
  const occluderRef = useRef<GripDepthOccluder | null>(null);
  // Hide the marker during camera motion (shared SSoT with BimGripOverlay2D).
  const isCameraMoving = useCameraMotionGate();

  // ADR-040 — subscribe ONLY to the low-frequency snap marker (drives the RAF on/off + glyph).
  const snap = useSyncExternalStore(
    useSnap3DOverlayStore.subscribe,
    () => useSnap3DOverlayStore.getState().snap,
    () => null,
  );
  const active = snap !== null && isSnapMarkerVisible(snap.view);

  // One frame: project the stored plan point through the live camera, occlusion-cull, and
  // position the marker imperatively. Reads the store fresh each call (no deps).
  const draw = useCallback(() => {
    const wrapper = wrapperRef.current;
    const manager = managerRef.current;
    if (!wrapper || !manager) return;
    const camera = manager.getCamera();
    const canvas = manager.getRendererCanvas();
    const cur = useSnap3DOverlayStore.getState().snap;
    if (!camera || !canvas || !cur) { wrapper.style.display = 'none'; return; }

    // Hide while the camera moves (orbit/zoom/pan) → reappears, correctly occluded, on settle.
    if (isCameraMoving(camera)) { wrapper.style.display = 'none'; return; }

    // Project plan→canvas-local px via the SAME projector the grips use (one projection SSoT).
    const project = makeGripPlanToCanvas(camera, canvas, () => cur.elevMm);
    const p = project(cur.view.point);
    if (p === GRIP_OFFSCREEN) { wrapper.style.display = 'none'; return; }

    // Occlusion (μόνο μπροστινά): cull a marker behind a solid surface — same GPU SSoT as grips.
    const occluder = occluderRef.current;
    if (occluder) {
      const world = dxfPlanToWorld(cur.view.point.x, cur.view.point.y, cur.elevMm);
      const vis = occluder.computeVisibility(manager.renderer, manager.scene, camera, [world]);
      if (vis && vis[0] === false) { wrapper.style.display = 'none'; return; }
    }

    wrapper.style.display = '';
    wrapper.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }, [managerRef, isCameraMoving]);

  // Own the GPU occluder for the overlay's lifetime (lazy GL resources inside).
  useEffect(() => {
    occluderRef.current = new GripDepthOccluder();
    return () => {
      occluderRef.current?.dispose();
      occluderRef.current = null;
    };
  }, []);

  // Hide the marker when the snap clears / on unmount (shared overlay RAF SSoT).
  const onStop = useCallback(() => {
    if (wrapperRef.current) wrapperRef.current.style.display = 'none';
  }, []);
  useRafWhile(active, draw, onStop);

  if (!active || !snap) return null;
  return (
    <div
      ref={wrapperRef}
      className="pointer-events-none absolute left-0 top-0"
      style={{ display: 'none', willChange: 'transform' }}
      aria-hidden="true"
    >
      <SnapIndicatorGlyph screenPos={ORIGIN} type={snap.view.type} description={snap.view.description} />
    </div>
  );
}
