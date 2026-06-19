/**
 * SectionStencil secondary cap passes — full-quality-only overlays που τρέχουν ΜΕΤΑ
 * το grey base cap ανά plane (ADR-366 §A.3 / ADR-452 v2.7):
 *   • selection emphasis cap (selected entity interior → emphasis colour)
 *   • per-material hatch overlays (one stencil pass per material key)
 *
 * Εξάχθηκαν από το `section-stencil-renderer.ts` (Google file-size SSoT, N.7.1).
 * Λειτουργούν πάνω σε ένα {@link SecondaryCapContext} με τα shared materials/scenes
 * του renderer — μηδέν αντίγραφο state. Όλες οι passes ακολουθούν το ίδιο 1-pass
 * stencil-parity trick (warmup seed → gl.stencilOpSeparate FRONT override → masked
 * scene render → cap quad).
 *
 * @see ADR-366 §A.3.Q4 — Cut surface visual decision
 */

import * as THREE from 'three';
import {
  type SectionHatchKey,
  getHatchCapMaterial,
  setHatchRepeat,
} from './section-hatch-cap';
import { isSectionParityOverlay } from './section-parity-overlay';

/** Shared renderer state ώστε οι secondary passes να μην κρατούν δικό τους αντίγραφο. */
export interface SecondaryCapContext {
  readonly singlePassStencilMat: THREE.MeshBasicMaterial;
  readonly warmupScene: THREE.Scene;
  readonly selectedCapMat: THREE.MeshBasicMaterial;
  readonly selectedCapMesh: THREE.Mesh;
  readonly selectedCapScene: THREE.Scene;
  readonly hatchCapMesh: THREE.Mesh;
  readonly hatchCapScene: THREE.Scene;
  positionMesh(mesh: THREE.Mesh, plane: THREE.Plane, size: number): void;
}

export function renderEmphasisCapForPlane(
  ctx: SecondaryCapContext,
  renderer: THREE.WebGLRenderer,
  mainScene: THREE.Scene,
  camera: THREE.Camera,
  gl: WebGL2RenderingContext,
  otherPlanes: THREE.Plane[],
  currentPlane: THREE.Plane,
  capSize: number,
  selectedBimIds: readonly string[],
): void {
  ctx.selectedCapMat.clippingPlanes = otherPlanes;

  // Temporarily hide BIM meshes that are NOT in the selection so that the
  // stencil pass encodes only the selected entities' solid interior. Overlays
  // (edge fat-lines + always-on-top M/V/N diagrams/labels) must also be hidden —
  // they corrupt the Mesh-material parity (SSoT predicate `isSectionParityOverlay`).
  const hidden: THREE.Object3D[] = [];
  mainScene.traverse((obj) => {
    if (!obj.visible) return;
    if (isSectionParityOverlay(obj)) { hidden.push(obj); obj.visible = false; return; }
    if (!(obj instanceof THREE.Mesh)) return;
    const ud = obj.userData as Record<string, unknown>;
    const bimId = ud['bimId'];
    if (bimId !== undefined && !selectedBimIds.includes(bimId as string)) {
      hidden.push(obj);
      obj.visible = false;
    }
  });

  renderer.clearStencil();
  renderer.render(ctx.warmupScene, camera);
  gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
  mainScene.overrideMaterial = ctx.singlePassStencilMat;
  renderer.render(mainScene, camera);
  mainScene.overrideMaterial = null;

  for (const obj of hidden) obj.visible = true;

  ctx.positionMesh(ctx.selectedCapMesh, currentPlane, capSize);
  renderer.render(ctx.selectedCapScene, camera);
}

/** Render one hatch overlay pass per material key (after the grey base cap). */
export function renderHatchOverlaysForPlane(
  ctx: SecondaryCapContext,
  renderer: THREE.WebGLRenderer,
  mainScene: THREE.Scene,
  camera: THREE.Camera,
  gl: WebGL2RenderingContext,
  otherPlanes: THREE.Plane[],
  currentPlane: THREE.Plane,
  capSize: number,
  hatchGroups: Map<SectionHatchKey, THREE.Object3D[]>,
): void {
  for (const [key, meshes] of hatchGroups) {
    renderHatchGroupForPlane(
      ctx, renderer, mainScene, camera, gl, otherPlanes, currentPlane, capSize, key, meshes,
    );
  }
}

/**
 * Single per-material hatch stencil pass (mirrors renderEmphasisCapForPlane pattern):
 * clearStencil → warmup → mask to this material's meshes → stencil fill → hatch cap overlay.
 */
function renderHatchGroupForPlane(
  ctx: SecondaryCapContext,
  renderer: THREE.WebGLRenderer,
  mainScene: THREE.Scene,
  camera: THREE.Camera,
  gl: WebGL2RenderingContext,
  otherPlanes: THREE.Plane[],
  currentPlane: THREE.Plane,
  capSize: number,
  key: SectionHatchKey,
  meshes: THREE.Object3D[],
): void {
  ctx.singlePassStencilMat.clippingPlanes = otherPlanes;

  // Hide BIM meshes that are NOT this material to isolate the stencil fill. Overlays
  // (edge fat-lines + always-on-top M/V/N diagrams/labels) must also be hidden — they
  // corrupt the Mesh-material parity (SSoT predicate `isSectionParityOverlay`).
  const hidden: THREE.Object3D[] = [];
  mainScene.traverse((obj) => {
    if (!obj.visible) return;
    if (isSectionParityOverlay(obj)) { hidden.push(obj); obj.visible = false; return; }
    if (!(obj instanceof THREE.Mesh)) return;
    const ud = obj.userData as Record<string, unknown>;
    const bimId = ud['bimId'];
    if (bimId === undefined) return;
    if (!meshes.includes(obj)) {
      hidden.push(obj);
      obj.visible = false;
    }
  });

  renderer.clearStencil();
  renderer.render(ctx.warmupScene, camera);
  gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
  mainScene.overrideMaterial = ctx.singlePassStencilMat;
  renderer.render(mainScene, camera);
  mainScene.overrideMaterial = null;

  for (const obj of hidden) obj.visible = true;

  const mat = getHatchCapMaterial(key);
  mat.clippingPlanes = otherPlanes;
  setHatchRepeat(key, capSize);
  ctx.hatchCapMesh.material = mat;
  ctx.positionMesh(ctx.hatchCapMesh, currentPlane, capSize);
  renderer.render(ctx.hatchCapScene, camera);
}
