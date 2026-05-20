/**
 * SSoT for camera position/target/fov.
 * Written every RAF frame by ThreeJsSceneManager — reads come from any subscriber.
 * Uses dirty-check to avoid Zustand notifications when camera is static.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import * as THREE from 'three';

const EPS = 1e-5;

interface Vec3Snapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CameraTargetState {
  readonly position: Vec3Snapshot;
  readonly target: Vec3Snapshot;
  /** Perspective FOV in degrees. 0 when orthographic camera is active. */
  readonly fov: number;
}

export interface CameraTargetActions {
  /**
   * Called once per RAF frame by ThreeJsSceneManager.
   * No-op when camera has not moved (epsilon dirty-check).
   */
  readonly syncFromCamera: (camera: THREE.Camera, target: THREE.Vector3) => void;
}

function vec3Eq(snap: Vec3Snapshot, v: THREE.Vector3): boolean {
  return (
    Math.abs(snap.x - v.x) <= EPS &&
    Math.abs(snap.y - v.y) <= EPS &&
    Math.abs(snap.z - v.z) <= EPS
  );
}

export const useCameraTargetStore = create<CameraTargetState & CameraTargetActions>()(
  subscribeWithSelector((set, get) => ({
    // Initial values match ThreeJsSceneManager.INITIAL_CAMERA_POSITION + DEFAULT_PERSPECTIVE_FOV
    position: { x: 15, y: 10, z: 15 },
    target: { x: 0, y: 0, z: 0 },
    fov: 50,

    syncFromCamera: (camera: THREE.Camera, target: THREE.Vector3): void => {
      const current = get();
      const newFov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 0;

      if (
        vec3Eq(current.position, camera.position) &&
        vec3Eq(current.target, target) &&
        Math.abs(current.fov - newFov) <= EPS
      ) return;

      const { x: px, y: py, z: pz } = camera.position;
      const { x: tx, y: ty, z: tz } = target;
      set({
        position: { x: px, y: py, z: pz },
        target: { x: tx, y: ty, z: tz },
        fov: newFov,
      });
    },
  }))
);
