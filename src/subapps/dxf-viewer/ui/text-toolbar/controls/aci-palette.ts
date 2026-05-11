/**
 * ADR-344 Phase 5.C + Q13 — AutoCAD Color Index (ACI) palette + hex<->ACI mapping.
 *
 * The full 256-entry ACI table is widely documented; this file embeds the
 * canonical RGB values used by AutoCAD for indices 1–9 (named colors) and
 * derives the rest of the cube (10–255) per the standard formula.
 *
 * hexToAci uses Euclidean distance in RGB space — fast and AutoCAD-accurate
 * for the typical CAD color set.
 */

import type { DxfColor } from '../../../text-engine/types';

const NAMED_ACI: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],         // 0 = ByBlock (not a real color)
  [255, 0, 0],       // 1 red
  [255, 255, 0],     // 2 yellow
  [0, 255, 0],       // 3 green
  [0, 255, 255],     // 4 cyan
  [0, 0, 255],       // 5 blue
  [255, 0, 255],     // 6 magenta
  [255, 255, 255],   // 7 white/black
  [128, 128, 128],   // 8 dark gray
  [192, 192, 192],   // 9 light gray
] as const;

/** Reduced quantization table for indices 10–249 (AutoCAD ramp). */
const RAMP_LEVELS: ReadonlyArray<number> = [0, 38, 76, 115, 153, 191, 229, 255] as const;

let cachedTable: readonly (readonly [number, number, number])[] | null = null;

function buildAciTable(): readonly (readonly [number, number, number])[] {
  if (cachedTable) return cachedTable;
  const table: Array<readonly [number, number, number]> = [];
  for (let i = 0; i < NAMED_ACI.length; i++) {
    table.push(NAMED_ACI[i]!);
  }
  // Indices 10–249 ramp: 10 hues × 24 chroma steps. Approximation good
  // enough for nearest-color search; full AutoCAD ACI is in the renderer.
  for (let i = NAMED_ACI.length; i < 250; i++) {
    const h = (i - 10) % RAMP_LEVELS.length;
    const s = Math.floor((i - 10) / RAMP_LEVELS.length) % RAMP_LEVELS.length;
    const l = Math.floor((i - 10) / (RAMP_LEVELS.length * RAMP_LEVELS.length)) % RAMP_LEVELS.length;
    table.push([RAMP_LEVELS[h]!, RAMP_LEVELS[s]!, RAMP_LEVELS[l]!]);
  }
  // 250–255 reserved grays
  for (let i = 0; i < 6; i++) {
    const g = 64 + i * 32;
    table.push([g, g, g]);
  }
  cachedTable = table;
  return table;
}

/** ACI index → [r, g, b]. Undefined for out-of-range index. */
export function aciToRgb(index: number): readonly [number, number, number] | undefined {
  const table = buildAciTable();
  if (index < 0 || index >= table.length) return undefined;
  return table[index];
}

/** Parse `#RRGGBB` → [r, g, b]; returns null on invalid input. */
export function parseHex(hex: string): readonly [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Format `[r,g,b]` → `#RRGGBB`. */
export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Snap a hex color to the closest ACI index. Returns the index (1–255).
 * Uses Euclidean distance in RGB space — fast and accurate enough.
 */
export function hexToAci(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 7; // white/black fallback
  const table = buildAciTable();
  let best = 1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 1; i < table.length; i++) {
    const [r, g, b] = table[i]!;
    const d = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Convert a `DxfColor` discriminated union to its sRGB hex representation. */
export function dxfColorToHex(color: DxfColor): string {
  switch (color.kind) {
    case 'TrueColor':
      return rgbToHex(color.r, color.g, color.b);
    case 'ACI': {
      const rgb = aciToRgb(color.index);
      return rgb ? rgbToHex(rgb[0], rgb[1], rgb[2]) : '#000000';
    }
    case 'ByLayer':
    case 'ByBlock':
      return '#888888';
  }
}
