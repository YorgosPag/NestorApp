/**
 * cinema4d-grid-material.ts — anti-aliased per-fragment DECADE-LOD grid material (ADR-558).
 *
 * Big-player technique (Blender `overlay_grid` / Maya / Ben Golus "pristine grid"): one ground quad
 * whose fragment shader derives the line spacing PER PIXEL from the screen-space derivative
 * (`fwidth`). Consequences, all free and continuous:
 *   • zoom in  → the decade LOD drops → finer minor lines fade in (the grid subdivides);
 *   • zoom out → the LOD climbs → fine lines merge, coarser decades remain;
 *   • camera tilt → far fragments have a larger derivative → they auto-coarsen toward the horizon,
 *     so the ground never turns into a solid moiré sheet.
 * Two line classes only: MINOR every decade cell, MAJOR (slightly bolder + darker token colour)
 * every 10th — the C4D "Major Lines Every 10th" model. A distance fog dissolves the bounded plane
 * into the horizon (NOT infinite). Lines are ~1px via the derivative, never thickening with zoom.
 *
 * Rendered AO-immune via the post-FX `'underlay'` overlay pass (depth-tested → occluded by the
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
  GRID3D_HORIZON_COLOR,
  GRID3D_BASE_CELL_M,
  GRID3D_MAJOR_EVERY,
  GRID3D_MINOR_TARGET_PX,
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
uniform vec3 uHorizonColor;
uniform float uBaseCell;       // decade anchor (m)
uniform float uMajorEvery;     // major every nth minor (10 → decade)
uniform float uMinorTargetPx;  // min screen px for the finest minor cell before subdividing
uniform float uMinorLinePx;
uniform float uMajorLinePx;
uniform float uAxisLinePx;
uniform float uMaxOpacity;
uniform vec3 uTarget;
uniform float uFadeStart;
uniform float uFadeEnd;

// AA coverage of the nearest line of a square grid with the given world cell, ~widthPx wide.
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
  vec2 p = vWorld.xz;

  // ── Per-fragment decade LOD ────────────────────────────────────────────────
  // World units covered by one pixel at this fragment (isotropic upper bound).
  float worldPerPx = max(max(fwidth(p.x), fwidth(p.y)), 1e-6);
  // Decade level so the minor cell is ≈ uMinorTargetPx on screen; continuous (fract = cross-fade).
  float lod = log2((worldPerPx * uMinorTargetPx) / uBaseCell) / log2(10.0);
  float lf = floor(lod);
  float frac = clamp(lod - lf, 0.0, 1.0);
  float cellMinor = uBaseCell * pow(10.0, lf);          // current minor decade
  float cellSub = cellMinor / uMajorEvery;              // finer subdivisions (fade in as frac → 0)
  float cellMajor = cellMinor * uMajorEvery;            // major: every 10th minor

  float subC = lineCoverage(p, cellSub, uMinorLinePx) * (1.0 - frac);
  float minorC = lineCoverage(p, cellMinor, uMinorLinePx);
  float majorC = lineCoverage(p, cellMajor, uMajorLinePx);

  vec3 color = uMinorColor;
  float a = max(subC, minorC);
  if (majorC >= a) { color = uMajorColor; a = majorC; }

  // ── World axes from origin: line at z==0 runs along X (red); x==0 runs along Z (blue) ─────────
  float axX = axisCoverage(vWorld.z, uAxisLinePx);
  float axZ = axisCoverage(vWorld.x, uAxisLinePx);
  if (axX > 0.001) { color = mix(color, uAxisXColor, axX); a = max(a, axX); }
  if (axZ > 0.001) { color = mix(color, uAxisZColor, axZ); a = max(a, axZ); }

  // ── Distance fog → horizon (bounded, not infinite) + horizon tint near the dissolving edge ────
  float dist = length(p - uTarget.xz);
  float edge = smoothstep(uFadeStart, uFadeEnd, dist);
  color = mix(color, uHorizonColor, edge * 0.5);
  a *= (1.0 - edge) * uMaxOpacity;

  if (a < 0.002) discard;
  gl_FragColor = vec4(color, a);
  // Linear → output colour space (sRGB), matching built-in materials so the THREE.Color uniforms
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
  uHorizonColor: { value: THREE.Color };
  uBaseCell: { value: number };
  uMajorEvery: { value: number };
  uMinorTargetPx: { value: number };
  uMinorLinePx: { value: number };
  uMajorLinePx: { value: number };
  uAxisLinePx: { value: number };
  uMaxOpacity: { value: number };
  uTarget: { value: THREE.Vector3 };
  uFadeStart: { value: number };
  uFadeEnd: { value: number };
}

/** Build the grid ShaderMaterial. Returns the typed `uniforms` reference alongside the material
 *  (same object three stores as `material.uniforms`) so callers refresh uniforms without a cast. */
export function createCinema4DGridMaterial(): { material: THREE.ShaderMaterial; uniforms: Cinema4DGridUniforms } {
  const uniforms: Cinema4DGridUniforms = {
    uMinorColor: { value: new THREE.Color(GRID3D_MINOR_COLOR_FALLBACK) },
    uMajorColor: { value: new THREE.Color(GRID3D_MAJOR_COLOR_FALLBACK) },
    uAxisXColor: { value: new THREE.Color(GRID3D_AXIS_X_COLOR) },
    uAxisZColor: { value: new THREE.Color(GRID3D_AXIS_Z_COLOR) },
    uHorizonColor: { value: new THREE.Color(GRID3D_HORIZON_COLOR) },
    uBaseCell: { value: GRID3D_BASE_CELL_M },
    uMajorEvery: { value: GRID3D_MAJOR_EVERY },
    uMinorTargetPx: { value: GRID3D_MINOR_TARGET_PX },
    uMinorLinePx: { value: GRID3D_MINOR_LINE_PX },
    uMajorLinePx: { value: GRID3D_MAJOR_LINE_PX },
    uAxisLinePx: { value: GRID3D_AXIS_LINE_PX },
    uMaxOpacity: { value: GRID3D_MAX_OPACITY },
    uTarget: { value: new THREE.Vector3(0, 0, 0) },
    uFadeStart: { value: 120 },
    uFadeEnd: { value: 600 },
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
