'use client';

/**
 * snap-marker-core.ts — shared 3D snap-indicator marker SSoT.
 *
 * The cyan cube-wireframe snap marker (reads as a square frame from any orbit
 * angle, mirroring the 2D endpoint square) is shown both by the gizmo during a
 * drag (ADR-402) and by the BIM placement tools (ADR-403). Both used to carry a
 * byte-identical copy of the geometry/material + screen-constant scaling + the four
 * tuning constants. This module is the ONE place that geometry + scaling + constants
 * live; the gizmo (`bim-gizmo-overlay-markers.createSnapMarker` / `showSnapMarker`)
 * and `PlacementSnapMarker` both reuse it (ADR-378 §Step 5/#5).
 *
 * Pure Three.js leaf: no React, no store, no scene mutation.
 */

import * as THREE from 'three';

/** Snap marker colour (cyan — distinct from axis/hover golds and from geometry). */
export const SNAP_MARKER_COLOR = 0x00e5ff;
/** Base marker box half-extent in world metres before screen-constant scaling. */
export const SNAP_MARKER_RADIUS = 0.06;
/** Screen-constant multiplier: markerScale = cameraDistance · tan(fov/2) · this. */
export const SNAP_MARKER_SCREEN_SCALE = 0.13;
/** Render order — above geometry, below the gizmo handles so it never hides them. */
export const SNAP_MARKER_RENDER_ORDER = 1999;

/**
 * Build the snap marker — a small cube wireframe. Depth-test off + high render
 * order so it stays visible through geometry. Unit half-extent (box side 2) so
 * `scale.setScalar(s)` gives a half-extent of `s` metres. Starts `visible=false`.
 */
export function createSnapMarkerMesh(): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2));
  const material = new THREE.LineBasicMaterial({
    color: SNAP_MARKER_COLOR,
    depthTest: false,
    transparent: true,
  });
  const marker = new THREE.LineSegments(edges, material);
  marker.renderOrder = SNAP_MARKER_RENDER_ORDER;
  marker.visible = false;
  return marker;
}

/**
 * Screen-constant half-extent (metres) for a marker at `world`, so it keeps a fixed
 * pixel size during zoom/orbit under a perspective camera. Orthographic cameras fall
 * back to `SNAP_MARKER_RADIUS`. Clamped to a tiny positive minimum. `screenScale`
 * overrides the default multiplier (the gizmo shrinks the marker during a collapsed
 * planar move so the user still sees where the face landed).
 */
export function snapMarkerScreenScale(
  world: THREE.Vector3,
  camera: THREE.Camera,
  screenScale: number = SNAP_MARKER_SCREEN_SCALE,
): number {
  let s = SNAP_MARKER_RADIUS;
  if (camera instanceof THREE.PerspectiveCamera) {
    const dist = camera.position.distanceTo(world);
    s = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * screenScale;
  }
  return Math.max(s, 1e-3);
}
