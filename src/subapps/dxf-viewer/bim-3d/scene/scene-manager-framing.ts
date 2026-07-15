/**
 * scene-manager-framing — initial-camera-fit fallback + DXF ground-plane helpers extracted
 * from ThreeJsSceneManager (N.7.1 SRP file-size split, keeps the manager < 500 lines). Pure
 * free functions so the manager keeps thin delegating wrappers; behavior is byte-for-byte
 * identical to the inline versions they replace.
 */

import type * as THREE from 'three';

export interface EnsureInitialCameraFitDeps {
  disposed: boolean;
  initialCameraFitDone: boolean;
  /** Lazy — only called when disposed/initialCameraFitDone gates have already passed. */
  getDxfBounds: () => THREE.Box3 | null;
  /** Lazy — only called when there is no DXF overlay bounds (BIM-only fallback path). */
  getSceneBounds: () => THREE.Box3 | null;
  frameBounds: (min: THREE.Vector3, max: THREE.Vector3) => void;
}

/**
 * ADR-537 — one-shot initial camera-fit FALLBACK. The primary initial fit rides on the DXF
 * overlay bounds (`applyDxfOverlayFraming`); a BIM-only scene, or one whose DXF overlay yields
 * null bounds (degenerate NaN entity / not yet loaded), would otherwise never auto-frame → the
 * user had to press F. When (and only when) there are NO DXF bounds, this frames the combined
 * BIM∪DXF scene bounds instead, sharing the SAME `initialCameraFitDone` latch so it fires at
 * most once and never fights the DXF path or a restored camera pose (ADR-400). The
 * `getDxfBounds()` guard keeps the DXF path strictly primary — the normal DXF-present flow is
 * byte-for-byte unchanged. Reuses the blessed `viewport.frameBounds` (keeps the ViewCube
 * synced — no repeat of the reverted 3D camera-fit regression, mem `camera_fit_3d_regression`).
 *
 * Returns `true` when a fit was actually applied — caller latches `initialCameraFitDone`.
 */
export function ensureInitialCameraFit(deps: EnsureInitialCameraFitDeps): boolean {
  if (deps.disposed || deps.initialCameraFitDone) return false;
  if (deps.getDxfBounds()) return false; // DXF present → let applyDxfOverlayFraming own the fit
  const bounds = deps.getSceneBounds(); // BIM (∪ DXF=null) — NaN-safe (finiteBox3FromObject)
  if (!bounds || bounds.isEmpty()) return false; // no framable geometry yet → retry on the next sync
  deps.frameBounds(bounds.min, bounds.max);
  return true;
}

/**
 * DXF overlay floor elevation (Y, metres) or null when no DXF is loaded — the horizontal
 * plane where the DXF wireframe lives. SSoT for both the wheel-zoom anchor (`resolveSurfacePoint`)
 * and the Alt+drag orbit pivot (`setOrbitPivotAt`), so a BIM-miss over the floor plan resolves the
 * real cursor point at floor depth (not a wrong-depth fallback). ADR-363 §empty-dxf / ADR-366 §A.6.Q5.
 */
export function computeDxfGroundY(dxfBounds: THREE.Box3 | null): number | null {
  return dxfBounds ? dxfBounds.min.y : null;
}
