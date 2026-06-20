/**
 * Color math — pure SSoT (ADR-509 adaptive entity color).
 *
 * Κοινό low-level χρωματικό math: hex parsing, luminance, WCAG contrast ratio, mix. Εξήχθη
 * για να **σταματήσει η διασπορά** (private `parseHex`/`luminance` στο `print-color-policy.ts`
 * + naive `getContrastColor` στο `color-config.ts`) — ΕΝΑ σπίτι, μηδέν διπλότυπο (N.0.2/N.12).
 *
 * Δύο luminance: `luminance601` (ITU-R BT.601 perceptual, ό,τι ήδη χρησιμοποιεί το print path)
 * + `srgbRelativeLuminance` (WCAG 2.x linearized — η σωστή για contrast ratio).
 *
 * Pure — zero DOM/React/store. Μονάδες: hex `#rgb`/`#rrggbb`, κανάλια 0..255.
 *
 * @see ./print-color-policy.ts — print path (reuse `parseHex`/`luminance601`/`channelToHex`)
 * @see ./adaptive-entity-color.ts — background-adaptive contrast resolver (reuse WCAG μέρος)
 */

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
  const clamped = Math.max(0, Math.min(255, Math.round(channel)));
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
  const k = Math.max(0, Math.min(1, t));
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
  return { r, g, b, a: Math.max(0, Math.min(1, a)) };
}

/** `{r,g,b,a}` → `rgba(r, g, b, a)` (κανάλια rounded+clamped 0..255, alpha clamped 0..1). */
export function rgbaString(c: RgbaColor): string {
  const ch = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
  return `rgba(${ch(c.r)}, ${ch(c.g)}, ${ch(c.b)}, ${Math.max(0, Math.min(1, c.a))})`;
}

/**
 * Alpha-composite ένα translucent χρώμα πάνω σε opaque hex φόντο → effective **opaque** hex.
 * `out = fg·a + bg·(1−a)` = `mixHex(bg, fg, a)` (reuse — μηδέν duplicate compositing math).
 */
export function compositeOverHex(fg: RgbaColor, bgHex: string): string {
  return mixHex(bgHex, rgbToHex(fg), fg.a);
}
