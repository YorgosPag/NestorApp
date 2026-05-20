/**
 * SectionBox — Pure Three.js implementation για ADR-366 §A.3 Phase 7.0 + 7.0a.
 *
 * Phase 7.0a αλλαγή: τα 6 solid face meshes αντικαταστάθηκαν από ενιαίο
 * wireframe edge box (12 line segments). Λόγος: τα ΠΡΑΓΜΑΤΙΚΑ solid caps
 * έρχονται πλέον από το `SectionStencilRenderer` (true stencil cap pattern).
 * Το SectionBox κρατά μόνο edge outline + 6 handle spheres για drag UX.
 * Αυτό αποφεύγει z-fight μεταξύ face meshes και stencil caps.
 *
 * Edges + handles φέρουν `userData['sectionBoxPart']=true` ώστε ο clip
 * applicator να τα παρακάμπτει (αλλιώς θα κλιπίζονταν από τον εαυτό τους).
 *
 * Pointer events: capture-phase listener στο renderer.domElement. Αν hit
 * handle → claim drag (stopImmediatePropagation), αλλιώς ο camera handler
 * δουλεύει κανονικά (tumble). Shift+drag = symmetric.
 *
 * @see ADR-366 §A.3.Q1, Q2, Q5
 * @see ADR-366 §A.3 Phase 7.0a — True Stencil Cap
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
  private readonly edgeBox: THREE.LineSegments;
  private readonly handles: THREE.Mesh[] = [];
  private readonly edgeMaterial: THREE.LineBasicMaterial;
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

    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: SECTION_CUT_SURFACE.color,
      transparent: true,
      opacity: 0.85,
      depthTest: true,
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

    this.edgeBox = this.buildEdgeBox();
    this.root.add(this.edgeBox);
    this.buildHandles();
  }

  private buildEdgeBox(): THREE.LineSegments {
    // Unit cube edges: BoxGeometry → EdgesGeometry → 12 line segments. Scale per bounds.
    const boxGeom = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(boxGeom);
    boxGeom.dispose();
    const lines = new THREE.LineSegments(edges, this.edgeMaterial);
    lines.userData[FACE_USERDATA_KEY] = true;
    lines.renderOrder = 990;
    return lines;
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

    this.edgeBox.position.set(cx, cy, cz);
    this.edgeBox.scale.set(sx, sy, sz);

    for (let i = 0; i < HANDLE_SPECS.length; i++) {
      const spec = HANDLE_SPECS[i];
      const handle = this.handles[i];
      this.positionHandle(handle, spec, cx, cy, cz, min, max);
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
    this.edgeBox.geometry.dispose();
    if (this.handles[0]) this.handles[0].geometry.dispose();
    this.edgeMaterial.dispose();
    this.handleMaterialIdle.dispose();
    this.handleMaterialHover.dispose();
    while (this.root.children.length > 0) this.root.remove(this.root.children[0]);
  }
}
