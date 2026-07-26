/**
 * scene-manager-camera — camera framing + orbit-pivot façade extracted from
 * `ThreeJsSceneManager` (N.7.1 SRP file-size split, keeps the manager under the 500-line cap).
 *
 * Every function here is a pure delegation over a structural {@link SceneCameraHost} view of the
 * manager: it reads ONLY public members (`bimLayer`, `viewport`, `dxfConverter`, `renderer`), so
 * the manager can pass `this` directly — no deps-object literal to keep in sync, and no second
 * copy of the framing/pivot rules. Behaviour is byte-for-byte identical to the inline versions
 * these replace; the disposed/latch gates stay in the class where the state lives.
 */

import type * as THREE from 'three';
import { computeFrameSelectionBounds } from './dxf-selection-framing-bounds';
import { ensureInitialCameraFit as runEnsureInitialCameraFit, computeDxfGroundY } from './scene-manager-framing';
import { setBimOrbitPivot } from './scene-manager-actions';
import { useSelection3DStore } from '../stores/Selection3DStore';
import type { ViewportCamera } from '../viewport/viewport-types';

/**
 * The slice of `ThreeJsSceneManager` these helpers touch — public members only, so the class is
 * structurally assignable without exposing anything new (private fields do not break assignability).
 */
export interface SceneCameraHost {
  readonly bimLayer: { readonly group: THREE.Group };
  readonly viewport: ViewportCamera;
  readonly dxfConverter: { getBounds(): THREE.Box3 | null };
  readonly renderer: { readonly domElement: HTMLCanvasElement };
  markSceneDirty(): void;
  getSceneFramingBounds(): THREE.Box3 | null;
}

/**
 * ADR-366 A.6.Q4 selection-aware F / Z — frame the selection keeping the camera angle, else fit
 * extents. BIM ∪ raw-DXF union in `computeFrameSelectionBounds` (dxf-selection-framing-bounds.ts).
 */
export function frameSelectionOrFitExtents(host: SceneCameraHost): void {
  const bounds = computeFrameSelectionBounds(
    host.bimLayer.group,
    useSelection3DStore.getState().selectedBimIds,
    host.dxfConverter.getBounds(),
  );
  if (bounds && !bounds.isEmpty()) host.viewport.frameBounds(bounds.min, bounds.max);
}

/** DXF overlay floor-elevation SSoT for wheel-zoom + Alt-drag orbit pivot (see `computeDxfGroundY`). */
export function sceneDxfGroundY(host: SceneCameraHost): number | null {
  return computeDxfGroundY(host.dxfConverter.getBounds());
}

/**
 * ADR-537 — one-shot initial camera-fit FALLBACK. Returns `true` when a fit was applied, so the
 * caller latches its own `initialCameraFitDone` (the latch stays owned by the manager).
 */
export function ensureInitialCameraFit(host: SceneCameraHost, alreadyFitted: boolean): boolean {
  return runEnsureInitialCameraFit({
    disposed: false, // the caller gates on `disposed` before delegating
    initialCameraFitDone: alreadyFitted,
    getDxfBounds: () => host.dxfConverter.getBounds(),
    getSceneBounds: () => host.getSceneFramingBounds(),
    frameBounds: (min, max) => host.viewport.frameBounds(min, max),
  });
}

/** ADR-366 §A.6.Q5 — Alt+click orbit-pivot picking (delegates to `setBimOrbitPivot`). */
export function setSceneOrbitPivotAt(
  host: SceneCameraHost,
  onNavigationActive: () => void,
  clientX: number,
  clientY: number,
): boolean {
  return setBimOrbitPivot(
    {
      bimGroup: host.bimLayer.group,
      camera: host.viewport.camera,
      canvas: host.renderer.domElement,
      currentTarget: host.viewport.target,
      groundY: sceneDxfGroundY(host),
      setOrbitPivot: (p) => host.viewport.setOrbitPivot(p),
      onNavigationActive,
      markDirty: () => host.markSceneDirty(),
    },
    clientX,
    clientY,
  );
}
