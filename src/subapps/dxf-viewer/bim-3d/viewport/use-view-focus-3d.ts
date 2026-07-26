'use client';

/**
 * ADR-435 / ADR-650 M5α.2 — the SOLE 3D subscriber of the {@link subscribeViewFocus} bus.
 *
 * «Zoom to X» from any DOM report panel (clash detective, topography QA, whatever comes next)
 * lands here and becomes one `viewport.frameBounds()` call. Extracted out of
 * `ClashMarkers3DOverlay` when the topography QA report became the second producer: the camera
 * framing was never clash-specific, and leaving it inside a clash component meant every new
 * report had to either re-implement it or import the clash overlay — the classic way one
 * behaviour becomes three copies.
 *
 * The bus already carries three-world metres (each producer converts from its own domain frame),
 * so this hook does NO coordinate math — it only turns a point + half-extent into a box.
 *
 * Mounted once by `BimViewport3DProjectedOverlays`, i.e. it exists exactly while the 3D view
 * does. Click-driven ⇒ zero per-frame cost (ADR-040).
 *
 * @see ../../systems/coordination/view-focus-bus.ts
 */

import { useEffect, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { subscribeViewFocus } from '../../systems/coordination/view-focus-bus';

/** Subscribe the live 3D camera to focus requests for as long as the viewport is mounted. */
export function useViewFocus3D(managerRef: MutableRefObject<ThreeJsSceneManager | null>): void {
  useEffect(() => subscribeViewFocus(({ point, halfExtentM: h }) => {
    const manager = managerRef.current;
    if (!manager) return;
    manager.viewport.frameBounds(
      new THREE.Vector3(point.x - h, point.y - h, point.z - h),
      new THREE.Vector3(point.x + h, point.y + h, point.z + h),
    );
  }), [managerRef]);
}
