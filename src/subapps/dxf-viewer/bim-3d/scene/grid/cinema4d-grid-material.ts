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
 * every 10th — the C4D "Major Lines Every 10th" model. The grid STOPS at a hard finite square
 * extent (C4D does NOT distance-fade toward the horizon — the lines just end). Lines are ~1px via
 * the derivative, never thickening with zoom; major vs minor by colour only (C4D-faithful).
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
  GRID3D_BASE_CELL_M,
  GRID3D_MAJOR_EVERY,
  GRID3D_MIN_CELL_PX,
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
uniform float uBaseCell;       // decade anchor (m)
uniform float uMajorEvery;     // major every nth minor (10 → decade)
uniform float uMinCellPx;      // minimum on-screen px between the finest minor lines (sparse)
uniform float uMinorLinePx;
uniform float uMajorLinePx;
uniform float uAxisLinePx;
uniform float uMaxOpacity;
uniform vec3 uTarget;
uniform float uExtent;         // hard finite half-size (m) around the target — grid STOPS here

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

  // ── Per-fragment decade LOD (sparse, big-player density) ───────────────────
  // World units covered by one pixel at this fragment (isotropic upper bound).
  float worldPerPx = max(max(fwidth(p.x), fwidth(p.y)), 1e-6);
  // Keep the finest minor lines ≥ uMinCellPx apart on screen → sparse, never a solid sheet.
  float lod = log2((worldPerPx * uMinCellPx) / uBaseCell) / log2(10.0);
  float lf = ceil(lod);
  float blend = clamp(lf - lod, 0.0, 1.0);              // 0 just after a decade step, 1 just before
  float cellMinor = uBaseCell * pow(10.0, lf);          // minor spacing ∈ [uMinCellPx, 10·uMinCellPx)
  float cellMajor = cellMinor * uMajorEvery;            // major: every 10th minor (decade)
  float cellFiner = cellMinor / uMajorEvery;            // next finer decade — cross-fades the transition

  float minorC = lineCoverage(p, cellMinor, uMinorLinePx);
  // The finer decade only appears once it ALSO clears uMinCellPx (× blend so it grows in smoothly).
  float finerPx = cellFiner / worldPerPx;
  float finerC = lineCoverage(p, cellFiner, uMinorLinePx) * blend * smoothstep(uMinCellPx * 0.5, uMinCellPx, finerPx);
  float majorC = lineCoverage(p, cellMajor, uMajorLinePx);

  vec3 color = uMinorColor;
  float a = max(minorC, finerC);
  if (majorC >= a) { color = uMajorColor; a = majorC; }

  // ── World axes from origin: line at z==0 runs along X (red); x==0 runs along Z (blue) ─────────
  float axX = axisCoverage(vWorld.z, uAxisLinePx);
  float axZ = axisCoverage(vWorld.x, uAxisLinePx);
  if (axX > 0.001) { color = mix(color, uAxisXColor, axX); a = max(a, axX); }
  if (axZ > 0.001) { color = mix(color, uAxisZColor, axZ); a = max(a, axZ); }

  // ── Hard finite extent — C4D STOPS the grid; lines do NOT distance-fade toward the horizon ────
  // (GetGridStep's `fade` is the LOD-transition crossfade only, never a distance fade.) Square
  // boundary that tracks the view; a worldPerPx-wide AA keeps the cut edge clean, not jagged.
  float edgeDist = max(abs(p.x - uTarget.x), abs(p.y - uTarget.z)); // p = world XZ → p.y is world Z
  float inside = 1.0 - smoothstep(uExtent - worldPerPx * 1.5, uExtent, edgeDist);
  a *= inside * uMaxOpacity;

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
  uBaseCell: { value: number };
  uMajorEvery: { value: number };
  uMinCellPx: { value: number };
  uMinorLinePx: { value: number };
  uMajorLinePx: { value: number };
  uAxisLinePx: { value: number };
  uMaxOpacity: { value: number };
  uTarget: { value: THREE.Vector3 };
  uExtent: { value: number };
}

/** Build the grid ShaderMaterial. Returns the typed `uniforms` reference alongside the material
 *  (same object three stores as `material.uniforms`) so callers refresh uniforms without a cast. */
export function createCinema4DGridMaterial(): { material: THREE.ShaderMaterial; uniforms: Cinema4DGridUniforms } {
  const uniforms: Cinema4DGridUniforms = {
    uMinorColor: { value: new THREE.Color(GRID3D_MINOR_COLOR_FALLBACK) },
    uMajorColor: { value: new THREE.Color(GRID3D_MAJOR_COLOR_FALLBACK) },
    uAxisXColor: { value: new THREE.Color(GRID3D_AXIS_X_COLOR) },
    uAxisZColor: { value: new THREE.Color(GRID3D_AXIS_Z_COLOR) },
    uBaseCell: { value: GRID3D_BASE_CELL_M },
    uMajorEvery: { value: GRID3D_MAJOR_EVERY },
    uMinCellPx: { value: GRID3D_MIN_CELL_PX },
    uMinorLinePx: { value: GRID3D_MINOR_LINE_PX },
    uMajorLinePx: { value: GRID3D_MAJOR_LINE_PX },
    uAxisLinePx: { value: GRID3D_AXIS_LINE_PX },
    uMaxOpacity: { value: GRID3D_MAX_OPACITY },
    uTarget: { value: new THREE.Vector3(0, 0, 0) },
    uExtent: { value: 350 },
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
