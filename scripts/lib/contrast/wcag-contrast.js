/**
 * WCAG 2.1 contrast primitives — HSL(Tailwind/shadcn token form) → sRGB → relative luminance → ratio.
 *
 * SSoT for every contrast number this repo computes OUTSIDE the chart palette.
 * (CHECK 3.32 / ADR-710 §10 owns the CATEGORICAL CHART palette and has its own,
 *  intentionally separate, perceptual machinery — CVD simulation, ΔE. Do NOT merge them:
 *  that one answers "can two SERIES be told apart", this one answers "can TEXT be read".)
 *
 * Formulas: WCAG 2.1 §1.4.3 relative luminance + contrast ratio.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */

'use strict';

/** Parse a shadcn token value `"217 33% 17%"` → {h,s,l} in [0..360],[0..1],[0..1]. Returns null if not a literal HSL triplet (e.g. `var(--x)`). */
function parseHslToken(value) {
  const m = /^\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*$/.exec(value);
  if (!m) return null;
  return { h: parseFloat(m[1]), s: parseFloat(m[2]) / 100, l: parseFloat(m[3]) / 100 };
}

/** HSL → sRGB 0..255 (CSS Color 3 algorithm). */
function hslToRgb({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] :
    hp < 2 ? [x, c, 0] :
    hp < 3 ? [0, c, x] :
    hp < 4 ? [0, x, c] :
    hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [r1 + m, g1 + m, b1 + m].map((v) => Math.round(v * 255));
}

/** WCAG relative luminance from sRGB 0..255. */
function relativeLuminance([r, g, b]) {
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio between two sRGB triplets. Range 1..21. */
function contrastRatio(rgbA, rgbB) {
  const la = relativeLuminance(rgbA);
  const lb = relativeLuminance(rgbB);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Alpha-composite a foreground over an opaque background (Tailwind `text-primary/70`).
 * WCAG has no official rule for translucent text; compositing is what the browser
 * actually paints, so it is what we measure.
 */
function compositeOver(fgRgb, bgRgb, alpha) {
  return fgRgb.map((c, i) => Math.round(c * alpha + bgRgb[i] * (1 - alpha)));
}

/** `[29,40,58]` → `"#1d283a"`. */
function toHex(rgb) {
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse a browser `getComputedStyle` colour — `rgb(30, 41, 59)` or `rgb(0, 0, 0, 0.5)`
 * / `rgba(0, 0, 0, 0.5)` — into `{ rgb: [r,g,b], alpha }`. Returns null for anything
 * else (`''`, `color(display-p3 …)`, keywords).
 *
 * Needed by ADR-770 Στρώμα 2β: the browser is the only thing that can resolve
 * `hsl(var(--x))`, `color-mix()` or an `rgba()` literal, and it always answers in this
 * one serialisation. Lives HERE, next to `compositeOver`, because "what is this colour"
 * and "what does it look like over that one" are one question asked twice — a second
 * parser in the runtime gate would be the ADR-749 shape all over again.
 *
 * ⚠️ Chrome serialises fully-opaque colours as `rgb(...)` and translucent ones as
 * `rgba(...)`, but `rgb(r g b / a)` is also legal CSS Color 4 output. Both accepted:
 * relying on the function NAME to tell you about alpha is a trap.
 */
function parseComputedColor(css) {
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i
    .exec(String(css || '').trim());
  if (!m) return null;
  const raw = m[4];
  const alpha = raw === undefined
    ? 1
    : raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw);
  return {
    rgb: [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])],
    alpha: Number.isFinite(alpha) ? alpha : 1,
  };
}

/** WCAG 2.1 grade for body text (<18.66px / non-bold). */
function grade(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'FAIL';
}

module.exports = {
  parseHslToken,
  parseComputedColor,
  hslToRgb,
  relativeLuminance,
  contrastRatio,
  compositeOver,
  toHex,
  grade,
};
