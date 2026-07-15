/**
 * scene-manager-construct — builds the ThreeJsSceneManager subsystem bundle (highlighters, POI,
 * Cinema-4D grid floor, animation / canonical-view / keyboard-focus services, ViewCube, environment
 * + background-mode store subscriptions, section controller, waypoint drag handles, frozen DXF
 * backdrop + the cached render-frame context). Extracted from the constructor to keep
 * ThreeJsSceneManager under the 500-line SRP limit — pure wiring, no React, no per-frame logic.
 * ADR-040 Phase XXIII (frameContext) / ADR-558 (grid) / ADR-516 Phase 2 (backdrop) / ADR-446 §2 (bg).
 */

import type * as THREE from 'three';
import { createPoi } from '../viewport/viewport-poi';
import type { RenderFrameContext } from './scene-render-frame';
import { DxfBackdropCache } from './dxf-backdrop-cache';
import type { BimSceneLayer } from './BimSceneLayer';
import { Cinema4DGridFloor } from './grid/cinema4d-grid-floor'; // ADR-558 — Cinema-4D-style ground grid
import type { IdleDetector } from '../lighting/idle-detector';
import type { SSAOModulator } from '../lighting/ssao-modulator';
import type { ShadowModulator } from '../lighting/shadow-modulator';
import type { EnvmapGenerator } from '../lighting/envmap-generator';
import type { PathTracerRenderer } from '../render/PathTracerRenderer';
import { useEnvironmentStore } from '../stores/EnvironmentStore';
import { SectionSceneController } from './section-scene-controller';
import type { DxfToThreeConverter } from '../converters/DxfToThreeConverter';
import { BimSelectionHighlighter } from '../systems/selection/BimSelectionHighlighter';
import { FaceSelectionHighlighter } from '../systems/selection/FaceSelectionHighlighter'; // ADR-539 per-face overlay
import { StairSubElementHighlighter } from '../systems/selection/StairSubElementHighlighter'; // ADR-358 Q19 per-tread/riser overlay
import { useStairSubElementSelectionStore } from '../../bim/stairs/stair-sub-element-selection-store';
import { useSelection3DStore } from '../stores/Selection3DStore';
import type { ViewportCamera } from '../viewport/viewport-types';
import type { ViewCubeEngine } from '../viewport/view-cube/view-cube';
import { createCanonicalViewService, type CanonicalViewService } from '../viewport/CanonicalViewService';
import { createAnimationManager, type AnimationManager } from '../viewport/animation-manager';
import { createKeyboardFocusManager, type KeyboardFocusManagerApi } from '../accessibility/KeyboardFocusManager';
import { FocusOutlineRenderer } from '../accessibility/FocusOutlineRenderer';
import { initViewCube } from './scene-setup';
import { computeSceneFramingBounds } from './scene-framing-bounds';
import { initBackgroundModeSubscription } from './scene-manager-actions';
import { WaypointDragHandleRenderer } from '../animation/WaypointDragHandle';
import { TerrainSceneLayer } from './terrain/TerrainSceneLayer'; // ADR-650 M4 — topographic surface
import { TerrainContourLayer } from './terrain/TerrainContourLayer'; // ADR-650 M10d — draped 3D contours
import { PointCloudSceneLayer } from './terrain/PointCloudSceneLayer'; // ADR-650 M8β/Β — point cloud (display-only)

export interface SceneManagerConstructDeps {
  readonly container: HTMLElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly bimLayer: BimSceneLayer;
  readonly dxfConverter: DxfToThreeConverter;
  readonly viewport: ViewportCamera;
  readonly envmapGenerator: EnvmapGenerator;
  readonly pathTracerRenderer: PathTracerRenderer;
  readonly ssaoModulator: SSAOModulator;
  readonly shadowModulator: ShadowModulator;
  readonly idleDetector: IdleDetector;
  /** Shared silhouette outline pass (ADR-536) — feeds selection + hover highlighters. */
  readonly selectionOutlinePass: ConstructorParameters<typeof BimSelectionHighlighter>[1];
  readonly markDirty: () => void;
  readonly isInteracting: () => boolean;
  readonly onViewCubeContextMenu: (x: number, y: number) => void;
  readonly onHdriUrl: (url: string) => void;
}

export interface SceneManagerParts {
  readonly selectionHighlighter: BimSelectionHighlighter;
  readonly hoverHighlighter: BimSelectionHighlighter;
  readonly faceHighlighter: FaceSelectionHighlighter;
  readonly faceHoverHighlighter: FaceSelectionHighlighter;
  /** ADR-358 Q19 — per-tread/riser overlay (click-into components). */
  readonly stairSubElementHighlighter: StairSubElementHighlighter;
  /** Teardown for the two ADR-358 store subscriptions (selection-reflect + host-lifecycle clear). */
  readonly stairSubUnsub: () => void;
  readonly poi: ReturnType<typeof createPoi>;
  readonly gridFloor: Cinema4DGridFloor;
  readonly terrainLayer: TerrainSceneLayer; // ADR-650 M4 — topographic surface (TIN → mesh)
  readonly terrainContourLayer: TerrainContourLayer; // ADR-650 M10d — draped contour lines (once, real z)
  readonly pointCloudLayer: PointCloudSceneLayer; // ADR-650 M8β/Β — display-only cloud (never geometry)
  readonly animationManager: AnimationManager;
  readonly canonicalViewService: CanonicalViewService;
  readonly keyboardFocusManager: KeyboardFocusManagerApi;
  readonly focusOutlineRenderer: FocusOutlineRenderer;
  readonly focusUnsub: () => void;
  readonly viewCube: ViewCubeEngine;
  readonly envStoreUnsub: () => void;
  readonly bgModeUnsub: () => void;
  readonly sectionController: SectionSceneController;
  readonly waypointDragHandleRenderer: WaypointDragHandleRenderer;
  readonly dxfBackdrop: DxfBackdropCache;
  readonly frameContext: RenderFrameContext;
}

/** Build the post-viewport subsystem bundle. Runtime construction order matches the original
 *  constructor (viewport + rendering subsystems already built by the caller). */
export function buildSceneManagerParts(deps: SceneManagerConstructDeps): SceneManagerParts {
  const {
    container, renderer, scene, bimLayer, dxfConverter, viewport,
    envmapGenerator, pathTracerRenderer, ssaoModulator, shadowModulator, idleDetector,
    selectionOutlinePass, markDirty, isInteracting, onViewCubeContextMenu, onHdriUrl,
  } = deps;

  // ADR-536 — highlighter feeds the selected meshes into the silhouette outline.
  const selectionHighlighter = new BimSelectionHighlighter(bimLayer.group, selectionOutlinePass);
  // ADR-538 — hover highlighter → SAME pass, yellow silhouette (via `setHovered`).
  const hoverHighlighter = new BimSelectionHighlighter(bimLayer.group, selectionOutlinePass, (p, o) => p.setHovered(o));
  const faceHighlighter = new FaceSelectionHighlighter(bimLayer.group);
  const faceHoverHighlighter = new FaceSelectionHighlighter(bimLayer.group, 0xffd400, 0.3); // ADR-539 Φ2 hover
  // ADR-358 Q19 — per-tread/riser overlay. The selection SSoT is the low-freq
  // `useStairSubElementSelectionStore`; ONE imperative subscription reflects it here (ADR-040
  // leaf, not an orchestrator React subscription), so every mutation source (3D click, Tab/Esc,
  // 2D canvas, lifecycle-clear) drives the visual through the single store.
  const stairSubElementHighlighter = new StairSubElementHighlighter(bimLayer.group);
  const stairSubReflectUnsub = useStairSubElementSelectionStore.subscribe((s) => {
    stairSubElementHighlighter.setTarget(s.selected);
    markDirty();
  });
  // ADR-358 Q19 §2γ — drop the sub-selection when its host stair leaves the whole-entity
  // selection from ANY source (2D canvas, ribbon, 3D). clear() then re-fires the reflect sub.
  const stairSubLifecycleUnsub = useSelection3DStore.subscribe((s) => {
    const sub = useStairSubElementSelectionStore.getState().selected;
    if (sub && !s.selectedBimIds.includes(sub.stairId)) {
      useStairSubElementSelectionStore.getState().clear();
    }
  });
  const stairSubUnsub = (): void => { stairSubReflectUnsub(); stairSubLifecycleUnsub(); };

  const poi = createPoi();
  scene.add(poi.root);
  // ADR-558 — Cinema-4D-style ground grid. Registers itself as a post-FX 'underlay' overlay
  // (AO-immune, depth-tested → occluded by the building). World-locked grid in true perspective +
  // soft horizon fade (cell step + fade radii scale with the camera distance).
  const gridFloor = new Cinema4DGridFloor(scene, () => viewport.camera, () => viewport.target);

  // ADR-650 M4 — topographic surface. Subscribes to the survey + display stores itself and
  // rebuilds its mesh from the ONE derived TIN (the same one the 2D contours are cut from).
  const terrainLayer = new TerrainSceneLayer(scene, markDirty);

  // ADR-650 M10d — οι ισοϋψείς της ΙΔΙΑΣ επιφάνειας ως draped γραμμές στο πραγματικό υψόμετρο (μία
  // φορά, όχι ανά όροφο). Ξεχωριστό layer από το mesh: εμφανίζεται/κρύβεται μαζί με το έδαφος, αλλά
  // είναι γραμμές (Revit Toposurface contours), ανεξάρτητο από το floor scope.
  const terrainContourLayer = new TerrainContourLayer(scene, markDirty);

  // ADR-650 M8β/Β — το νέφος σημείων του τελευταίου import. Ξεχωριστό layer από το έδαφος: το
  // έδαφος είναι η ΜΕΤΡΗΜΕΝΗ επιφάνεια, το νέφος είναι display-only τεκμήριο (§6) — μπαίνουν και
  // βγαίνουν ανεξάρτητα, και το νέφος δεν συμμετέχει ποτέ σε raycast/snap.
  const pointCloudLayer = new PointCloudSceneLayer(scene, markDirty);

  // Phase 4.2 — single animation manager (ADR-040 — ticked by the main RAF).
  const animationManager = createAnimationManager();
  // Phase 4.4 — instantiated once, shared by ViewCube and keyboard dispatcher.
  const canonicalViewService = createCanonicalViewService(viewport, animationManager);
  // Phase 4.5 A.7.Q1 — focus state machine + outline. Subscribe to drive the outline.
  const keyboardFocusManager = createKeyboardFocusManager();
  const focusOutlineRenderer = new FocusOutlineRenderer(scene);
  const focusUnsub = keyboardFocusManager.subscribe((focusedId) => {
    focusOutlineRenderer.setTargetById(bimLayer.group, focusedId);
  });

  const viewCube = initViewCube({
    container,
    renderer, // ADR-553 — scissored sub-viewport of the main renderer (1 WebGL context).
    onRenderNeeded: markDirty,
    viewport,
    canonicalViewService,
    // ADR-366 §C.1.b — combined BIM∪DXF bounds so HOME can zoom-to-fit the whole drawing.
    getSceneFramingBounds: () => computeSceneFramingBounds(bimLayer.group, dxfConverter.getBounds()),
    onContextMenuRequest: onViewCubeContextMenu,
  });

  const envStoreUnsub = useEnvironmentStore.subscribe(
    (s) => s.hdriUrl,
    (url) => { if (url) onHdriUrl(url); },
  );
  // ADR-446 §2 — visible-background mode subscription (logic in scene-manager-actions).
  const bgModeUnsub = initBackgroundModeSubscription(envmapGenerator, markDirty);

  // ADR-366 §A.3 Phase 7.0 — Section Cuts wiring (delegated to controller).
  const sectionController = new SectionSceneController({
    renderer, scene, getCamera: () => viewport.camera,
    getBimGroup: () => bimLayer.group, getDxfBounds: () => dxfConverter.getBounds(),
    invalidatePathTracer: () => pathTracerRenderer.invalidateScene(), markDirty, // ADR-452 cut-plane drag → repaint
  });
  // ADR-366 §C.1.b — waypoint drag-handle sprites. Auto-subscribes σε AnimationStore.
  const waypointDragHandleRenderer = new WaypointDragHandleRenderer(scene);
  // ADR-516 Phase 2 — frozen DXF backdrop. Gated OFF while section-cut / path-trace own the frame.
  const dxfBackdrop = new DxfBackdropCache({ isSectionActive: () => sectionController.isStencilActive(), isPathTracerActive: () => pathTracerRenderer.isActive });

  // ADR-040 Phase XXIII — cache render-frame context once. Scheduler drives tick().
  const frameContext: RenderFrameContext = {
    renderer, scene, dxfBackdrop,
    viewport, viewCube,
    animationManager, focusOutlineRenderer,
    idleDetector, ssaoModulator,
    shadowModulator,
    pathTracerRenderer, sectionController,
    poi, isInteracting,
  };

  return {
    selectionHighlighter, hoverHighlighter, faceHighlighter, faceHoverHighlighter,
    stairSubElementHighlighter, stairSubUnsub,
    poi, gridFloor, terrainLayer, terrainContourLayer, pointCloudLayer, animationManager, canonicalViewService,
    keyboardFocusManager, focusOutlineRenderer, focusUnsub, viewCube,
    envStoreUnsub, bgModeUnsub, sectionController, waypointDragHandleRenderer,
    dxfBackdrop, frameContext,
  };
}
