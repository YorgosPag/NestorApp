/**
 * ADR-454 — Print Plot Style policy (AutoCAD CTB / Revit print, 2D-only).
 *
 * Pure SSoT that maps an entity's resolved screen colour to a **print-safe**
 * colour for white-paper output, plus the active print DPI for ISO lineweights.
 *
 * The live 2D canvas renders on a dark background, so white / by-layer-white /
 * neutral (null → canvas token) strokes are invisible on a white PDF page. This
 * module remaps them to visible ink, with four plot-style modes mirroring the
 * AutoCAD plot-style table (CTB) families:
 *
 *   - `colour`     — white-safe colour: near-white / ACI 7 / null → black,
 *                    every other colour kept as-is (BIM category colours survive).
 *   - `monochrome` — all ink black (Revit default for technical drawings).
 *   - `grayscale`  — luminance → grey (near-white / null → black so it stays visible).
 *   - `by-pen`     — CTB ACI→pen remap (Slice 5, currently falls back to `colour`).
 *
 * **Activation model (ADR-040 compliant by construction)**: a module-level
 * singleton mirrors the existing `_activePenTable` / `setPenTableSource` pattern in
 * `bim-line-weight-resolver.ts`. The print capture path calls `setPrintColorPolicy`
 * immediately before `renderer.render()` and `clearPrintColorPolicy()` in a
 * `finally` — a synchronous call chain on a one-shot offscreen canvas, so there is
 * zero concurrency risk and zero impact on the live hot path (the singleton stays
 * `null` during normal interactive rendering, a single boolean branch).
 *
 * @module subapps/dxf-viewer/config/print-color-policy
 * @see docs/centralized-systems/reference/adrs/ADR-454-print-plot-style.md
 */

/** AutoCAD CTB / Revit plot-style families. */
export type PrintPlotStyle = 'colour' | 'monochrome' | 'grayscale' | 'by-pen';

export interface PrintColorPolicy {
  /** Active plot-style mode. */
  style: PrintPlotStyle;
  /** Physical print DPI used for ISO lineweight mm → px conversion. */
  dpi: number;
}

const PRINT_BLACK = '#000000';

/** Above this per-channel level (0..1) a colour is treated as "white" ink. */
const NEAR_WHITE_THRESHOLD = 0.92;

/** AutoCAD ACI 7 = white/black-on-white pen — always remapped to black ink. */
const ACI_WHITE = 7;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse `#rgb` / `#rrggbb` (case-insensitive) → 0..255 channels, or null. */
function parseHex(hex: string): Rgb | null {
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

/** Relative luminance (ITU-R BT.601 weights), 0..1. */
function luminance(rgb: Rgb): number {
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

/** True when every channel sits above the near-white threshold. */
function isNearWhite(rgb: Rgb): boolean {
  const t = NEAR_WHITE_THRESHOLD * 255;
  return rgb.r >= t && rgb.g >= t && rgb.b >= t;
}

function toHex(channel: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(channel)));
  return clamped.toString(16).padStart(2, '0');
}

/**
 * Map a resolved entity colour to a print-safe colour under the given policy.
 *
 * Always returns a concrete `#rrggbb` string (never null) so callers can feed it
 * straight to `ctx.strokeStyle` / leaf renderers without a token fallback that
 * would re-introduce the invisible-on-white problem.
 *
 * @param colorHex resolved screen colour, or `null` (BIM neutral → canvas token).
 * @param colorAci ACI index when known (Track A raw DXF), else `null`.
 * @param policy   active print colour policy.
 */
export function applyPlotColor(
  colorHex: string | null,
  colorAci: number | null,
  policy: PrintColorPolicy,
): string {
  if (policy.style === 'monochrome') return PRINT_BLACK;

  const rgb = colorHex ? parseHex(colorHex) : null;
  // null colour (BIM neutral token) or ACI 7 (white pen) → always black ink.
  const forcedWhite = rgb === null || colorAci === ACI_WHITE || isNearWhite(rgb);

  if (policy.style === 'grayscale') {
    if (rgb === null || forcedWhite) return PRINT_BLACK;
    const lum = luminance(rgb) * 255;
    return `#${toHex(lum)}${toHex(lum)}${toHex(lum)}`;
  }

  // 'colour' and 'by-pen' (Slice 5 fallback): white-safe colour preservation.
  if (forcedWhite) return PRINT_BLACK;
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

// ─── Module-level singleton (mirror of _activePenTable / setPenTableSource) ────

let _activePrintColorPolicy: PrintColorPolicy | null = null;

/** Returns the active print policy, or `null` during normal interactive render. */
export function getPrintColorPolicy(): PrintColorPolicy | null {
  return _activePrintColorPolicy;
}

/** Activate a print policy for the duration of an offscreen print render. */
export function setPrintColorPolicy(policy: PrintColorPolicy): void {
  _activePrintColorPolicy = policy;
}

/** Clear the print policy (call in a `finally` after the print render). */
export function clearPrintColorPolicy(): void {
  _activePrintColorPolicy = null;
}
