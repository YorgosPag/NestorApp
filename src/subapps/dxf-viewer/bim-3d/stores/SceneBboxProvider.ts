/**
 * ADR-366 §C.1.b — Scene bbox bridge for animation actions.
 *
 * Module-level register/getter bridging `ThreeJsSceneManager` (lives σε
 * `bim-3d/`) με consumers σε `app/` (e.g. `useDxfViewerCallbacks` που
 * triggers turntable animation). `BimViewport3D` registers the getter at
 * mount; consumers query at action-time. Returns null όταν 3D δεν έχει
 * mounted ή scene είναι άδειο — caller falls back as needed.
 *
 * Non-reactive (no Zustand) — used only μέσα σε imperative event handlers,
 * όχι render-time subscriptions. Mirror του pattern register/unregister
 * functions για lightweight cross-subsystem bridges.
 */

import type { SceneBbox } from '../animation/core/TurntablePathBuilder';

/** Minimal duck-typed shape για THREE.Box3 (decoupled από three types για pnpm resolution). */
interface Box3Like {
  readonly min: { readonly x: number; readonly y: number; readonly z: number };
  readonly max: { readonly x: number; readonly y: number; readonly z: number };
  isEmpty(): boolean;
}

type SceneBboxGetter = () => Box3Like | null;

let registeredGetter: SceneBboxGetter | null = null;

export function setSceneBboxGetter(getter: SceneBboxGetter): void {
  registeredGetter = getter;
}

export function clearSceneBboxGetter(): void {
  registeredGetter = null;
}

/**
 * Returns the current BIM scene bounding box, converted to plain Vec3 SceneBbox
 * shape. Returns null όταν δεν υπάρχει registered getter ή το bbox είναι empty
 * (no BIM/DXF data loaded).
 */
export function getSceneBbox(): SceneBbox | null {
  if (!registeredGetter) return null;
  const box = registeredGetter();
  if (!box || box.isEmpty()) return null;
  return {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
  };
}
