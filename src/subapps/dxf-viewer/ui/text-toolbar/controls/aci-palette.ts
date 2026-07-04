/**
 * ADR-344 Phase 5.C + Q13 — AutoCAD Color Index (ACI) picker adapters.
 *
 * 🏢 Color-Conversion SSoT (ADR-573): the ACI table has ONE home —
 * `settings/standards/aci.ts` (`ACI_PALETTE` 256 + `findClosestAci`). The old
 * self-contained 10-hue ramp approximation that lived here was REMOVED — it
 * diverged badly from the real palette (e.g. `#00994c` → ACI 170 = blue) and
 * produced entity colours in the DXF export that disagreed with the dimstyle
 * path (which already used `findClosestAci`). Both directions now derive from
 * the same SSoT so hex→index→hex round-trips are consistent.
 */

import type { DxfColor } from '../../../text-engine/types';
// 🏢 Color-Conversion SSoT (ADR-573): rgb↔hex via `config/color-math`;
// ACI table + nearest-match via `settings/standards/aci` (the single ACI SSoT).
import { parseHex as cmParseHex, rgbToHex as cmRgbToHex } from '../../../config/color-math';
import { findClosestAci, getAciColor } from '../../../settings/standards/aci';

/** ACI index (1–255) → [r, g, b] from the canonical `ACI_PALETTE`. Undefined out of range. */
export function aciToRgb(index: number): readonly [number, number, number] | undefined {
  if (index < 1 || index > 255) return undefined;
  const c = cmParseHex(getAciColor(index));
  return c ? [c.r, c.g, c.b] : undefined;
}

/** Parse `#RGB` / `#RRGGBB` → [r, g, b] tuple; returns null on invalid input. */
export function parseHex(hex: string): readonly [number, number, number] | null {
  const c = cmParseHex(hex);
  return c ? [c.r, c.g, c.b] : null;
}

/** Format `(r,g,b)` → `#rrggbb` (clamped + rounded via the color-math SSoT). */
export function rgbToHex(r: number, g: number, b: number): string {
  return cmRgbToHex({ r, g, b });
}

/**
 * Snap a hex colour to the closest ACI index (1–255) using the canonical
 * `ACI_PALETTE` nearest-match SSoT (`findClosestAci`). Invalid hex → 7 (white).
 */
export function hexToAci(hex: string): number {
  return parseHex(hex) ? findClosestAci(hex) : 7;
}

/**
 * Inverse of {@link dxfColorToHex} for true-color input: `#RRGGBB` → `DxfColor`
 * `TrueColor`. Lives beside its forward pair (SSoT). Distinct from
 * `utils/dxf-true-color.hexToTrueColor`, which returns a packed RGB `number` for
 * DXF group 420/421 export — different shape, hence a different name.
 */
export function hexToDxfTrueColor(hex: string): DxfColor {
  const [r, g, b] = parseHex(hex) ?? [255, 255, 255];
  return { kind: 'TrueColor', r, g, b };
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
