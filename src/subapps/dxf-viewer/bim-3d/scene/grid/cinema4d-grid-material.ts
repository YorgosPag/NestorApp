/**
 * cinema4d-grid-material.ts — anti-aliased world-locked perspective grid material (ADR-558, C4D model).
 *
 * C4D model (Giorgio "do it like C4D" 2026-06-30): one ground quad whose fragment shader draws a
 * WORLD-LOCKED grid (lines at fixed world coordinates) in true perspective, so all lines converge to
 * the horizon. The decade LOD is computed PER FRAGMENT from the screen-space derivative (uMinCellPx is
 * the spawn/merge threshold), so lines are born/killed continuously with BOTH zoom AND camera tilt
 * (far fragments coarsen toward the horizon) -- this is what makes it dynamic. The over-dense finest
 * minor fades out as a decade is about to merge (continuous, no pop); the major decade stays full.
 *
 * Two line classes: MINOR every cell + MAJOR every uMajorEvery-th; major vs minor by COLOUR + WIDTH
 * (major distinctly bolder so primary/secondary read apart). The grid does NOT stop at a hard edge --
 * it is MELTED into the grey background by a soft HORIZON FADE keyed to the fragment distance from the
 * camera (full strength up to uFadeNear, gone by uFadeFar), exactly how C4D dissolves it at the
 * horizon; the radii scale with zoom (capped at a hard reach).
 *
 * Rendered AO-immune via the post-FX `'underlay'` overlay pass (depth-tested -> occluded by the
 * building, never tinted by SSAO). `toneMapped:false` + THREE.Color uniforms + the
 * `<colorspace_fragment>` chunk keep the resolved token hexes byte-exact.
 *
 * @module bim-3d/scene/grid/cinema4d-grid-material
 */

import * as THREE from 'three';
import {
  GRID3D_MINOR_COLOR_FALLBACK,
  GRID3D_MAJOR_COLOR_FALLBACK,
  GRID3D_AXIS_X_COLOR,
  GRID3D_AXIS_Z_COLOR,
  GRID3D_BASE_CELL_M,
  GRID3D_MIN_CELL_PX,
  GRID3D_MAJOR_EVERY,
  GRID3D_MINOR_LINE_PX,
  GRID3D_MAJOR_LINE_PX,
  GRID3D_AXIS_LINE_PX,
  GRID3D_MAX_OPACITY,
} from './cinema4d-grid-config';

const VERTEX_SHADER = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorld = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec3 vWorld;

uniform vec3 uMinorColor;
uniform vec3 uMajorColor;
uniform vec3 uAxisXColor;
uniform vec3 uAxisZColor;
uniform float uBaseCell;       // decade anchor (m) -- LOD multiplies this by powers of ten
uniform float uMinCellPx;      // STEPPING knob: min on-screen px between the finest minor lines
uniform float uMajorEvery;     // major line every Nth minor (10 -> decade)
uniform float uMinorLinePx;
uniform float uMajorLinePx;
uniform float uAxisLinePx;
uniform float uMaxOpacity;
uniform float uFadeNear;       // distance from the camera (m) where the grid is still full strength
uniform float uFadeFar;        // distance from the camera (m) where the grid has dissolved (horizon)
// cameraPosition is injected automatically by three for ShaderMaterial.

// AA coverage of the nearest line of a square grid with the given world cell, about widthPx wide.
float lineCoverage(vec2 p, float cell, float widthPx) {
  vec2 c = p / cell;
  vec2 d = max(fwidth(c), vec2(1e-6));
  vec2 g = abs(fract(c - 0.5) - 0.5) / d;   // per-axis pixel distance to nearest line
  float l = min(g.x, g.y);
  return 1.0 - smoothstep(widthPx - 1.0, widthPx, l);
}

// AA coverage of a single axis line at coord == 0.
float axisCoverage(float coord, float widthPx) {
  float d = max(fwidth(coord), 1e-6);
  return 1.0 - smoothstep(widthPx - 1.0, widthPx, abs(coord) / d);
}

void main() {
  // World-locked grid: lines live at fixed world coordinates and converge to the horizon in true
  // perspective (C4D). One uniform cell size -> perspective compresses the cells toward the horizon
  // (the 3D depth cue), no per-fragment rings, and the major sits exactly every 10th minor (BUG 2).
  vec2 p = vWorld.xz;
  // Per-fragment decade LOD: choose the spacing PER PIXEL from the screen-space derivative, so lines
  // spawn (zoom-in / tilt-up) and merge (zoom-out / tilt-down) continuously -- dynamic with BOTH zoom
  // and tilt. World-locked (lines at fixed world coords). uMinCellPx is the spawn/merge threshold.
  float worldPerPx = max(max(fwidth(p.x), fwidth(p.y)), 1e-6);
  float lod = log2((worldPerPx * uMinCellPx) / uBaseCell) / log2(10.0);
  float lodFloor = floor(lod);
  float lodFade = lod - lodFloor;                       // 0 just after a decade step, ->1 just before
  float cellMinor = uBaseCell * pow(10.0, lodFloor);    // finest minor (>= uMinCellPx on screen)
  float cellMajor = cellMinor * uMajorEvery;            // major every 10th minor

  // The over-dense finest minor fades out as the decade is about to merge (continuous, no hard pop);
  // the major decade stays full + bold so primary/secondary read clearly apart.
  float minorC = lineCoverage(p, cellMinor, uMinorLinePx) * (1.0 - lodFade);
  float majorC = lineCoverage(p, cellMajor, uMajorLinePx);

  vec3 color = uMinorColor;
  float a = minorC;
  if (majorC >= a) { color = uMajorColor; a = majorC; }

  // -- World axes from origin: line at z==0 runs along X (red); x==0 runs along Z (blue) -----------
  float axX = axisCoverage(vWorld.z, uAxisLinePx);
  float axZ = axisCoverage(vWorld.x, uAxisLinePx);
  if (axX > 0.001) { color = mix(color, uAxisXColor, axX); a = max(a, axX); }
  if (axZ > 0.001) { color = mix(color, uAxisZColor, axZ); a = max(a, axZ); }

  // -- Horizon fade (C4D): melt the grid into the grey background as it nears the horizon. The fade
  // is keyed to the fragment distance FROM THE CAMERA (full strength up to uFadeNear, gone by
  // uFadeFar) -> a soft dissolve toward the horizon, never a hard edge. ----------------------------
  float camDist = distance(vWorld, cameraPosition);
  float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, camDist);
  a *= fade * uMaxOpacity;
  if (a < 0.002) discard;
  gl_FragColor = vec4(color, a);
  // Linear -> output colour space (sRGB), matching built-in materials so the THREE.Color uniforms
  // render byte-exact to their resolved token hexes (#414141 / #4B4B4B / axes).
  #include <colorspace_fragment>
}
`;

/** Uniform bag — colours are THREE.Color so the renderer's colour management converts the resolved
 *  token hexes (sRGB) to linear; `toneMapped:false` + `<colorspace_fragment>` keep them byte-exact. */
export interface Cinema4DGridUniforms {
  uMinorColor: { value: THREE.Color };
  uMajorColor: { value: THREE.Color };
  uAxisXColor: { value: THREE.Color };
  uAxisZColor: { value: THREE.Color };
  uBaseCell: { value: number };
  uMinCellPx: { value: number };
  uMajorEvery: { value: number };
  uMinorLinePx: { value: number };
  uMajorLinePx: { value: number };
  uAxisLinePx: { value: number };
  uMaxOpacity: { value: number };
  uFadeNear: { value: number };
  uFadeFar: { value: number };
  /** three's `ShaderMaterial.uniforms` is `{ [k: string]: IUniform }` — η index signature
   *  επιτρέπει direct assign του typed bag (κάθε named member είναι `{ value }` = `IUniform`). */
  [uniform: string]: THREE.IUniform;
}

/** Build the grid ShaderMaterial. Returns the typed `uniforms` reference alongside the material
 *  (same object three stores as `material.uniforms`) so callers refresh uniforms without a cast.
 *  uFadeNear / uFadeFar are recomputed per frame (the horizon fade scales with the camera distance);
 *  the decade LOD is derived per fragment in the shader. */
export function createCinema4DGridMaterial(): { material: THREE.ShaderMaterial; uniforms: Cinema4DGridUniforms } {
  const uniforms: Cinema4DGridUniforms = {
    uMinorColor: { value: new THREE.Color(GRID3D_MINOR_COLOR_FALLBACK) },
    uMajorColor: { value: new THREE.Color(GRID3D_MAJOR_COLOR_FALLBACK) },
    uAxisXColor: { value: new THREE.Color(GRID3D_AXIS_X_COLOR) },
    uAxisZColor: { value: new THREE.Color(GRID3D_AXIS_Z_COLOR) },
    uBaseCell: { value: GRID3D_BASE_CELL_M },
    uMinCellPx: { value: GRID3D_MIN_CELL_PX },
    uMajorEvery: { value: GRID3D_MAJOR_EVERY },
    uMinorLinePx: { value: GRID3D_MINOR_LINE_PX },
    uMajorLinePx: { value: GRID3D_MAJOR_LINE_PX },
    uAxisLinePx: { value: GRID3D_AXIS_LINE_PX },
    uMaxOpacity: { value: GRID3D_MAX_OPACITY },
    uFadeNear: { value: 0 }, // set per frame (NEAR_K x distance)
    uFadeFar: { value: 1 },  // set per frame (FAR_K x distance)
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  return { material, uniforms };
}
