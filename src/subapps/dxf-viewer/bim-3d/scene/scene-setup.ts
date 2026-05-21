/**
 * scene-setup — Three.js bootstrap factories extracted from `ThreeJsSceneManager`
 * (ADR-366 Phase 4.4) to keep the manager under the 500-line cap. Pure functions,
 * no class state — call once during manager construction.
 */

import * as THREE from 'three';

export interface SceneLights {
  readonly sun: THREE.DirectionalLight;
  readonly ambient: THREE.AmbientLight;
  readonly hemi: THREE.HemisphereLight;
}

/**
 * stencil:true required for ADR-366 §A.3 Phase 7.0a stencil cap pipeline.
 * (Three.js default is already true, set explicit για future-proofing.)
 */
export function createBimRenderer(container: HTMLElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
  renderer.setClearColor(0x1a1a1a, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  return renderer;
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

/** Initialize scene with axes helper + lights. Sets noon default sun position (ADR-366 §7.2). */
export function createBimScene(lights: SceneLights): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(new THREE.AxesHelper(2));
  scene.add(lights.ambient);
  scene.add(lights.sun);
  scene.add(lights.hemi);
  lights.sun.position.set(-5, 10, 5);
  return scene;
}
