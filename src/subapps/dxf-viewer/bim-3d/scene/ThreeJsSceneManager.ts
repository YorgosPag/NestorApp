/** ThreeJsSceneManager — Three.js lifecycle (BIM 3D viewport). Pure class, no React. Caller calls dispose() on unmount. */

import * as THREE from 'three';
import { createPoi } from '../viewport/viewport-poi';
import type { RenderFrameContext } from './scene-render-frame';
import { DxfBackdropCache } from './dxf-backdrop-cache'; import type { HoverBeautyCache } from './hover-beauty-cache';
import { BimSceneLayer } from './BimSceneLayer';
import { Cinema4DGridFloor } from './grid/cinema4d-grid-floor'; // ADR-558 — Cinema-4D-style ground grid
import type { TerrainSceneLayer } from './terrain/TerrainSceneLayer'; // ADR-650 M4 — topographic surface
import type { TerrainContourLayer } from './terrain/TerrainContourLayer'; // ADR-650 M10d — draped 3D contours
import type { PointCloudSceneLayer } from './terrain/PointCloudSceneLayer'; // ADR-650 M8β/Β — point cloud
import type { TopoAutoBreaklineCandidateLayer } from './terrain/TopoAutoBreaklineCandidateLayer'; // ADR-650 M8β/Γ
import type { PerformanceCollector } from '../performance/PerformanceCollector'; import type { IdleDetector } from '../lighting/idle-detector';
import type { QualityModulator } from '../lighting/quality-modulator'; import type { SSAOModulator } from '../lighting/ssao-modulator';
import type { ShadowModulator } from '../lighting/shadow-modulator';
import type { EnvmapGenerator } from '../lighting/envmap-generator'; import type { PathTracerRenderer } from '../render/PathTracerRenderer';
import type { LightPreset } from '../lighting/lighting-presets';
import { SectionSceneController } from './section-scene-controller';
import { DxfToThreeConverter } from '../converters/DxfToThreeConverter';
import { raycastBimGroup, raycastBimFace, raycastWorldPointOrPlane, type RaycastHit } from '../systems/raycaster/BimEntityRaycaster';
import { BimSelectionHighlighter } from '../systems/selection/BimSelectionHighlighter';
import { FaceSelectionHighlighter } from '../systems/selection/FaceSelectionHighlighter'; // ADR-539 per-face overlay
import { StairSubElementHighlighter, countStairSubElementMeshes } from '../systems/selection/StairSubElementHighlighter'; // ADR-358 Q19 per-tread/riser overlay
import { readEntityFaceKeys } from '../systems/selection/faced-mesh-lookup'; // ADR-715 — «ό,τι ζωγραφίστηκε» SSoT
import type { StairSubPart } from '../../bim/stairs/stair-sub-element-selection-store';
import type { FloorVisMode } from '../utils/floor-visibility-state';
import type { BuildingVisMode } from '../utils/building-visibility-state';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewportCamera } from '../viewport/viewport-types';
import type { ViewCubeEngine } from '../viewport/view-cube/view-cube';
import { type FinalRenderConfig } from '../stores/ViewMode3DStore';
import { startFinalRender as runFinalRender } from './start-final-render';
import type { CanonicalViewService } from '../viewport/CanonicalViewService';
import type { CanonicalViewId, ProjectionMode } from '../viewport/viewport-types';
import type { AnimationManager } from '../viewport/animation-manager';
import { computeSceneFramingBounds } from './scene-framing-bounds';
// ADR-537 / ADR-366 A.6.Q4 — BIM (Selection3DStore) ∪ raw-DXF (universal SelectedEntitiesStore)
// framing + Alt-drag orbit pivot + one-shot initial fit (N.7.1 split → scene-manager-camera).
import { frameSelectionOrFitExtents as runFrameSelectionOrFitExtents, sceneDxfGroundY, ensureInitialCameraFit as runEnsureInitialCameraFit, setSceneOrbitPivotAt } from './scene-manager-camera';
import { createBimRenderer, createBimLights, createBimScene, initViewportCamera, getRendererViewportSize } from './scene-setup';
import { applyViewportResize, applyDevicePixelRatioSync, buildSceneResizeDeps, type SceneResizeDeps } from './scene-manager-resize';
import type { KeyboardFocusManagerApi } from '../accessibility/KeyboardFocusManager';
import { FocusOutlineRenderer } from '../accessibility/FocusOutlineRenderer'; import type { FocusEntityLabelData } from '../accessibility/FocusIndicator3D';
import { computeFocusOrder, findFocusedEntityData } from '../accessibility/focus-order';
import { cycleKeyboardFocus as a11yCycleFocus, selectFocusedEntity as a11ySelectFocused } from './scene-manager-a11y';
import { applyLightPresetToScene, updateSunDirection } from '../lighting/apply-light-preset';
import { type ReducedMotionOverride } from '../accessibility/use-reduced-motion';
import { WaypointDragHandleRenderer } from '../animation/WaypointDragHandle';
import { disposeSceneManagerResources } from './scene-dispose';
import { getWaypointHandlesRoot as wpHandlesRoot, setWaypointHoverState as wpHoverState, setWaypointDragAxisLock as wpAxisLock, pickWaypointAxisArrow as wpPickAxisArrow } from './scene-manager-waypoint';
import { isSceneDirtyFromState, buildSceneDirtyState } from './scene-dirty-state';
import { RedrawLevel, escalateRedraw } from './scene-redraw-level';
import { renderTickFrame, isSceneRenderDisabledByDiagFlag, captureFrameDataURL } from './scene-manager-tick';
import { tickMeshReveal, isMeshRevealActive, disposeMeshReveal } from '../reveal/mesh-reveal-fade'; // ADR-693 Φ2
import { recordMarkDirty as diagRecordMarkDirty } from './bim3d-perf-diag'; // 🔬 ADR-549 Phase 0 (revertible)
import { createSceneRenderingSubsystems } from './scene-rendering-subsystems';
import { buildSceneManagerParts } from './scene-manager-construct';
import {
  applyBimSelection,
  applyBimMarqueeSelection,
  hydrateBimSelectionFromUniversal,
  loadHdriIntoStore,
  EMPTY_FLOOR_VIS_SCOPE,
  type SyncDxfOverlayDeps,
  type FloorVisibilityScope,
} from './scene-manager-actions';
import { syncBimEntities as runSyncBimEntities, syncBimEntitiesMultiFloor as runSyncBimEntitiesMultiFloor, syncDxfOverlay as runSyncDxfOverlay, syncDxfOverlayMultiFloor as runSyncDxfOverlayMultiFloor, applyFloorVisibility as applyFloorVisibilitySync, applyBuildingVisibility as applyBuildingVisibilitySync, buildBimSyncDeps, buildSceneSyncSideEffects, buildSyncDxfOverlayDeps, type SceneSyncSideEffects, type DxfOverlayFitState } from './scene-manager-sync';
import type { FloorStackEntry } from './multi-floor-3d-source';
import type { DxfOverlayFloorEntry } from '../converters/DxfToThreeConverter';

const INITIAL_CAMERA_POSITION = new THREE.Vector3(15, 10, 15);
const INITIAL_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);

export class ThreeJsSceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly viewport: ViewportCamera;
  readonly bimLayer: BimSceneLayer;
  private readonly gridFloor: Cinema4DGridFloor; // ADR-558 — Cinema-4D-style ground grid (post-FX underlay)
  private readonly terrainLayer: TerrainSceneLayer; // ADR-650 M4 — topographic surface (TIN → mesh)
  private readonly terrainContourLayer: TerrainContourLayer; // ADR-650 M10d — draped 3D contour lines
  private readonly pointCloudLayer: PointCloudSceneLayer; // ADR-650 M8β/Β — display-only point cloud
  private readonly autoBreaklineLayer: TopoAutoBreaklineCandidateLayer; // ADR-650 M8β/Γ — υποψήφιες υπό έγκριση
  readonly dxfConverter: DxfToThreeConverter;
  readonly selectionHighlighter: BimSelectionHighlighter;
  // ADR-538 hover silhouette / ADR-539 per-face overlays (Cinema4D «Polygon Mode»).
  readonly hoverHighlighter: BimSelectionHighlighter;
  readonly faceHighlighter: FaceSelectionHighlighter;
  readonly faceHoverHighlighter: FaceSelectionHighlighter;
  /** ADR-358 Q19 — per-tread/riser overlay (click-into components). */
  readonly stairSubElementHighlighter: StairSubElementHighlighter;
  /** ADR-358 Q19 — teardown for the two sub-element store subscriptions. */
  private readonly stairSubUnsub: () => void;
  /** ADR-715 — «Τμήμα» (κοντόστυλο) overlay: ΟΛΕΣ οι θαμμένες όψεις της host κολώνας. */
  readonly buriedPartHighlighter: FaceSelectionHighlighter;
  /** ADR-715 — teardown for the two «Τμήμα» store subscriptions. */
  private readonly buriedPartUnsub: () => void;
  private readonly viewCube: ViewCubeEngine;
  private readonly poi: ReturnType<typeof createPoi>;
  private readonly sun: THREE.DirectionalLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly idleDetector: IdleDetector;
  private readonly qualityModulator: QualityModulator;
  private readonly shadowModulator: ShadowModulator;
  private readonly ssaoModulator: SSAOModulator;
  private readonly envmapGenerator: EnvmapGenerator;
  private readonly pathTracerRenderer: PathTracerRenderer;
  private readonly performanceCollector: PerformanceCollector;
  private readonly envStoreUnsub: () => void;
  private readonly bgModeUnsub: () => void; // ADR-446 §2 — visible-background mode subscription.
  private readonly sectionController: SectionSceneController;
  private readonly animationManager: AnimationManager;
  private readonly canonicalViewService: CanonicalViewService;
  private readonly keyboardFocusManager: KeyboardFocusManagerApi;
  private readonly focusOutlineRenderer: FocusOutlineRenderer;
  private readonly focusUnsub: () => void;
  private readonly waypointDragHandleRenderer: WaypointDragHandleRenderer;
  private readonly dxfBackdrop: DxfBackdropCache; // ADR-516 Phase 2 — frozen DXF backdrop (armed on entity drag).
  private readonly hoverBeautyCache: HoverBeautyCache; // ADR-549 Φ3 — beauty snapshot for instant hover.
  private readonly frameContext: RenderFrameContext; // ADR-040 XXIII — ctx cached once; dirty flags cleared per tick.
  /**
   * ADR-549 Φ4 — ΕΝΑ ordered επίπεδο αντί για `_sceneDirty` + `_hoverDirty`. Ξεκινά σε FULL (πρώτο
   * καρέ). Ο ΜΟΝΟΣ τρόπος να ανέβει είναι `escalateRedraw`, άρα ένα overlay αίτημα δεν μπορεί να
   * υποβαθμίσει εκκρεμές full render — και το gate βλέπει ΚΑΙ ΤΑ ΔΥΟ επίπεδα από ένα πεδίο.
   */
  private _redraw: RedrawLevel = RedrawLevel.FULL;
  private lastTickTime = performance.now();
  private disposed = false;
  private reducedMotionOverride: ReducedMotionOverride = 'auto';
  private isInteracting = false;
  private initialCameraFitDone = false;
  /** Phase 4.3: mutable callback for ViewCube right-click context menu. */
  private viewCubeContextMenuCb: ((x: number, y: number) => void) | null = null;
  /** ADR-400 §3D — fired on every camera interaction-end (orbit/pan/wheel-idle/tumble) so the
   *  owner can debounce-persist the view. Set via {@link setCameraSettledCallback}. */
  private cameraSettledCb: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.renderer = createBimRenderer(container);
    const lights = createBimLights();
    this.sun = lights.sun;
    this.ambient = lights.ambient;
    this.hemi = lights.hemi;
    this.scene = createBimScene(lights);
    this.bimLayer = new BimSceneLayer(this.scene);
    // ADR-645 Φάση A — the converter streams text meshes across frames; each batch marks the
    // scene dirty so the UnifiedFrameScheduler repaints the fill-in without a second rAF loop.
    this.dxfConverter = new DxfToThreeConverter(this.scene, () => this.markSceneDirty());
    this.viewport = initViewportCamera({
      rendererDomElement: this.renderer.domElement,
      initialPosition: INITIAL_CAMERA_POSITION,
      initialTarget: INITIAL_CAMERA_TARGET,
      onInteractionStart: () => { this.isInteracting = true; this.poi.onNavigationActive(); this.markSceneDirty(); },
      onInteractionEnd: () => { this.isInteracting = false; this.cameraSettledCb?.(); this.markSceneDirty(); }, // ADR-040 XXIII: keeps dirty for damping inertia; ADR-400 §3D: persist camera on settle
      onRenderNeeded: () => this.markSceneDirty(),
      getReducedMotionOverride: () => this.reducedMotionOverride,
      onAltClick: (clientX, clientY) => { this.setOrbitPivotAt(clientX, clientY); }, // ADR-366 §A.6.Q5
      onAltPress: (clientX, clientY) => { this.setOrbitPivotAt(clientX, clientY); }, // re-centre pivot before drag
      // ADR-363 Φ1G.5 — anchor point under the cursor for the Revit surface-anchored wheel zoom.
      // BIM hit → DXF ground-plane → camera-facing plane through the orbit target (SAME resolver as
      // the Alt+drag orbit-pivot, `setOrbitPivotAt`). So empty canvas + DXF underlay + BIM surface ALL
      // feed the ONE exponential dolly — no fall-through to OrbitControls' divergent zoom (ADR-363 §empty-dxf).
      resolveSurfacePoint: (clientX, clientY) =>
        raycastWorldPointOrPlane(
          this.bimLayer.group, this.viewport.camera, this.renderer.domElement, clientX, clientY,
          this.viewport.target, this.dxfGroundY(),
        ),
    });
    const subs = createSceneRenderingSubsystems({
      renderer: this.renderer, scene: this.scene, sun: this.sun, bimLayer: this.bimLayer,
      getCamera: () => this.viewport.camera, viewportSize: getRendererViewportSize(this.renderer.domElement),
      onNeedsRender: () => this.markSceneDirty(),
    });
    this.qualityModulator = subs.qualityModulator;
    this.shadowModulator = subs.shadowModulator;
    this.ssaoModulator = subs.ssaoModulator;
    this.envmapGenerator = subs.envmapGenerator;
    this.pathTracerRenderer = subs.pathTracerRenderer;
    this.idleDetector = subs.idleDetector;
    this.performanceCollector = subs.performanceCollector;
    // ADR-040 §SRP — post-viewport subsystem wiring lives in scene-manager-construct (keeps this
    // class < 500 lines). Runtime construction order is preserved (viewport + rendering subs first).
    const parts = buildSceneManagerParts({
      container, renderer: this.renderer, scene: this.scene, bimLayer: this.bimLayer,
      dxfConverter: this.dxfConverter, viewport: this.viewport,
      envmapGenerator: this.envmapGenerator, pathTracerRenderer: this.pathTracerRenderer,
      ssaoModulator: this.ssaoModulator, shadowModulator: this.shadowModulator,
      idleDetector: this.idleDetector, selectionOutlinePass: subs.selectionOutlinePass,
      markDirty: () => this.markSceneDirty(),
      isInteracting: () => this.isInteracting,
      onViewCubeContextMenu: (x, y) => this.viewCubeContextMenuCb?.(x, y),
      onHdriUrl: (url) => { void this.loadHdriEnvironment(url); },
    });
    this.selectionHighlighter = parts.selectionHighlighter; this.hoverHighlighter = parts.hoverHighlighter;
    this.faceHighlighter = parts.faceHighlighter; this.faceHoverHighlighter = parts.faceHoverHighlighter;
    this.stairSubElementHighlighter = parts.stairSubElementHighlighter; this.stairSubUnsub = parts.stairSubUnsub;
    this.buriedPartHighlighter = parts.buriedPartHighlighter; this.buriedPartUnsub = parts.buriedPartUnsub;
    this.poi = parts.poi; this.gridFloor = parts.gridFloor; this.terrainLayer = parts.terrainLayer;
    this.terrainContourLayer = parts.terrainContourLayer;
    this.pointCloudLayer = parts.pointCloudLayer;
    this.autoBreaklineLayer = parts.autoBreaklineLayer;
    this.animationManager = parts.animationManager; this.canonicalViewService = parts.canonicalViewService;
    this.keyboardFocusManager = parts.keyboardFocusManager; this.focusOutlineRenderer = parts.focusOutlineRenderer;
    this.focusUnsub = parts.focusUnsub; this.viewCube = parts.viewCube;
    this.envStoreUnsub = parts.envStoreUnsub; this.bgModeUnsub = parts.bgModeUnsub;
    this.sectionController = parts.sectionController; this.waypointDragHandleRenderer = parts.waypointDragHandleRenderer;
    this.dxfBackdrop = parts.dxfBackdrop; this.hoverBeautyCache = parts.hoverBeautyCache; this.frameContext = parts.frameContext;
  }

  /** ADR-366 Phase 9 / C.5.Q5 — update override; viewport reads it at animation-call time. */
  setReducedMotionOverride(override: ReducedMotionOverride): void { this.reducedMotionOverride = override; }

  // Phase 4.4 keyboard-shortcut façade (use3DShortcuts → manager → viewport).
  snapToCanonicalView(view: CanonicalViewId): void { if (!this.disposed) this.canonicalViewService.snapTo(view); }
  snapToHomeView(): void { if (!this.disposed) this.canonicalViewService.snapHome(); }
  /**
   * ADR-366 A.6.Q4 selection-aware F / Z — frame the selection keeping the camera angle, else fit
   * extents. BIM ∪ raw-DXF union in `computeFrameSelectionBounds` (dxf-selection-framing-bounds.ts).
   */
  frameSelectionOrFitExtents(): void { if (!this.disposed) runFrameSelectionOrFitExtents(this); }

  /** ADR-366 §C.1.b — combined BIM + DXF bounds για animation actions (turntable). */
  getSceneFramingBounds(): THREE.Box3 | null { return this.disposed ? null : computeSceneFramingBounds(this.bimLayer.group, this.dxfConverter.getBounds()); }

  // ── Phase 4.5 / A.7 — Accessibility public surface (logic in scene-manager-a11y) ──
  /** A.7.Q4 — screen-space pan (dxPx > 0 = view right, dyPx > 0 = view up). */
  panViewportByPixels(dxPx: number, dyPx: number): void { if (!this.disposed) this.viewport.pan(dxPx, dyPx); }
  /** C.5.Q3 — current frustum-culled entity order for keyboard navigator. */
  getEntityFocusOrder(): readonly string[] { return this.disposed ? [] : computeFocusOrder(this.bimLayer.group, this.viewport.camera); }
  /** A.7.Q1 — Tab/Shift+Tab cycle through visible entities. */
  cycleKeyboardFocus(direction: 'next' | 'prev'): void { if (!this.disposed) a11yCycleFocus(this.bimLayer.group, this.viewport.camera, this.keyboardFocusManager, direction); }
  /** A.7.Q1 — Enter on focused entity → toggle selection (ADR-030 integration). */
  selectFocusedEntity(): void { if (!this.disposed) a11ySelectFocused(this.keyboardFocusManager, (id) => this.selectBimEntity(id)); }
  /** A.7.Q1 — Esc clears focus ring (selection untouched). */
  clearKeyboardFocus(): void { if (!this.disposed) this.keyboardFocusManager.clear(); }
  /** Read-only handle for FocusIndicator3D React subscriber. */
  getKeyboardFocusManager(): KeyboardFocusManagerApi { return this.keyboardFocusManager; }
  /** Resolve label data for the floating focus label (entity type + name + world center). */
  getFocusedEntityData(bimId: string): FocusEntityLabelData | null { return this.disposed ? null : findFocusedEntityData(this.bimLayer.group, bimId); }

  getCamera(): THREE.Camera { return this.viewport.camera; }

  /** ADR-366 §B.5 — true while navigating the camera; suspends OSNAP/hover picking during nav. */
  isCameraInteracting(): boolean { return this.isInteracting; }

  // ── ADR-366 §C.1.b — Waypoint drag-handle public surface (logic in scene-manager-waypoint) ──
  getWaypointHandlesRoot(): THREE.Group | null { return wpHandlesRoot(this.disposed, this.waypointDragHandleRenderer); }
  setWaypointHoverState(role: 'position' | 'target' | null): void { wpHoverState(this.disposed, this.waypointDragHandleRenderer, role, () => this.markSceneDirty()); }
  setDragAxisLock(axis: 'X' | 'Y' | 'Z' | null): void { wpAxisLock(this.disposed, this.waypointDragHandleRenderer, axis, () => this.markSceneDirty()); }
  pickWaypointAxisArrow(domElement: HTMLElement, camera: import('three').Camera, clientX: number, clientY: number): 'X' | 'Y' | 'Z' | null {
    return wpPickAxisArrow(this.disposed, this.waypointDragHandleRenderer, domElement, camera, clientX, clientY);
  }

  setViewCubeContextMenuCallback(cb: (x: number, y: number) => void): void { this.viewCubeContextMenuCb = cb; }
  setViewCubeCompassVisible(visible: boolean): void { this.viewCube.setCompassVisible(visible); this.markSceneDirty(); }

  /** ADR-040 Phase XXIII — driven by UnifiedFrameScheduler once per rAF tick, ONLY when dirty. */
  tick(now: number, scheduledDelta: number): void {
    if (this.disposed) return;
    if (isSceneRenderDisabledByDiagFlag()) { this._redraw = RedrawLevel.NONE; return; } // 🔬 ADR-549 Φ0
    const delta = scheduledDelta > 0 ? scheduledDelta : now - this.lastTickTime; // deltaTime=0 on first frame → derive.
    this.lastTickTime = now;
    tickMeshReveal(now); // ADR-693 Φ2 — πέπλο αποκάλυψης ΠΡΙΝ το render· κανένα δικό του RAF (ADR-040).
    const diagSample = { ...this.dirtyState(), ssaoActive: this.ssaoModulator.isSsaoActive() }; // 🔬 ADR-549 Φ0 — dirty-reason + time.
    // ADR-549 Φ4 — CONSUME-BEFORE-RENDER: το επίπεδο μηδενίζεται ΠΡΙΝ σχεδιάσουμε, ώστε ένα
    // `markSceneDirty` που πυροδοτείται ΜΕΣΑ στο render (subscription/callback) να επιβιώνει για το
    // επόμενο καρέ αντί να καταπίνεται από ένα reset στο τέλος (η παλιά σειρά το έχανε σιωπηλά).
    const level = this._redraw;
    this._redraw = RedrawLevel.NONE;
    renderTickFrame(this.frameContext, level, now, delta, diagSample);
  }

  /** ADR-040 Phase XXIII — render-gating state (SSoT for isSceneDirty + ADR-549 diag sample). */
  private dirtyState() {
    return buildSceneDirtyState(this.isInteracting, this.viewport, this.animationManager, this.pathTracerRenderer, this._redraw, isMeshRevealActive());
  }

  /** ADR-040 Phase XXIII — true when the scene must be redrawn this frame (on-demand SSoT). */
  isSceneDirty(): boolean { return this.disposed ? false : isSceneDirtyFromState(this.dirtyState()); }

  /** ADR-040 — ζήτησε ΠΛΗΡΕΣ redraw (γεωμετρία/υλικά/κάμερα/φώτα). (🔬 ADR-549 Φ0 trace, revertible) */
  markSceneDirty(): void { if (!this.disposed) { diagRecordMarkDirty(); this._request(RedrawLevel.FULL); } }
  /** ADR-549 Φ3 — ζήτησε OVERLAY-ONLY redraw (άλλαξε μόνο το outline → blit cache + outline). */
  markHoverDirty(): void { if (!this.disposed) this._request(RedrawLevel.OVERLAY); }

  /** ADR-549 Φ4 — ο ΜΟΝΟΣ γραφέας του `_redraw`: monotonic, άρα ποτέ υποβάθμιση εκκρεμούς αιτήματος. */
  private _request(level: RedrawLevel): void { this._redraw = escalateRedraw(this._redraw, level); }

  /**
   * ADR-516 — INTERACTION GATE for NON-camera drags (gizmo/grip entity edit). The render
   * frame uses `isInteracting` to pick its quality path: true → cheap raster (SSAO + shadows
   * OFF, ~3ms), false → full refine-on-idle SSAO+shadow composer (~30-108ms on a weak GPU).
   * Camera drags flip it via OrbitControls `onInteractionStart/End`; a gizmo drag disables
   * those controls, so WITHOUT this the scene paid the idle-refine cost EVERY frame while the
   * user dragged — the real cursor↔entity lag (diag 2026-06-29). Drag handlers call
   * setInteracting(true) at begin, (false) at end (→ one final crisp SSAO frame at rest).
   */
  setInteracting(active: boolean): void {
    // ADR-516 Phase 2 — an entity drag (camera fixed) arms the frozen DXF backdrop; release disarms it.
    if (!this.disposed) { this.isInteracting = active; if (active) this.dxfBackdrop.arm(); else this.dxfBackdrop.disarm(); this.markSceneDirty(); }
  }

  /** ADR-366 §B.5 — frame → data-URL (HUD screenshot). Λογική στο `scene-manager-tick`. */
  captureFrameDataURL(type = 'image/png', quality?: number): string {
    return this.disposed ? '' : captureFrameDataURL(this.frameContext, this.renderer.domElement, type, quality);
  }

  syncBimEntities(
    entities: Bim3DEntities,
    floorElevationMm = 0,
    activeLevelId?: string,
    scope: FloorVisibilityScope = EMPTY_FLOOR_VIS_SCOPE,
    nextFloorElevationMm: number | undefined = undefined,
  ): void {
    if (this.disposed) return;
    runSyncBimEntities(this.bimSyncDeps(), { entities, floorElevationMm, nextFloorElevationMm, activeLevelId, ...scope }, this.syncSideEffects());
    this.ensureInitialCameraFit();
  }

  /** Shared sync deps (BIM layer + selection/focus/render subsystems). */
  private bimSyncDeps() {
    return buildBimSyncDeps(this.bimLayer, this.selectionHighlighter, this.hoverHighlighter, this.keyboardFocusManager, this.pathTracerRenderer, this.sectionController);
  }

  /** ADR-366 §B.5 — post-sync side-effect subsystems handed to scene-manager-sync. */
  private syncSideEffects(): SceneSyncSideEffects {
    return buildSceneSyncSideEffects(this.faceHighlighter, this.faceHoverHighlighter, this.stairSubElementHighlighter, this.buriedPartHighlighter, this.ssaoModulator, this.shadowModulator, this.viewport, () => this.markSceneDirty());
  }

  /** ADR-399 Phase B — build the whole building stacked by elevation ("Όλοι οι όροφοι"). */
  syncBimEntitiesMultiFloor(
    stack: readonly FloorStackEntry[],
    scope: FloorVisibilityScope = EMPTY_FLOOR_VIS_SCOPE,
  ): void {
    if (this.disposed) return;
    runSyncBimEntitiesMultiFloor(this.bimSyncDeps(), { stack, ...scope }, this.syncSideEffects());
    this.ensureInitialCameraFit();
  }

  applyFloorVisibility(modes: ReadonlyMap<string, FloorVisMode>): void { if (!this.disposed) applyFloorVisibilitySync(this.bimLayer.group, modes, this.shadowModulator, () => this.markSceneDirty()); }

  applyBuildingVisibility(modes: ReadonlyMap<string, BuildingVisMode>): void { if (!this.disposed) applyBuildingVisibilitySync(this.bimLayer.group, modes, this.shadowModulator, () => this.markSceneDirty()); }

  /** ADR-399 Φάση Ε — `floorElevationMm` = active storey datum-relative FFL (0 = read-only pipeline). */
  syncDxfOverlay(dxfScene: DxfScene | null, floorElevationMm = 0): void { if (!this.disposed) { runSyncDxfOverlay(this.dxfOverlayDeps(), dxfScene, floorElevationMm, this.dxfFitState(), () => this.markSceneDirty()); this.dxfBackdrop.invalidate(); } }

  /** ADR-399 Phase B — stacked per-floor DXF overlay («Όλοι οι όροφοι»). */
  syncDxfOverlayMultiFloor(entries: readonly DxfOverlayFloorEntry[]): void { if (!this.disposed) { runSyncDxfOverlayMultiFloor(this.dxfOverlayDeps(), entries, this.dxfFitState(), () => this.markSceneDirty()); this.dxfBackdrop.invalidate(); } }

  /** Shared DXF overlay deps (converter + path-tracer + section + viewport). */
  private dxfOverlayDeps(): SyncDxfOverlayDeps {
    return buildSyncDxfOverlayDeps(this.dxfConverter, this.pathTracerRenderer, this.sectionController, this.viewport);
  }

  /** First-frame camera-fit latch (read + set `initialCameraFitDone`). */
  private dxfFitState(): DxfOverlayFitState { return { done: this.initialCameraFitDone, markDone: () => { this.initialCameraFitDone = true; } }; }

  /** ADR-537 — one-shot initial camera-fit FALLBACK (logic in scene-manager-framing). */
  private ensureInitialCameraFit(): void {
    if (this.disposed) return;
    if (runEnsureInitialCameraFit(this, this.initialCameraFitDone)) this.initialCameraFitDone = true;
  }

  /** Replace (plain click) or toggle (ADR-402 Φ-C Shift+click) one entity in the selection; null clears. */
  selectBimEntity(bimId: string | null): void { this.applyBimSelectionMode(bimId, 'replace'); }
  toggleBimEntity(bimId: string | null): void { this.applyBimSelectionMode(bimId, 'toggle'); }
  private applyBimSelectionMode(bimId: string | null, mode: 'replace' | 'toggle'): void {
    if (!this.disposed) { this.markSceneDirty(); applyBimSelection({ bimGroup: this.bimLayer.group, selectionHighlighter: this.selectionHighlighter }, bimId, mode); }
  }

  /** ADR-692 — apply a window/crossing MARQUEE result (bulk bimIds) with a combine mode. */
  applyBimMarqueeSelection(ids: readonly string[], mode: 'replace' | 'add' | 'subtract'): void {
    if (!this.disposed) { this.markSceneDirty(); applyBimMarqueeSelection({ bimGroup: this.bimLayer.group, selectionHighlighter: this.selectionHighlighter }, ids, mode); }
  }

  /** ADR-402/532 — cross-mode hydration: mirror the universal 2D selection into 3D on entry (called after the scene is built). */
  hydrateSelectionFromUniversal(universalIds: readonly string[]): void {
    if (!this.disposed) { this.markSceneDirty(); hydrateBimSelectionFromUniversal({ bimGroup: this.bimLayer.group, selectionHighlighter: this.selectionHighlighter }, universalIds); }
  }

  raycastBimEntities(clientX: number, clientY: number): RaycastHit | null { return this.disposed ? null : raycastBimGroup(this.bimLayer.group, this.viewport.camera, this.renderer.domElement, clientX, clientY); }

  /** ADR-539 — face-level pick (Polygon Mode): RaycastHit carrying the `faceKey`. */
  raycastBimFace(clientX: number, clientY: number): RaycastHit | null { return this.disposed ? null : raycastBimFace(this.bimLayer.group, this.viewport.camera, this.renderer.domElement, clientX, clientY); }

  /** ADR-539 Φ4b — highlight (or clear) ΟΛΕΣ τις επιλεγμένες όψεις (multi-face Polygon Mode). */
  setSelectedFaces(faces: readonly { bimId: string; faceKey: string }[]): void { if (!this.disposed) { this.faceHighlighter.setTargets(faces); this.markSceneDirty(); } }

  /** ADR-539 — highlight (or clear) one face (context-menu / drag-drop / Φ4a· delegates to Φ4b). */
  setSelectedFace(bimId: string | null, faceKey: string | null): void { this.setSelectedFaces(bimId && faceKey ? [{ bimId, faceKey }] : []); }

  /** ADR-539 Φ2 — yellow hover preview on the face under the cursor / drag (Polygon Mode). */
  setHoveredFace(bimId: string | null, faceKey: string | null): void { if (!this.disposed) { this.faceHoverHighlighter.setTarget(bimId, faceKey); this.markSceneDirty(); } }

  /** ADR-358 Q19 — number of tagged tread/riser meshes of a stair (Tab-cycle wraparound). */
  countStairSubElements(stairId: string, part: StairSubPart): number { return this.disposed ? 0 : countStairSubElementMeshes(this.bimLayer.group, stairId, part); }

  /**
   * ADR-715 — η αρίθμηση όψεων του faced mesh μιας οντότητας, δηλαδή **ό,τι όντως ζωγραφίστηκε**
   * (mirror του `countStairSubElements`: το UI ρωτά τη ζωντανή σκηνή αντί να ξανα-παράγει κλειδιά).
   * Ο δρόμος του swatch τη χρειάζεται για να βάψει ΟΛΕΣ τις θαμμένες όψεις του Τμήματος.
   */
  getEntityFaceKeys(bimId: string): readonly string[] | undefined { return this.disposed ? undefined : readEntityFaceKeys(this.bimLayer.group, bimId); }

  /** DXF overlay floor-elevation SSoT for wheel-zoom + Alt-drag orbit pivot (logic in scene-manager-framing). */
  private dxfGroundY(): number | null { return sceneDxfGroundY(this); }

  /** ADR-366 §A.6.Q5 — Alt+click orbit-pivot picking (delegates to `setSceneOrbitPivotAt`). */
  setOrbitPivotAt(clientX: number, clientY: number): boolean {
    return this.disposed ? false : setSceneOrbitPivotAt(this, () => this.poi.onNavigationActive(), clientX, clientY);
  }

  updateSunPosition(azimuthDeg: number, elevationDeg: number): void { if (!this.disposed) { updateSunDirection(this.sun, azimuthDeg, elevationDeg); this.shadowModulator.invalidateShadowMap(); this.markSceneDirty(); } }

  /**
   * ADR-400 §3D — restore a persisted 3D camera view instantly AND latch the initial-fit
   * flag so the subsequent `syncDxfOverlay` auto-framing does NOT animate the restored pose
   * away (the framing only fires while `initialCameraFitDone` is false). No-op when disposed.
   */
  restoreCameraView(position: THREE.Vector3, target: THREE.Vector3, zoom: number, projection: ProjectionMode): void {
    if (this.disposed) return;
    this.viewport.setPose(position, target, zoom, projection);
    this.initialCameraFitDone = true; // suppress the one-shot Zoom-Extents framing
    this.markSceneDirty();
  }

  /** ADR-400 §3D — register a callback fired when the camera settles (debounced persist owner). */
  setCameraSettledCallback(cb: (() => void) | null): void { this.cameraSettledCb = cb; }

  /** Public bridge για το ADR-366 §A.3 Section controller (BimViewport3D safety effect). */
  initSectionBox(): void { if (!this.disposed) { this.sectionController.ensureInit(); this.sectionController.applyState(); this.markSceneDirty(); } }
  /** ADR-550 — re-assert current section clip planes on a subtree built mid-drag (edit live-preview ghost/rebuilds); reuses the controller's `reapplyClipPlanesUnder` SSoT so they never draw unclipped over a cut. */
  reapplySectionClip(root: THREE.Object3D): void { if (!this.disposed) this.sectionController.reapplyClipPlanesUnder(root); }
  async loadHdriEnvironment(url: string): Promise<void> { if (!this.disposed) await loadHdriIntoStore(url, this.envmapGenerator, this.pathTracerRenderer, () => this.markSceneDirty()); }

  applyLightPreset(preset: LightPreset): void { if (!this.disposed) { applyLightPresetToScene({ sun: this.sun, ambient: this.ambient, hemi: this.hemi }, preset, this.envmapGenerator); this.shadowModulator.invalidateShadowMap(); this.markSceneDirty(); } }

  getRendererCanvas(): HTMLCanvasElement { return this.renderer.domElement; }

  startFinalRender(
    config: FinalRenderConfig,
    renderContext: { projectId: string; companyId: string; userId: string },
    onProgress: (pct: number) => void,
    onComplete: (result: { savedDisk: boolean; savedProject: boolean; uploadError: boolean }) => void,
  ): void {
    if (this.disposed) return;
    runFinalRender(this.pathTracerRenderer, this.renderer.domElement, config, renderContext, onProgress, onComplete);
  }

  cancelFinalRender(): void { if (!this.disposed) this.pathTracerRenderer.cancelFinal(); }

  resize(width: number, height: number): void { if (!this.disposed) applyViewportResize(this.resizeDeps(), width, height); }

  /** ADR-549 Phase 7 / ADR-556 — re-apply dpr after a `devicePixelRatio` CHANGE (logic in scene-manager-resize). */
  syncDevicePixelRatio(): void { if (!this.disposed) applyDevicePixelRatioSync(this.resizeDeps()); }

  /** Shared renderer-sizing deps for the resize helpers (scene-manager-resize). */
  private resizeDeps(): SceneResizeDeps {
    return buildSceneResizeDeps(this.renderer, this.viewport, this.viewCube, this.ssaoModulator, () => this.markSceneDirty(),
      () => { this.dxfBackdrop.invalidate(); this.hoverBeautyCache.invalidate(); }); // ADR-549 Φ5
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.faceHighlighter.dispose(); this.faceHoverHighlighter.dispose(); this.dxfBackdrop.dispose(); this.hoverBeautyCache.dispose(); // ADR-539 + ADR-516 Phase 2 + ADR-549 Φ3 — release face overlays + caches.
    this.stairSubUnsub(); this.stairSubElementHighlighter.dispose(); // ADR-358 Q19 — drop store subs + release the sub-element overlay.
    this.buriedPartUnsub(); this.buriedPartHighlighter.dispose(); // ADR-715 — ίδιο ζευγάρι για το «Τμήμα».
    this.gridFloor.dispose(); // ADR-558 — unregister overlay + free grid geometry/material.
    this.terrainLayer.dispose(); // ADR-650 M4 — drop store subs + free the terrain mesh geometry.
    this.terrainContourLayer.dispose(); // ADR-650 M10d — drop store subs + free the contour line geometry.
    this.pointCloudLayer.dispose(); // ADR-650 M8β/Β — drop store sub + free the cloud buffers + material.
    this.autoBreaklineLayer.dispose(); // ADR-650 M8β/Γ — drop the review sub + free the candidate lines.
    disposeMeshReveal(); // ADR-693 Φ2 — free any in-flight reveal veil (per-instance material + geometry).
    // ADR-040 Phase XXIII — no rafHandle: BimViewport3D unregisters the scheduler BEFORE dispose(), so no in-flight tick races teardown.
    disposeSceneManagerResources({
      renderer: this.renderer,
      envStoreUnsub: this.envStoreUnsub, bgModeUnsub: this.bgModeUnsub, focusUnsub: this.focusUnsub,
      sectionController: this.sectionController,
      waypointDragHandleRenderer: this.waypointDragHandleRenderer,
      animationManager: this.animationManager,
      focusOutlineRenderer: this.focusOutlineRenderer, keyboardFocusManager: this.keyboardFocusManager,
      idleDetector: this.idleDetector, qualityModulator: this.qualityModulator, shadowModulator: this.shadowModulator,
      pathTracerRenderer: this.pathTracerRenderer, ssaoModulator: this.ssaoModulator,
      envmapGenerator: this.envmapGenerator,
      performanceCollector: this.performanceCollector,
      selectionHighlighter: this.selectionHighlighter,
      bimLayer: this.bimLayer, dxfConverter: this.dxfConverter,
      viewport: this.viewport, viewCube: this.viewCube, poi: this.poi,
    });
  }
}
