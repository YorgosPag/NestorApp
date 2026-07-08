/**
 * Color math — pure SSoT (ADR-509 adaptive entity color· ADR-573 color-conversion consolidation).
 *
 * Κοινό low-level χρωματικό math: hex/rgba/HSL/HSV parsing, luminance, WCAG contrast ratio, mix,
 * 8-digit alpha. Εξήχθη για να **σταματήσει η διασπορά** (private `parseHex`/`luminance` στο
 * `print-color-policy.ts` + διάσπαρτοι converters, ADR-573) — ΕΝΑ σπίτι, μηδέν διπλότυπο (N.0.2/N.12).
 *
 * Δύο luminance: `luminance601` (ITU-R BT.601 perceptual, ό,τι ήδη χρησιμοποιεί το print path)
 * + `srgbRelativeLuminance` (WCAG 2.x linearized — η σωστή για contrast ratio).
 *
 * Pure — zero DOM/React/store. Μονάδες: hex `#rgb`/`#rrggbb`, κανάλια 0..255.
 *
 * @see ./print-color-policy.ts — print path (reuse `parseHex`/`luminance601`/`channelToHex`)
 * @see ./adaptive-entity-color.ts — background-adaptive contrast resolver (reuse WCAG μέρος)
 */

import { clamp01, clamp255 } from '../utils/scalar-math';

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Opaque-or-translucent χρώμα: `Rgb` + alpha 0..1. */
export interface RgbaColor extends Rgb {
  readonly a: number;
}

/** Parse `#rgb` / `#rrggbb` (case-insensitive) → 0..255 channels, ή `null` σε άκυρο. */
export function parseHex(hex: string): Rgb | null {
  const m = hex.trim().replace(/^#/, '');
  if (m.length === 3) {
    const r = parseInt(m[0] + m[0], 16);
    const g = parseInt(m[1] + m[1], 16);
    const b = parseInt(m[2] + m[2], 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  if (m.length === 6) {
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  return null;
}

/** Ένα κανάλι (0..255, clamped+rounded) → 2-ψήφιο hex. */
export function channelToHex(channel: number): string {
  const clamped = clamp255(Math.round(channel));
  return clamped.toString(16).padStart(2, '0');
}

/** `Rgb` → `#rrggbb`. */
export function rgbToHex(rgb: Rgb): string {
  return `#${channelToHex(rgb.r)}${channelToHex(rgb.g)}${channelToHex(rgb.b)}`;
}

/** Perceptual luminance (ITU-R BT.601 weights), 0..1. (print path) */
export function luminance601(rgb: Rgb): number {
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

/**
 * Κορεσμός 0..1 (HSV/HSL ορισμός: `(max−min)/max`). `0` = ουδέτερο γκρι, `1` = πλήρως κορεσμένο.
 * Επιτρέπει διαχωρισμό «δομικό γκρι» (χαμηλός κορεσμός → ασφαλές να ανοίξει προς λευκό χωρίς
 * αλλοίωση) από «ζωηρό χρώμα» (υψηλός κορεσμός → mix-προς-λευκό θα το ξέπλενε → να μείνει).
 */
export function saturation(rgb: Rgb): number {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  return max === 0 ? 0 : (max - min) / max;
}

/** sRGB linearization ενός καναλιού 0..255 → linear 0..1 (WCAG 2.x). */
function linearizeChannel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance, 0..1 (η σωστή για contrast ratio). */
export function srgbRelativeLuminance(rgb: Rgb): number {
  return 0.2126 * linearizeChannel(rgb.r) + 0.7152 * linearizeChannel(rgb.g) + 0.0722 * linearizeChannel(rgb.b);
}

/**
 * WCAG contrast ratio μεταξύ δύο hex χρωμάτων, 1..21. `1` σε άκυρο input (συντηρητικό →
 * «μηδέν contrast» ώστε ο caller να προσαρμόσει). `(L1+0.05)/(L2+0.05)`, L1≥L2.
 */
export function contrastRatio(aHex: string, bHex: string): number {
  const a = parseHex(aHex);
  const b = parseHex(bHex);
  if (!a || !b) return 1;
  const la = srgbRelativeLuminance(a);
  const lb = srgbRelativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Γραμμική ανάμειξη δύο hex χρωμάτων ανά κανάλι· `t∈[0,1]` (0=a, 1=b). `a` σε άκυρο input. */
export function mixHex(aHex: string, bHex: string, t: number): string {
  const a = parseHex(aHex);
  const b = parseHex(bHex);
  if (!a || !b) return aHex;
  const k = clamp01(t);
  return rgbToHex({
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  });
}

/**
 * Parse `#hex` / `rgb(r,g,b)` / `rgba(r,g,b,a)` → {r,g,b,a} (channels 0..255, alpha 0..1).
 * hex/rgb → `a=1`. `null` σε άκυρο input. Reuse `parseHex` για το hex μέρος (μηδέν duplicate).
 */
export function parseColor(input: string): RgbaColor | null {
  const s = input.trim();
  if (s.startsWith('#')) {
    const rgb = parseHex(s);
    return rgb ? { ...rgb, a: 1 } : null;
  }
  const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s);
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a = m[4] === undefined ? 1 : Number(m[4]);
  if ([r, g, b, a].some(Number.isNaN)) return null;
  return { r, g, b, a: clamp01(a) };
}

/** `{r,g,b,a}` → `rgba(r, g, b, a)` (κανάλια rounded+clamped 0..255, alpha clamped 0..1). */
export function rgbaString(c: RgbaColor): string {
  const ch = (n: number): number => clamp255(Math.round(n));
  return `rgba(${ch(c.r)}, ${ch(c.g)}, ${ch(c.b)}, ${clamp01(c.a)})`;
}

/**
 * **SSoT** `#hex` (`#rgb`/`#rrggbb`) + alpha 0..1 → `rgba(r, g, b, a)` string για translucent fills.
 * Reuse `parseHex` + `rgbaString` — μηδέν duplicate parse/format. Άκυρο hex → επιστρέφει το hex ως
 * ασφαλές fallback (μη-throwing). Οι domain wrappers (`mep-system-color`, `bim-vg-fill-tint`)
 * delegateάρουν εδώ (N.0.2/N.12).
 */
export function hexToRgba(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  return rgb ? rgbaString({ ...rgb, a: alpha }) : hex;
}

/**
 * Alpha-composite ένα translucent χρώμα πάνω σε opaque hex φόντο → effective **opaque** hex.
 * `out = fg·a + bg·(1−a)` = `mixHex(bg, fg, a)` (reuse — μηδέν duplicate compositing math).
 */
export function compositeOverHex(fg: RgbaColor, bgHex: string): string {
  return mixHex(bgHex, rgbToHex(fg), fg.a);
}

// ── 8-digit alpha hex + HSL/HSV (SSoT for the colour-picker superset, ADR-573) ──
//
// Absorbed here so `ui/color/utils` becomes thin adapters (big-player single colour
// module — Figma-style). Channel ranges: r/g/b 0..255, alpha 0..1, h 0..360, s/l/v 0..100.

/** Hue-Saturation-Lightness (h 0..360, s/l 0..100). Alpha is carried by the caller. */
export interface Hsl {
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

/** Hue-Saturation-Value (h 0..360, s/v 0..100). Alpha is carried by the caller. */
export interface Hsv {
  readonly h: number;
  readonly s: number;
  readonly v: number;
}

/**
 * Parse `#rgb` / `#rrggbb` / `#rrggbbaa` → `{r,g,b,a}` (channels 0..255, alpha 0..1).
 * `null` σε άκυρο input (non-throwing). Το 8-digit κωδικοποιεί alpha ως byte/255· τα
 * 3/6-digit → `a=1`. Reuse `parseHex` για το 3/6-digit μέρος (μηδέν duplicate).
 */
export function parseHexAlpha(hex: string): RgbaColor | null {
  const m = hex.trim().replace(/^#/, '');
  if (m.length === 8) {
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    const a = parseInt(m.slice(6, 8), 16);
    if ([r, g, b, a].some(Number.isNaN)) return null;
    return { r, g, b, a: a / 255 };
  }
  const rgb = parseHex(hex);
  return rgb ? { ...rgb, a: 1 } : null;
}

/** Normalize `Rgb` (0..255) → r,g,b (0..1) + max/min/delta (SSoT for HSL/HSV). */
function rgbNormalized(rgb: Rgb): {
  r: number; g: number; b: number; max: number; min: number; delta: number;
} {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return { r, g, b, max, min, delta: max - min };
}

/** Hue (0..1) from normalized r,g,b + max/delta (shared hexcone for HSL/HSV); delta 0 → 0. */
function hueFromRgb(r: number, g: number, b: number, max: number, delta: number): number {
  if (delta === 0) return 0;
  switch (max) {
    case r: return ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    case g: return ((b - r) / delta + 2) / 6;
    default: return ((r - g) / delta + 4) / 6; // case b
  }
}

/** `Rgb` (0..255) → `Hsl` (h 0..360, s/l 0..100). */
export function rgbToHsl(rgb: Rgb): Hsl {
  const { r, g, b, max, min, delta } = rgbNormalized(rgb);
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  return { h: hueFromRgb(r, g, b, max, delta) * 360, s: s * 100, l: l * 100 };
}

/** `Hsl` (h 0..360, s/l 0..100) → `Rgb` (0..255, un-rounded floats). */
export function hslToRgb(hsl: Hsl): Rgb {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r: number;
  let g: number;
  let b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { r: r * 255, g: g * 255, b: b * 255 };
}

/** `Rgb` (0..255) → `Hsv` (h 0..360, s/v 0..100). */
export function rgbToHsv(rgb: Rgb): Hsv {
  const { r, g, b, max, delta } = rgbNormalized(rgb);
  const s = max === 0 ? 0 : delta / max;
  return { h: hueFromRgb(r, g, b, max, delta) * 360, s: s * 100, v: max * 100 };
}

/** `Hsv` (h 0..360, s/v 0..100) → `Rgb` (0..255, un-rounded floats). */
export function hsvToRgb(hsv: Hsv): Rgb {
  const h = hsv.h / 360;
  const s = hsv.s / 100;
  const v = hsv.v / 100;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r: number;
  let g: number;
  let b: number;

  switch (i % 6) {
    case 0:
      [r, g, b] = [v, t, p];
      break;
    case 1:
      [r, g, b] = [q, v, p];
      break;
    case 2:
      [r, g, b] = [p, v, t];
      break;
    case 3:
      [r, g, b] = [p, q, v];
      break;
    case 4:
      [r, g, b] = [t, p, v];
      break;
    case 5:
      [r, g, b] = [v, p, q];
      break;
    default:
      [r, g, b] = [0, 0, 0];
  }

  return { r: r * 255, g: g * 255, b: b * 255 };
}
