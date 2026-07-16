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
import { applyClippingPlanes, clearClippingPlanes, type ScopeClipPlanes } from '../systems/section/section-clip-applicator';
import { SectionStencilRenderer } from '../systems/section/section-stencil-renderer';
import { useCropRegionStore } from '../render/crop-region/CropRegionStore';
import { buildCropPlanes } from '../render/crop-region/crop-frustum-builder';
// ADR-452/455 — axis cut planes (horizontal Z View Range + vertical X/Y sections)
// as extra clip sources, composed here so this controller stays the SINGLE owner of
// the scene's clipping planes.
import { resolveAllAxisCuts } from './cut-plane-3d';
// ADR-665 — the terrain's own level cut: a third clip source that applies ONLY to the topo scope.
import { resolveTerrainCut } from './terrain/terrain-clip-plane';
import { subscribeTerrain3D } from '../../systems/topography/terrain-3d-store';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { clipCompositionKey } from './section-clip-composition';
import { SectionCapQualityTracker } from './section-cap-quality';
import { composeCutEntries, composeClipPlanes, MAX_CLIP_PLANES, type AxisCutEntry } from './axis-cut-composer';
import { applyEdgeCutTrim, restoreEdgeCut } from './edge-cut-applicator';
import { unionSceneBounds } from './section-scene-bounds';
import { renderPostFxOverlays } from './post-fx-overlay-pass';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { useActiveStoreyStore } from '../../systems/levels/active-storey-store';
import { createSectionBoxDragHandlers } from './section-box-drag-handlers';
import { DXF_TIMING } from '../../config/dxf-timing';

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
  /** ADR-452/455 — active axis cut planes (Z horizontal + X/Y vertical), 0–3. Each capped via the single-plane path. */
  private axisCuts: AxisCutEntry[] = [];
  /**
   * ADR-665 — the terrain's level cut (0 or 1 entry). Modelled as an `AxisCutEntry` so the fast
   * path can mutate `plane.constant` in place when the ACTIVE LEVEL changes — the composition is
   * unchanged, only the elevation moved, so switching floors never triggers a per-mesh
   * `needsUpdate` storm.
   */
  private terrainCuts: AxisCutEntry[] = [];
  /**
   * ADR-665 — the plane set for the `'topo'` scope: the terrain's level cut FIRST, then the
   * building's own planes (so an active section box / axis cut still trims the hill too). Kept
   * out of {@link combinedPlanes} so the BUILDING is never cut by the terrain's plane.
   */
  private terrainPlanes: THREE.Plane[] = [];
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
  private refineTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly REFINE_DELAY_MS = DXF_TIMING.ui.SECTION_REFINE; // ADR-516
  /** ADR-452 — per-frame motion signals → cap quality tier (N.7.1 split, ADR-665). */
  private readonly capQuality = new SectionCapQualityTracker();
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
    const dom = deps.renderer.domElement;
    const dragHandlers = createSectionBoxDragHandlers({
      sectionBox: this.sectionBox,
      dom,
      getCamera: deps.getCamera,
    });
    this.pointerDown = dragHandlers.onPointerDown;
    this.pointerMove = dragHandlers.onPointerMove;
    this.pointerUp = dragHandlers.onPointerUp;
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
    // ADR-665 — the terrain's level cut is an independent clip source: it stays active even when
    // the Section Box and every axis cut are off (that is the whole point — the hill is cut at the
    // active storey without the user enabling anything).
    const terrainResolved = resolveTerrainCut();
    this.clipActive = enabled || cutActive || terrainResolved !== null;

    if (!this.clipActive) {
      clearClippingPlanes(this.deps.scene);
      // ADR-452 — restore any edge overlays the cut had trimmed/hidden.
      restoreEdgeCut(this.deps.getBimGroup());
      this.sectionBox.setVisible(false);
      this.cachedPlanes = [];
      this.combinedPlanes = [];
      this.sectionPlanes = [];
      this.axisCuts = [];
      this.terrainCuts = [];
      this.terrainPlanes = [];
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
    //
    // ADR-665 — the TERRAIN cut rides this same path, and that is what makes changing floor free:
    // switching level moves only `terrainCuts[0].plane.constant` while the composition key is
    // identical, so the whole re-apply is skipped. The guard therefore has to account for both
    // lists — an empty `axisCuts` with a live `terrainCuts` is the common case (terrain-only cut).
    const compositionKey = clipCompositionKey(resolved, terrainResolved);
    const terrainCount = terrainResolved ? 1 : 0;
    if (
      this.axisCuts.length + this.terrainCuts.length > 0 &&
      this.axisCuts.length === resolved.length &&
      this.terrainCuts.length === terrainCount &&
      compositionKey === this.lastClipCompositionKey
    ) {
      for (let i = 0; i < this.axisCuts.length; i++) {
        this.axisCuts[i].plane.constant = resolved[i].sign * resolved[i].worldCoordM;
      }
      if (terrainResolved && this.terrainCuts.length === 1) {
        this.terrainCuts[0].plane.constant = terrainResolved.sign * terrainResolved.worldCoordM;
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

    // ADR-665 — the terrain's own plane set. Reuses `composeCutEntries` so the persistent plane
    // instance survives across level changes (fast-path precondition), and puts the terrain cut
    // FIRST so it always survives the Three.js 6-plane hard limit — even under a full 6-plane
    // section box. The building's cuts/box/crop follow, so an explicit section still trims the hill.
    this.terrainCuts = composeCutEntries(terrainResolved ? [terrainResolved] : [], this.terrainCuts);
    this.terrainPlanes = composeClipPlanes(
      [...this.terrainCuts.map((e) => e.plane), ...cutPlanes],
      this.cachedPlanes,
      cropPlanes,
    );

    applyClippingPlanes(this.deps.scene, this.scopePlanes());
    // ADR-452 v2.11 — the gradual fat-line edge trim (LineMaterial can't be GPU-clipped
    // on this build) is applied in the render frame for the Z cut: a CHEAP visibility
    // cull while the slider drags, the EXACT trim once it settles.
    this.deps.invalidatePathTracer();
    this.deps.markDirty();
  }

  /** ADR-665 — the current planes per clip scope: the building vs the terrain. */
  private scopePlanes(): ScopeClipPlanes {
    return { default: this.combinedPlanes, topo: this.terrainPlanes };
  }

  /**
   * ADR-665 — re-write the CURRENT clip planes onto one subtree. Called by a topo scene layer
   * right after it rebuilds: a freshly constructed material starts with `clippingPlanes = null`,
   * and nothing else would ever put them back (this controller does not subscribe to
   * `TopoPointStore`, so a survey edit is invisible to it).
   *
   * Keeps the ownership rule intact — the layer OWNS its geometry, this controller stays the
   * SINGLE owner of the planes; the layer only says «I rebuilt, re-assert your state».
   * Synchronous + subtree-scoped ⇒ no subscription-order race and no scene-wide `needsUpdate`
   * storm. Idempotent.
   */
  reapplyClipPlanesUnder(root: THREE.Object3D): void {
    if (this.disposed) return;
    applyClippingPlanes(root, this.scopePlanes());
  }

  /**
   * True αν το section είναι ενεργό ΚΑΙ έχει τουλάχιστον 1 active plane.
   * Καθορίζει αν ο render loop θα κάνει direct render + stencil caps
   * (bypass composer) αντί για την κανονική SSAO pipeline.
   *
   * ADR-665 — reads `combinedPlanes`, which EXCLUDES `terrainPlanes` by design: a terrain-only
   * level cut must NOT flip the whole scene onto the expensive stencil path. The terrain cut ships
   * without a cap (the TIN is DoubleSide, so it reads as a shell, not a void) — see ADR-665 §cap.
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

    // ADR-452 v2.7/v2.9 — cap quality from the frame's motion signals (cut drag / camera / cursor).
    // ADR-665 — the terrain cut is deliberately NOT a motion input here: it has no cap to refine,
    // and a level switch must not downgrade the building's caps to grey.
    const { quality, cutMoving } = this.capQuality.pick(
      camera,
      this.axisCuts.map((e) => e.plane.constant),
      interacting,
    );

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

    // ADR-537 — draw the post-FX overlays (DXF underlay + gizmo) on top of the section frame
    // (screen depth intact from the caps render) so the reference linework + manipulators stay
    // visible + correct-coloured in section mode too, exactly as on the raster / SSAO paths.
    renderPostFxOverlays(renderer, this.deps.scene, camera);

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
    // ADR-665 — the terrain's level cut has two more inputs:
    //  • floor3DScope — «Όλοι οι όροφοι» suppresses the cut entirely (no single active level).
    //  • terrain-3d-store — `visible` + `autoClipAtActiveLevel`. This one is a VANILLA
    //    `createExternalStore`, NOT zustand, so it has its own `subscribe`; without this line the
    //    toggle would silently do nothing (nobody else was listening to it).
    const u7 = useViewMode3DStore.subscribe(cb);
    const u8 = subscribeTerrain3D(cb);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); };
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
