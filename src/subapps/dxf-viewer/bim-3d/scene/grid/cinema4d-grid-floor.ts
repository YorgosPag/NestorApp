/**
 * cinema4d-grid-floor.ts — Cinema-4D-style ground grid for the BIM 3D viewport (ADR-558).
 *
 * One bounded XZ quad (Y=0) drawn with the per-fragment decade-LOD shader grid material, registered
 * as a post-FX `'underlay'` overlay (ADR-537) so it is depth-tested (occluded by the building) yet
 * never tinted by SSAO. Each frame the overlay provider re-resolves the theme grid colours and the
 * distance-fog radii, then re-centres the mesh on the camera target so the bounded plane always
 * covers the view while the lines stay world-locked. The dynamic subdivision (zoom + tilt) is done
 * entirely in the shader via `fwidth`, so the CPU per-frame cost is two colour reads + a few scalars.
 *
 * Owner pattern: same as `BimSceneLayer` / `WaypointDragHandleRenderer` — constructed once by
 * `ThreeJsSceneManager`, `dispose()` on teardown.
 *
 * @module bim-3d/scene/grid/cinema4d-grid-floor
 */

import * as THREE from 'three';
import { registerPostFxOverlay } from '../post-fx-overlay-pass';
import { resolveCssVarColor } from '../../../config/color-config';
import { createCinema4DGridMaterial, type Cinema4DGridUniforms } from './cinema4d-grid-material';
import { computeGrid3DFog } from './cinema4d-grid-frame';
import {
  GRID3D_PLANE_HALF_SIZE_M,
  GRID3D_MINOR_COLOR_VAR,
  GRID3D_MINOR_COLOR_FALLBACK,
  GRID3D_MAJOR_COLOR_VAR,
  GRID3D_MAJOR_COLOR_FALLBACK,
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
    this.unregister = registerPostFxOverlay(scene, () => this.overlayRoots(), 'underlay');
  }

  /** Toggle the grid (kept for future settings wiring; default ON like Cinema 4D). */
  setEnabled(enabled: boolean): void { this.enabled = enabled; }

  /** Post-FX `'underlay'` provider: refresh uniforms then return the root when shown. */
  private overlayRoots(): readonly THREE.Object3D[] {
    if (!this.enabled) return [];
    this.refresh();
    return [this.root];
  }

  /** Per-frame: re-resolve theme colours + distance fog, re-centre the window on the camera target. */
  private refresh(): void {
    const camera = this.getCamera();
    const target = this.getTarget();
    const u = this.uniforms;

    u.uMinorColor.value.set(resolveCssVarColor(GRID3D_MINOR_COLOR_VAR) || GRID3D_MINOR_COLOR_FALLBACK);
    u.uMajorColor.value.set(resolveCssVarColor(GRID3D_MAJOR_COLOR_VAR) || GRID3D_MAJOR_COLOR_FALLBACK);

    const fog = computeGrid3DFog({ distance: camera.position.distanceTo(target) });
    u.uFadeStart.value = fog.fadeStart;
    u.uFadeEnd.value = fog.fadeEnd;
    u.uTarget.value.copy(target);

    this.mesh.position.set(target.x, 0, target.z); // window follows the view; lines stay world-locked
  }

  dispose(): void {
    this.unregister();
    this.geometry.dispose();
    this.material.dispose();
  }
}
