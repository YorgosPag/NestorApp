/**
 * SectionSceneController — Owns ADR-366 §A.3 Phase 7.0 wiring inside the
 * Three.js scene. Extracted from ThreeJsSceneManager για να μην ξεπεράσει το
 * 500-line όριο (N.7.1).
 *
 * Responsibilities:
 *  - Construct + own the SectionBox (Three.js geometry)
 *  - Subscribe to SectionStore (enabled / mode / bounds / planes)
 *  - Apply / clear clipping planes via the applicator
 *  - Lazy-init box bounds από το geometry bbox (first call)
 *  - Capture-phase pointer handlers για drag των box handles
 *
 * Pure ownership — δεν αγγίζει camera/POI/render loop κλπ. ThreeJsSceneManager
 * τo κρατάει σαν private field και delegates `init` + dispose.
 */

import * as THREE from 'three';
import { useSectionStore, type SectionBoxBounds } from '../stores/SectionStore';
import { SectionBox } from '../systems/section/SectionBox';
import { applyClippingPlanes, clearClippingPlanes } from '../systems/section/section-clip-applicator';

export interface SectionControllerDeps {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly getCamera: () => THREE.Camera;
  readonly getBimGroup: () => THREE.Object3D;
  readonly getDxfBounds: () => THREE.Box3 | null;
  readonly invalidatePathTracer: () => void;
}

export class SectionSceneController {
  private readonly deps: SectionControllerDeps;
  private readonly sectionBox: SectionBox;
  private readonly storeUnsub: () => void;
  private readonly pointerDown: (e: PointerEvent) => void;
  private readonly pointerMove: (e: PointerEvent) => void;
  private readonly pointerUp: (e: PointerEvent) => void;
  private initDone = false;
  private disposed = false;

  constructor(deps: SectionControllerDeps) {
    this.deps = deps;
    deps.renderer.localClippingEnabled = true;
    this.sectionBox = new SectionBox();
    deps.scene.add(this.sectionBox.root);
    this.storeUnsub = this.subscribeStore();
    this.pointerDown = (e) => this.onPointerDown(e);
    this.pointerMove = (e) => this.onPointerMove(e);
    this.pointerUp = (e) => this.onPointerUp(e);
    const dom = deps.renderer.domElement;
    dom.addEventListener('pointerdown', this.pointerDown, { capture: true });
    dom.addEventListener('pointermove', this.pointerMove, { capture: true });
    dom.addEventListener('pointerup', this.pointerUp, { capture: true });
  }

  /** Καλείται από τον manager μετά από geometry sync. Idempotent. */
  ensureInit(): void {
    if (this.disposed || this.initDone) return;
    const box = new THREE.Box3();
    const bimBox = new THREE.Box3().setFromObject(this.deps.getBimGroup());
    if (!bimBox.isEmpty()) box.union(bimBox);
    const dxfBox = this.deps.getDxfBounds();
    if (dxfBox && !dxfBox.isEmpty()) box.union(dxfBox);
    if (box.isEmpty()) return;
    const size = new THREE.Vector3();
    box.getSize(size);
    box.expandByVector(size.multiplyScalar(0.1));
    const bounds: SectionBoxBounds = {
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
    };
    useSectionStore.getState().setBoxBounds(bounds);
    this.initDone = true;
  }

  applyState(): void {
    if (this.disposed) return;
    const { enabled, mode, boxBounds, planes } = useSectionStore.getState();
    if (!enabled) {
      clearClippingPlanes(this.deps.scene);
      this.sectionBox.setVisible(false);
      this.deps.invalidatePathTracer();
      return;
    }
    if (mode === 'box') {
      if (boxBounds) this.sectionBox.setFromBounds(boxBounds);
      this.sectionBox.setVisible(true);
      applyClippingPlanes(this.deps.scene, this.sectionBox.getPlanes());
    } else {
      this.sectionBox.setVisible(false);
      const threePlanes = planes
        .filter((p) => p.enabled)
        .map(
          (p) => new THREE.Plane(
            new THREE.Vector3(p.normal[0], p.normal[1], p.normal[2]),
            p.constant,
          ),
        );
      applyClippingPlanes(this.deps.scene, threePlanes);
    }
    this.deps.invalidatePathTracer();
  }

  private subscribeStore(): () => void {
    const cb = (): void => this.applyState();
    const u1 = useSectionStore.subscribe((s) => s.enabled, cb);
    const u2 = useSectionStore.subscribe((s) => s.mode, cb);
    const u3 = useSectionStore.subscribe((s) => s.boxBounds, cb);
    const u4 = useSectionStore.subscribe((s) => s.planes, cb);
    return () => { u1(); u2(); u3(); u4(); };
  }

  private onPointerDown(e: PointerEvent): void {
    const { enabled, mode } = useSectionStore.getState();
    if (!enabled || mode !== 'box') return;
    const dom = this.deps.renderer.domElement;
    const claimed = this.sectionBox.handlePointerDown(e.clientX, e.clientY, this.deps.getCamera(), dom);
    if (!claimed) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    dom.setPointerCapture(e.pointerId);
  }

  private onPointerMove(e: PointerEvent): void {
    const { enabled, mode } = useSectionStore.getState();
    if (!enabled || mode !== 'box') return;
    const dom = this.deps.renderer.domElement;
    const wasDragging = this.sectionBox.isDragging();
    this.sectionBox.handlePointerMove(e.clientX, e.clientY, this.deps.getCamera(), dom, e.shiftKey, {
      onAxisDrag: (axis, side, value) => {
        useSectionStore.getState().setBoxBoundsAxis(axis, side, value);
      },
    });
    if (wasDragging || this.sectionBox.isDragging()) e.stopImmediatePropagation();
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.sectionBox.isDragging()) return;
    this.sectionBox.handlePointerUp();
    try { this.deps.renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    e.stopImmediatePropagation();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.storeUnsub();
    const dom = this.deps.renderer.domElement;
    const opts = { capture: true } as EventListenerOptions;
    dom.removeEventListener('pointerdown', this.pointerDown, opts);
    dom.removeEventListener('pointermove', this.pointerMove, opts);
    dom.removeEventListener('pointerup', this.pointerUp, opts);
    this.sectionBox.dispose();
  }
}
