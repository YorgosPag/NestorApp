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

import { useRef, useSyncExternalStore, useCallback, type MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';
import { SnapIndicatorGlyph } from '../../../canvas-v2/overlays/SnapIndicatorGlyph';
import { useRafWhile, useCameraMotionGate, useGripDepthOccluder } from '../overlay-raf';
import { projectSnap3DMarker } from './project-snap3d-marker';
import { useSnap3DOverlayStore } from '../../stores/Snap3DOverlayStore';
import { snapGlyphKey, parseSnapGlyphKey } from './snap-3d-glyph-key';

export interface BimSnapIndicatorOverlay3DProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

/** The glyph lays out around (0,0); the wrapper `transform` supplies the real screen position. */
const ORIGIN = { x: 0, y: 0 } as const;

export function BimSnapIndicatorOverlay3D({ managerRef }: BimSnapIndicatorOverlay3DProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  // GPU depth-occluder via το shared lifecycle SSoT (overlay-raf, ADR-544 dedup) — same as grips.
  const occluderRef = useGripDepthOccluder();
  // Hide the marker during camera motion (shared SSoT with BimGripOverlay2D).
  const isCameraMoving = useCameraMotionGate();

  // ADR-040 — subscribe ONLY to the glyph IDENTITY (type + description, or null when nothing to
  // draw). The marker's plan position/elevation are applied imperatively in the RAF, so a
  // position-only change (e.g. nearest-on-edge slide) keeps the SAME key ⇒ zero re-render.
  const glyphKey = useSyncExternalStore(
    useSnap3DOverlayStore.subscribe,
    () => snapGlyphKey(useSnap3DOverlayStore.getState().snap),
    () => null,
  );
  const active = glyphKey !== null;

  // One frame: project the stored snap marker via the shared SSoT (project + occlusion-cull +
  // camera-gate), and position the glyph imperatively. Reads the store fresh each call (no deps).
  const draw = useCallback(() => {
    const wrapper = wrapperRef.current;
    const manager = managerRef.current;
    if (!wrapper || !manager) return;
    const camera = manager.getCamera();
    const cur = useSnap3DOverlayStore.getState().snap;
    if (!camera || !cur) { wrapper.style.display = 'none'; return; }

    // ADR-545 — ONE projection SSoT shared with the 3D crosshair (off-screen + occlusion +
    // camera-motion all decided in `projectSnap3DMarker`).
    const screen = projectSnap3DMarker(manager, cur, isCameraMoving(camera), occluderRef.current);
    if (!screen || !screen.visible) { wrapper.style.display = 'none'; return; }

    wrapper.style.display = '';
    wrapper.style.transform = `translate(${screen.point.x}px, ${screen.point.y}px)`;
  }, [managerRef, isCameraMoving]);

  // Hide the marker when the snap clears / on unmount (shared overlay RAF SSoT).
  const onStop = useCallback(() => {
    if (wrapperRef.current) wrapperRef.current.style.display = 'none';
  }, []);
  useRafWhile(active, draw, onStop, 'snap-indicator'); // 🔬 ADR-549 Phase 0

  if (glyphKey === null) return null;
  // Recover the glyph fields from the subscribed key (no store read during render → tearing-safe).
  const { type, description } = parseSnapGlyphKey(glyphKey);
  return (
    <div
      ref={wrapperRef}
      className="pointer-events-none absolute left-0 top-0"
      style={{ display: 'none', willChange: 'transform' }}
      aria-hidden="true"
    >
      <SnapIndicatorGlyph screenPos={ORIGIN} type={type} description={description} />
    </div>
  );
}
