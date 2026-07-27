/**
 * round-dot-texture — an antialiased WHITE DISC on transparent, for `THREE.Points` sprites.
 *
 * A `THREE.Points` vertex is rasterised as a **square** by WebGL; `PointsMaterial` does nothing
 * about it. Every square dot in a CAD viewport reads as «pixel artefact», never as «vertex marker»,
 * and a row of them reads as a dashed band rather than a set of points. The fix is a per-fragment
 * mask, and there are two ways to get one:
 *
 *   - `onBeforeCompile` + `discard` on `gl_PointCoord` — cheaper on paper, but ADR-689 records the
 *     two traps it carries (it must NOT be used on a `ShaderMaterial`, and it REQUIRES a
 *     `customProgramCacheKey`, or every material sharing the program silently gets the injection).
 *     It also gives a HARD edge — a discard has no partial coverage, so the rim aliases and crawls
 *     while the camera orbits, which is exactly the artefact a marker must not have.
 *   - a tiny generated texture — one 64×64 canvas for the whole app, mip-mapped, and the disc's rim
 *     is antialiased by the 2D canvas rasteriser *before* it ever reaches the GPU.
 *
 * The texture wins on quality and carries no shader-injection risk, and at one 16 KB texture for
 * the app the «cheaper» argument is noise. RGB is pure white so `PointsMaterial.color` tints it —
 * the dot's colour still comes from the `UI_COLORS` SSoT, never from this file.
 *
 * N.18 audit — the two existing canvas-texture generators in `bim-3d/` are NOT this:
 * `comments/comment-marker-textures` bakes a type/status colour + a letter glyph, and
 * `animation/WaypointDragHandle.buildHandleTexture` draws a filled SQUARE with a grip outline.
 * This one is content-free on purpose, so any future round marker can reuse it as-is.
 *
 * @module bim-3d/materials/round-dot-texture
 * @enterprise ADR-650 — Topography · ADR-689 — shader-injection constraints
 */

import * as THREE from 'three';

/**
 * Source resolution of the disc. 64 px keeps the mip chain long enough that an 8 px on-screen dot
 * samples a well-filtered level instead of a hand-aliased one; the whole app shares one instance.
 */
const DOT_TEXTURE_PX = 64;

/** Leave a 1 px transparent margin so the antialiased rim is never clipped by the texture edge. */
const DOT_TEXTURE_MARGIN_PX = 1;

let cached: THREE.CanvasTexture | null | undefined;

/** Paint the disc, or return null when there is no 2D rasteriser (jsdom without `canvas`). */
function buildRoundDotTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = DOT_TEXTURE_PX;
  canvas.height = DOT_TEXTURE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const centre = DOT_TEXTURE_PX / 2;
  ctx.beginPath();
  ctx.arc(centre, centre, centre - DOT_TEXTURE_MARGIN_PX, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff'; // pure white — the MATERIAL supplies the colour (UI_COLORS SSoT)
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The shared disc sprite, built on first use.
 *
 * Returns `null` when no canvas rasteriser exists. Callers must then leave `map` unset — which
 * degrades to the square dot, i.e. the OLD look. Fail-visible on purpose: a blank texture would
 * make the markers silently invisible, which is the worse of the two failures by far.
 */
export function getRoundDotTexture(): THREE.CanvasTexture | null {
  if (cached === undefined) cached = buildRoundDotTexture();
  return cached;
}

/** Free the shared texture. Called on full app teardown, with the material catalogs. */
export function disposeRoundDotTexture(): void {
  cached?.dispose();
  cached = undefined;
}
