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
import { SectionStencilRenderer } from '../systems/section/section-stencil-renderer';
import { useCropRegionStore } from '../render/crop-region/CropRegionStore';
import { buildCropPlanes } from '../render/crop-region/crop-frustum-builder';
// ADR-452 — cut-plane (Revit View Range) as a 3rd clip source, composed here so
// this controller stays the SINGLE owner of the scene's clipping planes.
import { resolveCutPlane } from './cut-plane-3d';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { useActiveStoreyStore } from '../../systems/levels/active-storey-store';

export interface SectionControllerDeps {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly getCamera: () => THREE.Camera;
  readonly getBimGroup: () => THREE.Object3D;
  readonly getDxfBounds: () => THREE.Box3 | null;
  readonly invalidatePathTracer: () => void;
  /** ADR-452 — request an on-demand raster repaint (slider drag drives clip change). */
  readonly markDirty: () => void;
}

export class SectionSceneController {
  private readonly deps: SectionControllerDeps;
  private readonly sectionBox: SectionBox;
  private readonly stencilRenderer: SectionStencilRenderer;
  private readonly storeUnsub: () => void;
  private readonly cropUnsub: () => void;
  private readonly pointerDown: (e: PointerEvent) => void;
  private readonly pointerMove: (e: PointerEvent) => void;
  private readonly pointerUp: (e: PointerEvent) => void;
  private initDone = false;
  private disposed = false;
  private cachedPlanes: THREE.Plane[] = [];
  /** Combined cut-plane + section + crop planes (≤ 6 total, Three.js hard limit). */
  private combinedPlanes: THREE.Plane[] = [];
  /** ADR-452 — the horizontal cut plane (Revit View Range), or null when off. Capped via the single-plane path. */
  private cutPlane: THREE.Plane | null = null;
  /** ADR-452 — section box / crop planes only (excludes the cut plane). Drives the box stencil-cap loop. */
  private sectionPlanes: THREE.Plane[] = [];
  /** ADR-452 — true when any clip source (section box OR cut plane) is active. */
  private clipActive = false;

  constructor(deps: SectionControllerDeps) {
    this.deps = deps;
    deps.renderer.localClippingEnabled = true;
    this.sectionBox = new SectionBox();
    deps.scene.add(this.sectionBox.root);
    this.stencilRenderer = new SectionStencilRenderer({
      getBimGroup: deps.getBimGroup,
      getDxfBounds: deps.getDxfBounds,
    });
    this.storeUnsub = this.subscribeStore();
    this.cropUnsub = useCropRegionStore.subscribe(
      (s) => s.editState,
      () => this.applyState(),
    );
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
    // ADR-452 — cut plane is an independent clip source; it stays active even when
    // the Section Box is off.
    const cutPlane = resolveCutPlane();
    this.cutPlane = cutPlane;
    this.clipActive = enabled || cutPlane !== null;

    if (!this.clipActive) {
      clearClippingPlanes(this.deps.scene);
      this.sectionBox.setVisible(false);
      this.cachedPlanes = [];
      this.combinedPlanes = [];
      this.sectionPlanes = [];
      this.deps.invalidatePathTracer();
      this.deps.markDirty();
      return;
    }

    // Section-box / planes-mode geometry only when the Section feature is enabled.
    if (enabled && mode === 'box') {
      if (boxBounds) this.sectionBox.setFromBounds(boxBounds);
      this.sectionBox.setVisible(true);
      this.cachedPlanes = this.sectionBox.getPlanes();
    } else if (enabled) {
      this.sectionBox.setVisible(false);
      this.cachedPlanes = planes
        .filter((p) => p.enabled)
        .map(
          (p) => new THREE.Plane(
            new THREE.Vector3(p.normal[0], p.normal[1], p.normal[2]),
            p.constant,
          ),
        );
    } else {
      this.sectionBox.setVisible(false);
      this.cachedPlanes = [];
    }

    const cropPlanes = this.buildCropPlanes();
    // Cut plane FIRST so it survives the Three.js 6-plane hard limit even when a
    // full 6-plane section box is also active (rare combo).
    const all = cutPlane
      ? [cutPlane, ...this.cachedPlanes, ...cropPlanes]
      : [...this.cachedPlanes, ...cropPlanes];
    this.combinedPlanes = all.slice(0, 6);
    // Section box / crop planes that survived the 6-plane clip slice, EXCLUDING the
    // cut plane — these feed the box stencil-cap loop (unchanged) and bound the
    // single-plane cut cap. The cut plane is capped separately (correct lone-plane
    // algorithm), so it must not enter the box loop (its depth-parity trick garbles
    // a lone horizontal plane).
    this.sectionPlanes = cutPlane ? this.combinedPlanes.slice(1) : this.combinedPlanes;
    applyClippingPlanes(this.deps.scene, this.combinedPlanes);
    this.deps.invalidatePathTracer();
    this.deps.markDirty();
  }

  /**
   * True αν το section είναι ενεργό ΚΑΙ έχει τουλάχιστον 1 active plane.
   * Καθορίζει αν ο render loop θα κάνει direct render + stencil caps
   * (bypass composer) αντί για την κανονική SSAO pipeline.
   */
  isStencilActive(): boolean {
    if (this.disposed) return false;
    // ADR-452 — caps render whenever any clip source (section box OR cut plane) is live.
    return this.clipActive && this.combinedPlanes.length > 0;
  }

  private buildCropPlanes(): THREE.Plane[] {
    const cropState = useCropRegionStore.getState();
    if (cropState.editState !== 'committed' || !cropState.rectangle) return [];
    const camera = this.deps.getCamera();
    const depthRange = cropState.depthRangeEnabled
      ? { near: cropState.nearNorm, far: cropState.farNorm }
      : undefined;
    return buildCropPlanes(cropState.rectangle, camera, depthRange);
  }

  /**
   * Render καρέ με stencil caps. Καλείται από τον ThreeJsSceneManager όταν
   * `isStencilActive()` είναι true. Bypasses EffectComposer/SSAO (το default
   * RT δεν έχει stencil buffer).
   */
  renderFrameWithCaps(camera: THREE.Camera): void {
    if (this.disposed) return;
    const renderer = this.deps.renderer;
    // ADR-452 — fat-line edge overlays can't be clipped (LineMaterial clipping throws
    // a shader compile error on this build), so the wireframe of everything above the
    // cut would float as a phantom "cage". Suppress it geometrically: hide every edge
    // overlay that extends above the cut for the duration of this frame, then restore.
    const restoreEdges = this.cutPlane ? this.hideEdgesAboveCut(this.cutPlane.constant) : null;

    renderer.autoClear = true;
    renderer.render(this.deps.scene, camera);
    const bounds = this.computeSceneBounds();
    // Box / crop caps via the existing multi-plane loop (cut plane excluded).
    if (this.sectionPlanes.length > 0) {
      this.stencilRenderer.render(renderer, this.deps.scene, camera, this.sectionPlanes, bounds);
    }
    // ADR-452 — the horizontal cut plane caps via the correct single-plane path,
    // bounded by the section/crop planes (if any).
    if (this.cutPlane) {
      this.stencilRenderer.renderHorizontalCutCap(
        renderer, this.deps.scene, camera, this.cutPlane, this.sectionPlanes, bounds,
      );
    }
    restoreEdges?.();
  }

  /**
   * ADR-452 — hide every fat-line edge overlay whose top sits above the cut plane,
   * returning a closure that restores them. The cut clips solid FACES (their
   * materials accept clip planes) but `LineMaterial` throws when clipped, so its
   * edges would otherwise persist above the cut as a floating cage / top rims.
   * Each overlay's world top-Y is cached in `userData` (geometry is static).
   * `cutWorldY` = the cut plane's `constant` (its world-Y, normal = (0,-1,0)).
   */
  private hideEdgesAboveCut(cutWorldY: number): () => void {
    const EPS = 1e-4;
    const hidden: THREE.Object3D[] = [];
    const tmp = new THREE.Box3();
    this.deps.getBimGroup().traverse((obj) => {
      if (obj.userData['bimEdgeOverlay'] !== true || !obj.visible) return;
      let topY = obj.userData['bimEdgeTopY'] as number | undefined;
      if (topY === undefined) {
        tmp.setFromObject(obj);
        topY = tmp.isEmpty() ? -Infinity : tmp.max.y;
        obj.userData['bimEdgeTopY'] = topY;
      }
      if (topY > cutWorldY + EPS) {
        obj.visible = false;
        hidden.push(obj);
      }
    });
    return () => { for (const o of hidden) o.visible = true; };
  }

  private computeSceneBounds(): THREE.Box3 | null {
    const box = new THREE.Box3();
    const bimBox = new THREE.Box3().setFromObject(this.deps.getBimGroup());
    if (!bimBox.isEmpty()) box.union(bimBox);
    const dxfBox = this.deps.getDxfBounds();
    if (dxfBox && !dxfBox.isEmpty()) box.union(dxfBox);
    return box.isEmpty() ? null : box;
  }

  private subscribeStore(): () => void {
    const cb = (): void => this.applyState();
    const u1 = useSectionStore.subscribe((s) => s.enabled, cb);
    const u2 = useSectionStore.subscribe((s) => s.mode, cb);
    const u3 = useSectionStore.subscribe((s) => s.boxBounds, cb);
    const u4 = useSectionStore.subscribe((s) => s.planes, cb);
    // ADR-452 — re-compose clip planes when the cut-plane SSoT or the active storey
    // changes. These stores are plain (no subscribeWithSelector), so we listen to
    // every change; the cut-plane slider drag only mutates cutPlaneMm, and applyState
    // is idempotent, so the extra calls are cheap and user-frequency.
    const u5 = useBimRenderSettingsStore.subscribe(cb);
    const u6 = useActiveStoreyStore.subscribe(cb);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
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
    this.cropUnsub();
    const dom = this.deps.renderer.domElement;
    const opts = { capture: true } as EventListenerOptions;
    dom.removeEventListener('pointerdown', this.pointerDown, opts);
    dom.removeEventListener('pointermove', this.pointerMove, opts);
    dom.removeEventListener('pointerup', this.pointerUp, opts);
    this.sectionBox.dispose();
    this.stencilRenderer.dispose();
  }
}
