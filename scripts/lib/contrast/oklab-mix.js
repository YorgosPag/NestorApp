/**
 * `color-mix(in oklab, A p%, B)` — the same arithmetic the browser performs, so a gate can judge a
 * mixed colour BEFORE it is painted (CSS Color 5 §2: interpolate premultiplied OKLab components
 * linearly; for opaque inputs premultiplication is the identity).
 *
 * Inputs and output are sRGB 0..255 triplets — the currency of `wcag-contrast.js`.
 * The forward transform is `cvd.oklabFromLin` (one copy of the matrices); only the inverse lives here.
 *
 * @see src/design-system/primitives/Avatar/monogram-tone.ts — first consumer (ADR-190 §Display)
 */

'use strict';

const { oklabFromLin, s2lin, clamp01 } = require('./cvd');

function linFromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

const lin2s = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** `color-mix(in oklab, a weightA, b)` with `weightA` in 0..1. */
function mixInOklab(rgbA, rgbB, weightA) {
  const toLab = (rgb) => oklabFromLin(rgb.map((v) => s2lin(v / 255)));
  const labA = toLab(rgbA);
  const labB = toLab(rgbB);
  const mixed = labA.map((v, i) => v * weightA + labB[i] * (1 - weightA));
  return linFromOklab(mixed).map((v) => Math.round(255 * clamp01(lin2s(clamp01(v)))));
}

module.exports = { mixInOklab };
