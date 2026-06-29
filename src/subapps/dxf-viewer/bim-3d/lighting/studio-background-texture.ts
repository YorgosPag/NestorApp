/**
 * studio-background-texture.ts — Cinema 4D / Blender-style vertical studio gradient for the
 * 3D viewport background (ADR-446 §2.1).
 *
 * Giorgio: the flat sky-blue background was unpleasant to draw on. The new look is a neutral
 * vertical gradient built AROUND the SAME base colour the 2D canvas uses
 * (`--canvas-background-dxf`, via `resolveDxfCanvasBackgroundHex()`) — so 2D and 3D stay
 * FULL SSoT on one colour token (a theme switch moves both), but the 3D gets the subtle
 * depth the "big players" use: darker at the top, the base in the middle, lighter at the
 * bottom. Screen-fixed (a plain non-equirect `Texture` background is drawn full-screen, so
 * the gradient does not swim with the camera). The IBL lighting (`scene.environment`) is
 * untouched — only the visible backdrop changes.
 *
 * The colour math is the PURE slice (`studioGradientStops`, jest-tested); the THREE plumbing
 * (`buildStudioBackgroundTexture`) wraps it into a 1×N sRGB `DataTexture`.
 */

import * as THREE from 'three';
import type { CanvasGradientStops } from '../../config/color-config';
import { parseHex, mixHex } from '../../config/color-math';

/** Lightness spread of each end from the base (sRGB [0..1]). ±0.12 ≈ ±31/255 — subtle depth. */
export const STUDIO_BG_DELTA = 0.12;

/** Vertical gradient stops (sRGB bytes 0..255), built around the 2D-canvas base colour. */
export interface StudioGradientStops {
  /** Screen TOP — darker (Cinema 4D look). */
  readonly top: readonly [number, number, number];
  /** Screen MIDDLE — exactly the base (the 2D-canvas SSoT colour). */
  readonly mid: readonly [number, number, number];
  /** Screen BOTTOM — lighter. */
  readonly bottom: readonly [number, number, number];
}

const _parse = new THREE.Color();
const _rgb = { r: 0, g: 0, b: 0 };

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * Resolve the three gradient stops from the base colour. `baseHex` is anything
 * `THREE.Color.set` accepts (`#rrggbb`, `rgb(...)`, named) — the live 2D-canvas token. The
 * base is read in sRGB so the mid stop matches the 2D canvas byte-for-byte; the ends are the
 * base ± `delta` lightness, clamped (a pure-black base clamps the top to black — the upper
 * half then stays black, the lower half eases to grey, which is the intended dark studio).
 */
export function studioGradientStops(baseHex: string, delta = STUDIO_BG_DELTA): StudioGradientStops {
  _parse.set(baseHex);
  _parse.getRGB(_rgb, THREE.SRGBColorSpace);
  const d = delta * 255;
  const r = _rgb.r * 255;
  const g = _rgb.g * 255;
  const b = _rgb.b * 255;
  return {
    top: [clamp255(r - d), clamp255(g - d), clamp255(b - d)],
    mid: [clamp255(r), clamp255(g), clamp255(b)],
    bottom: [clamp255(r + d), clamp255(g + d), clamp255(b + d)],
  };
}

const GRADIENT_HEIGHT = 256;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** `#rrggbb` → sRGB byte tuple [0..255], reusing the `color-math` SSoT parser (hex stops). */
function rgbTuple(hex: string): readonly [number, number, number] {
  const c = parseHex(hex);
  return c ? [c.r, c.g, c.b] : [0, 0, 0];
}

/**
 * Build the SAME three-stop shape from EXPLICIT top/bottom stops (e.g. the exact Cinema 4D
 * `#5B5B5B`→`#868686`). The mid is the linear midpoint of the two ends, so the existing
 * bottom→mid→top texture loop collapses into a single straight bottom→top line — a pure
 * 2-stop linear gradient with zero new rendering code. Channel math reuses `color-math`
 * (`parseHex` + `mixHex`, ADR-509 SSoT) — no private colour arithmetic here. ADR-446 §2.1.
 */
export function explicitToStops(stops: CanvasGradientStops): StudioGradientStops {
  return {
    top: rgbTuple(stops.top),
    mid: rgbTuple(mixHex(stops.top, stops.bottom, 0.5)),
    bottom: rgbTuple(stops.bottom),
  };
}

/**
 * Build the 1×N sRGB gradient `DataTexture` for `scene.background`. Row 0 is screen-BOTTOM
 * (`flipY=false` → the first row maps to v=0 = bottom of the full-screen background quad), so
 * the gradient runs bottom→mid→top = lighter→base→darker. Linear-filtered, no mipmaps, sRGB
 * colour-space (so it displays identically to the solid `THREE.Color(base)` path).
 *
 * When `explicit` stops are supplied (a theme with an exact gradient, e.g. Cinema 4D), they
 * drive a pure 2-stop linear gradient; otherwise the gradient is derived symmetrically from
 * `baseHex` (the legacy «σαν 2Δ» depth look). ADR-446 §2.1.
 */
export function buildStudioBackgroundTexture(
  baseHex: string,
  explicit?: CanvasGradientStops | null,
): THREE.DataTexture {
  const { top, mid, bottom } = explicit ? explicitToStops(explicit) : studioGradientStops(baseHex);
  const data = new Uint8Array(GRADIENT_HEIGHT * 4);
  for (let row = 0; row < GRADIENT_HEIGHT; row++) {
    const v = row / (GRADIENT_HEIGHT - 1); // 0 = screen-bottom, 1 = screen-top
    const from = v < 0.5 ? bottom : mid;
    const to = v < 0.5 ? mid : top;
    const t = v < 0.5 ? v * 2 : (v - 0.5) * 2;
    const i = row * 4;
    data[i] = clamp255(lerp(from[0], to[0], t));
    data[i + 1] = clamp255(lerp(from[1], to[1], t));
    data[i + 2] = clamp255(lerp(from[2], to[2], t));
    data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, 1, GRADIENT_HEIGHT, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
