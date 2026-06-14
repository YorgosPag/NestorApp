/**
 * ADR-453 — Active 3D scene-manager registry (SSoT handle).
 *
 * Zero-React module singleton holding a reference to the currently-mounted
 * `ThreeJsSceneManager`. BimViewport3D registers/clears it on mount/unmount;
 * the print engine (capture-3d) reads it to snapshot the live 3D view without
 * threading the manager through React props.
 *
 * Mirrors the existing imperative-handle registration pattern used by
 * `setSceneBboxGetter` in the 3D viewport.
 *
 * @module subapps/dxf-viewer/bim-3d/scene/active-scene-manager-registry
 */

import type { ThreeJsSceneManager } from './ThreeJsSceneManager';

let activeSceneManager: ThreeJsSceneManager | null = null;

/** Register (or clear with `null`) the active 3D scene manager. */
export function setActiveSceneManager(manager: ThreeJsSceneManager | null): void {
  activeSceneManager = manager;
}

/** Read the active 3D scene manager, or `null` when 3D is not mounted. */
export function getActiveSceneManager(): ThreeJsSceneManager | null {
  return activeSceneManager;
}
