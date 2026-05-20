/**
 * SectionStencilRenderer — True stencil cap pattern για ADR-366 §A.3 Phase 7.0a.
 *
 * Λύνει το πρόβλημα του Phase 7.0 base: τα face meshes του SectionBox ήταν
 * placeholder visual indicator (Navisworks-style). Το cut face έδειχνε
 * "κούφιο" interior αντί solid filled surface.
 *
 * Pattern: Three.js webgl_clipping_stencil example.
 *   https://threejs.org/examples/?q=clip#webgl_clipping_stencil
 *
 * Algorithm (per enabled clip plane i):
 *   1. clearStencil()
 *   2. scene.overrideMaterial = backStencilMat
 *      (BackSide, IncrementWrap, color/depth write OFF, clipping=others)
 *      → renderer.render(scene, camera)
 *   3. scene.overrideMaterial = frontStencilMat (FrontSide, DecrementWrap)
 *      → renderer.render(scene, camera)
 *   4. scene.overrideMaterial = null
 *   5. Position cap mesh on plane i, render capScene with stencilFunc=NotEqual,0
 *      → solid SECTION_CUT_SURFACE fill where geometry was cut
 *
 * Cap material clips with `others` (όχι self) ώστε το ίδιο το cap να μην
 * αποκόπτεται από την τομή που γεμίζει. Render order: caller πρέπει να έχει
 * ήδη ζωγραφίσει την κύρια σκηνή με ΟΛΑ τα planes ενεργά. Καλείται μετά,
 * γράφει caps πάνω από το main render via stencil mask.
 *
 * Trade-off: SSAO/composer bypass όταν section enabled (default render target
 * δεν έχει stencil buffer). Αποδεκτό — section editing = active interaction,
 * SSAO ενεργοποιείται μόνο σε idle.
 *
 * @see ADR-366 §A.3.Q4 — Cut surface visual decision
 */

import * as THREE from 'three';
import { SECTION_CUT_SURFACE } from '../../../config/color-config';

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
  private readonly backStencilMat: THREE.MeshBasicMaterial;
  private readonly frontStencilMat: THREE.MeshBasicMaterial;
  private readonly capMat: THREE.MeshBasicMaterial;
  private readonly capMesh: THREE.Mesh;
  private readonly capScene: THREE.Scene;
  private disposed = false;

  constructor(deps: StencilRendererDeps) {
    this.deps = deps;
    this.backStencilMat = this.createStencilMaterial(
      THREE.BackSide,
      THREE.IncrementWrapStencilOp,
    );
    this.frontStencilMat = this.createStencilMaterial(
      THREE.FrontSide,
      THREE.DecrementWrapStencilOp,
    );
    this.capMat = this.createCapMaterial();
    const geom = new THREE.PlaneGeometry(1, 1);
    this.capMesh = new THREE.Mesh(geom, this.capMat);
    this.capMesh.frustumCulled = false;
    this.capScene = new THREE.Scene();
    this.capScene.add(this.capMesh);
  }

  private createStencilMaterial(
    side: THREE.Side,
    op: THREE.StencilOp,
  ): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial();
    mat.depthWrite = false;
    mat.depthTest = true;
    mat.colorWrite = false;
    mat.side = side;
    mat.stencilWrite = true;
    mat.stencilFunc = THREE.AlwaysStencilFunc;
    mat.stencilFail = op;
    mat.stencilZFail = op;
    mat.stencilZPass = op;
    return mat;
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

  /**
   * Render stencil caps για κάθε enabled plane. Καλείται ΜΕΤΑ το main scene
   * render (καλούμενος πρέπει να έχει κάνει renderer.render(scene, camera)
   * πρώτα με ΟΛΑ τα planes clipping ενεργά).
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
    const currentPlane = planes[index];
    const others = planes.filter((_, idx) => idx !== index);
    this.backStencilMat.clippingPlanes = others as THREE.Plane[];
    this.frontStencilMat.clippingPlanes = others as THREE.Plane[];
    this.capMat.clippingPlanes = others as THREE.Plane[];

    renderer.clearStencil();

    mainScene.overrideMaterial = this.backStencilMat;
    renderer.render(mainScene, camera);

    mainScene.overrideMaterial = this.frontStencilMat;
    renderer.render(mainScene, camera);

    mainScene.overrideMaterial = null;

    this.positionCapMesh(currentPlane, capSize);
    renderer.render(this.capScene, camera);
  }

  private positionCapMesh(plane: THREE.Plane, capSize: number): void {
    // Point on plane closest to origin: -normal * constant
    const normal = plane.normal;
    const pointOnPlane = normal.clone().multiplyScalar(-plane.constant);
    this.capMesh.position.copy(pointOnPlane);
    // Align quad normal (default +Z) with plane normal
    const defaultNormal = new THREE.Vector3(0, 0, 1);
    this.capMesh.quaternion.setFromUnitVectors(defaultNormal, normal);
    this.capMesh.scale.set(capSize, capSize, 1);
    this.capMesh.updateMatrix();
    this.capMesh.updateMatrixWorld(true);
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
    this.backStencilMat.dispose();
    this.frontStencilMat.dispose();
    this.capMat.dispose();
    while (this.capScene.children.length > 0) {
      this.capScene.remove(this.capScene.children[0]);
    }
  }
}
