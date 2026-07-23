/**
 * preview-backdrop-texture — the diagonal light/dark grey stripe backdrop (SSoT) for the
 * Material Editor «Εμφάνιση» preview sphere (ADR-687).
 *
 * WHY diagonal stripes: every big-player material editor (Cinema 4D, Substance, the app's own
 * material swatches) puts an alternating diagonal grey pattern BEHIND the preview sphere. It is
 * the classic «transparency checker» — a solid material hides it, a transparent one lets the
 * stripes show through, so opacity is instantly readable. It also reads as a neutral studio
 * surround (never a flat colour that could be mistaken for the material).
 *
 * Rendered as an in-scene textured plane (`material-preview-sphere-renderer.ts`) with
 * `toneMapped:false`, so the reference greys are pixel-exact under ACES and the pattern is
 * guaranteed to appear regardless of canvas alpha / CSS (a `scene.background` texture renders
 * unpredictably with tone mapping; a CSS backdrop needs a transparent canvas). Pure data,
 * mirroring the `studio-*-texture` idiom.
 *
 * @see ./material-preview-sphere-renderer.ts — the sole consumer (backdrop plane)
 * @see docs/centralized-systems/reference/adrs/ADR-687-material-editor-visual-appearance.md
 */

import * as THREE from 'three';

const SIZE = 256;
/** Full period in px (one dark band + one light band). */
const STRIPE_PERIOD = 36;
/** The two alternating greys (the documented Cinema 4D material-preview stops). */
const DARK: readonly [number, number, number] = [0x5b, 0x5b, 0x5b];
const LIGHT: readonly [number, number, number] = [0x86, 0x86, 0x86];

/**
 * Build the diagonal (45°) light/dark grey stripe backdrop as an sRGB `DataTexture`.
 * `(x + y)` constant = a 45° diagonal, so banding on `(x + y) mod period` yields evenly
 * spaced diagonal stripes. Consumed as the `map` of the preview backdrop plane.
 */
export function buildDiagonalStripeBackdropTexture(): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4);
  const half = STRIPE_PERIOD / 2;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const inLightBand = (x + y) % STRIPE_PERIOD >= half;
      const c = inLightBand ? LIGHT : DARK;
      const i = (y * SIZE + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
