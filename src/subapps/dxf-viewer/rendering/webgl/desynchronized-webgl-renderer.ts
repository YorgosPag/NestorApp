/**
 * Shared low-latency WebGL2 renderer factory (SSoT).
 *
 * Extracted (ADR-639 Στάδιο 5, N.0.2/N.18) from `createBimRenderer`
 * (`bim-3d/scene/scene-setup.ts`) so the BIM 3D viewport and the 2D DXF WebGL line
 * layer build their `THREE.WebGLRenderer` through the SAME belt-and-suspenders
 * `desynchronized` webgl2 context path — the low-latency flags can never drift
 * between the two.
 *
 * Why we build the context by hand instead of letting three do it: three r0.170
 * forwards only alpha/depth/stencil/antialias/premultipliedAlpha/preserveDrawingBuffer/
 * powerPreference/failIfMajorPerformanceCaveat to `getContext` — it does NOT forward
 * `desynchronized`. That flag decouples the canvas present from the vsync-locked
 * compositor (low-latency mode: the web equivalent of the DXGI flip-model waitable
 * swap-chain used by Revit / Cinema 4D, and the `desynchronized` canvas Figma uses
 * for cursor/stylus latency). `powerPreference:'high-performance'` forces the
 * discrete-GPU path (Autodesk Forge/APS & Onshape practice). So we create the webgl2
 * context ourselves WITH the flag and hand it to the renderer via the `context` param.
 *
 * Belt-and-suspenders: if the manual webgl2 context fails (unlikely on a modern
 * browser) we fall back to letting three create its own context with the same
 * options (minus `desynchronized`) — no throw, no gap.
 *
 * @see bim-3d/scene/scene-setup.ts — createBimRenderer (consumer)
 * @see canvas-v2/webgl-lines/webgl-line-renderer-setup.ts — createWebglLineRenderer (consumer)
 */

import * as THREE from 'three';

export interface DesynchronizedWebglRendererOptions {
  /** MSAA. BIM viewport: true (crisp edges on a tiny scene). Line layer: true (fat-line AA). */
  readonly antialias: boolean;
  /** Transparent framebuffer so lower canvas layers show through. Both consumers: true. */
  readonly alpha: boolean;
  /** Stencil buffer. BIM needs it (stencil-cap pipeline). Line layer: false. */
  readonly stencil: boolean;
}

/**
 * Create a `THREE.WebGLRenderer` backed by a low-latency `desynchronized` webgl2
 * context (with a plain-three fallback). The caller owns the canvas lifecycle
 * (append `renderer.domElement`, set pixel ratio / size / clear colour).
 */
export function createDesynchronizedWebglRenderer(
  opts: DesynchronizedWebglRendererOptions,
): THREE.WebGLRenderer {
  const canvas = document.createElement('canvas');
  const glAttributes: WebGLContextAttributes = {
    antialias: opts.antialias,
    alpha: opts.alpha,
    stencil: opts.stencil,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
    desynchronized: true,
    failIfMajorPerformanceCaveat: false,
  };
  const context = canvas.getContext('webgl2', glAttributes);
  const rendererOptions: THREE.WebGLRendererParameters = {
    antialias: opts.antialias,
    alpha: opts.alpha,
    stencil: opts.stencil,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  };
  return context
    ? new THREE.WebGLRenderer({ canvas, context, ...rendererOptions })
    : new THREE.WebGLRenderer(rendererOptions);
}
