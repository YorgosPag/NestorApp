/**
 * preview-pivot — shared Alt+click orbit-pivot picking + visible feedback for the
 * «Edit Type» preview viewports (slab + wall). SSoT so the two near-identical
 * preview renderers do NOT duplicate the pivot raycast / marker wiring
 * (ADR-414, Boy-Scout extraction of the copy-pasted `setPivotAt`).
 *
 * Two pieces:
 *  - `resolvePreviewPivot()` — raycasts the band meshes at the cursor and, on a
 *    MISS, falls back to a camera-facing plane through the scene origin. The
 *    preview scene is a thin band slice on a mostly-empty background, so a strict
 *    geometry-only pick silently no-ops whenever the click lands just off the
 *    bands → "Alt+click does nothing". The plane fallback makes the clicked point
 *    ALWAYS become the rotation centre (Giorgio's request), matching CAD pivot
 *    conventions.
 *  - `PreviewPivotMarker` — a small 3-axis crosshair that flashes at the new
 *    pivot, mirroring the main viewport's POI cross (ADR-366 §A.6.Q5). Without
 *    it the pivot change is invisible (the bands are small + centred, so the
 *    re-centre is imperceptible) → reads as "it doesn't work".
 *
 * Standalone THREE — OUTSIDE the ADR-040 high-frequency canvas path.
 *
 * @see ./preview-orbit-controls.ts — owns the Alt+click GESTURE detection
 * @see ./WallTypePreviewRenderer.ts, ./SlabTypePreviewRenderer.ts — consumers
 */

import * as THREE from 'three';
import { DXF_TIMING } from '../../config/dxf-timing';

/** Crosshair half-length (meters) — sized for the ~1m preview stub. */
const MARKER_HALF_M = 0.12;
const MARKER_COLOR = 0x38bdf8; // sky-400 — matches the band highlight outline.
/** How long the pivot crosshair stays visible after an Alt+click (ms). */
const MARKER_FLASH_MS = DXF_TIMING.animation.MARKER_FLASH; // ADR-516

const _ndc = new THREE.Vector2();
const _normal = new THREE.Vector3();
const _origin = new THREE.Vector3(0, 0, 0);

/**
 * Resolve the world point an Alt+click should orbit around. Raycasts `targets`
 * first; on a miss, intersects a plane through the origin facing the camera so a
 * click on empty space still yields a sensible pivot at the clicked location.
 * Returns null only when the canvas has no size (nothing to pick).
 */
export function resolvePreviewPivot(
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  dom: HTMLElement,
  targets: readonly THREE.Object3D[],
  clientX: number,
  clientY: number,
): THREE.Vector3 | null {
  const rect = dom.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  _ndc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(_ndc, camera);

  const hit = raycaster.intersectObjects(targets as THREE.Object3D[], false)[0];
  if (hit) return hit.point.clone();

  // Miss → camera-facing plane through the scene origin (the bands' centre).
  camera.getWorldDirection(_normal);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(_normal, _origin);
  const point = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, point) ? point : null;
}

/**
 * A brief 3-axis crosshair shown at the orbit pivot after an Alt+click, so the
 * re-centre is visible. Render-on-demand friendly: it triggers a render when
 * shown and again when it auto-hides — no RAF loop.
 */
export class PreviewPivotMarker {
  private readonly marker: THREE.LineSegments;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly scene: THREE.Scene) {
    const h = MARKER_HALF_M;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [-h, 0, 0, h, 0, 0, 0, -h, 0, 0, h, 0, 0, 0, -h, 0, 0, h],
        3,
      ),
    );
    const mat = new THREE.LineBasicMaterial({
      color: MARKER_COLOR,
      depthTest: false, // always visible, even inside a band
      transparent: true,
    });
    this.marker = new THREE.LineSegments(geo, mat);
    this.marker.renderOrder = 999;
    this.marker.visible = false;
    this.scene.add(this.marker);
  }

  /** Flash the crosshair at `point`, scheduling an auto-hide that re-renders. */
  flashAt(point: THREE.Vector3, render: () => void): void {
    this.marker.position.copy(point);
    this.marker.visible = true;
    render();
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.marker.visible = false;
      render();
    }, MARKER_FLASH_MS);
  }

  dispose(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.scene.remove(this.marker);
    this.marker.geometry.dispose();
    (this.marker.material as THREE.Material).dispose();
  }
}
