/**
 * cinema4d-grid-floor.ts — Cinema-4D-style ground grid for the BIM 3D viewport (ADR-558).
 *
 * One large XZ quad (Y=0) drawn with the world-locked C4D grid shader material, registered as a
 * post-FX `'underlay'` overlay (ADR-537) so it is depth-tested (occluded by the building) yet never
 * tinted by SSAO. Each frame the overlay provider re-resolves the theme grid colours, derives the
 * horizon-fade radii (keyed to the camera->target distance), and re-centres the quad on the target so
 * it always covers the view while the grid lines stay world-locked. The decade LOD + AA + fade are
 * done per fragment in the shader, so the CPU per-frame cost is two colour reads + one distance.
 *
 * Owner pattern: same as `BimSceneLayer` / `WaypointDragHandleRenderer` — constructed once by
 * `ThreeJsSceneManager`, `dispose()` on teardown.
 *
 * @module bim-3d/scene/grid/cinema4d-grid-floor
 */

import * as THREE from 'three';
import { registerPostFxOverlay, OVERLAY_ORDER } from '../post-fx-overlay-pass';
import { resolveCssVarColor } from '../../../config/color-config';
import { createCinema4DGridMaterial, type Cinema4DGridUniforms } from './cinema4d-grid-material';
import { computeGrid3DFrame } from './cinema4d-grid-frame';
import {
  GRID3D_PLANE_HALF_SIZE_M,
  GRID3D_MINOR_COLOR_VAR,
  GRID3D_MINOR_COLOR_FALLBACK,
  GRID3D_MAJOR_COLOR_VAR,
  GRID3D_MAJOR_COLOR_FALLBACK,
  GRID3D_MAJOR_DARKEN,
} from './cinema4d-grid-config';

export class Cinema4DGridFloor {
  private readonly root = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly uniforms: Cinema4DGridUniforms;
  private readonly geometry: THREE.PlaneGeometry;
  private readonly unregister: () => void;
  private enabled = true;

  constructor(
    scene: THREE.Object3D,
    private readonly getCamera: () => THREE.Camera,
    private readonly getTarget: () => THREE.Vector3,
  ) {
    const built = createCinema4DGridMaterial();
    this.material = built.material;
    this.uniforms = built.uniforms;
    this.geometry = new THREE.PlaneGeometry(GRID3D_PLANE_HALF_SIZE_M * 2, GRID3D_PLANE_HALF_SIZE_M * 2);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2; // lie on the XZ ground plane (Y-up world)
    this.mesh.frustumCulled = false; // re-centred on the target each frame; never cull
    this.mesh.renderOrder = -1; // ground reference draws under everything else
    this.root.add(this.mesh);
    this.root.visible = false; // overlay-owned: the main render skips it (ADR-537 contract)
    // `GROUND` z-order: grid + DXF wireframe are BOTH coplanar `'underlay'` (Y=0, depthWrite:false),
    // so draw order — not depth — decides who paints on top. GROUND keeps the grid beneath the DXF
    // entities (the reference floor under the plan), independent of construction order. (ADR-558.)
    this.unregister = registerPostFxOverlay(scene, () => this.overlayRoots(), 'underlay', OVERLAY_ORDER.GROUND);
  }

  /** Toggle the grid (kept for future settings wiring; default ON like Cinema 4D). */
  setEnabled(enabled: boolean): void { this.enabled = enabled; }

  /** Post-FX `'underlay'` provider: refresh uniforms then return the root when shown. */
  private overlayRoots(): readonly THREE.Object3D[] {
    if (!this.enabled) return [];
    this.refresh();
    return [this.root];
  }

  /** Per-frame: re-resolve theme colours + the world-locked cell size & horizon-fade radii. */
  private refresh(): void {
    const camera = this.getCamera();
    const target = this.getTarget();
    const u = this.uniforms;

    u.uMinorColor.value.set(resolveCssVarColor(GRID3D_MINOR_COLOR_VAR) || GRID3D_MINOR_COLOR_FALLBACK);
    // Major: live token colour, darkened a touch for the 3D grid only (2D + token untouched).
    u.uMajorColor.value.set(resolveCssVarColor(GRID3D_MAJOR_COLOR_VAR) || GRID3D_MAJOR_COLOR_FALLBACK)
      .multiplyScalar(GRID3D_MAJOR_DARKEN);

    // World-locked cell size (decade step) + horizon-fade radii, both keyed to the camera distance.
    const frame = computeGrid3DFrame({ distance: camera.position.distanceTo(target) });
    u.uFadeNear.value = frame.fadeNear;
    u.uFadeFar.value = frame.fadeFar;

    this.mesh.position.set(target.x, 0, target.z); // quad follows the view; grid lines stay world-locked
  }

  dispose(): void {
    this.unregister();
    this.geometry.dispose();
    this.material.dispose();
  }
}
