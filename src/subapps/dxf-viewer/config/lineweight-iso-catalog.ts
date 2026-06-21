/**
 * Lineweight ISO Catalog — ADR-358 §5.3 + §5.3.ter (Q5 Per-project configurable).
 *
 * Immutable SSoT for the 24 ISO baseline lineweight values (mm) plus the 3 special
 * enum values (-3 Default / -2 ByLayer / -1 ByBlock) defined by DXF group 370.
 *
 * Reuses the `LineweightMm` type from `types/entities.ts` (no duplication).
 *
 * Helpers:
 *   - `isConcreteLineweight(lw)` — type guard, true only for real mm values.
 *   - `lineweightToPx(lw, dpi)` — convert mm to display pixels.
 *   - `parseDxfCode370(int)` — decode DXF group 370 integer (hundredths of mm).
 *   - `encodeDxfCode370(lw)` — encode `LineweightMm` to DXF group 370 integer.
 *
 * Pre-commit ratchet `lineweight-iso-catalog` BLOCKS hardcoded ISO numeric literals
 * + `as LineweightMm` casts outside this file + tests + entities.ts.
 */

import type { LineweightMm } from '../types/entities';

/**
 * 24 ISO 128-20 baseline lineweight values in millimetres.
 * DXF group 370 native ordering (ascending mm).
 * Reference: AutoCAD `LWEIGHT` table + DXF reference (group code 370).
 */
export const LINEWEIGHT_ISO_VALUES: ReadonlyArray<LineweightMm> = Object.freeze([
  0, 0.05, 0.09, 0.13, 0.15, 0.18, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.53, 0.6,
  0.7, 0.8, 0.9, 1.0, 1.06, 1.2, 1.4, 1.58, 2.0, 2.11,
]) as ReadonlyArray<LineweightMm>;

/**
 * DXF group 370 special sentinel values — non-numeric semantics.
 * Frozen to prevent accidental rebinding.
 */
export const LINEWEIGHT_SPECIAL = Object.freeze({
  /** Resolved via `default-lineweight-resolver.ts` cascade. */
  DEFAULT: -3 as const,
  /** Entity inherits from its layer. */
  BYLAYER: -2 as const,
  /** Entity inherits from its containing block. */
  BYBLOCK: -1 as const,
});

/** Tuple of all special sentinel values for fast membership checks. */
export const LINEWEIGHT_SPECIAL_VALUES: ReadonlyArray<-3 | -2 | -1> = Object.freeze([
  LINEWEIGHT_SPECIAL.DEFAULT,
  LINEWEIGHT_SPECIAL.BYLAYER,
  LINEWEIGHT_SPECIAL.BYBLOCK,
]);

/** Concrete lineweight subtype — excludes the 3 special enums. */
export type ConcreteLineweightMm = Exclude<LineweightMm, -3 | -2 | -1>;

/**
 * The printable (positive) ISO lineweights — `LINEWEIGHT_ISO_VALUES` χωρίς το 0.
 * **SSoT για κάθε UI dropdown παχών** (BIM style panels, ribbon line-tool/hatch):
 * οι αριθμοί ζουν ΜΟΝΟ εδώ, οι consumers παράγουν options/labels από αυτό.
 */
export const LINEWEIGHT_CONCRETE_MM_VALUES: readonly ConcreteLineweightMm[] =
  LINEWEIGHT_ISO_VALUES.filter((v): v is ConcreteLineweightMm => v > 0);

/**
 * Type guard: true when `lw` is a concrete mm value (0..2.11), false for
 * null/undefined and the special sentinels (-3/-2/-1).
 */
export function isConcreteLineweight(
  lw: LineweightMm | null | undefined,
): lw is ConcreteLineweightMm {
  if (lw === null || lw === undefined) return false;
  return lw >= 0;
}

/**
 * Convert a concrete lineweight (mm) to display pixels at the given DPI.
 * Returns 0 for special sentinels — callers must resolve those first
 * (see `default-lineweight-resolver.ts` and ByLayer/ByBlock cascade).
 *
 * Formula: 1 inch = 25.4 mm, so px = mm × dpi / 25.4.
 */
export function lineweightToPx(
  lw: LineweightMm | null | undefined,
  dpi = 96,
): number {
  if (!isConcreteLineweight(lw)) return 0;
  return (lw * dpi) / 25.4;
}

/**
 * Decode a DXF group 370 integer to a `LineweightMm`.
 *
 * DXF native encoding:
 *   - -3 / -2 / -1: special sentinels (passed through).
 *   - 0..211: hundredths of mm (e.g. 25 → 0.25mm, 211 → 2.11mm).
 *
 * Unknown / out-of-catalog values snap to nearest ISO value (tolerance 0.005mm);
 * if no match, returns `-3` (DEFAULT) so callers can apply the resolver cascade.
 */
export function parseDxfCode370(int: number): LineweightMm {
  if (int === -3 || int === -2 || int === -1) return int;
  const mm = int / 100;
  for (const v of LINEWEIGHT_ISO_VALUES) {
    if (Math.abs(v - mm) < 0.005) return v;
  }
  return LINEWEIGHT_SPECIAL.DEFAULT;
}

/**
 * Encode a `LineweightMm` to its DXF group 370 integer representation
 * (inverse of `parseDxfCode370`).
 */
export function encodeDxfCode370(lw: LineweightMm): number {
  if (lw === -3 || lw === -2 || lw === -1) return lw;
  return Math.round(lw * 100);
}

/** True when `lw` belongs to the 24 ISO baseline values (mm). */
export function isIsoBaselineLineweight(lw: number): lw is ConcreteLineweightMm {
  for (const v of LINEWEIGHT_ISO_VALUES) {
    if (Math.abs(v - lw) < 0.005) return true;
  }
  return false;
}
