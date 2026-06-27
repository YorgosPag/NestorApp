/**
 * scene-setup — Three.js bootstrap factories extracted from `ThreeJsSceneManager`
 * (ADR-366 Phase 4.4) to keep the manager under the 500-line cap. Pure functions,
 * no class state — call once during manager construction.
 */

import * as THREE from 'three';
import { createViewportCamera } from '../viewport/viewport-camera';
import { createViewCube } from '../viewport/view-cube/view-cube';
import type { ViewportCamera, CanonicalViewId } from '../viewport/viewport-types';
import type { ViewCubeEngine } from '../viewport/view-cube/view-cube';
import type { CanonicalViewService } from '../viewport/CanonicalViewService';
import { checkReducedMotion, type ReducedMotionOverride } from '../accessibility/use-reduced-motion';

export interface SceneLights {
  readonly sun: THREE.DirectionalLight;
  readonly ambient: THREE.AmbientLight;
  readonly hemi: THREE.HemisphereLight;
}

export interface InitViewportCameraDeps {
  readonly rendererDomElement: HTMLCanvasElement;
  readonly initialPosition: THREE.Vector3;
  readonly initialTarget: THREE.Vector3;
  readonly onInteractionStart: () => void;
  readonly onInteractionEnd: () => void;
  /** ADR-040 Phase XXIII — fired by OrbitControls 'change' (covers damping inertia). */
  readonly onRenderNeeded: () => void;
  readonly getReducedMotionOverride: () => ReducedMotionOverride;
  /** ADR-366 §A.6.Q5 — static Alt+left-click → orbit-pivot pick (clientX, clientY). */
  readonly onAltClick: (clientX: number, clientY: number) => void;
  /** Alt+left pointer-down → orbit-pivot pick so the drag orbits around the cursor point. */
  readonly onAltPress: (clientX: number, clientY: number) => void;
  /** ADR-363 Φ1G.5 — geometry point under the cursor for the Revit surface-anchored wheel zoom. */
  readonly resolveSurfacePoint: (clientX: number, clientY: number) => THREE.Vector3 | null;
}

export function initViewportCamera(deps: InitViewportCameraDeps): ViewportCamera {
  return createViewportCamera(deps.rendererDomElement, {
    initialPosition: deps.initialPosition.clone(),
    initialTarget: deps.initialTarget.clone(),
    onRenderNeeded: deps.onRenderNeeded,
    onInteractionStart: deps.onInteractionStart,
    onInteractionEnd: deps.onInteractionEnd,
    getReducedMotion: () => checkReducedMotion(deps.getReducedMotionOverride()),
    onAltClick: deps.onAltClick,
    onAltPress: deps.onAltPress,
    resolveSurfacePoint: deps.resolveSurfacePoint,
  });
}

export interface InitViewCubeDeps {
  readonly container: HTMLElement;
  readonly viewport: ViewportCamera;
  readonly canonicalViewService: CanonicalViewService;
  readonly onContextMenuRequest: (x: number, y: number) => void;
}

export function initViewCube(deps: InitViewCubeDeps): ViewCubeEngine {
  const { viewport, canonicalViewService } = deps;
  return createViewCube({
    container: deps.container,
    getCamera: () => viewport.camera as THREE.PerspectiveCamera | THREE.OrthographicCamera,
    getTarget: () => viewport.target,
    onFaceSnap: (mode) => viewport.setProjection(mode),
    onDirSnap: (dir) => viewport.snapToViewDirection(dir),
    onRoll: (dirSign) => viewport.rollView(dirSign),
    onSnapToView: (id: CanonicalViewId) => canonicalViewService.snapTo(id),
    onHome: () => canonicalViewService.snapHome(),
    onDragRotate: (dx, dy) => viewport.applyTumble(dx, dy),
    onContextMenuRequest: deps.onContextMenuRequest,
  });
}

/**
 * stencil:true required for ADR-366 §A.3 Phase 7.0a stencil cap pipeline.
 * (Three.js default is already true, set explicit για future-proofing.)
 */
export function createBimRenderer(container: HTMLElement): THREE.WebGLRenderer {
  // preserveDrawingBuffer:true so canvas.toBlob()/toDataURL() captures the rendered
  // frame for the Performance HUD screenshot + diagnostics (ADR-366 §B.5). Without it
  // WebGL clears the drawing buffer after compositing → screenshots come out blank.
  // Same choice as the MP4 exporter renderer.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
  renderer.setClearColor(0x1a1a1a, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  return renderer;
}

/** Live viewport pixel size from the renderer canvas, with safe non-zero fallbacks. */
export function getRendererViewportSize(domElement: HTMLElement): { width: number; height: number } {
  return {
    width: domElement.clientWidth || 800,
    height: domElement.clientHeight || 600,
  };
}

export function createBimLights(): SceneLights {
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

/** Initialize scene with lights. Sets noon default sun position (ADR-366 §7.2). */
export function createBimScene(lights: SceneLights): THREE.Scene {
  const scene = new THREE.Scene();
  // ADR-452 — removed the debug `AxesHelper` (R/G/B lines at world origin). It sat
  // at (0,0,0) — away from the building when the model is offset from origin — and
  // read as a stray, unselectable "flying" sliver (Giorgio: «σκουπίδι στην αρχή των
  // αξόνων»). It was a leftover dev helper with no production purpose.
  scene.add(lights.ambient);
  scene.add(lights.sun);
  scene.add(lights.hemi);
  lights.sun.position.set(-5, 10, 5);
  return scene;
}
