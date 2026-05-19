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
import { DxfFloorPlanOverlay } from './DxfFloorPlanOverlay';
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
  readonly overlay: DxfFloorPlanOverlay;
  private readonly viewCube: ViewCubeEngine;
  private readonly poi: ReturnType<typeof createPoi>;

  private rafHandle: number | null = null;
  private disposed = false;
  private lastFrameTime = performance.now();
  private isInteracting = false;
  private initialCameraFitDone = false;

  constructor(container: HTMLElement) {
    this.renderer = this.initRenderer(container);
    this.scene = this.initScene();
    this.bimLayer = new BimSceneLayer(this.scene);
    this.overlay = new DxfFloorPlanOverlay(this.scene);
    this.viewport = this.initViewportCamera(container);
    this.poi = createPoi();
    this.scene.add(this.poi.root);
    this.viewCube = this.initViewCube(container);
    this.startLoop();
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

  private initScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.add(new THREE.AxesHelper(2));

    // Sky ambient (ADR-366 §7.2)
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // Sun — Athens summer noon: azimuth ~180° (south), elevation ~65° (ADR-366 §7.2)
    const sun = new THREE.DirectionalLight(0xfffaf0, 3);
    sun.position.set(-5, 10, 5);
    sun.castShadow = true;
    sun.shadow.bias = -0.0005;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    scene.add(sun);

    // Ground bounce (HemisphereLight — sky blue / warm ground)
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.3));

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

      this.renderer.render(this.scene, this.viewport.camera);
    };
    this.rafHandle = requestAnimationFrame(animate);
  }

  syncBimEntities(entities: Bim3DEntities, floorElevationMm = 0): void {
    if (!this.disposed) this.bimLayer.sync(entities, floorElevationMm);
  }

  syncDxfOverlay(dxfScene: DxfScene | null): void {
    if (this.disposed) return;
    this.overlay.sync(dxfScene);
    if (!this.initialCameraFitDone) {
      const box = this.overlay.getBounds();
      if (box && !box.isEmpty()) {
        this.viewport.frameBounds(box.min, box.max);
        this.initialCameraFitDone = true;
      }
    }
  }

  resize(width: number, height: number): void {
    if (this.disposed || width === 0 || height === 0) return;
    this.viewport.updateAspect(width, height);
    this.renderer.setSize(width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.bimLayer.dispose();
    this.overlay.dispose();
    this.viewport.dispose();
    this.viewCube.dispose();
    this.poi.dispose();
    this.renderer.dispose();
    const domElement = this.renderer.domElement;
    if (domElement.parentNode) domElement.parentNode.removeChild(domElement);
  }
}
