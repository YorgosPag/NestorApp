/**
 * SectionBox — Pure Three.js implementation για ADR-366 §A.3 Phase 7.0.
 *
 * Διαχειρίζεται 6 face meshes (semi-transparent grey clip-volume indicator)
 * + 6 handle discs (CAD_UI_COLORS.grips) για face-axis drag. Δεν γνωρίζει
 * την εφαρμογή των clipping planes — απλώς εκθέτει `getPlanes()` και
 * το ThreeJsSceneManager περνά το αποτέλεσμα στον applicator.
 *
 * Face meshes + handles φέρουν `userData['sectionBoxPart']=true` ώστε ο
 * clip applicator να τα παρακάμπτει (αλλιώς θα κλιπίζονταν από τον εαυτό
 * τους).
 *
 * Pointer events: capture-phase listener στο renderer.domElement. Αν hit
 * handle → claim drag (stopImmediatePropagation), αλλιώς ο camera handler
 * δουλεύει κανονικά (tumble). Shift+drag = symmetric.
 *
 * @see ADR-366 §A.3.Q1, Q2, Q5
 */

import * as THREE from 'three';
import { CAD_UI_COLORS, HOVER_HIGHLIGHT, SECTION_CUT_SURFACE } from '../../../config/color-config';
import type { SectionBoxBounds, Axis, AxisSide } from '../../stores/SectionStore';

interface HandleSpec {
  readonly axis: Axis;
  readonly side: AxisSide;
  /** Outward normal (unit) */
  readonly normal: readonly [number, number, number];
}

const HANDLE_SPECS: ReadonlyArray<HandleSpec> = [
  { axis: 'x', side: 'min', normal: [-1, 0, 0] },
  { axis: 'x', side: 'max', normal: [1, 0, 0] },
  { axis: 'y', side: 'min', normal: [0, -1, 0] },
  { axis: 'y', side: 'max', normal: [0, 1, 0] },
  { axis: 'z', side: 'min', normal: [0, 0, -1] },
  { axis: 'z', side: 'max', normal: [0, 0, 1] },
];

const HANDLE_RADIUS = 0.25;
const FACE_USERDATA_KEY = 'sectionBoxPart';

interface DragState {
  readonly spec: HandleSpec;
  readonly startBounds: SectionBoxBounds;
  readonly startWorld: THREE.Vector3;
  readonly dragPlane: THREE.Plane;
}

export interface SectionBoxCallbacks {
  /** Άξονας/side dragged → νέα τιμή. ThreeJsSceneManager το γράφει στο store. */
  onAxisDrag(axis: Axis, side: AxisSide, value: number): void;
}

export class SectionBox {
  readonly root: THREE.Group;
  private readonly faces: THREE.Mesh[] = [];
  private readonly handles: THREE.Mesh[] = [];
  private readonly faceMaterial: THREE.MeshBasicMaterial;
  private readonly handleMaterialIdle: THREE.MeshBasicMaterial;
  private readonly handleMaterialHover: THREE.MeshBasicMaterial;
  private readonly raycaster = new THREE.Raycaster();
  private bounds: SectionBoxBounds | null = null;
  private hoveredHandle: THREE.Mesh | null = null;
  private dragState: DragState | null = null;
  private disposed = false;

  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'section-box-root';
    this.root.visible = false;

    this.faceMaterial = new THREE.MeshBasicMaterial({
      color: SECTION_CUT_SURFACE.color,
      opacity: SECTION_CUT_SURFACE.opacity,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.handleMaterialIdle = new THREE.MeshBasicMaterial({
      color: CAD_UI_COLORS.grips.color_unselected,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    this.handleMaterialHover = new THREE.MeshBasicMaterial({
      color: HOVER_HIGHLIGHT.ENTITY.glowColor,
      depthTest: false,
      transparent: true,
      opacity: 1,
    });

    this.buildFaces();
    this.buildHandles();
  }

  private buildFaces(): void {
    // Unit plane geometry: 1x1, axis-aligned to XY. We orient + scale per face in setFromBounds().
    const geom = new THREE.PlaneGeometry(1, 1);
    for (const spec of HANDLE_SPECS) {
      const mesh = new THREE.Mesh(geom, this.faceMaterial);
      mesh.userData[FACE_USERDATA_KEY] = true;
      mesh.userData['sectionFaceSpec'] = spec;
      mesh.renderOrder = 990;
      this.root.add(mesh);
      this.faces.push(mesh);
    }
  }

  private buildHandles(): void {
    const geom = new THREE.SphereGeometry(HANDLE_RADIUS, 16, 12);
    for (const spec of HANDLE_SPECS) {
      const mesh = new THREE.Mesh(geom, this.handleMaterialIdle);
      mesh.userData[FACE_USERDATA_KEY] = true;
      mesh.userData['sectionHandleSpec'] = spec;
      mesh.renderOrder = 999;
      this.root.add(mesh);
      this.handles.push(mesh);
    }
  }

  setFromBounds(bounds: SectionBoxBounds): void {
    if (this.disposed) return;
    this.bounds = bounds;
    const min = bounds.min;
    const max = bounds.max;
    const sx = max[0] - min[0];
    const sy = max[1] - min[1];
    const sz = max[2] - min[2];
    const cx = (max[0] + min[0]) / 2;
    const cy = (max[1] + min[1]) / 2;
    const cz = (max[2] + min[2]) / 2;

    for (let i = 0; i < HANDLE_SPECS.length; i++) {
      const spec = HANDLE_SPECS[i];
      const face = this.faces[i];
      const handle = this.handles[i];
      this.positionFace(face, spec, min, max, sx, sy, sz);
      this.positionHandle(handle, spec, cx, cy, cz, min, max);
    }
  }

  private positionFace(
    face: THREE.Mesh,
    spec: HandleSpec,
    min: readonly [number, number, number],
    max: readonly [number, number, number],
    sx: number,
    sy: number,
    sz: number,
  ): void {
    face.position.set((max[0] + min[0]) / 2, (max[1] + min[1]) / 2, (max[2] + min[2]) / 2);
    face.rotation.set(0, 0, 0);
    if (spec.axis === 'x') {
      face.position.x = spec.side === 'min' ? min[0] : max[0];
      face.rotation.y = Math.PI / 2;
      face.scale.set(sz, sy, 1);
    } else if (spec.axis === 'y') {
      face.position.y = spec.side === 'min' ? min[1] : max[1];
      face.rotation.x = Math.PI / 2;
      face.scale.set(sx, sz, 1);
    } else {
      face.position.z = spec.side === 'min' ? min[2] : max[2];
      face.scale.set(sx, sy, 1);
    }
  }

  private positionHandle(
    handle: THREE.Mesh,
    spec: HandleSpec,
    cx: number,
    cy: number,
    cz: number,
    min: readonly [number, number, number],
    max: readonly [number, number, number],
  ): void {
    if (spec.axis === 'x') handle.position.set(spec.side === 'min' ? min[0] : max[0], cy, cz);
    else if (spec.axis === 'y') handle.position.set(cx, spec.side === 'min' ? min[1] : max[1], cz);
    else handle.position.set(cx, cy, spec.side === 'min' ? min[2] : max[2]);
  }

  /** Three.Plane list για όλες τις 6 outward-facing faces (box mode). */
  getPlanes(): THREE.Plane[] {
    if (!this.bounds) return [];
    const planes: THREE.Plane[] = [];
    for (const spec of HANDLE_SPECS) {
      const n = new THREE.Vector3(spec.normal[0], spec.normal[1], spec.normal[2]);
      // For outward normal, points OUTSIDE box satisfy n·p > constant → clip them.
      // Three.js Material.clippingPlanes clips OUT the half-space where n·p + constant > 0.
      // We want to keep INSIDE box → for +X face (n=+X), keep x ≤ max[0] → clip x > max[0]
      //   → n·p - max[0] > 0 ⇒ plane = THREE.Plane(n, -max[0]).
      // For -X face (n=-X), keep x ≥ min[0] → clip x < min[0] → -x > -min[0] ⇒ Plane(-X, +min[0]).
      const idx = spec.axis === 'x' ? 0 : spec.axis === 'y' ? 1 : 2;
      const value = spec.side === 'max' ? this.bounds.max[idx] : this.bounds.min[idx];
      const constant = spec.side === 'max' ? -value : value;
      planes.push(new THREE.Plane(n, constant));
    }
    return planes;
  }

  setVisible(visible: boolean): void {
    if (!this.disposed) this.root.visible = visible;
  }

  // ── Pointer handling ─────────────────────────────────────────────────────

  handlePointerDown(
    clientX: number,
    clientY: number,
    camera: THREE.Camera,
    domElement: HTMLCanvasElement,
  ): boolean {
    if (this.disposed || !this.root.visible || !this.bounds) return false;
    const hit = this.raycastHandle(clientX, clientY, camera, domElement);
    if (!hit) return false;
    const spec = hit.object.userData['sectionHandleSpec'] as HandleSpec;
    const startWorld = hit.point.clone();
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const dragPlane = new THREE.Plane();
    dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), startWorld);
    this.dragState = { spec, startBounds: this.bounds, startWorld, dragPlane };
    return true;
  }

  handlePointerMove(
    clientX: number,
    clientY: number,
    camera: THREE.Camera,
    domElement: HTMLCanvasElement,
    shiftKey: boolean,
    callbacks: SectionBoxCallbacks,
  ): void {
    if (this.disposed) return;
    if (!this.dragState) {
      this.updateHover(clientX, clientY, camera, domElement);
      return;
    }
    const current = this.projectToDragPlane(clientX, clientY, camera, domElement);
    if (!current) return;
    const { spec, startBounds, startWorld } = this.dragState;
    const delta = current.clone().sub(startWorld);
    const axisIdx = spec.axis === 'x' ? 0 : spec.axis === 'y' ? 1 : 2;
    // Scalar = motion projected onto the POSITIVE axis (not outward normal):
    // newAxisCoord = startAxisCoord + Δ_axis. Outward direction is encoded via `side`.
    const axisUnit = new THREE.Vector3(
      spec.axis === 'x' ? 1 : 0,
      spec.axis === 'y' ? 1 : 0,
      spec.axis === 'z' ? 1 : 0,
    );
    const scalar = delta.dot(axisUnit);
    const startValue = spec.side === 'max' ? startBounds.max[axisIdx] : startBounds.min[axisIdx];
    callbacks.onAxisDrag(spec.axis, spec.side, startValue + scalar);
    if (shiftKey) {
      // Mirror: opposite face moves the inverse amount → symmetric box resize.
      const oppositeSide: AxisSide = spec.side === 'min' ? 'max' : 'min';
      const oppositeStart =
        oppositeSide === 'max' ? startBounds.max[axisIdx] : startBounds.min[axisIdx];
      callbacks.onAxisDrag(spec.axis, oppositeSide, oppositeStart - scalar);
    }
  }

  handlePointerUp(): void {
    this.dragState = null;
  }

  isDragging(): boolean {
    return this.dragState !== null;
  }

  private projectToDragPlane(
    clientX: number,
    clientY: number,
    camera: THREE.Camera,
    domElement: HTMLCanvasElement,
  ): THREE.Vector3 | null {
    if (!this.dragState) return null;
    const ndc = this.toNdc(clientX, clientY, domElement);
    this.raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    const ok = this.raycaster.ray.intersectPlane(this.dragState.dragPlane, hit);
    return ok ? hit : null;
  }

  private raycastHandle(
    clientX: number,
    clientY: number,
    camera: THREE.Camera,
    domElement: HTMLCanvasElement,
  ): THREE.Intersection | null {
    const ndc = this.toNdc(clientX, clientY, domElement);
    this.raycaster.setFromCamera(ndc, camera);
    const hits = this.raycaster.intersectObjects(this.handles, false);
    return hits.length > 0 ? hits[0] : null;
  }

  private updateHover(
    clientX: number,
    clientY: number,
    camera: THREE.Camera,
    domElement: HTMLCanvasElement,
  ): void {
    const hit = this.raycastHandle(clientX, clientY, camera, domElement);
    const newHovered = (hit?.object as THREE.Mesh | undefined) ?? null;
    if (newHovered === this.hoveredHandle) return;
    if (this.hoveredHandle) this.hoveredHandle.material = this.handleMaterialIdle;
    if (newHovered) newHovered.material = this.handleMaterialHover;
    this.hoveredHandle = newHovered;
  }

  private toNdc(clientX: number, clientY: number, domElement: HTMLCanvasElement): THREE.Vector2 {
    const rect = domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    // Geometry/material are shared across faces / handles — dispose each once.
    if (this.faces[0]) this.faces[0].geometry.dispose();
    if (this.handles[0]) this.handles[0].geometry.dispose();
    this.faceMaterial.dispose();
    this.handleMaterialIdle.dispose();
    this.handleMaterialHover.dispose();
    while (this.root.children.length > 0) this.root.remove(this.root.children[0]);
  }
}
