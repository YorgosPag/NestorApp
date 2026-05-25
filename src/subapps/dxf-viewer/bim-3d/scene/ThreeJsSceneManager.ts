/**
 * ThreeJsSceneManager — Three.js lifecycle management for BIM 3D viewport.
 *
 * Phase 0: placeholder scene (wireframe cube + axes + ambient light).
 * Phase 1: replaces OrbitControls placeholder with GenArc ViewportCamera
 *          (tumble, perspective/ortho, ViewCube, POI indicator, animated transitions).
 * Phase 2+: BIM entity rendering replaces placeholder scene.
 *
 * Pure class — no React imports. Owned exclusively by BimViewport3D.
 * Caller is responsible for dispose() on component unmount.
 */

import * as THREE from 'three';
import { createViewportCamera } from '../viewport/viewport-camera';
import { createViewCube } from '../viewport/view-cube/view-cube';
import { createPoi } from '../viewport/viewport-poi';
import { renderSceneFrame, type RenderFrameContext } from './scene-render-frame';
import { BimSceneLayer } from './BimSceneLayer';
import { PerformanceCollector } from '../performance/PerformanceCollector';
import { IdleDetector } from '../lighting/idle-detector';
import { QualityModulator } from '../lighting/quality-modulator';
import { SSAOModulator } from '../lighting/ssao-modulator';
import { EnvmapGenerator } from '../lighting/envmap-generator';
import { PathTracerRenderer } from '../render/PathTracerRenderer';
import type { LightPreset } from '../lighting/lighting-presets';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { useEnvironmentStore } from '../stores/EnvironmentStore';
import { SectionSceneController } from './section-scene-controller';
import { DxfToThreeConverter } from '../converters/DxfToThreeConverter';
import { raycastBimGroup, type RaycastHit } from '../systems/raycaster/BimEntityRaycaster';
import { BimSelectionHighlighter } from '../systems/selection/BimSelectionHighlighter';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { applyFloorVisibility } from '../utils/applyFloorVisibility';
import type { FloorVisMode } from '../utils/floor-visibility-state';
import { applyBuildingVisibility } from '../utils/applyBuildingVisibility';
import type { BuildingVisMode } from '../utils/building-visibility-state';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import type { BuildingRef, FloorRef } from '../../bim/utils/bim-floor-utils';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewportCamera } from '../viewport/viewport-types';
import type { ViewCubeEngine } from '../viewport/view-cube/view-cube';
import { VIEWCUBE_HIDE_WIDTH_PX } from '../viewport/viewport-constants';
import type { FinalRenderConfig } from '../stores/ViewMode3DStore';
import { startFinalRender as runFinalRender } from './start-final-render';
import { createCanonicalViewService } from '../viewport/CanonicalViewService';
import type { CanonicalViewService } from '../viewport/CanonicalViewService';
import type { CanonicalViewId } from '../viewport/viewport-types';
import { createAnimationManager } from '../viewport/animation-manager';
import type { AnimationManager } from '../viewport/animation-manager';
import { computeFramingTargetBounds } from './scene-framing-bounds';
import { createBimRenderer, createBimLights, createBimScene } from './scene-setup';
import {
  createKeyboardFocusManager,
  type KeyboardFocusManagerApi,
} from '../accessibility/KeyboardFocusManager';
import { FocusOutlineRenderer } from '../accessibility/FocusOutlineRenderer';
import type { FocusEntityLabelData } from '../accessibility/FocusIndicator3D';
import { computeFocusOrder, findFocusedEntityData } from '../accessibility/focus-order';
import { applyLightPresetToScene, updateSunDirection } from '../lighting/apply-light-preset';
import { checkReducedMotion, type ReducedMotionOverride } from '../accessibility/use-reduced-motion';
import { WaypointDragHandleRenderer } from '../animation/WaypointDragHandle';

const INITIAL_CAMERA_POSITION = new THREE.Vector3(15, 10, 15);
const INITIAL_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);

export class ThreeJsSceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly viewport: ViewportCamera;
  readonly bimLayer: BimSceneLayer;
  readonly dxfConverter: DxfToThreeConverter;
  readonly selectionHighlighter: BimSelectionHighlighter;
  private readonly viewCube: ViewCubeEngine;
  private readonly poi: ReturnType<typeof createPoi>;
  private readonly sun: THREE.DirectionalLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly idleDetector: IdleDetector;
  private readonly qualityModulator: QualityModulator;
  private readonly ssaoModulator: SSAOModulator;
  private readonly envmapGenerator: EnvmapGenerator;
  private readonly pathTracerRenderer: PathTracerRenderer;

  private readonly performanceCollector: PerformanceCollector;
  private readonly envStoreUnsub: () => void;
  private readonly sectionController: SectionSceneController;
  /** Phase 4.2: single animation manager, ticked by main RAF (ADR-040 compliant). */
  private readonly animationManager: AnimationManager;
  /** Phase 4.4: shared canonical-view dispatcher (ViewCube + keyboard shortcuts). */
  private readonly canonicalViewService: CanonicalViewService;
  /** Phase 4.5 A.7.Q1: keyboard focus state machine + Three.js outline. */
  private readonly keyboardFocusManager: KeyboardFocusManagerApi;
  private readonly focusOutlineRenderer: FocusOutlineRenderer;
  private readonly focusUnsub: () => void;
  /** ADR-366 §C.1.b — waypoint drag-handle sprites (visualization only για C.1.b). */
  private readonly waypointDragHandleRenderer: WaypointDragHandleRenderer;
  private rafHandle: number | null = null;
  private disposed = false;
  private reducedMotionOverride: ReducedMotionOverride = 'auto';
  private lastFrameTime = performance.now();
  private isInteracting = false;
  private initialCameraFitDone = false;
  /** Phase 4.3: mutable callback for ViewCube right-click context menu. */
  private viewCubeContextMenuCb: ((x: number, y: number) => void) | null = null;

  constructor(container: HTMLElement) {
    this.renderer = createBimRenderer(container);
    const lights = createBimLights();
    this.sun = lights.sun;
    this.ambient = lights.ambient;
    this.hemi = lights.hemi;
    this.scene = createBimScene(lights);
    this.qualityModulator = new QualityModulator(this.sun);
    this.bimLayer = new BimSceneLayer(this.scene);
    this.selectionHighlighter = new BimSelectionHighlighter(this.bimLayer.group);
    this.dxfConverter = new DxfToThreeConverter(this.scene);
    this.viewport = this.initViewportCamera(container);
    const { width, height } = this.getViewportSize();
    this.ssaoModulator = new SSAOModulator(
      this.renderer,
      this.scene,
      () => this.viewport.camera,
      width,
      height,
    );
    this.envmapGenerator = new EnvmapGenerator(this.renderer, this.scene);
    this.pathTracerRenderer = new PathTracerRenderer(
      this.renderer,
      this.scene,
      () => this.viewport.camera,
    );
    this.idleDetector = new IdleDetector({
      thresholdMs: 800,
      onIdle: () => {
        this.qualityModulator.onCameraIdle();
        this.ssaoModulator.onCameraIdle();
        this.pathTracerRenderer.start();
        useViewMode3DStore.getState().enterPreviewMode();
      },
      onActive: () => {
        this.qualityModulator.onCameraActive();
        this.ssaoModulator.onCameraActive();
        this.pathTracerRenderer.cancel();
        useViewMode3DStore.getState().enterRasterMode();
      },
    });
    this.poi = createPoi();
    this.scene.add(this.poi.root);
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
    this.viewCube = this.initViewCube(container);
    this.performanceCollector = new PerformanceCollector(this.renderer, this.scene);
    this.performanceCollector.start();
    this.envStoreUnsub = useEnvironmentStore.subscribe(
      (s) => s.hdriUrl,
      (url) => { if (url) void this.loadHdriEnvironment(url); },
    );
    // ADR-366 §A.3 Phase 7.0 — Section Cuts wiring (delegated to controller).
    this.sectionController = new SectionSceneController({
      renderer: this.renderer,
      scene: this.scene,
      getCamera: () => this.viewport.camera,
      getBimGroup: () => this.bimLayer.group,
      getDxfBounds: () => this.dxfConverter.getBounds(),
      invalidatePathTracer: () => this.pathTracerRenderer.invalidateScene(),
    });
    // ADR-366 §C.1.b — waypoint drag-handle sprites. Auto-subscribes σε AnimationStore.
    this.waypointDragHandleRenderer = new WaypointDragHandleRenderer(this.scene);
    this.startLoop();
  }

  private getViewportSize(): { width: number; height: number } {
    return {
      width: this.renderer.domElement.clientWidth || 800,
      height: this.renderer.domElement.clientHeight || 600,
    };
  }

  private initViewportCamera(container: HTMLElement): ViewportCamera {
    return createViewportCamera(this.renderer.domElement, {
      initialPosition: INITIAL_CAMERA_POSITION.clone(),
      initialTarget: INITIAL_CAMERA_TARGET.clone(),
      onRenderNeeded: () => { /* RAF drives rendering — no-op */ },
      onInteractionStart: () => {
        this.isInteracting = true;
        this.poi.onNavigationActive();
      },
      onInteractionEnd: () => { this.isInteracting = false; },
      getReducedMotion: () => checkReducedMotion(this.reducedMotionOverride),
    });
  }

  /** ADR-366 Phase 9 / C.5.Q5 — update override; viewport reads it at animation-call time. */
  setReducedMotionOverride(override: ReducedMotionOverride): void {
    this.reducedMotionOverride = override;
  }

  private initViewCube(container: HTMLElement): ViewCubeEngine {
    return createViewCube({
      container,
      getCamera: () => this.viewport.camera as THREE.PerspectiveCamera | THREE.OrthographicCamera,
      getTarget: () => this.viewport.target,
      // Fallback path (used only when onSnapToView is absent — backward compat).
      onFaceSnap: (mode) => this.viewport.setProjection(mode),
      onDirSnap: (dir) => this.viewport.snapToViewDirection(dir),
      // Phase 4.1: canonical dispatch — routes all face/edge/corner clicks.
      onSnapToView: (id) => this.canonicalViewService.snapTo(id),
      // Home = NE isometric (A.5 decision — industry convergence 4/4).
      onHome: () => this.canonicalViewService.snapHome(),
      onDragRotate: (dx, dy) => this.viewport.applyTumble(dx, dy),
      // Phase 4.3: right-click context menu — delegate to mutable callback (set by BimViewport3D).
      onContextMenuRequest: (x, y) => this.viewCubeContextMenuCb?.(x, y),
    });
  }

  // Phase 4.4 keyboard-shortcut façade (use3DShortcuts → manager → viewport).
  snapToCanonicalView(view: CanonicalViewId): void {
    if (!this.disposed) this.canonicalViewService.snapTo(view);
  }
  snapToHomeView(): void {
    if (!this.disposed) this.canonicalViewService.snapHome();
  }
  /** ADR-366 A.6.Q4 selection-aware F — bounds math in `scene-framing-bounds.ts`. */
  frameSelectionOrFitExtents(): void {
    if (this.disposed) return;
    const bounds = computeFramingTargetBounds(
      this.bimLayer.group,
      this.dxfConverter.getBounds(),
      useSelection3DStore.getState().selectedBimId,
    );
    if (!bounds || bounds.isEmpty()) return;
    this.viewport.frameBounds(bounds.min, bounds.max);
  }

  // ── Phase 4.5 / A.7 — Accessibility public surface ─────────────────────────
  /** ADR-366 Phase 4.5 / A.7.Q4 — screen-space pan (dxPx > 0 = view right, dyPx > 0 = view up). */
  panViewportByPixels(dxPx: number, dyPx: number): void {
    if (!this.disposed) this.viewport.pan(dxPx, dyPx);
  }

  /** ADR-366 Phase 9 / C.5.Q3 — current frustum-culled entity order for keyboard navigator. */
  getEntityFocusOrder(): readonly string[] {
    if (this.disposed) return [];
    return computeFocusOrder(this.bimLayer.group, this.viewport.camera);
  }

  /** ADR-366 Phase 4.5 / A.7.Q1 — Tab/Shift+Tab cycle through visible entities. */
  cycleKeyboardFocus(direction: 'next' | 'prev'): void {
    if (this.disposed) return;
    this.keyboardFocusManager.setOrder(computeFocusOrder(this.bimLayer.group, this.viewport.camera));
    if (direction === 'next') this.keyboardFocusManager.next();
    else this.keyboardFocusManager.prev();
  }

  /** ADR-366 Phase 4.5 / A.7.Q1 — Enter on focused entity → toggle selection (ADR-030 integration). */
  selectFocusedEntity(): void {
    if (this.disposed) return;
    const focusedId = this.keyboardFocusManager.getFocused();
    if (!focusedId) return;
    const currentSelected = useSelection3DStore.getState().selectedBimId;
    if (currentSelected === focusedId) {
      this.selectBimEntity(null);
    } else {
      this.selectBimEntity(focusedId);
    }
  }

  /** ADR-366 Phase 4.5 / A.7.Q1 — Esc clears focus ring (selection untouched). */
  clearKeyboardFocus(): void {
    if (!this.disposed) this.keyboardFocusManager.clear();
  }

  /** Read-only handle for FocusIndicator3D React subscriber. */
  getKeyboardFocusManager(): KeyboardFocusManagerApi {
    return this.keyboardFocusManager;
  }

  /** Resolve label data for the floating focus label (entity type + name + world center). */
  getFocusedEntityData(bimId: string): FocusEntityLabelData | null {
    if (this.disposed) return null;
    return findFocusedEntityData(this.bimLayer.group, bimId);
  }

  /** Expose live camera for screen-projection (FocusIndicator3D label positioning). */
  getCamera(): THREE.Camera {
    return this.viewport.camera;
  }

  /** Phase 4.3: wire BimViewport3D's React context menu callback into the ViewCube. */
  setViewCubeContextMenuCallback(cb: (x: number, y: number) => void): void {
    this.viewCubeContextMenuCb = cb;
  }

  /** Phase 4.3: propagate user compass visibility preference to the ViewCube. */
  setViewCubeCompassVisible(visible: boolean): void {
    this.viewCube.setCompassVisible(visible);
  }

  private startLoop(): void {
    const ctx: RenderFrameContext = {
      viewport: this.viewport,
      viewCube: this.viewCube,
      animationManager: this.animationManager,
      focusOutlineRenderer: this.focusOutlineRenderer,
      idleDetector: this.idleDetector,
      ssaoModulator: this.ssaoModulator,
      pathTracerRenderer: this.pathTracerRenderer,
      sectionController: this.sectionController,
      poi: this.poi,
      isInteracting: () => this.isInteracting,
    };
    const animate = () => {
      if (this.disposed) return;
      this.rafHandle = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;
      renderSceneFrame(ctx, now, delta);
    };
    this.rafHandle = requestAnimationFrame(animate);
  }

  syncBimEntities(
    entities: Bim3DEntities,
    floorElevationMm = 0,
    activeLevelId?: string,
    floors: readonly FloorRef[] = [],
    buildings: readonly BuildingRef[] = [],
    activeBuildingId: string | null = null,
    buildingVisModes: ReadonlyMap<string, BuildingVisMode> = new Map(),
  ): void {
    if (this.disposed) return;
    const selectedId = useSelection3DStore.getState().selectedBimId;
    this.selectionHighlighter.onClear();
    // Phase 4.5: stale bimId refs die on rebuild — clear focus before new traversal.
    this.keyboardFocusManager.clear();
    this.bimLayer.sync(entities, floorElevationMm, activeLevelId, floors, buildings, activeBuildingId, buildingVisModes);
    if (buildingVisModes.size > 0) applyBuildingVisibility(this.bimLayer.group, buildingVisModes);
    if (selectedId) this.selectionHighlighter.onSelect(selectedId);
    this.pathTracerRenderer.invalidateScene();
    this.sectionController.ensureInit();
    this.sectionController.applyState();
  }

  applyFloorVisibility(modes: ReadonlyMap<string, FloorVisMode>): void {
    if (!this.disposed) applyFloorVisibility(this.bimLayer.group, modes);
  }

  applyBuildingVisibility(modes: ReadonlyMap<string, BuildingVisMode>): void {
    if (!this.disposed) applyBuildingVisibility(this.bimLayer.group, modes);
  }

  syncDxfOverlay(dxfScene: DxfScene | null): void {
    if (this.disposed) return;
    this.dxfConverter.sync(dxfScene);
    this.pathTracerRenderer.invalidateScene();
    if (!this.initialCameraFitDone) {
      const box = this.dxfConverter.getBounds();
      if (box && !box.isEmpty()) {
        this.viewport.frameBounds(box.min, box.max);
        this.initialCameraFitDone = true;
      }
    }
    this.sectionController.ensureInit();
    this.sectionController.applyState();
  }

  selectBimEntity(bimId: string | null): void {
    if (this.disposed) return;
    if (bimId === null) {
      this.selectionHighlighter.onClear();
      useSelection3DStore.getState().clearSelection();
      return;
    }
    // Resolve bimType from the live group before highlighting.
    let bimType = '';
    this.bimLayer.group.traverse((obj) => {
      if (bimType) return;
      const id = obj.userData['bimId'] as string | undefined;
      if (id === bimId) bimType = (obj.userData['bimType'] as string | undefined) ?? '';
    });
    this.selectionHighlighter.onSelect(bimId);
    useSelection3DStore.getState().selectEntity(bimId, bimType);
  }

  raycastBimEntities(clientX: number, clientY: number): RaycastHit | null {
    if (this.disposed) return null;
    return raycastBimGroup(
      this.bimLayer.group,
      this.viewport.camera,
      this.renderer.domElement,
      clientX,
      clientY,
    );
  }

  updateSunPosition(azimuthDeg: number, elevationDeg: number): void {
    if (!this.disposed) updateSunDirection(this.sun, azimuthDeg, elevationDeg);
  }

  /** Public bridge για το ADR-366 §A.3 Section controller (BimViewport3D safety effect). */
  initSectionBox(): void {
    if (this.disposed) return;
    this.sectionController.ensureInit();
    this.sectionController.applyState();
  }

  async loadHdriEnvironment(url: string): Promise<void> {
    if (this.disposed) return;
    const store = useEnvironmentStore.getState();
    store.setLoading(true);
    store.setError(false);
    try {
      await this.envmapGenerator.loadHdri(url);
      this.pathTracerRenderer.invalidateScene();
    } catch {
      store.setError(true);
    } finally {
      store.setLoading(false);
    }
  }

  applyLightPreset(preset: LightPreset): void {
    if (this.disposed) return;
    applyLightPresetToScene(
      { sun: this.sun, ambient: this.ambient, hemi: this.hemi },
      preset,
      this.envmapGenerator,
    );
  }

  getRendererCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  startFinalRender(
    config: FinalRenderConfig,
    renderContext: { projectId: string; companyId: string; userId: string },
    onProgress: (pct: number) => void,
    onComplete: (result: { savedDisk: boolean; savedProject: boolean; uploadError: boolean }) => void,
  ): void {
    if (this.disposed) return;
    runFinalRender(this.pathTracerRenderer, this.renderer.domElement, config, renderContext, onProgress, onComplete);
  }

  cancelFinalRender(): void {
    if (!this.disposed) this.pathTracerRenderer.cancelFinal();
  }

  resize(width: number, height: number): void {
    if (this.disposed || width === 0 || height === 0) return;
    this.viewport.updateAspect(width, height);
    this.renderer.setSize(width, height);
    this.ssaoModulator.resize(width, height);
    this.viewCube.setVisible(width >= VIEWCUBE_HIDE_WIDTH_PX);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.envStoreUnsub();
    this.sectionController.dispose();
    this.waypointDragHandleRenderer.dispose();
    const dom = this.renderer.domElement;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.animationManager.dispose();
    this.focusUnsub();
    this.focusOutlineRenderer.dispose();
    this.keyboardFocusManager.dispose();
    this.idleDetector.dispose();
    this.qualityModulator.dispose();
    this.pathTracerRenderer.dispose();
    this.ssaoModulator.dispose();
    this.envmapGenerator.dispose();
    this.performanceCollector.dispose();
    this.selectionHighlighter.dispose();
    this.bimLayer.dispose();
    this.dxfConverter.dispose();
    this.viewport.dispose();
    this.viewCube.dispose();
    this.poi.dispose();
    this.renderer.dispose();
    if (dom.parentNode) dom.parentNode.removeChild(dom);
  }
}
