/**
 * ADR-639 Στάδιο 5 — WebGL line-layer renderer factory.
 *
 * Builds the `THREE.WebGLRenderer` for the 2D DXF line layer via the shared
 * low-latency SSoT (`createDesynchronizedWebglRenderer`) — same desynchronized
 * webgl2 context + belt-and-suspenders fallback as the BIM 3D viewport. Adds the
 * line-layer specifics: transparent clear (the layer sits BELOW the Canvas2D
 * detail/overlay canvas and above the grid/floorplan, so everything must show
 * through), MSAA for fat-line edge smoothing, and the shared DPR clamp.
 *
 * COLOUR — deliberate deviation from the blueprint (documented, ADR-639):
 * the blueprint proposed `THREE.ColorManagement.enabled = false` + raw sRGB vertex
 * colours. But `ColorManagement.enabled` is a THREE-GLOBAL singleton, shared with
 * the BIM 3D viewport's renderer — flipping it false would corrupt every 3D PBR
 * colour (input hex would stop being linearised). We achieve the SAME goal
 * (per-vertex colour 1:1 with Canvas2D hex) WITHOUT the global side-effect by
 * keeping ColorManagement ON and uploading LINEAR-converted vertex colours in the
 * buffer builder (STEP 5): the output sRGB OETF then reproduces the exact Canvas2D
 * hex. So this factory does NOT mutate any three global and leaves
 * `outputColorSpace` at three's default (SRGBColorSpace) — identical to the BIM
 * renderer. See `webgl-line-buffer-builder.ts` for the sRGB→linear upload.
 *
 * The caller (WebglLineLayerManager) owns the canvas: append `renderer.domElement`
 * to the layer div, then drive `setSize` / `syncDevicePixelRatio`.
 *
 * @see rendering/webgl/desynchronized-webgl-renderer.ts — shared context SSoT
 * @see bim-3d/scene/scene-setup.ts:91 — bimPixelRatio (the mirrored DPR clamp)
 */

import * as THREE from 'three';
import { getDevicePixelRatio } from '../../systems/cursor/utils';
import { createDesynchronizedWebglRenderer } from '../../rendering/webgl/desynchronized-webgl-renderer';

/**
 * Live WebGL pixel ratio for the line layer — the shared `min(devicePixelRatio, 2)`
 * clamp (ADR-549). Above 2× a flat CAD line layer gains nothing visible but pays
 * quadratic fill-rate on HiDPI. Reads the DPR through the cursor-utils SSoT so it
 * tracks the same value the rest of the viewport uses.
 */
export function webglLinePixelRatio(): number {
  return Math.min(getDevicePixelRatio(), 2);
}

/**
 * Create the transparent, low-latency WebGL renderer for the DXF line layer.
 * Pixel ratio + size are applied here; the manager re-applies them on resize/DPR
 * change. Clear colour is fully transparent (alpha 0) so the layer composites over
 * the grid/floorplan below and under the Canvas2D detail canvas above.
 */
export function createWebglLineRenderer(): THREE.WebGLRenderer {
  const renderer = createDesynchronizedWebglRenderer({
    antialias: true,
    alpha: true,
    stencil: false,
  });
  renderer.setPixelRatio(webglLinePixelRatio());
  // Transparent framebuffer — the layer is one slice of the canvas stack, not opaque.
  renderer.setClearColor(0x000000, 0);
  return renderer;
}
