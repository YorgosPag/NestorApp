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
import { SectionStencilRenderer, type SectionCapQuality } from '../systems/section/section-stencil-renderer';
import { useCropRegionStore } from '../render/crop-region/CropRegionStore';
import { buildCropPlanes } from '../render/crop-region/crop-frustum-builder';
// ADR-452/455 — axis cut planes (horizontal Z View Range + vertical X/Y sections)
// as extra clip sources, composed here so this controller stays the SINGLE owner of
// the scene's clipping planes.
import { resolveAllAxisCuts, type ResolvedAxisCut } from './cut-plane-3d';
import { composeCutEntries, axisCutCompositionKey, detectCutMoving, composeClipPlanes, MAX_CLIP_PLANES, type AxisCutEntry } from './axis-cut-composer';
import { applyEdgeCutTrim, restoreEdgeCut } from './edge-cut-applicator';
import { unionSceneBounds } from './section-scene-bounds';
import { renderUnderlay, type UnderlayRootGetter } from './underlay-pass';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { useActiveStoreyStore } from '../../systems/levels/active-storey-store';
import { DXF_TIMING } from '../../config/dxf-timing';

export interface SectionControllerDeps {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly getCamera: () => THREE.Camera;
  readonly getBimGroup: () => THREE.Object3D;
  readonly getDxfBounds: () => THREE.Box3 | null;
  /** ADR-537 underlay-depth — owner accessor for the DXF underlay root (`DxfToThreeConverter.getRoot`). */
  readonly getUnderlayRoot: UnderlayRootGetter;
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
  /** ADR-452/455 — active axis cut planes (Z horizontal + X/Y vertical), 0–3. Each capped via the single-plane path. */
  private axisCuts: AxisCutEntry[] = [];
  /** ADR-452 — section box / crop planes only (excludes the cut planes). Drives the box stencil-cap loop. */
  private sectionPlanes: THREE.Plane[] = [];
  /** ADR-452 — true when any clip source (section box OR cut plane) is active. */
  private clipActive = false;
  /**
   * ADR-452 v2.7 — refine-on-idle for the (expensive) stencil caps. The cut/box cap
   * passes re-render the whole BIM scene 2×(1+N_colours) times per frame; doing the
   * full per-material poché on EVERY drag/orbit frame drops to ~10 fps. So while the
   * camera orbits OR the cut plane is moving we render only the cheap opaque grey
   * base, then a one-shot timer forces a single FULL-quality frame once motion
   * settles (the on-demand scheduler keeps that frame on screen). Mirrors the
   * SSAO "refine-on-idle" pattern already used for the composer path.
   */
  private lastRenderedCutConstants: number[] = [];
  private refineTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly REFINE_DELAY_MS = DXF_TIMING.ui.SECTION_REFINE; // ADR-516
  /**
   * ADR-452 v2.12 — throttle for the GPU-heavy EXACT edge trim WHILE the slider is
   * actively dragging (`cutMoving`). On a dense floor, re-uploading every crossing edge
   * overlay's geometry on every drag frame can stutter; a ~50 ms cap keeps the edges
   * following the plane smoothly (≤50 ms lag, imperceptible on normal scenes, still
   * gradual) while bounding GPU uploads — the Revit-style "regen throttle" for heavy
   * models. Settled / camera-static frames are NEVER throttled: the per-overlay
   * `bimEdgeAppliedCutY` guard makes those nearly free, keeps them self-healing, and
   * guarantees the final exact trim lands the instant the slider settles.
   */
  private lastEdgeTrimMs = 0;
  private static readonly EDGE_TRIM_THROTTLE_MS = DXF_TIMING.frame.EDGE_TRIM; // ADR-516
  /**
   * ADR-452 v2.7 — last rendered camera pose, to treat ANY camera navigation as a
   * draft frame. `isInteracting` only flips for orbit/pan/tumble (OrbitControls
   * `start`/`end`); **wheel-zoom and animated moves call `onRenderNeeded` WITHOUT it**,
   * so they would otherwise hit the expensive full-quality cap path every frame. NaN
   * seed → the first frame always counts as moved.
   */
  private readonly lastCamPos = new THREE.Vector3(NaN, NaN, NaN);
  private readonly lastCamQuat = new THREE.Quaternion(NaN, NaN, NaN, NaN);
  private lastCamZoom = NaN;
  /**
   * ADR-452 v2.11 — clip-plane COMPOSITION key (which sources are active + their
   * geometry, EXCLUDING the cut elevation). An identical key across two applyState
   * calls means only the cut constant moved (slider drag) → fast path: mutate the
   * persistent cut-plane object in place, skip applyClippingPlanes' per-mesh
   * `needsUpdate` (the 50–157 ms RAF program re-setup). null seed → first call is slow.
   */
  private lastClipCompositionKey: string | null = null;

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
    const box = unionSceneBounds(this.deps.getBimGroup(), this.deps.getDxfBounds());
    if (!box) return;
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
    // ADR-452/455 — axis cuts (Z horizontal + X/Y vertical) are independent clip
    // sources; they stay active even when the Section Box is off.
    const resolved = resolveAllAxisCuts();
    const cutActive = resolved.length > 0;
    this.clipActive = enabled || cutActive;

    if (!this.clipActive) {
      clearClippingPlanes(this.deps.scene);
      // ADR-452 — restore any edge overlays the cut had trimmed/hidden.
      restoreEdgeCut(this.deps.getBimGroup());
      this.sectionBox.setVisible(false);
      this.cachedPlanes = [];
      this.combinedPlanes = [];
      this.sectionPlanes = [];
      this.axisCuts = [];
      this.lastClipCompositionKey = null;
      this.deps.invalidatePathTracer();
      this.deps.markDirty();
      return;
    }

    // ADR-452/455 v2.11 — FAST PATH: when ONLY cut POSITIONS moved (slider drag), the
    // plane COMPOSITION (active axes/signs + box/crop) is unchanged, so re-running
    // applyClippingPlanes (which flips `material.needsUpdate` on every mesh → per-frame
    // WebGL program re-setup, the 50–157 ms RAF jank) is pure waste. The renderer reads
    // `plane.constant` as a uniform every frame, so mutating each persistent cut-plane
    // object — the SAME instances the materials already reference — in place is enough.
    // (resolved order is stable z→x→y, matching this.axisCuts, so index i aligns.)
    const compositionKey = this.clipCompositionKey(resolved);
    if (
      this.axisCuts.length > 0 &&
      this.axisCuts.length === resolved.length &&
      compositionKey === this.lastClipCompositionKey
    ) {
      for (let i = 0; i < this.axisCuts.length; i++) {
        this.axisCuts[i].plane.constant = resolved[i].sign * resolved[i].worldCoordM;
      }
      this.deps.invalidatePathTracer();
      this.deps.markDirty();
      return;
    }
    this.lastClipCompositionKey = compositionKey;

    // SLOW PATH — composition changed (enable/disable/flip, box drag, mode, crop): rebuild.
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

    // Reuse persistent cut-plane instances when axis+sign unchanged so the fast path
    // can mutate them in place (materials keep referencing the same objects).
    this.axisCuts = composeCutEntries(resolved, this.axisCuts);
    // ADR-455 — only the Z (horizontal) cut runs the fat-line edge trim; restore the
    // overlays whenever no Z cut is active (X/Y edge trim deferred — see ADR-455).
    if (!this.axisCuts.some((e) => e.axis === 'z')) restoreEdgeCut(this.deps.getBimGroup());

    const cropPlanes = this.buildCropPlanes();
    // Cut planes FIRST so they survive the Three.js 6-plane hard limit even when a
    // full 6-plane section box is also active (rare combo).
    const cutPlanes = this.axisCuts.map((e) => e.plane);
    this.combinedPlanes = composeClipPlanes(cutPlanes, this.cachedPlanes, cropPlanes);
    if (
      process.env.NODE_ENV !== 'production' &&
      cutPlanes.length + this.cachedPlanes.length + cropPlanes.length > MAX_CLIP_PLANES
    ) {
      // Dev-only: surface silently-dropped box/crop planes (cuts are kept first).
      // eslint-disable-next-line no-console
      console.warn('[ADR-455] >6 clip planes active; box/crop surplus dropped (cuts kept first).');
    }
    // Section box / crop planes that survived the 6-plane slice, EXCLUDING the cut
    // planes (which are first) — these feed the box stencil-cap loop and bound each
    // single-plane cut cap. A cut plane must not enter the box loop (its depth-parity
    // trick garbles a lone axis plane); it is capped separately per axis.
    this.sectionPlanes = this.combinedPlanes.slice(this.axisCuts.length);
    applyClippingPlanes(this.deps.scene, this.combinedPlanes);
    // ADR-452 v2.11 — the gradual fat-line edge trim (LineMaterial can't be GPU-clipped
    // on this build) is applied in the render frame for the Z cut: a CHEAP visibility
    // cull while the slider drags, the EXACT trim once it settles.
    this.deps.invalidatePathTracer();
    this.deps.markDirty();
  }

  /**
   * ADR-452/455 v2.11 — a cheap string key of the clip-plane COMPOSITION: which sources
   * are active and their geometry, DELIBERATELY excluding the cut POSITIONS. An identical
   * key across slider ticks ⇒ only a cut constant moved ⇒ fast path. A flip (sign change),
   * an axis toggle, box drag / crop / mode / enable change ⇒ new key ⇒ full re-apply.
   */
  private clipCompositionKey(resolved: ResolvedAxisCut[]): string {
    const { enabled, mode, boxBounds, planes } = useSectionStore.getState();
    const box = enabled && mode === 'box' && boxBounds
      ? `${boxBounds.min.join(',')}|${boxBounds.max.join(',')}`
      : '';
    const pl = enabled && mode !== 'box'
      ? planes.filter((p) => p.enabled).map((p) => `${p.normal.join(',')}:${p.constant}`).join('/')
      : '';
    const crop = useCropRegionStore.getState();
    const cr = crop.editState === 'committed' && crop.rectangle
      ? (crop.depthRangeEnabled ? `${crop.nearNorm},${crop.farNorm}` : '-')
      : '';
    return `axes:${axisCutCompositionKey(resolved)}|e${enabled ? 1 : 0}|m${mode}|b${box}|p${pl}|r${cr}`;
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
  renderFrameWithCaps(camera: THREE.Camera, interacting = false): void {
    if (this.disposed) return;
    const renderer = this.deps.renderer;

    // ADR-452 v2.7/v2.9 — pick cap quality from three independent motion signals:
    //  • cutMoving   — cut-plane constant changed (slider drag fires applyState→markDirty).
    //  • camMoved    — camera pose changed since last frame: covers wheel-zoom and
    //                  animated moves, which mark the scene dirty WITHOUT `interacting`.
    //  • interacting — orbit/pan/tumble (the only gestures that set the flag).
    //
    // v2.9 three-tier ladder (Giorgio «κράτα τα χρώματα στην κίνηση»):
    //  • cut-slider drag             → 'fast'   (grey base only — geometry changes every
    //                                            frame, the heaviest parity case).
    //  • camera motion (orbit/zoom)  → 'colors' (grey base + per-material colour caps,
    //                                            no hatch/emphasis → keeps the coloured
    //                                            section visible while navigating).
    //  • settled                     → 'full'   (+ hatch overlays + selection emphasis).
    // cutMoving wins over camMoved (a slider drag may nudge the camera too).
    const cutConstants = this.axisCuts.map((e) => e.plane.constant);
    const cutMoving = detectCutMoving(cutConstants, this.lastRenderedCutConstants);
    this.lastRenderedCutConstants = cutConstants;

    const camZoom = (camera as THREE.Camera & { zoom?: number }).zoom ?? 1;
    const camMoved =
      !camera.position.equals(this.lastCamPos) ||
      !camera.quaternion.equals(this.lastCamQuat) ||
      camZoom !== this.lastCamZoom;
    this.lastCamPos.copy(camera.position);
    this.lastCamQuat.copy(camera.quaternion);
    this.lastCamZoom = camZoom;

    // ADR-452 cap-quality tiering:
    //  • cut-slider drag (cutMoving) → 'colors' — live coloured cut faces while the cut
    //    constant changes (Giorgio 2026-06-19 «κράτα τα χρώματα στο σύρσιμο»).
    //  • camera orbit / zoom (interacting || camMoved) → 'fast' — grey base ONLY. The
    //    coloured poché re-renders the whole BIM scene ~2×(1+N_colours) times/frame; that
    //    is the section-nav lag. Dropping it to grey during camera motion is the big perf
    //    win (Giorgio 2026-06-26 «γκρι στην περιστροφή»). The coloured 'full' frame snaps
    //    back the instant motion settles, via the on-demand refine below (armRefine).
    //  • settled → 'full' — + hatch overlays + selection emphasis.
    const quality: SectionCapQuality = cutMoving
      ? 'colors'
      : (interacting || camMoved)
        ? 'fast'
        : 'full';

    // ADR-452 v2.12 — fat-line edge overlays follow the cut HERE, applying the EXACT
    // gradual trim on EVERY frame the cut is live (drag AND settled). The per-overlay
    // `bimEdgeAppliedCutY` guard inside `applyEdgeCutTrim` skips redundant GPU re-uploads,
    // so a camera-static frame costs only a traverse, and a drag re-uploads only the
    // overlays that actually cross the moving plane. This is the right tradeoff for two
    // reasons Giorgio hit in v2.11:
    //  (a) GRADUAL during drag — crossing edges (columns/walls spanning the cut) shrink
    //      live to the plane instead of staying a full-height "cage" until release.
    //  (b) SELF-HEALING — any overlay a cap parity pass / rebuild restores to pristine is
    //      re-trimmed the very next frame, fixing «οι ακμές επανεμφανίζονται μέχρι την
    //      κορυφή ~150ms μετά το release» (the old `lastSettledEdgeCutY` skip-guard left
    //      those restored-pristine overlays untrimmed). The per-tick re-upload that was
    //      the 357 ms pointermove jank is gone because this runs once per FRAME, not per
    //      slider `onValueChange`.
    // ADR-455 — only the Z (horizontal) cut runs the fat-line edge trim; X/Y vertical
    // edge trim is deferred (see ADR-455 Out-of-scope). `zCut.plane.constant` == worldY.
    const zCut = this.axisCuts.find((e) => e.axis === 'z');
    if (zCut) {
      // Throttle ONLY the active drag (the GPU-upload-heavy case); settled/static frames
      // always trim (self-healing + final exact position on release). See EDGE_TRIM_THROTTLE_MS.
      const nowMs = typeof performance !== 'undefined' ? performance.now() : 0;
      const throttled =
        cutMoving && nowMs - this.lastEdgeTrimMs < SectionSceneController.EDGE_TRIM_THROTTLE_MS;
      if (!throttled) {
        applyEdgeCutTrim(this.deps.getBimGroup(), zCut.plane.constant);
        this.lastEdgeTrimMs = nowMs;
      }
    }

    renderer.autoClear = true;
    renderer.render(this.deps.scene, camera);

    // ADR-452 v2.19 (Giorgio 2026-06-19) — caps render EVERY frame, INCLUDING the cut-slider
    // drag, so the coloured cut faces are live (no hollow/grey draft). The cut geometry
    // changes per frame so the caps can't be cached; 'colors' quality bounds the cost (grey
    // base + N per-material colour passes, NO hatch/emphasis — those refine on settle). On a
    // dense floor this is heavier than the old drag-skip draft; revisit if FPS suffers (N.17).
    {
      const bounds = this.computeSceneBounds();
      // Box / crop caps via the existing multi-plane loop (cut planes excluded).
      if (this.sectionPlanes.length > 0) {
        this.stencilRenderer.render(renderer, this.deps.scene, camera, this.sectionPlanes, bounds, quality);
      }
      // ADR-452/455 — each axis cut plane caps via the correct single-plane path,
      // bounded by the OTHER cut planes + the section/crop planes (so intersecting
      // cuts mutually trim their caps). The stencil buffer is cleared between caps.
      for (const entry of this.axisCuts) {
        const boundPlanes = [
          ...this.axisCuts.filter((e) => e !== entry).map((e) => e.plane),
          ...this.sectionPlanes,
        ];
        this.stencilRenderer.renderAxisCutCap(
          renderer, this.deps.scene, camera, entry.plane, boundPlanes, bounds, quality,
        );
      }
    }

    // ADR-537 underlay-depth — draw the DXF underlay on top of the section frame (screen depth
    // intact from the caps render) so the reference linework stays visible + depth-correct in
    // section mode too, exactly as on the raster / SSAO paths.
    renderUnderlay(renderer, this.deps.getUnderlayRoot(), camera);

    // Any draft frame (slider drag with caps skipped, 'fast' grey, or 'colors' camera
    // motion) schedules one FULL-quality refine once motion stops, so the solid/coloured
    // cut faces + hatch overlays + selection emphasis come back even though the on-demand
    // scheduler may not paint another frame on its own.
    if (cutMoving || quality !== 'full') this.armRefine();
    else this.clearRefine();
  }

  /** ADR-452 v2.7 — force a single FULL-quality cap frame after motion settles. */
  private armRefine(): void {
    if (this.disposed) return;
    if (this.refineTimer !== null) clearTimeout(this.refineTimer);
    this.refineTimer = setTimeout(() => {
      this.refineTimer = null;
      // Next frame: not interacting + cut constant unchanged → quality === 'full'.
      this.deps.markDirty();
    }, SectionSceneController.REFINE_DELAY_MS);
  }

  private clearRefine(): void {
    if (this.refineTimer !== null) {
      clearTimeout(this.refineTimer);
      this.refineTimer = null;
    }
  }

  private computeSceneBounds(): THREE.Box3 | null {
    return unionSceneBounds(this.deps.getBimGroup(), this.deps.getDxfBounds());
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
    this.clearRefine();
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
