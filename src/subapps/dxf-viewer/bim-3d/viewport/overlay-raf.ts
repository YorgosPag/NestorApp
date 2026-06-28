'use client';

/**
 * overlay-raf — shared SSoT for the 3D Canvas2D/DOM overlay lifecycle (ADR-542).
 *
 * Every "draw the 2D thing over the WebGL viewport each frame" overlay (`BimGripOverlay2D`,
 * `DxfHoverGlowOverlay2D`, `BimSnapIndicatorOverlay3D`, `BimCrosshairOverlay3D`,
 * `BimPlacementOverlay2D`) shared the SAME boilerplate verbatim. It now lives here, in one place:
 *
 *   - `useRafWhile(active, draw, onStop?)` — run `draw` in a `requestAnimationFrame` loop while
 *     `active`, cancel when it turns false / on unmount, and call `onStop` on deactivation
 *     (e.g. clear the canvas / hide the marker).
 *   - `useCameraMotionGate()` — returns `isMoving(camera)`: true when the camera pose changed
 *     since the previous frame (orbit/zoom/pan), so an overlay can HIDE its handles during
 *     navigation and snap them back on settle (the big-player CAD pattern). It updates its
 *     stored pose each call, so it must be called exactly once per frame inside `draw`.
 *
 * Pure React hooks + Three.js — no store, no scene mutation.
 */

import { useRef, useEffect, useCallback, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { GripDepthOccluder } from '../grips/grip-3d-depth-occluder';
import { recordOverlayDraw } from '../scene/bim3d-perf-diag'; // 🔬 ADR-549 Phase 0 (revertible)

/**
 * Drive `draw` on every animation frame while `active`. Cancels the loop when `active` turns
 * false or on unmount; `onStop` (if given) runs on deactivation for cleanup (clear canvas /
 * hide marker). `draw` and `onStop` should be stable (`useCallback`) — they are effect deps.
 */
export function useRafWhile(active: boolean, draw: () => void, onStop?: () => void, diagLabel?: string): void {
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!active) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      onStop?.();
      return;
    }
    const loop = () => {
      // 🔬 ADR-549 Phase 0 (REVERTIBLE) — time each overlay's per-frame draw, keyed by label, so we
      // can see which of the 7 private rAF loops is the long task (these live OUTSIDE the scheduler).
      if (diagLabel) {
        const t0 = performance.now();
        draw();
        recordOverlayDraw(diagLabel, performance.now() - t0);
      } else {
        draw();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active, draw, onStop, diagLabel]);
}

/**
 * Own a GPU depth-occluder for an overlay's lifetime (lazy GL resources inside, disposed on
 * unmount). SSoT — ΟΛΑ τα Canvas2D-over-WebGL overlays (grips ADR-535, snap ADR-542, crosshair,
 * column placement ADR-544) χρειάζονται ΕΝΑ occluder instance με ΙΔΕΝΤΙΚΟ lifecycle· πριν ήταν
 * copy-pasted verbatim σε 4 αρχεία. Επιστρέφει το ref ώστε το `draw()` να διαβάζει `.current`.
 */
export function useGripDepthOccluder(): MutableRefObject<GripDepthOccluder | null> {
  const ref = useRef<GripDepthOccluder | null>(null);
  useEffect(() => {
    ref.current = new GripDepthOccluder();
    return () => {
      ref.current?.dispose();
      ref.current = null;
    };
  }, []);
  return ref;
}

/**
 * Returns `isMoving(camera)` — true when the camera's world/projection matrices differ from the
 * previous call (orbit/zoom/pan in flight). Updates the stored pose on every call, so call it
 * ONCE per frame inside the overlay's `draw`. The first call returns false (no prior pose).
 */
export function useCameraMotionGate(): (camera: THREE.Camera) => boolean {
  const lastWorldRef = useRef(new THREE.Matrix4());
  const lastProjRef = useRef(new THREE.Matrix4());
  const poseValidRef = useRef(false);
  return useCallback((camera: THREE.Camera): boolean => {
    const moving =
      poseValidRef.current &&
      (!lastWorldRef.current.equals(camera.matrixWorld) ||
        !lastProjRef.current.equals(camera.projectionMatrix));
    lastWorldRef.current.copy(camera.matrixWorld);
    lastProjRef.current.copy(camera.projectionMatrix);
    poseValidRef.current = true;
    return moving;
  }, []);
}
