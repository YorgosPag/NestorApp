'use client';

/**
 * PlacementSnapMarker — 3D snap indicator for BIM element placement.
 *
 * ADR-403 (3D BIM Element Placement) — Phase 2 OSNAP. A small cube wireframe that
 * reads as a square frame from any orbit angle (mirroring the 2D endpoint square),
 * shown at the world point the placement cursor snaps to. Depth-test off + high
 * render order so it stays visible through geometry; screen-constant scale so it
 * keeps a fixed pixel size during zoom/orbit.
 *
 * This deliberately reproduces the gizmo drag-marker pattern
 * (`bim-gizmo-overlay.createSnapMarker` / `showSnapMarker`, ADR-402) rather than
 * importing it — that file is ADR-402 territory. Pure Three.js leaf object (the
 * `ColumnPlacementGhost` pattern): added to the scene in the constructor, driven
 * by the placement hook, removed on `dispose`. No React, no store subscription.
 */

import * as THREE from 'three';

/** Cyan endpoint colour, matching the 2D snap indicator + gizmo drag marker. */
const SNAP_MARKER_COLOR = 0x00e5ff;
/** Fallback world half-extent (m) when the camera is orthographic. */
const SNAP_MARKER_RADIUS = 0.06;
/** Screen-constant scale factor: half-extent ≈ dist·tan(fov/2)·this. */
const SNAP_MARKER_SCREEN_SCALE = 0.13;
/** High render order so the marker draws over scene geometry. */
const SNAP_MARKER_RENDER_ORDER = 1999;

export class PlacementSnapMarker {
  private readonly scene: THREE.Scene;
  private readonly marker: THREE.LineSegments;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Unit half-extent (box side 2) so `scale.setScalar(s)` gives a half-extent
    // of `s` metres.
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2));
    const material = new THREE.LineBasicMaterial({
      color: SNAP_MARKER_COLOR,
      depthTest: false,
      transparent: true,
    });
    this.marker = new THREE.LineSegments(edges, material);
    this.marker.renderOrder = SNAP_MARKER_RENDER_ORDER;
    this.marker.visible = false;
    // Non-pickable: the marker must never intercept hover/selection raycasts.
    this.marker.raycast = () => {};
    this.scene.add(this.marker);
  }

  /** Show the marker at a world point, sized screen-constant like the gizmo. */
  show(world: THREE.Vector3, camera: THREE.Camera): void {
    if (this.disposed) return;
    this.marker.position.copy(world);
    let s = SNAP_MARKER_RADIUS;
    if (camera instanceof THREE.PerspectiveCamera) {
      const dist = camera.position.distanceTo(world);
      s = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * SNAP_MARKER_SCREEN_SCALE;
    }
    this.marker.scale.setScalar(Math.max(s, 1e-3));
    this.marker.visible = true;
    this.marker.updateMatrixWorld(true);
  }

  /** Hide the marker (no snap / cursor off the floor). */
  hide(): void {
    if (this.disposed) return;
    this.marker.visible = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.marker);
    this.marker.geometry.dispose();
    (this.marker.material as THREE.Material).dispose();
  }
}
