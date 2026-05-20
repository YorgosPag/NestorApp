/**
 * SectionStencilRenderer — True stencil cap pattern για ADR-366 §A.3.
 *
 * Phase 7.0a (2-pass): per active plane = clearStencil + BackSide scene pass
 *   (IncrementWrap) + FrontSide scene pass (DecrementWrap) + cap quad.
 *   Box mode worst case: 12 full BIM scene renders + 6 cap quads.
 *
 * Phase 7.0b (1-pass): per active plane = clearStencil + zero-area warmup
 *   (cache seed) + single DoubleSide scene pass + cap quad.
 *   Box mode worst case: 6 full BIM scene renders + 6 cap quads.
 *   Reduction: ~50% fewer large scene renders.
 *
 * Phase 7.0C (selection emphasis): after normal cap, if selectedBimId set →
 *   2nd stencil pass με visibility mask (selected entity only) → emphasis
 *   cap (SECTION_CUT_SURFACE.selectedCapColor) rendered on top.
 *   Cost: +1 BIM render + traverse when entity selected (0 cost when idle).
 *
 * 1-pass mechanism (gl.stencilOpSeparate cache trick):
 *   1. Warmup: render zero-area mesh with singlePassMat (stencilZPass=IncrementWrap).
 *      Three.js caches stencil state as IncrementWrap. Zero fragments = no stencil writes.
 *   2. gl.stencilOpSeparate(FRONT, KEEP, KEEP, DECR_WRAP) — overrides WebGL FRONT face only.
 *      Three.js JS cache still shows IncrementWrap (unaware of raw GL call).
 *   3. mainScene render with overrideMaterial=singlePassMat — for every object, Three.js
 *      compares material.stencilZPass (IncrementWrap) vs cached (IncrementWrap) → CACHE HIT
 *      → skips gl.stencilOp → our FRONT override persists throughout.
 *      Result: back-facing fragments → IncrementWrap (entering solid),
 *              front-facing fragments → DecrementWrap (exiting solid). Stencil parity correct.
 *   4. Cap quad: stencilFunc=NotEqual(0) → solid fill where geometry was cut.
 *
 * @see ADR-366 §A.3.Q4 — Cut surface visual decision
 * @see ADR-366 Phase 7.0b implementation note
 */

import * as THREE from 'three';
import { SECTION_CUT_SURFACE } from '../../../config/color-config';
import { useSelection3DStore } from '../../stores/Selection3DStore';

export interface StencilRendererDeps {
  /** BIM group reference για bounding sphere calc (cap quad size). */
  readonly getBimGroup: () => THREE.Object3D;
  /** DXF overlay bounds for combined scene extent. */
  readonly getDxfBounds: () => THREE.Box3 | null;
}

const CAP_QUAD_SCALE_FACTOR = 4;
const FALLBACK_CAP_SIZE = 100;

export class SectionStencilRenderer {
  private readonly deps: StencilRendererDeps;
  private readonly singlePassStencilMat: THREE.MeshBasicMaterial;
  private readonly warmupScene: THREE.Scene;
  private readonly capMat: THREE.MeshBasicMaterial;
  private readonly capMesh: THREE.Mesh;
  private readonly capScene: THREE.Scene;
  private readonly selectedCapMat: THREE.MeshBasicMaterial;
  private readonly selectedCapMesh: THREE.Mesh;
  private readonly selectedCapScene: THREE.Scene;
  private disposed = false;

  constructor(deps: StencilRendererDeps) {
    this.deps = deps;
    this.singlePassStencilMat = this.createSinglePassMaterial();
    this.warmupScene = this.createWarmupScene();
    this.capMat = this.createCapMaterial();
    const geom = new THREE.PlaneGeometry(1, 1);
    this.capMesh = new THREE.Mesh(geom, this.capMat);
    this.capMesh.frustumCulled = false;
    this.capScene = new THREE.Scene();
    this.capScene.add(this.capMesh);
    this.selectedCapMat = this.createSelectedCapMaterial();
    const selectedGeom = new THREE.PlaneGeometry(1, 1);
    this.selectedCapMesh = new THREE.Mesh(selectedGeom, this.selectedCapMat);
    this.selectedCapMesh.frustumCulled = false;
    this.selectedCapScene = new THREE.Scene();
    this.selectedCapScene.add(this.selectedCapMesh);
  }

  private createSinglePassMaterial(): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial();
    mat.side = THREE.DoubleSide;
    mat.colorWrite = false;
    mat.depthWrite = false;
    mat.depthTest = true;
    mat.stencilWrite = true;
    mat.stencilFunc = THREE.AlwaysStencilFunc;
    mat.stencilFail = THREE.KeepStencilOp;
    mat.stencilZFail = THREE.KeepStencilOp;
    // BACK face (entering solid) → IncrementWrap via Three.js material property.
    // FRONT face (exiting solid) → DecrementWrap via gl.stencilOpSeparate (per-plane override).
    mat.stencilZPass = THREE.IncrementWrapStencilOp;
    return mat;
  }

  private createWarmupScene(): THREE.Scene {
    // Zero-area plane (scale=0): zero fragments rendered → zero stencil writes.
    // Sole purpose: trigger Three.js's updateCommonMaterial(singlePassMat) so the
    // stencil state cache is seeded with IncrementWrap before the real scene pass.
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      this.singlePassStencilMat,
    );
    mesh.scale.set(0, 0, 1);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return scene;
  }

  private createCapMaterial(): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({
      color: SECTION_CUT_SURFACE.color,
      opacity: SECTION_CUT_SURFACE.opacity,
      transparent: SECTION_CUT_SURFACE.opacity < 1,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });
    mat.stencilWrite = true;
    mat.stencilRef = 0;
    mat.stencilFunc = THREE.NotEqualStencilFunc;
    mat.stencilFail = THREE.ReplaceStencilOp;
    mat.stencilZFail = THREE.ReplaceStencilOp;
    mat.stencilZPass = THREE.ReplaceStencilOp;
    return mat;
  }

  private createSelectedCapMaterial(): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({
      color: SECTION_CUT_SURFACE.selectedCapColor,
      opacity: SECTION_CUT_SURFACE.selectedCapOpacity,
      transparent: SECTION_CUT_SURFACE.selectedCapOpacity < 1,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });
    mat.stencilWrite = true;
    mat.stencilRef = 0;
    mat.stencilFunc = THREE.NotEqualStencilFunc;
    mat.stencilFail = THREE.ReplaceStencilOp;
    mat.stencilZFail = THREE.ReplaceStencilOp;
    mat.stencilZPass = THREE.ReplaceStencilOp;
    return mat;
  }

  /**
   * Render stencil caps για κάθε enabled plane. Καλείται ΜΕΤΑ το main scene
   * render (caller πρέπει να έχει κάνει renderer.render(scene, camera) πρώτα
   * με ΟΛΑ τα planes clipping ενεργά).
   *
   * @param renderer    Active WebGLRenderer (στο default framebuffer με stencil)
   * @param mainScene   Η κύρια σκηνή (BIM + DXF + sectionBox + lights)
   * @param camera      Active perspective/ortho camera
   * @param planes      Όλα τα clip planes (1-6 για box, 1-6 για plane mode)
   * @param sceneBounds Bounding box για cap quad size
   */
  render(
    renderer: THREE.WebGLRenderer,
    mainScene: THREE.Scene,
    camera: THREE.Camera,
    planes: ReadonlyArray<THREE.Plane>,
    sceneBounds: THREE.Box3 | null,
  ): void {
    if (this.disposed || planes.length === 0) return;

    const capSize = this.computeCapSize(sceneBounds);
    const savedAutoClear = renderer.autoClear;
    const savedAutoClearColor = renderer.autoClearColor;
    const savedAutoClearDepth = renderer.autoClearDepth;
    const savedAutoClearStencil = renderer.autoClearStencil;
    renderer.autoClear = false;
    renderer.autoClearColor = false;
    renderer.autoClearDepth = false;
    renderer.autoClearStencil = false;

    for (let i = 0; i < planes.length; i++) {
      this.renderCapForPlane(renderer, mainScene, camera, planes, i, capSize);
    }

    mainScene.overrideMaterial = null;
    renderer.autoClear = savedAutoClear;
    renderer.autoClearColor = savedAutoClearColor;
    renderer.autoClearDepth = savedAutoClearDepth;
    renderer.autoClearStencil = savedAutoClearStencil;
  }

  private renderCapForPlane(
    renderer: THREE.WebGLRenderer,
    mainScene: THREE.Scene,
    camera: THREE.Camera,
    planes: ReadonlyArray<THREE.Plane>,
    index: number,
    capSize: number,
  ): void {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const currentPlane = planes[index];
    const others = planes.filter((_, idx) => idx !== index) as THREE.Plane[];

    this.singlePassStencilMat.clippingPlanes = others;
    this.capMat.clippingPlanes = others;

    renderer.clearStencil();

    // Seed Three.js stencil state cache with singlePassMat (IncrementWrap).
    // Required because the previous cap render left the cache at ReplaceStencilOp;
    // without seeding, the first BIM object would cause a cache-miss and Three.js
    // would call gl.stencilOp(INCR_WRAP), overwriting our FRONT face override below.
    renderer.render(this.warmupScene, camera);

    // Override FRONT face stencil op to DecrementWrap (exiting solid).
    // Three.js cache stays IncrementWrap (it doesn't know about this raw GL call),
    // so all BIM objects in the main pass will cache-hit and skip gl.stencilOp.
    // Back-facing fragments keep IncrementWrap (entering solid). Parity → NotEqual(0) → cap.
    gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.DECR_WRAP);

    mainScene.overrideMaterial = this.singlePassStencilMat;
    renderer.render(mainScene, camera);
    mainScene.overrideMaterial = null;

    this.positionMesh(this.capMesh, currentPlane, capSize);
    renderer.render(this.capScene, camera);

    const selectedBimId = useSelection3DStore.getState().selectedBimId;
    if (selectedBimId !== null) {
      this.renderEmphasisCapForPlane(
        renderer, mainScene, camera, gl, others, currentPlane, capSize, selectedBimId,
      );
    }
  }

  private renderEmphasisCapForPlane(
    renderer: THREE.WebGLRenderer,
    mainScene: THREE.Scene,
    camera: THREE.Camera,
    gl: WebGL2RenderingContext,
    otherPlanes: THREE.Plane[],
    currentPlane: THREE.Plane,
    capSize: number,
    selectedBimId: string,
  ): void {
    this.selectedCapMat.clippingPlanes = otherPlanes;

    // Temporarily hide BIM meshes that are NOT the selected entity so that
    // the stencil pass encodes only the selected entity's solid interior.
    const hidden: THREE.Object3D[] = [];
    mainScene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const bimId = (obj.userData as Record<string, unknown>)['bimId'];
      if (bimId !== undefined && bimId !== selectedBimId) {
        hidden.push(obj);
        obj.visible = false;
      }
    });

    renderer.clearStencil();
    renderer.render(this.warmupScene, camera);
    gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
    mainScene.overrideMaterial = this.singlePassStencilMat;
    renderer.render(mainScene, camera);
    mainScene.overrideMaterial = null;

    for (const obj of hidden) obj.visible = true;

    this.positionMesh(this.selectedCapMesh, currentPlane, capSize);
    renderer.render(this.selectedCapScene, camera);
  }

  private positionMesh(mesh: THREE.Mesh, plane: THREE.Plane, size: number): void {
    const normal = plane.normal;
    const pointOnPlane = normal.clone().multiplyScalar(-plane.constant);
    mesh.position.copy(pointOnPlane);
    const defaultNormal = new THREE.Vector3(0, 0, 1);
    mesh.quaternion.setFromUnitVectors(defaultNormal, normal);
    mesh.scale.set(size, size, 1);
    mesh.updateMatrix();
    mesh.updateMatrixWorld(true);
  }

  private computeCapSize(sceneBounds: THREE.Box3 | null): number {
    if (!sceneBounds || sceneBounds.isEmpty()) {
      const bimBox = new THREE.Box3().setFromObject(this.deps.getBimGroup());
      const dxfBox = this.deps.getDxfBounds();
      const combined = new THREE.Box3();
      if (!bimBox.isEmpty()) combined.union(bimBox);
      if (dxfBox && !dxfBox.isEmpty()) combined.union(dxfBox);
      if (combined.isEmpty()) return FALLBACK_CAP_SIZE;
      sceneBounds = combined;
    }
    const sphere = sceneBounds.getBoundingSphere(new THREE.Sphere());
    return Math.max(sphere.radius * CAP_QUAD_SCALE_FACTOR, FALLBACK_CAP_SIZE);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.capMesh.geometry.dispose();
    this.singlePassStencilMat.dispose();
    this.capMat.dispose();
    this.selectedCapMesh.geometry.dispose();
    this.selectedCapMat.dispose();
    const warmupMesh = this.warmupScene.children[0] as THREE.Mesh | undefined;
    if (warmupMesh) {
      warmupMesh.geometry.dispose();
      this.warmupScene.remove(warmupMesh);
    }
    while (this.capScene.children.length > 0) {
      this.capScene.remove(this.capScene.children[0]);
    }
    while (this.selectedCapScene.children.length > 0) {
      this.selectedCapScene.remove(this.selectedCapScene.children[0]);
    }
  }
}
