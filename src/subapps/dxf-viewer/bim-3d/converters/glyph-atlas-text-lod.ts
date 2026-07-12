/**
 * glyph-atlas-text-lod.ts — screen-size text LOD (declutter) for the merged atlas text mesh
 * (ADR-645 Φάση C).
 *
 * PROBLEM (Revit / Navisworks / Forge): in «Όλοι οι όροφοι» thousands of labels project to a few
 * pixels when zoomed out — unreadable clutter that still costs fragments. The big players HIDE any
 * label whose on-screen height drops below a legibility floor (declutter), revealing it again as you
 * zoom in.
 *
 * WHY A SHADER (not a CPU rebuild): the whole floor's text is ONE merged `BufferGeometry` (Φάση B),
 * so per-glyph visibility can't change without rebuilding the buffer — unless it's decided in the
 * GPU. We inject a per-fragment `discard` into the stock `MeshBasicMaterial` via `onBeforeCompile`
 * (stock three, no new dependency): each glyph carries a baked `aEmVec` (its local vertical extent),
 * the vertex shader projects vertex vs. vertex+aEmVec to NDC, and the pixel delta IS the glyph's
 * on-screen height. Below `uMinLabelPx` the fragment is discarded. **Zero CPU per frame, zero
 * re-upload** — only the viewport uniform is refreshed (on resize) by the mesh's `onBeforeRender`.
 *
 * PROJECTION-AGNOSTIC: measuring the NDC delta of two world points through the SAME
 * `projectionMatrix * modelViewMatrix` is correct for BOTH perspective and orthographic cameras and
 * absorbs the per-floor non-uniform group scale — no camera-mode branch, no distance formula. This
 * mirrors the 2D WebGL line LOD idea (`computeInstanceCount`: drop sub-`cutoffPx` detail) at the GPU
 * granularity a merged buffer needs.
 */

import * as THREE from 'three';

/** Injected at global scope of the vertex shader (declarations + the em→pixel projection). */
export const TEXT_LOD_VERTEX_HEADER = /* glsl */ `
attribute vec3 aEmVec;
uniform vec2 uViewportPx;
varying float vGlyphPx;
`;

/**
 * Appended right after `#include <project_vertex>` (so `transformed` + `gl_Position` exist). Projects
 * the vertex and the vertex offset by its glyph em-vector to NDC; the pixel-space distance between
 * them is the glyph's on-screen height, passed to the fragment stage.
 */
export const TEXT_LOD_VERTEX_BODY = /* glsl */ `
  vec4 emClip = projectionMatrix * modelViewMatrix * vec4( transformed + aEmVec, 1.0 );
  vec2 ndcSelf = gl_Position.xy / gl_Position.w;
  vec2 ndcEm = emClip.xy / emClip.w;
  vGlyphPx = length( ( ndcEm - ndcSelf ) * 0.5 * uViewportPx );
`;

/** Prepended to the fragment shader's global scope. */
export const TEXT_LOD_FRAGMENT_HEADER = /* glsl */ `
uniform float uMinLabelPx;
varying float vGlyphPx;
`;

/** Discard sub-legible glyphs first thing in the fragment stage (before the atlas texture fetch). */
export const TEXT_LOD_FRAGMENT_DISCARD = /* glsl */ `
  if ( vGlyphPx < uMinLabelPx ) discard;
`;

/** Handle to refresh the per-material viewport uniform (the only thing that changes — on resize). */
export interface TextLodController {
  /** Set the current drawing viewport in CSS pixels (call from the mesh's `onBeforeRender`). */
  setViewport(widthPx: number, heightPx: number): void;
}

/**
 * Wire screen-size LOD into `material` (a stock `MeshBasicMaterial`). Adds the `aEmVec`-driven
 * per-fragment discard below `minLabelPx` on-screen glyph height. Returns a controller whose
 * `setViewport` feeds the live viewport size to the shader (no-op until the shader has compiled).
 */
export function applyTextLodMaterial(
  material: THREE.MeshBasicMaterial,
  minLabelPx: number,
): TextLodController {
  const viewport = new THREE.Vector2(1, 1);
  let compiledViewport: THREE.IUniform<THREE.Vector2> | null = null;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uViewportPx = { value: viewport };
    shader.uniforms.uMinLabelPx = { value: minLabelPx };
    compiledViewport = shader.uniforms.uViewportPx as THREE.IUniform<THREE.Vector2>;
    shader.vertexShader = TEXT_LOD_VERTEX_HEADER + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>\n${TEXT_LOD_VERTEX_BODY}`,
    );
    shader.fragmentShader = TEXT_LOD_FRAGMENT_HEADER + shader.fragmentShader.replace(
      'void main() {',
      `void main() {\n${TEXT_LOD_FRAGMENT_DISCARD}`,
    );
  };
  // Recompile once if the material was already used before LOD wiring (defensive; builder wires at
  // construction, so normally this is a no-op).
  material.needsUpdate = true;

  return {
    setViewport(widthPx, heightPx) {
      viewport.set(Math.max(widthPx, 1), Math.max(heightPx, 1));
      if (compiledViewport) compiledViewport.value = viewport;
    },
  };
}

/**
 * Pure JS reference for the on-screen glyph height the shader computes — the projection-math SSoT
 * mirrored by `TEXT_LOD_VERTEX_BODY` (kept in sync by the unit test). `base` and `base + emVec` are
 * WORLD-space points; returns their pixel-space separation for the given camera + viewport (CSS px).
 */
export function projectedEmPixelHeight(
  base: THREE.Vector3,
  emVec: THREE.Vector3,
  camera: THREE.Camera,
  viewportWidthPx: number,
  viewportHeightPx: number,
): number {
  const ndcSelf = base.clone().project(camera);
  const ndcEm = base.clone().add(emVec).project(camera);
  const dx = (ndcEm.x - ndcSelf.x) * 0.5 * viewportWidthPx;
  const dy = (ndcEm.y - ndcSelf.y) * 0.5 * viewportHeightPx;
  return Math.hypot(dx, dy);
}
