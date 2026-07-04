/**
 * ADR-375 v2.12 — V/G category-color fill tint helper (Revit "cut pattern
 * background" convention).
 *
 * BIM 2D renderers (Wall/Column/Slab/SlabOpening/Beam) all paint a translucent
 * "category fill" inside their footprint polygon. Pre-v2.12 this fill was a
 * hardcoded per-category/per-kind rgba constant, so user-set V/G colors only
 * affected edges and hatch — never the body fill. This SSoT computes the
 * tinted rgba string the renderer should use, falling back to `null` when no
 * V/G color is configured (renderer then keeps its existing hardcoded fill).
 *
 * Industry alignment: in Revit "Override Graphics in View", setting a category
 * cut/projection color auto-tints the cut pattern background. For 2D plan
 * footprints (one polygon represents BOTH cut surface and projection), we
 * accept either V/G column — prefer the cutState match, fall back to the
 * other.
 */
import type { BimCategory, ObjectStyle } from '../../config/bim-object-styles';
import type { CutState } from '../../config/bim-view-range';
// 🏢 ADR-571: color-conversion SSoT (reuse parse/format — μηδέν local duplicate)
import { parseHex, rgbaString } from '../../config/color-math';

/** Alpha used when tinting the body fill with a V/G color. */
export const VG_FILL_ALPHA = 0.2;

/**
 * Convert a hex color (`#rgb`/`#rrggbb`) to a `rgba(r, g, b, alpha)` string.
 * Returns `null` if the input is not a valid hex (renderer then keeps its default).
 * 🏢 ADR-571: reuses the `parseHex`+`rgbaString` SSoT (config/color-math.ts) — μηδέν duplicate.
 */
export function hexToRgba(hex: string, alpha: number): string | null {
  const rgb = parseHex(hex);
  return rgb ? rgbaString({ ...rgb, a: alpha }) : null;
}

/**
 * Resolve the V/G body-fill tint for a BIM category footprint.
 *
 * Priority chain:
 *   1. user-set color for the matching cutState column (cutColor / projectionColor)
 *   2. user-set color for the OPPOSITE column (so picking either V/G column tints
 *      the 2D plan footprint — Revit-faithful pattern adapted for 2D semantics)
 *   3. `null` (renderer keeps its hardcoded translucent default)
 *
 * @param alpha - opacity for the final rgba string (default {@link VG_FILL_ALPHA})
 */
export function resolveVgFillTint(
  category: BimCategory,
  cutState: CutState,
  objectStyles: Partial<Record<BimCategory, ObjectStyle>> | undefined,
  alpha: number = VG_FILL_ALPHA,
): string | null {
  const styleEntry = objectStyles?.[category];
  if (!styleEntry) return null;
  const primary = cutState === 'cut' ? styleEntry.cutColor : styleEntry.projectionColor;
  const secondary = cutState === 'cut' ? styleEntry.projectionColor : styleEntry.cutColor;
  const hex = primary ?? secondary;
  if (!hex) return null;
  return hexToRgba(hex, alpha);
}
