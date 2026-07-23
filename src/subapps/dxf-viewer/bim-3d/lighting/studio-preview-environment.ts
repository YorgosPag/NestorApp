/**
 * studio-preview-environment — procedural HDR studio environment (SSoT) for the
 * Material Editor «Εμφάνιση» preview sphere (ADR-687).
 *
 * WHY procedural, not an HDRI file: a material-editor preview must read the material,
 * not a busy photographed room. The big players' material previews (Cinema 4D, Substance
 * Painter, Marmoset Toolbag, Blender look-dev) light the sphere with a clean STUDIO rig —
 * a neutral grey surround with a few bright softbox panels — so glossy/metal surfaces show
 * crisp rectangular highlights (the tell-tale «this is reflective» read) without visual
 * noise. This builds exactly that as an equirectangular **HDR** texture: the softboxes
 * carry linear values > 1 (true high-dynamic-range), so after PMREM + ACES tone mapping a
 * metal at metalness=1 reflects bright, filmic studio light instead of a flat grey blob.
 *
 * Deterministic + offline + instant (no network HDRI fetch, no async pop-in) — the modern
 * IBL technique, self-contained. Fed to `EnvmapGenerator.applyEquirectEnvironment` which
 * PMREMs it into `scene.environment`.
 *
 * Mirrors the pure-data style of `studio-background-texture.ts` / the gradient env in
 * `envmap-generator.ts` (row/col fill of a `DataTexture`), so there is one shared idiom for
 * procedural equirect sources — no second technique.
 *
 * @see ./envmap-generator.ts — applyEquirectEnvironment (PMREM + scene.environment SSoT)
 * @see ../preview/material-preview-sphere-renderer.ts — the sole consumer
 * @see docs/centralized-systems/reference/adrs/ADR-687-material-editor-visual-appearance.md
 */

import * as THREE from 'three';
import { clamp01 } from '../../utils/scalar-math';

const ENV_WIDTH = 512;
const ENV_HEIGHT = 256;

/** Linear grey surround: darker below the horizon, brighter above (soft top fill). */
const FLOOR_VALUE = 0.03;
const CEIL_VALUE = 0.32;

/**
 * Softbox panels in equirect UV space. `v` runs bottom→top (v≈1 = zenith / +Y, matching the
 * `EquirectangularReflectionMapping` + `flipY=false` convention of the gradient env), so the
 * panels sit in the UPPER hemisphere and light the sphere from above like a real studio.
 * `intensity` is a LINEAR HDR value (> 1) → genuine bright reflections. `soft` = edge falloff.
 */
interface Softbox {
  readonly u: number;
  readonly v: number;
  readonly uHalf: number;
  readonly vHalf: number;
  readonly intensity: number;
  readonly soft: number;
}

const SOFTBOXES: readonly Softbox[] = [
  // Key — large, bright, front-left-high (the dominant highlight).
  { u: 0.28, v: 0.72, uHalf: 0.11, vHalf: 0.14, intensity: 6.5, soft: 0.55 },
  // Fill — smaller, dimmer, right side (shapes the opposite edge).
  { u: 0.66, v: 0.66, uHalf: 0.07, vHalf: 0.10, intensity: 2.4, soft: 0.6 },
  // Top rim — thin bright strip near the zenith (crisp upper reflection line).
  { u: 0.46, v: 0.9, uHalf: 0.26, vHalf: 0.035, intensity: 3.2, soft: 0.7 },
];

/** Smoothstep 0→1 across [edge0, edge1] (identical curve to GLSL `smoothstep`). */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Linear HDR contribution of one softbox at UV (u, v): 1 in its core, fading to 0 at the edge. */
function softboxContribution(box: Softbox, u: number, v: number): number {
  const du = Math.abs(u - box.u) / box.uHalf;
  const dv = Math.abs(v - box.v) / box.vHalf;
  const d = Math.max(du, dv); // rectangular panel with a soft rounded falloff
  const falloff = 1 - smoothstep(1 - box.soft, 1, d); // 1 in the core, 0 beyond the edge
  return box.intensity * falloff;
}

/**
 * Build the procedural HDR studio environment as a linear float equirect `DataTexture`.
 * Neutral (equal RGB) so the material's own colour is judged truthfully — the studio only
 * adds brightness/reflection, never a colour cast. Consumed by
 * `EnvmapGenerator.applyEquirectEnvironment` (which PMREMs then disposes it).
 */
export function buildStudioPreviewEnvTexture(): THREE.DataTexture {
  const data = new Float32Array(ENV_WIDTH * ENV_HEIGHT * 4);

  for (let row = 0; row < ENV_HEIGHT; row++) {
    const v = row / (ENV_HEIGHT - 1);
    const base = FLOOR_VALUE + (CEIL_VALUE - FLOOR_VALUE) * smoothstep(0.35, 1, v);

    for (let col = 0; col < ENV_WIDTH; col++) {
      const u = col / (ENV_WIDTH - 1);
      let value = base;
      for (const box of SOFTBOXES) value += softboxContribution(box, u, v);

      const i = (row * ENV_WIDTH + col) * 4;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 1;
    }
  }

  const texture = new THREE.DataTexture(data, ENV_WIDTH, ENV_HEIGHT, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}
