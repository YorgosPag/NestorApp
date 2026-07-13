/**
 * coordinate-transforms.ts — 3D viewport coordinate math
 *
 * PORT_AS_IS from GenArc SPEC-3D-004C (ADR-366 §4).
 * Pure functions — no React, no Three.js scene graph mutations.
 *
 * Two coordinate systems:
 *   DXF plan  — XY plane, millimetres, Z = elevation
 *   3D world  — Y-up, metres (Three.js convention, ADR-009)
 */

import * as THREE from 'three';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

// ── NDC / Screen ↔ World ──────────────────────────────────────────────────────

/**
 * Convert screen pixel position + depth to world space.
 * @param x  — pixel X (left = 0)
 * @param y  — pixel Y (top = 0)
 * @param z  — normalized depth [0..1], 0 = near plane, 1 = far plane
 */
export function screenToWorld(
  x: number,
  y: number,
  z: number,
  camera: THREE.Camera,
  canvas: HTMLElement,
): THREE.Vector3 {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector3(
    ((x - rect.left) / rect.width) * 2 - 1,
    -((y - rect.top) / rect.height) * 2 + 1,
    z * 2 - 1,
  );
  return ndc.unproject(camera);
}

/**
 * Convert world position to screen pixel coordinates.
 * Returns null if the point is behind the camera.
 */
export function worldToScreen(
  pos: THREE.Vector3,
  camera: THREE.Camera,
  canvas: HTMLElement,
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  const ndc = pos.clone().project(camera);
  if (ndc.z > 1) return null; // behind camera
  return {
    x: ((ndc.x + 1) / 2) * rect.width + rect.left,
    y: ((-ndc.y + 1) / 2) * rect.height + rect.top,
  };
}

/**
 * Convert NDC position + depth to world space.
 * @param ndc — THREE.Vector2, each component in [-1..1]
 * @param z   — NDC depth in [-1..1] (−1 = near, +1 = far)
 */
export function ndcToWorld(
  ndc: THREE.Vector2,
  z: number,
  camera: THREE.Camera,
): THREE.Vector3 {
  return new THREE.Vector3(ndc.x, ndc.y, z).unproject(camera);
}

/**
 * Convert world position to NDC.
 * Z component is NDC depth in [-1..1].
 */
export function worldToNdc(
  pos: THREE.Vector3,
  camera: THREE.Camera,
): THREE.Vector3 {
  return pos.clone().project(camera);
}

/**
 * Compute world-space size (metres) of one screen pixel — the inverse of the on-screen
 * scale. Drives constant-px annotation sizing (`Temp*Overlay` labels), wall-HUD scaling and
 * snap/hit-test tolerances in world units.
 *
 * Mode-aware:
 *  - **Perspective**: visible height grows with `distance` → `2·tan(fov/2)·distance / heightPx`.
 *  - **Orthographic** (Top/Front/Side & canonical views): `distance` is irrelevant; the visible
 *    height is the zoomed frustum `(top − bottom) / zoom`. Previously this returned a placeholder
 *    `1` (≈ 1 m/px) → in ortho the constant-px label sprites blew up to dozens of metres and
 *    covered the whole viewport (ADR-363 §empty-dxf follow-up — «τεράστια νούμερα μετακίνησης»),
 *    and snap tolerances read ~1000 mm/px. Same formula the ortho branch of `pan()` uses.
 *
 * `clientHeight` is floored at 1 so a not-yet-laid-out canvas can't divide by zero → Infinity.
 */
export function getPixelWorldSize(
  distance: number,
  camera: THREE.Camera,
  canvas: HTMLElement,
): number {
  const heightPx = Math.max(canvas.clientHeight, 1);
  if (camera instanceof THREE.PerspectiveCamera) {
    const vFovRad = (camera.fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(vFovRad / 2) * distance;
    return visibleHeight / heightPx;
  }
  if (camera instanceof THREE.OrthographicCamera) {
    const visibleHeight = (camera.top - camera.bottom) / camera.zoom;
    return visibleHeight / heightPx;
  }
  return 1;
}

/**
 * ADR-543/537 — SCENE units per screen pixel at a given world point, the screen-constant scale every 3D
 * overlay derives from the live camera (ambient tracking tolerance/radius/adaptive-step, wall/grip HUD
 * clearances). The ONE home for the `getPixelWorldSize(dist)·1000·mmToSceneUnits(units)` chain
 * (`worldPerPixel(dist mm)` → scene units) that was inlined across the wall placement, wall-HUD, grip-HUD
 * and grip-tracking overlays — so «scene units per px» lives once, not four times. `units='mm'` yields
 * plan-mm per px (the plan-mm HUD path); any scene unit yields that unit per px (the scene-unit tracking path).
 */
export function cameraSceneUnitsPerPixel(
  camera: THREE.Camera,
  canvas: HTMLElement,
  worldPoint: THREE.Vector3,
  units: SceneUnits,
): number {
  const dist = camera.position.distanceTo(worldPoint);
  return getPixelWorldSize(dist, camera, canvas) * 1000 * mmToSceneUnits(units);
}

/**
 * Compute visible world dimensions at the camera's focus distance.
 * For PerspectiveCamera: uses target distance (fallback: 10m).
 */
export function getVisibleWorldSize(
  camera: THREE.Camera,
  canvas: HTMLElement,
): { w: number; h: number } {
  if (!(camera instanceof THREE.PerspectiveCamera)) {
    return { w: 100, h: 100 };
  }
  const distance = 10; // default focus distance in metres
  const vFovRad = (camera.fov * Math.PI) / 180;
  const h = 2 * Math.tan(vFovRad / 2) * distance;
  const w = h * camera.aspect;
  return { w, h };
}

// ── DXF Plan ↔ 3D World ───────────────────────────────────────────────────────

const MM_TO_M = 0.001;
const M_TO_MM = 1000;

/**
 * Convert DXF plan coordinates (mm, XY plan) to 3D world (m, Y-up).
 * DXF: x_mm = east, y_mm = north, z_mm = elevation
 * Three.js: x = east, y = elevation, z = -north (right-hand Y-up)
 */
export function dxfPlanToWorld(
  x_mm: number,
  y_mm: number,
  elev_mm = 0,
): THREE.Vector3 {
  return new THREE.Vector3(
    x_mm * MM_TO_M,
    elev_mm * MM_TO_M,
    -y_mm * MM_TO_M,
  );
}

/**
 * Zero-allocation bulk variant of {@link dxfPlanToWorld}: write ONE plan-mm vertex straight
 * into an interleaved XYZ buffer at float offset `i` (i.e. vertex `i / 3`).
 *
 * Same axis convention, same constants, same file — so a BufferGeometry built vertex-by-vertex
 * (ADR-650 M4 terrain TIN: thousands of survey points, rebuilt on every edit) can never drift
 * from the Vector3 path the grips / ghosts / snap markers use. Without this, a bulk builder
 * either allocates one Vector3 per vertex or re-inlines `(x, elev, -y) × 0.001` — a second
 * copy of the convention, which is exactly how 3D silently mirrors itself against 2D.
 */
export function writeDxfPlanToWorld(
  out: Float32Array,
  i: number,
  x_mm: number,
  y_mm: number,
  elev_mm: number,
): void {
  out[i] = x_mm * MM_TO_M;
  out[i + 1] = elev_mm * MM_TO_M;
  out[i + 2] = -y_mm * MM_TO_M;
}

/**
 * Convert 3D world position (m, Y-up) back to DXF plan coordinates (mm).
 */
export function worldToDxfPlan(pos: THREE.Vector3): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: pos.x * M_TO_MM,
    y: -pos.z * M_TO_MM,
    z: pos.y * M_TO_MM,
  };
}
