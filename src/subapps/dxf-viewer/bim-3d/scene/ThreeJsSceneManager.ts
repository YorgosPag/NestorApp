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
import { detectSnapCandidate } from '../viewport/view-snap-detector';
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
import type { FinalRenderConfig } from '../stores/ViewMode3DStore';
import { writeRenderOutput } from '../render/render-output-writer';
import { useCameraTargetStore } from '../stores/CameraTargetStore';
import { createCanonicalViewService } from '../viewport/CanonicalViewService';

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
  private rafHandle: number | null = null;
  private disposed = false;
  private lastFrameTime = performance.now();
  private isInteracting = false;
  private initialCameraFitDone = false;

  constructor(container: HTMLElement) {
    this.renderer = this.initRenderer(container);
    const lights = this.createLights();
    this.sun = lights.sun;
    this.ambient = lights.ambient;
    this.hemi = lights.hemi;
    this.scene = this.initScene();
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
    this.startLoop();
  }

  private getViewportSize(): { width: number; height: number } {
    return {
      width: this.renderer.domElement.clientWidth || 800,
      height: this.renderer.domElement.clientHeight || 600,
    };
  }

  private initRenderer(container: HTMLElement): THREE.WebGLRenderer {
    // stencil:true required for ADR-366 §A.3 Phase 7.0a stencil cap pipeline.
    // (Three.js default is already true, set explicit για future-proofing.)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
    renderer.setClearColor(0x1a1a1a, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    return renderer;
  }

  private createLights(): { sun: THREE.DirectionalLight; ambient: THREE.AmbientLight; hemi: THREE.HemisphereLight } {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);

    const sun = new THREE.DirectionalLight(0xfffaf0, 3);
    sun.castShadow = true;
    sun.shadow.bias = -0.002;
    sun.shadow.normalBias = 0.1;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.3);

    return { sun, ambient, hemi };
  }

  private initScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.add(new THREE.AxesHelper(2));
    scene.add(this.ambient);
    scene.add(this.sun);
    scene.add(this.hemi);
    // Apply noon default position (ADR-366 §7.2)
    this.sun.position.set(-5, 10, 5);
    return scene;
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
    });
  }

  private initViewCube(container: HTMLElement): ViewCubeEngine {
    const canonicalViewService = createCanonicalViewService(this.viewport);
    return createViewCube({
      container,
      getCamera: () => this.viewport.camera as THREE.PerspectiveCamera | THREE.OrthographicCamera,
      getTarget: () => this.viewport.target,
      // Fallback path (used only when onSnapToView is absent — backward compat).
      onFaceSnap: (mode) => this.viewport.setProjection(mode),
      onDirSnap: (dir) => this.viewport.snapToViewDirection(dir),
      // Phase 4.1: canonical dispatch — routes all face/edge/corner clicks.
      onSnapToView: (id) => canonicalViewService.snapTo(id),
      // Home = NE isometric (A.5 decision — industry convergence 4/4).
      onHome: () => canonicalViewService.snapHome(),
      onDragRotate: (dx, dy) => this.viewport.applyTumble(dx, dy),
    });
  }

  private startLoop(): void {
    const animate = () => {
      if (this.disposed) return;
      this.rafHandle = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;

      this.viewport.update();
      useCameraTargetStore.getState().syncFromCamera(this.viewport.camera, this.viewport.target);

      if (this.isInteracting) {
        this.idleDetector.notifyActive();
      } else {
        this.idleDetector.notifyIdle();
      }

      // POI: update position + fade
      this.poi.updateTarget(this.viewport.target);
      this.poi.updateCamera(this.viewport.camera);
      this.poi.updateFade(delta);

      // ViewCube: sync rotation from main camera every frame
      this.viewCube.sync(
        this.viewport.camera as THREE.PerspectiveCamera | THREE.OrthographicCamera,
        this.viewport.target,
      );

      // Smart View Snap: suggest projection on camera stop
      if (!this.isInteracting && !this.viewport.isAnimating) {
        detectSnapCandidate(this.viewport.camera.position, this.viewport.target);
        // Snap candidate available for future ribbon indicator (Phase 4)
      }

      if (this.pathTracerRenderer.isActive) {
        // Cancel during camera animation — stale BVH state causes WebGL errors.
        if (this.viewport.isAnimating) {
          this.pathTracerRenderer.cancel();
          useViewMode3DStore.getState().enterRasterMode();
        } else {
          try {
            this.pathTracerRenderer.renderSample();
          } catch {
            this.pathTracerRenderer.cancel();
            useViewMode3DStore.getState().enterRasterMode();
          }
        }
      } else if (this.sectionController.isStencilActive()) {
        // ADR-366 §A.3 Phase 7.0a — Direct render + stencil caps.
        // Bypass EffectComposer/SSAO (default RT lacks stencil buffer).
        // SSAO trade-off acceptable: section editing = active interaction,
        // SSAO only kicks in at idle anyway.
        this.sectionController.renderFrameWithCaps(this.viewport.camera);
      } else {
        this.ssaoModulator.render();
      }
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
    if (this.disposed) return;
    const azRad = (azimuthDeg * Math.PI) / 180;
    const elRad = (elevationDeg * Math.PI) / 180;
    const x = Math.cos(elRad) * Math.sin(azRad);
    const y = Math.sin(elRad);
    const z = Math.cos(elRad) * Math.cos(azRad);
    this.sun.position.set(x * 15, y * 15, z * 15);
    this.sun.visible = elevationDeg > -5;
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
    this.sun.color.set(preset.sunColor);
    this.sun.intensity = preset.sunIntensity;
    this.ambient.intensity = preset.ambientIntensity;
    this.hemi.color.set(preset.skyColor);
    this.hemi.groundColor.set(preset.groundColor);
    this.hemi.intensity = preset.hemisphereIntensity;
    this.updateSunPosition(preset.azimuthDeg, preset.elevationDeg);
    this.envmapGenerator.updateForPreset(preset);
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
    // Cancel any in-progress preview path trace first
    this.pathTracerRenderer.cancel();
    this.pathTracerRenderer.invalidateScene();

    this.pathTracerRenderer.startFinal(
      config,
      onProgress,
      () => {
        const canvas = this.renderer.domElement;
        writeRenderOutput(canvas, {
          format: config.format,
          destDisk: config.destDisk,
          destProject: config.destProject,
          projectId: renderContext.projectId,
          companyId: renderContext.companyId,
          userId: renderContext.userId,
          presetSPP: config.presetSPP,
          resolutionW: config.resolutionW,
          resolutionH: config.resolutionH,
        }).then(onComplete).catch(() => {
          onComplete({ savedDisk: false, savedProject: false, uploadError: true });
        });
      },
    );
  }

  cancelFinalRender(): void {
    if (!this.disposed) this.pathTracerRenderer.cancelFinal();
  }

  resize(width: number, height: number): void {
    if (this.disposed || width === 0 || height === 0) return;
    this.viewport.updateAspect(width, height);
    this.renderer.setSize(width, height);
    this.ssaoModulator.resize(width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.envStoreUnsub();
    this.sectionController.dispose();
    const dom = this.renderer.domElement;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
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
