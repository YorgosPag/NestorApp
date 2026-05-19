/**
 * Navigation POI (Point of Interest) cross indicator — orbit target marker.
 * PORT_AS_IS from GenArc viewportPoi.ts (ADR-366 §8.2 SPEC-3D-004A).
 */

import * as THREE from 'three';
import {
  POI_ARM_LENGTH, POI_COLOR,
  POI_FADE_DELAY_MS, POI_FADE_DURATION_MS,
} from './viewport-constants';

export interface Poi {
  readonly root: THREE.Object3D;
  readonly updateTarget: (target: THREE.Vector3) => void;
  readonly updateCamera: (camera: THREE.Camera) => void;
  readonly onNavigationActive: () => void;
  readonly updateFade: (deltaMs: number) => boolean;
  readonly dispose: () => void;
}

export function createPoi(): Poi {
  const root = new THREE.Group();
  root.renderOrder = 998;

  const a = POI_ARM_LENGTH;
  const positions = new Float32Array([
    -a, 0, 0,   a, 0, 0,
     0, -a, 0,  0, a, 0,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(POI_COLOR[0], POI_COLOR[1], POI_COLOR[2]),
    transparent: true, opacity: 0,
    depthTest: false, depthWrite: false,
  });
  root.add(new THREE.LineSegments(geometry, material));

  let opacity = 0;
  let idleTimer = 0;
  let fadingIn = false;
  let fadingOut = false;

  function updateTarget(target: THREE.Vector3): void { root.position.copy(target); }
  function updateCamera(camera: THREE.Camera): void { root.quaternion.copy(camera.quaternion); }

  function onNavigationActive(): void {
    idleTimer = 0;
    fadingOut = false;
    if (opacity < 1) fadingIn = true;
  }

  function updateFade(deltaMs: number): boolean {
    if (fadingIn) {
      opacity = Math.min(opacity + deltaMs / POI_FADE_DURATION_MS, 1);
      if (opacity >= 1) { opacity = 1; fadingIn = false; }
      material.opacity = opacity;
      return true;
    }
    if (!fadingIn && !fadingOut && opacity > 0) {
      idleTimer += deltaMs;
      if (idleTimer >= POI_FADE_DELAY_MS) fadingOut = true;
    }
    if (fadingOut) {
      opacity = Math.max(opacity - deltaMs / POI_FADE_DURATION_MS, 0);
      if (opacity <= 0) { opacity = 0; fadingOut = false; }
      material.opacity = opacity;
      return true;
    }
    return false;
  }

  function dispose(): void { geometry.dispose(); material.dispose(); }

  return { root, updateTarget, updateCamera, onNavigationActive, updateFade, dispose };
}
