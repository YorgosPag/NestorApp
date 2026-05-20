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
import { DxfToThreeConverter } from '../converters/DxfToThreeConverter';
import { raycastBimGroup, type RaycastHit } from '../systems/raycaster/BimEntityRaycaster';
import { BimSelectionHighlighter } from '../systems/selection/BimSelectionHighlighter';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { applyFloorVisibility } from '../utils/applyFloorVisibility';
import type { FloorVisMode } from '../utils/floor-visibility-state';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewportCamera } from '../viewport/viewport-types';
import type { ViewCubeEngine } from '../viewport/view-cube/view-cube';

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
    this.startLoop();
  }

  private getViewportSize(): { width: number; height: number } {
    return {
      width: this.renderer.domElement.clientWidth || 800,
      height: this.renderer.domElement.clientHeight || 600,
    };
  }

  private initRenderer(container: HTMLElement): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
    return createViewCube({
      container,
      getCamera: () => this.viewport.camera as THREE.PerspectiveCamera | THREE.OrthographicCamera,
      getTarget: () => this.viewport.target,
      onFaceSnap: (mode) => {
        if (mode === 'top') {
          // Top-face click from 3D → handled externally via ViewMode3DStore if needed.
          // For now: switch to ortho top view.
        }
        this.viewport.setProjection(mode);
      },
      onDirSnap: (dir) => this.viewport.snapToViewDirection(dir),
      onHome: () => this.viewport.goHome(),
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
        this.pathTracerRenderer.renderSample();
      } else {
        this.ssaoModulator.render();
      }
    };
    this.rafHandle = requestAnimationFrame(animate);
  }

  syncBimEntities(entities: Bim3DEntities, floorElevationMm = 0, activeLevelId?: string): void {
    if (this.disposed) return;
    // Clear highlight before rebuild — old mesh refs die in BimSceneLayer.clearGroup().
    const selectedId = useSelection3DStore.getState().selectedBimId;
    this.selectionHighlighter.onClear();
    this.bimLayer.sync(entities, floorElevationMm, activeLevelId);
    if (selectedId) this.selectionHighlighter.onSelect(selectedId);
    this.pathTracerRenderer.invalidateScene();
  }

  applyFloorVisibility(modes: ReadonlyMap<string, FloorVisMode>): void {
    if (!this.disposed) applyFloorVisibility(this.bimLayer.group, modes);
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

  resize(width: number, height: number): void {
    if (this.disposed || width === 0 || height === 0) return;
    this.viewport.updateAspect(width, height);
    this.renderer.setSize(width, height);
    this.ssaoModulator.resize(width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
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
    const domElement = this.renderer.domElement;
    if (domElement.parentNode) domElement.parentNode.removeChild(domElement);
  }
}
