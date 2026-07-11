/**
 * ADR-639 Στάδιο 5 — WebGL line-layer orthographic-camera math (pure, pixel-exact).
 *
 * The ENTIRE per-pan/zoom cost of the line layer is recomputing four ortho bounds
 * and one `updateProjectionMatrix()` — zero buffer touch. These bounds are derived
 * DIRECTLY from `CoordinateTransforms.worldToScreen` so the GPU lines land on the
 * exact same pixels as the Canvas2D layers (arcs / text / hatch / selection).
 *
 * worldToScreen (`CoordinateTransforms.ts:100-103`, MARGINS.left = MARGINS.top = 30):
 *   screenX = MARGINS.left + wx*scale + offsetX
 *   screenY = (H - MARGINS.top) - wy*scale - offsetY          (CSS px, y-down)
 *
 * An OrthographicCamera at the origin looking -Z (up +Y) with world vertices packed
 * at (wx, wy, 0) reproduces that EXACTLY with these bounds — no extra Y-flip. The CAD
 * Y-inversion (screenY subtracts) and the GL clip-space Y (NDC y-up → window y-up,
 * then CSS reads y-down) cancel out. Verified bit-parity in the sibling test.
 *
 * DPR note: W/H here are ALWAYS CSS px (the shared Viewport) — never canvas.width/
 * height. The device pixel ratio feeds ONLY renderer.setPixelRatio / setSize /
 * LineMaterial.resolution — putting it in the ortho matrix is the classic HiDPI
 * shrink bug and is explicitly avoided.
 *
 * @see rendering/core/CoordinateTransforms.ts:100-103 — the mirrored affine
 * @see canvas-v2/webgl-lines/__tests__/webgl-line-ortho-camera.test.ts — parity proof
 */

import type * as THREE from 'three';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import { COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';

export interface OrthoBounds {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
  readonly near: number;
  readonly far: number;
}

/**
 * Compute the ortho bounds that make an origin/-Z camera reproduce worldToScreen.
 * Returns null when the viewport is not laid out yet (W or H is 0) or the transform
 * scale is degenerate — the caller skips the render tick (mirror of
 * `CoordinateTransforms.classifyViewport` 'transient' + `dxf-canvas-renderer.ts:145`).
 */
export function computeOrthoBounds(
  transform: ViewTransform,
  viewport: Viewport,
): OrthoBounds | null {
  const W = viewport.width;
  const H = viewport.height;
  const { scale, offsetX, offsetY } = transform;
  // Guard: unlaid-out viewport (0×0) or a degenerate scale (division denominator) →
  // no valid projection this frame. Never emit NaN bounds (Google-level N.7.2).
  if (W <= 0 || H <= 0 || !Number.isFinite(scale) || scale === 0) return null;

  // X uses MARGINS.left, Y uses MARGINS.top (both 30 today, referenced separately so
  // the parity holds even if the two ruler margins ever diverge).
  const marginX = COORDINATE_LAYOUT.MARGINS.left;
  const marginY = COORDINATE_LAYOUT.MARGINS.top;

  return {
    left: -(marginX + offsetX) / scale,
    right: (W - marginX - offsetX) / scale,
    bottom: -(marginY + offsetY) / scale,
    top: (H - marginY - offsetY) / scale,
    near: -1,
    far: 1,
  };
}

/**
 * Push computed bounds onto an OrthographicCamera and rebuild its projection.
 * This single call is the whole per-tick GPU-side pan/zoom update.
 */
export function applyToCamera(camera: THREE.OrthographicCamera, bounds: OrthoBounds): void {
  camera.left = bounds.left;
  camera.right = bounds.right;
  camera.bottom = bounds.bottom;
  camera.top = bounds.top;
  camera.near = bounds.near;
  camera.far = bounds.far;
  camera.updateProjectionMatrix();
}
