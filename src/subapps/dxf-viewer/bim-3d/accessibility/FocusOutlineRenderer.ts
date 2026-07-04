// ============================================================================
// ♿ FOCUS OUTLINE RENDERER — Three.js dashed bbox (ADR-366 Phase 4.5 / A.7.Q1)
// ============================================================================
//
// Renders a dashed cyan wireframe around the keyboard-focused BIM entity. Lives
// inside the Three.js scene, owned by ThreeJsSceneManager. Pure Three.js — no
// React. Mirrors BimSelectionHighlighter's lifecycle (group-scoped traverse).
//
// Implementation note (ADR-366 §A.7.Q1):
//   - Reuse `EdgesGeometry` (built-in) on top of the target mesh's geometry,
//     transformed by the mesh world matrix. `LineDashedMaterial` provides the
//     dashed pattern. depthTest=false + renderOrder=999 keeps the outline
//     visible through obstructions (focus must always be discoverable).
//   - On `setTarget(null)` everything is removed but kept allocated until
//     `dispose()` so Tab cycling stays GC-quiet.
// ============================================================================

import * as THREE from 'three';
import { BIM_FOCUS_OUTLINE_COLOR_THREE } from '../../accessibility/bim-a11y-color-tokens';
import { finiteBox3FromObject } from '../scene/finite-bounds';

const FOCUS_OUTLINE_COLOR = BIM_FOCUS_OUTLINE_COLOR_THREE;
const FOCUS_OUTLINE_DASH_SIZE = 0.08;
const FOCUS_OUTLINE_GAP_SIZE = 0.04;
const FOCUS_OUTLINE_RENDER_ORDER = 999;

export class FocusOutlineRenderer {
  private readonly material: THREE.LineDashedMaterial;
  private currentMesh: THREE.Mesh | null = null;
  private currentSegments: THREE.LineSegments | null = null;

  constructor(private readonly scene: THREE.Scene) {
    this.material = new THREE.LineDashedMaterial({
      color: FOCUS_OUTLINE_COLOR,
      dashSize: FOCUS_OUTLINE_DASH_SIZE,
      gapSize: FOCUS_OUTLINE_GAP_SIZE,
      depthTest: false,
      transparent: true,
      linewidth: 1,
    });
  }

  /** Find a mesh under `group` whose `userData.bimId` matches and apply outline. */
  setTargetById(group: THREE.Group, bimId: string | null): void {
    if (bimId === null) {
      this.clear();
      return;
    }
    let target: THREE.Mesh | null = null;
    group.traverse((obj) => {
      if (target) return;
      if (!(obj instanceof THREE.Mesh)) return;
      if ((obj.userData['bimId'] as string | undefined) === bimId) target = obj;
    });
    this.setTargetMesh(target);
  }

  setTargetMesh(mesh: THREE.Mesh | null): void {
    if (mesh === this.currentMesh) return;
    this.clear();
    if (!mesh) return;
    const edges = new THREE.EdgesGeometry(mesh.geometry, 30);
    const segments = new THREE.LineSegments(edges, this.material);
    segments.matrixAutoUpdate = false;
    segments.matrix.copy(mesh.matrixWorld);
    segments.renderOrder = FOCUS_OUTLINE_RENDER_ORDER;
    segments.computeLineDistances();
    this.scene.add(segments);
    this.currentMesh = mesh;
    this.currentSegments = segments;
  }

  /** Refresh the world-matrix copy when the mesh transforms (per-frame from RAF). */
  syncWorldMatrix(): void {
    if (!this.currentMesh || !this.currentSegments) return;
    this.currentSegments.matrix.copy(this.currentMesh.matrixWorld);
  }

  /** Compute the world-space center of the focused entity (null when nothing focused). */
  getCurrentWorldCenter(): THREE.Vector3 | null {
    if (!this.currentMesh) return null;
    const box = finiteBox3FromObject(this.currentMesh);
    if (!box) return null;
    return box.getCenter(new THREE.Vector3());
  }

  clear(): void {
    if (this.currentSegments) {
      this.scene.remove(this.currentSegments);
      this.currentSegments.geometry.dispose();
      this.currentSegments = null;
    }
    this.currentMesh = null;
  }

  dispose(): void {
    this.clear();
    this.material.dispose();
  }
}
