/** ThreeJsSceneManager — Three.js lifecycle (BIM 3D viewport). Pure class, no React. Caller calls dispose() on unmount. */

import * as THREE from 'three';
import { createPoi } from '../viewport/viewport-poi';
import { renderSceneFrame, type RenderFrameContext } from './scene-render-frame';
import { DxfBackdropCache } from './dxf-backdrop-cache';
import { BimSceneLayer } from './BimSceneLayer';
import { Cinema4DGridFloor } from './grid/cinema4d-grid-floor'; // ADR-558 — Cinema-4D-style ground grid
import type { PerformanceCollector } from '../performance/PerformanceCollector'; import type { IdleDetector } from '../lighting/idle-detector';
import type { QualityModulator } from '../lighting/quality-modulator'; import type { SSAOModulator } from '../lighting/ssao-modulator';
import type { ShadowModulator } from '../lighting/shadow-modulator';
import type { EnvmapGenerator } from '../lighting/envmap-generator'; import type { PathTracerRenderer } from '../render/PathTracerRenderer';
import type { LightPreset } from '../lighting/lighting-presets';
import { useEnvironmentStore } from '../stores/EnvironmentStore';
import { SectionSceneController } from './section-scene-controller';
import { DxfToThreeConverter } from '../converters/DxfToThreeConverter';
import { raycastBimGroup, raycastBimFace, raycastWorldPointOrPlane, type RaycastHit } from '../systems/raycaster/BimEntityRaycaster';
import { BimSelectionHighlighter } from '../systems/selection/BimSelectionHighlighter';
import { FaceSelectionHighlighter } from '../systems/selection/FaceSelectionHighlighter'; // ADR-539 per-face overlay
import { useSelection3DStore } from '../stores/Selection3DStore';
import type { FloorVisMode } from '../utils/floor-visibility-state';
import type { BuildingVisMode } from '../utils/building-visibility-state';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import type { BuildingRef, FloorRef } from '../../bim/utils/bim-floor-utils';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewportCamera } from '../viewport/viewport-types';
import type { ViewCubeEngine } from '../viewport/view-cube/view-cube';
import { type FinalRenderConfig } from '../stores/ViewMode3DStore';
import { startFinalRender as runFinalRender } from './start-final-render';
import { createCanonicalViewService } from '../viewport/CanonicalViewService'; import type { CanonicalViewService } from '../viewport/CanonicalViewService';
import type { CanonicalViewId, ProjectionMode } from '../viewport/viewport-types';
import { createAnimationManager } from '../viewport/animation-manager'; import type { AnimationManager } from '../viewport/animation-manager';
import { computeFramingTargetBounds, computeSceneFramingBounds } from './scene-framing-bounds';
import { createBimRenderer, createBimLights, createBimScene, initViewportCamera, initViewCube, getRendererViewportSize } from './scene-setup';
import { applyViewportResize, applyDevicePixelRatioSync, buildSceneResizeDeps, type SceneResizeDeps } from './scene-manager-resize';
import { createKeyboardFocusManager, type KeyboardFocusManagerApi } from '../accessibility/KeyboardFocusManager';
import { FocusOutlineRenderer } from '../accessibility/FocusOutlineRenderer'; import type { FocusEntityLabelData } from '../accessibility/FocusIndicator3D';
import { computeFocusOrder, findFocusedEntityData } from '../accessibility/focus-order';
import { cycleKeyboardFocus as a11yCycleFocus, selectFocusedEntity as a11ySelectFocused } from './scene-manager-a11y';
import { applyLightPresetToScene, updateSunDirection } from '../lighting/apply-light-preset';
import { type ReducedMotionOverride } from '../accessibility/use-reduced-motion';
import { WaypointDragHandleRenderer } from '../animation/WaypointDragHandle';
import { disposeSceneManagerResources } from './scene-dispose';
import { getWaypointHandlesRoot as wpHandlesRoot, setWaypointHoverState as wpHoverState, setWaypointDragAxisLock as wpAxisLock, pickWaypointAxisArrow as wpPickAxisArrow } from './scene-manager-waypoint';
import { isSceneDirtyFromState, buildSceneDirtyState } from './scene-dirty-state';
import { recordRender as diagRecordRender, recordMarkDirty as diagRecordMarkDirty } from './bim3d-perf-diag'; // 🔬 ADR-549 Phase 0 (revertible)
import { createSceneRenderingSubsystems } from './scene-rendering-subsystems';
import {
  setBimOrbitPivot,
  applyBimSelection,
  loadHdriIntoStore,
  initBackgroundModeSubscription,
  type SyncDxfOverlayDeps,
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
  readonly dxfConverter: DxfToThreeConverter;
  readonly selectionHighlighter: BimSelectionHighlighter;
  // ADR-538 hover silhouette / ADR-539 per-face overlays (Cinema4D «Polygon Mode»).
  readonly hoverHighlighter: BimSelectionHighlighter;
  readonly faceHighlighter: FaceSelectionHighlighter;
  readonly faceHoverHighlighter: FaceSelectionHighlighter;
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
  // ADR-040 Phase XXIII — render-frame ctx cached once; `_sceneDirty` set by mutators, cleared per tick.
  private readonly frameContext: RenderFrameContext;
  private _sceneDirty = true;
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
    this.dxfConverter = new DxfToThreeConverter(this.scene);
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
    // ADR-536 — highlighter feeds the selected meshes into the silhouette outline.
    this.selectionHighlighter = new BimSelectionHighlighter(this.bimLayer.group, subs.selectionOutlinePass);
    // ADR-538 — hover highlighter → SAME pass, yellow silhouette (via `setHovered`).
    this.hoverHighlighter = new BimSelectionHighlighter(this.bimLayer.group, subs.selectionOutlinePass, (p, o) => p.setHovered(o));
    this.faceHighlighter = new FaceSelectionHighlighter(this.bimLayer.group);
    this.faceHoverHighlighter = new FaceSelectionHighlighter(this.bimLayer.group, 0xffd400, 0.3); // ADR-539 Φ2 hover
    this.poi = createPoi();
    this.scene.add(this.poi.root);
    // ADR-558 — Cinema-4D-style ground grid. Registers itself as a post-FX 'underlay' overlay
    // (AO-immune, depth-tested → occluded by the building). C4D model: world-locked grid in true
    // perspective + soft horizon fade (the cell step + fade radii scale with the camera distance).
    this.gridFloor = new Cinema4DGridFloor(
      this.scene,
      () => this.viewport.camera,
      () => this.viewport.target,
    );
    // Phase 4.2: single animation manager (ADR-040 — ticked by main RAF below).
    this.animationManager = createAnimationManager();
    // Phase 4.4: instantiated once, shared by ViewCube and keyboard dispatcher.
    this.canonicalViewService = createCanonicalViewService(this.viewport, this.animationManager);
    // Phase 4.5 A.7.Q1: focus state machine + outline. Subscribe to drive the outline.
    this.keyboardFocusManager = createKeyboardFocusManager();
    this.focusOutlineRenderer = new FocusOutlineRenderer(this.scene);
    this.focusUnsub = this.keyboardFocusManager.subscribe((focusedId) => {
      this.focusOutlineRenderer.setTargetById(this.bimLayer.group, focusedId);
    });
    this.viewCube = initViewCube({
      container,
      renderer: this.renderer, // ADR-553 — scissored sub-viewport of the main renderer (1 WebGL context).
      onRenderNeeded: () => this.markSceneDirty(),
      viewport: this.viewport,
      canonicalViewService: this.canonicalViewService,
      onContextMenuRequest: (x, y) => this.viewCubeContextMenuCb?.(x, y),
    });
    this.envStoreUnsub = useEnvironmentStore.subscribe(
      (s) => s.hdriUrl,
      (url) => { if (url) void this.loadHdriEnvironment(url); },
    );
    // ADR-446 §2 — visible-background mode subscription (logic in scene-manager-actions).
    this.bgModeUnsub = initBackgroundModeSubscription(this.envmapGenerator, () => this.markSceneDirty());
    // ADR-366 §A.3 Phase 7.0 — Section Cuts wiring (delegated to controller).
    this.sectionController = new SectionSceneController({
      renderer: this.renderer, scene: this.scene, getCamera: () => this.viewport.camera,
      getBimGroup: () => this.bimLayer.group, getDxfBounds: () => this.dxfConverter.getBounds(),
      invalidatePathTracer: () => this.pathTracerRenderer.invalidateScene(), markDirty: () => this.markSceneDirty(), // ADR-452 cut-plane drag → repaint
    });
    // ADR-366 §C.1.b — waypoint drag-handle sprites. Auto-subscribes σε AnimationStore.
    this.waypointDragHandleRenderer = new WaypointDragHandleRenderer(this.scene);
    // ADR-516 Phase 2 — frozen DXF backdrop. Gated OFF while section-cut / path-trace own the frame.
    this.dxfBackdrop = new DxfBackdropCache({ isSectionActive: () => this.sectionController.isStencilActive(), isPathTracerActive: () => this.pathTracerRenderer.isActive });
    // ADR-040 Phase XXIII — cache render-frame context once. Scheduler drives tick().
    this.frameContext = {
      renderer: this.renderer, scene: this.scene, dxfBackdrop: this.dxfBackdrop,
      viewport: this.viewport, viewCube: this.viewCube,
      animationManager: this.animationManager, focusOutlineRenderer: this.focusOutlineRenderer,
      idleDetector: this.idleDetector, ssaoModulator: this.ssaoModulator,
      shadowModulator: this.shadowModulator,
      pathTracerRenderer: this.pathTracerRenderer, sectionController: this.sectionController,
      poi: this.poi, isInteracting: () => this.isInteracting,
    };
  }

  /** ADR-366 Phase 9 / C.5.Q5 — update override; viewport reads it at animation-call time. */
  setReducedMotionOverride(override: ReducedMotionOverride): void { this.reducedMotionOverride = override; }

  // Phase 4.4 keyboard-shortcut façade (use3DShortcuts → manager → viewport).
  snapToCanonicalView(view: CanonicalViewId): void { if (!this.disposed) this.canonicalViewService.snapTo(view); }
  snapToHomeView(): void { if (!this.disposed) this.canonicalViewService.snapHome(); }
  /** ADR-366 A.6.Q4 selection-aware F — bounds math in `scene-framing-bounds.ts`. */
  frameSelectionOrFitExtents(): void {
    if (this.disposed) return;
    const bounds = computeFramingTargetBounds(this.bimLayer.group, this.dxfConverter.getBounds(), useSelection3DStore.getState().selectedBimIds);
    if (bounds && !bounds.isEmpty()) this.viewport.frameBounds(bounds.min, bounds.max);
  }

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
    // 🔬 DIAG (UNCOMMITTED) — `dxf-no-render`='1' skips the whole scene render (A/B the render cost).
    if (typeof window !== 'undefined' && window.localStorage.getItem('dxf-no-render') === '1') {
      this._sceneDirty = false;
      return;
    }
    // Scheduler may pass deltaTime=0 on first frame; derive locally as safety net.
    const delta = scheduledDelta > 0 ? scheduledDelta : now - this.lastTickTime;
    this.lastTickTime = now;
    // 🔬 ADR-549 Phase 0 (REVERTIBLE) — capture dirty-reason BEFORE clearing + time the render.
    const diagSample = { ...this.dirtyState(), ssaoActive: this.ssaoModulator.isSsaoActive() };
    const diagStart = performance.now();
    renderSceneFrame(this.frameContext, now, delta);
    diagRecordRender(performance.now() - diagStart, diagSample);
    this._sceneDirty = false;
  }

  /** ADR-040 Phase XXIII — render-gating state (SSoT for isSceneDirty + ADR-549 diag sample). */
  private dirtyState() {
    return buildSceneDirtyState(this.isInteracting, this.viewport, this.animationManager, this.pathTracerRenderer, this._sceneDirty);
  }

  /** ADR-040 Phase XXIII — true when the scene must be redrawn this frame (on-demand SSoT). */
  isSceneDirty(): boolean { return this.disposed ? false : isSceneDirtyFromState(this.dirtyState()); }

  markSceneDirty(): void { if (!this.disposed) { diagRecordMarkDirty(); this._sceneDirty = true; } } // ADR-040 — flag for redraw. (🔬 ADR-549 Phase 0 trace, revertible)

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

  /** ADR-366 §B.5 — capture the frame as a data-URL (HUD screenshot): force ONE sync render + read
   *  the buffer in the SAME task, so it works WITHOUT `preserveDrawingBuffer`. */
  captureFrameDataURL(type = 'image/png', quality?: number): string {
    if (this.disposed) return '';
    renderSceneFrame(this.frameContext, performance.now(), 0);
    return this.renderer.domElement.toDataURL(type, quality);
  }

  syncBimEntities(
    entities: Bim3DEntities,
    floorElevationMm = 0,
    activeLevelId?: string,
    floors: readonly FloorRef[] = [],
    buildings: readonly BuildingRef[] = [],
    activeBuildingId: string | null = null,
    buildingVisModes: ReadonlyMap<string, BuildingVisMode> = new Map(),
    floorVisModes: ReadonlyMap<string, FloorVisMode> = new Map(),
    nextFloorElevationMm: number | undefined = undefined,
  ): void {
    if (this.disposed) return;
    runSyncBimEntities(
      this.bimSyncDeps(),
      { entities, floorElevationMm, nextFloorElevationMm, activeLevelId, floors, buildings, activeBuildingId, buildingVisModes, floorVisModes },
      this.syncSideEffects(),
    );
  }

  /** Shared sync deps (BIM layer + selection/focus/render subsystems). */
  private bimSyncDeps() {
    return buildBimSyncDeps(this.bimLayer, this.selectionHighlighter, this.hoverHighlighter, this.keyboardFocusManager, this.pathTracerRenderer, this.sectionController);
  }

  /** ADR-366 §B.5 — post-sync side-effect subsystems handed to scene-manager-sync. */
  private syncSideEffects(): SceneSyncSideEffects {
    return buildSceneSyncSideEffects(this.faceHighlighter, this.faceHoverHighlighter, this.ssaoModulator, this.shadowModulator, this.viewport, () => this.markSceneDirty());
  }

  /** ADR-399 Phase B — build the whole building stacked by elevation ("Όλοι οι όροφοι"). */
  syncBimEntitiesMultiFloor(
    stack: readonly FloorStackEntry[],
    floors: readonly FloorRef[] = [],
    buildings: readonly BuildingRef[] = [],
    activeBuildingId: string | null = null,
    buildingVisModes: ReadonlyMap<string, BuildingVisMode> = new Map(),
    floorVisModes: ReadonlyMap<string, FloorVisMode> = new Map(),
  ): void {
    if (this.disposed) return;
    runSyncBimEntitiesMultiFloor(
      this.bimSyncDeps(),
      { stack, floors, buildings, activeBuildingId, buildingVisModes, floorVisModes },
      this.syncSideEffects(),
    );
  }

  applyFloorVisibility(modes: ReadonlyMap<string, FloorVisMode>): void { if (!this.disposed) applyFloorVisibilitySync(this.bimLayer.group, modes, this.shadowModulator, () => this.markSceneDirty()); }

  applyBuildingVisibility(modes: ReadonlyMap<string, BuildingVisMode>): void { if (!this.disposed) applyBuildingVisibilitySync(this.bimLayer.group, modes, this.shadowModulator, () => this.markSceneDirty()); }

  syncDxfOverlay(dxfScene: DxfScene | null): void { if (!this.disposed) { runSyncDxfOverlay(this.dxfOverlayDeps(), dxfScene, this.dxfFitState(), () => this.markSceneDirty()); this.dxfBackdrop.invalidate(); } }

  /** ADR-399 Phase B — stacked per-floor DXF overlay («Όλοι οι όροφοι»). */
  syncDxfOverlayMultiFloor(entries: readonly DxfOverlayFloorEntry[]): void { if (!this.disposed) { runSyncDxfOverlayMultiFloor(this.dxfOverlayDeps(), entries, this.dxfFitState(), () => this.markSceneDirty()); this.dxfBackdrop.invalidate(); } }

  /** Shared DXF overlay deps (converter + path-tracer + section + viewport). */
  private dxfOverlayDeps(): SyncDxfOverlayDeps {
    return buildSyncDxfOverlayDeps(this.dxfConverter, this.pathTracerRenderer, this.sectionController, this.viewport);
  }

  /** First-frame camera-fit latch (read + set `initialCameraFitDone`). */
  private dxfFitState(): DxfOverlayFitState { return { done: this.initialCameraFitDone, markDone: () => { this.initialCameraFitDone = true; } }; }

  /** Replace (plain click) or toggle (ADR-402 Φ-C Shift+click) one entity in the selection; null clears. */
  selectBimEntity(bimId: string | null): void { this.applyBimSelectionMode(bimId, 'replace'); }
  toggleBimEntity(bimId: string | null): void { this.applyBimSelectionMode(bimId, 'toggle'); }
  private applyBimSelectionMode(bimId: string | null, mode: 'replace' | 'toggle'): void {
    if (!this.disposed) { this.markSceneDirty(); applyBimSelection({ bimGroup: this.bimLayer.group, selectionHighlighter: this.selectionHighlighter }, bimId, mode); }
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

  /**
   * DXF overlay floor elevation (Y, metres) or null when no DXF is loaded — the horizontal
   * plane where the DXF wireframe lives. SSoT for both the wheel-zoom anchor (`resolveSurfacePoint`)
   * and the Alt+drag orbit pivot (`setOrbitPivotAt`), so a BIM-miss over the floor plan resolves the
   * real cursor point at floor depth (not a wrong-depth fallback). ADR-363 §empty-dxf / ADR-366 §A.6.Q5.
   */
  private dxfGroundY(): number | null {
    const dxfBounds = this.dxfConverter.getBounds();
    return dxfBounds ? dxfBounds.min.y : null;
  }

  /** ADR-366 §A.6.Q5 — Alt+click orbit-pivot picking (delegates to `setBimOrbitPivot`). */
  setOrbitPivotAt(clientX: number, clientY: number): boolean {
    if (this.disposed) return false;
    return setBimOrbitPivot(
      { bimGroup: this.bimLayer.group, camera: this.viewport.camera, canvas: this.renderer.domElement,
        currentTarget: this.viewport.target, groundY: this.dxfGroundY(),
        setOrbitPivot: (p) => this.viewport.setOrbitPivot(p),
        onNavigationActive: () => this.poi.onNavigationActive(),
        markDirty: () => this.markSceneDirty() },
      clientX, clientY,
    );
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

  resize(width: number, height: number): void { if (!this.disposed) { applyViewportResize(this.resizeDeps(), width, height); this.dxfBackdrop.invalidate(); } }

  /** ADR-549 Phase 7 / ADR-556 — re-apply dpr after a `devicePixelRatio` CHANGE (logic in scene-manager-resize). */
  syncDevicePixelRatio(): void { if (!this.disposed) { applyDevicePixelRatioSync(this.resizeDeps()); this.dxfBackdrop.invalidate(); } }

  /** Shared renderer-sizing deps for the resize helpers (scene-manager-resize). */
  private resizeDeps(): SceneResizeDeps {
    return buildSceneResizeDeps(this.renderer, this.viewport, this.viewCube, this.ssaoModulator, () => this.markSceneDirty());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.faceHighlighter.dispose(); this.faceHoverHighlighter.dispose(); this.dxfBackdrop.dispose(); // ADR-539 + ADR-516 Phase 2 — release face overlays + backdrop cache.
    this.gridFloor.dispose(); // ADR-558 — unregister overlay + free grid geometry/material.
    // ADR-040 Phase XXIII — no rafHandle: scheduler unregister happens in BimViewport3D
    // BEFORE dispose() is invoked, guaranteeing no in-flight tick can race with teardown.
    disposeSceneManagerResources({
      renderer: this.renderer,
      envStoreUnsub: this.envStoreUnsub, bgModeUnsub: this.bgModeUnsub, focusUnsub: this.focusUnsub,
      sectionController: this.sectionController,
      waypointDragHandleRenderer: this.waypointDragHandleRenderer,
      animationManager: this.animationManager,
      focusOutlineRenderer: this.focusOutlineRenderer,
      keyboardFocusManager: this.keyboardFocusManager,
      idleDetector: this.idleDetector, qualityModulator: this.qualityModulator,
      shadowModulator: this.shadowModulator,
      pathTracerRenderer: this.pathTracerRenderer, ssaoModulator: this.ssaoModulator,
      envmapGenerator: this.envmapGenerator,
      performanceCollector: this.performanceCollector,
      selectionHighlighter: this.selectionHighlighter,
      bimLayer: this.bimLayer, dxfConverter: this.dxfConverter,
      viewport: this.viewport, viewCube: this.viewCube, poi: this.poi,
    });
  }
}
