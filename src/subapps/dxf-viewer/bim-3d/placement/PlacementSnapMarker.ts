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
 * Geometry + material + screen-constant scaling come from the shared SSoT
 * `bim-3d/shared/snap-marker-core.ts` (reused by the gizmo drag marker too, ADR-378
 * §Step 5) — no longer a private copy of the gizmo's marker. Pure Three.js leaf
 * object (the `ColumnPlacementGhost` pattern): added to the scene in the constructor,
 * driven by the placement hook, removed on `dispose`. No React, no store subscription.
 */

import * as THREE from 'three';
import { createSnapMarkerMesh, snapMarkerScreenScale } from '../shared/snap-marker-core';

export class PlacementSnapMarker {
  private readonly scene: THREE.Scene;
  private readonly marker: THREE.LineSegments;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.marker = createSnapMarkerMesh();
    // Non-pickable: the marker must never intercept hover/selection raycasts.
    this.marker.raycast = () => {};
    this.scene.add(this.marker);
  }

  /** Show the marker at a world point, sized screen-constant like the gizmo. */
  show(world: THREE.Vector3, camera: THREE.Camera): void {
    if (this.disposed) return;
    this.marker.position.copy(world);
    this.marker.scale.setScalar(snapMarkerScreenScale(world, camera));
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
