/**
 * ADR-639 Στάδιο 5 — WebGL line-layer teardown.
 *
 * Mirrors `disposeSceneManagerResources` (`bim-3d/scene/scene-dispose.ts:54-80`):
 * a pure function that receives every GPU resource and tears it down in a fixed,
 * leak-free order — per-bucket geometry then material, then the renderer, then the
 * canvas is detached from the DOM. Called by the manager's `dispose()` AFTER the leaf
 * has UNREGISTERED its scheduler callback (mirror `BimViewport3D.tsx:207-213`), so no
 * tick can fire mid-teardown.
 *
 * Disposing geometry + material + renderer releases the GPU buffers and the WebGL
 * context; without this, a DXF reload / level switch would leak ~10 MB of line
 * buffers per load (Risk #7 / dispose-leak verification in the ADR).
 *
 * @see bim-3d/scene/scene-dispose.ts:54-80 — the mirrored teardown order
 */

import type * as THREE from 'three';
import type { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

export interface WebglLineDisposeDeps {
  readonly renderer: THREE.WebGLRenderer;
  /** One LineSegments2 per (width,alpha) bucket — each owns a geometry + a LineMaterial. */
  readonly meshes: readonly LineSegments2[];
  /** The layer's own canvas (appended by the manager to the layer div). */
  readonly canvas: HTMLCanvasElement;
}

/**
 * Release all line-layer GPU resources and detach the canvas. Idempotent-safe to call
 * once; the caller nulls its references afterwards.
 */
export function disposeWebglLineResources(deps: WebglLineDisposeDeps): void {
  for (const mesh of deps.meshes) {
    mesh.geometry.dispose();
    (mesh.material as LineMaterial).dispose();
  }
  deps.renderer.dispose();
  const dom = deps.canvas;
  if (dom.parentNode) dom.parentNode.removeChild(dom);
}
