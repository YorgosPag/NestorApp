/**
 * SectionStencil secondary cap passes — full-quality-only overlays που τρέχουν ΜΕΤΑ
 * το grey base cap ανά plane (ADR-366 §A.3 / ADR-452 v2.7):
 *   • selection emphasis cap (selected entity interior → emphasis colour)
 *   • per-material hatch overlays (one stencil pass per material key)
 *
 * Εξάχθηκαν από το `section-stencil-renderer.ts` (Google file-size SSoT, N.7.1).
 * Λειτουργούν πάνω σε ένα {@link SecondaryCapContext} με τα shared materials/scenes
 * του renderer — μηδέν αντίγραφο state. Όλες οι passes ακολουθούν το ίδιο 1-pass
 * stencil-parity trick ({@link runMaskedParity}: warmup seed → gl.stencilOpSeparate
 * FRONT override → masked scene render → cap quad).
 *
 * @see ADR-366 §A.3.Q4 — Cut surface visual decision
 */

import * as THREE from 'three';
import {
  type SectionHatchKey,
  getHatchCapMaterial,
  setHatchRepeat,
} from './section-hatch-cap';
import {
  type KeepParityMesh,
  hideNonParityMeshes,
  restoreHidden,
} from './section-parity-scene';

/** Shared renderer state ώστε οι secondary passes να μην κρατούν δικό τους αντίγραφο. */
export interface SecondaryCapContext {
  readonly singlePassStencilMat: THREE.MeshBasicMaterial;
  readonly warmupScene: THREE.Scene;
  readonly selectedCapMat: THREE.MeshBasicMaterial;
  readonly selectedCapMesh: THREE.Mesh;
  readonly selectedCapScene: THREE.Scene;
  readonly hatchCapMesh: THREE.Mesh;
  readonly hatchCapScene: THREE.Scene;
  positionMesh(mesh: THREE.Mesh, plane: THREE.Plane, size: number, center: THREE.Vector3 | null): void;
}

/** Per-plane render invariants shared by every secondary cap pass (ADR-621). */
export interface PlaneCapPass {
  readonly renderer: THREE.WebGLRenderer;
  readonly mainScene: THREE.Scene;
  readonly camera: THREE.Camera;
  readonly gl: WebGL2RenderingContext;
  readonly otherPlanes: THREE.Plane[];
  readonly currentPlane: THREE.Plane;
  readonly capSize: number;
  readonly capCenter: THREE.Vector3 | null;
}

/**
 * ADR-621 — shared 1-pass masked parity: isolate the meshes `keepMesh` accepts
 * (overlays always excluded), then run warmup-seed → raw FRONT-decrement override →
 * masked scene render, leaving stencil != 0 at that subset's cross-section. Caller
 * draws its cap quad afterwards. Both secondary passes differ ONLY in the mask and
 * the final cap quad.
 */
function runMaskedParity(ctx: SecondaryCapContext, pass: PlaneCapPass, keepMesh: KeepParityMesh): void {
  ctx.singlePassStencilMat.clippingPlanes = pass.otherPlanes;
  const hidden = hideNonParityMeshes(pass.mainScene, keepMesh);
  pass.renderer.clearStencil();
  pass.renderer.render(ctx.warmupScene, pass.camera);
  pass.gl.stencilOpSeparate(pass.gl.FRONT, pass.gl.KEEP, pass.gl.KEEP, pass.gl.DECR_WRAP);
  pass.mainScene.overrideMaterial = ctx.singlePassStencilMat;
  pass.renderer.render(pass.mainScene, pass.camera);
  pass.mainScene.overrideMaterial = null;
  restoreHidden(hidden);
}

/**
 * Selection emphasis cap: stencil only the SELECTED entities' solid interior, then
 * fill the emphasis-coloured cap over it. Hidden non-selected meshes + overlays are
 * restored by {@link runMaskedParity}.
 */
export function renderEmphasisCapForPlane(
  ctx: SecondaryCapContext,
  pass: PlaneCapPass,
  selectedBimIds: readonly string[],
): void {
  ctx.selectedCapMat.clippingPlanes = pass.otherPlanes;
  runMaskedParity(ctx, pass, (_obj, bimId) => selectedBimIds.includes(bimId as string));
  ctx.positionMesh(ctx.selectedCapMesh, pass.currentPlane, pass.capSize, pass.capCenter);
  pass.renderer.render(ctx.selectedCapScene, pass.camera);
}

/** Render one hatch overlay pass per material key (after the grey base cap). */
export function renderHatchOverlaysForPlane(
  ctx: SecondaryCapContext,
  pass: PlaneCapPass,
  hatchGroups: Map<SectionHatchKey, THREE.Object3D[]>,
): void {
  for (const [key, meshes] of hatchGroups) {
    renderHatchGroupForPlane(ctx, pass, key, meshes);
  }
}

/**
 * Single per-material hatch stencil pass (mirrors renderEmphasisCapForPlane pattern):
 * mask to this material's meshes → stencil fill → hatch cap overlay.
 */
function renderHatchGroupForPlane(
  ctx: SecondaryCapContext,
  pass: PlaneCapPass,
  key: SectionHatchKey,
  meshes: THREE.Object3D[],
): void {
  runMaskedParity(ctx, pass, (obj) => meshes.includes(obj));
  const mat = getHatchCapMaterial(key);
  mat.clippingPlanes = pass.otherPlanes;
  setHatchRepeat(key, pass.capSize);
  ctx.hatchCapMesh.material = mat;
  ctx.positionMesh(ctx.hatchCapMesh, pass.currentPlane, pass.capSize, pass.capCenter);
  pass.renderer.render(ctx.hatchCapScene, pass.camera);
}
