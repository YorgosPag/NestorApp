/**
 * ADR-344 Phase 1 — DxfColor, MixedValue<T>, DxfDocumentVersion.
 *
 * DxfColor — discriminated union covering all AutoCAD color models:
 *   ByLayer / ByBlock (inherited), ACI 1-255, TrueColor 24-bit (R2004+).
 *
 * MixedValue<T> — null = indeterminate: multiple selected entities disagree.
 *   Mirrors Figma / Illustrator toolbar UX for multi-selection (ADR-344 §2.6).
 *
 * DxfDocumentVersion — typed $ACADVER strings from the DXF specification.
 *   Parser and serializer use these for version-gated feature branches (Q14).
 */

export type DxfColor =
  | { readonly kind: 'ByLayer' }
  | { readonly kind: 'ByBlock' }
  | { readonly kind: 'ACI'; readonly index: number }
  | { readonly kind: 'TrueColor'; readonly r: number; readonly g: number; readonly b: number };

/** null = indeterminate (multi-selection with mixed values) */
export type MixedValue<T> = T | null;

/** $ACADVER header values for the DXF versions supported by this engine. */
export enum DxfDocumentVersion {
  R12 = 'AC1009',
  R2000 = 'AC1015',
  R2004 = 'AC1018',
  R2007 = 'AC1021',
  R2010 = 'AC1024',
  R2013 = 'AC1027',
  R2018 = 'AC1032',
}

// ── Sentinel colour constants ─────────────────────────────────────────────────

export const DXF_COLOR_BY_LAYER: DxfColor = { kind: 'ByLayer' };
export const DXF_COLOR_BY_BLOCK: DxfColor = { kind: 'ByBlock' };

// ── Colour constructors ───────────────────────────────────────────────────────

/**
 * Parse the integer form used by the DXF \c true-colour code.
 * AutoCAD encodes true color as R·65536 + G·256 + B.
 */
export function parseTrueColorInt(value: number): DxfColor {
  return {
    kind: 'TrueColor',
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

/** Encode a TrueColor back to the DXF integer form (group code 420). */
export function encodeTrueColorInt(color: DxfColor): number {
  if (color.kind !== 'TrueColor') return 0;
  return ((color.r & 0xff) << 16) | ((color.g & 0xff) << 8) | (color.b & 0xff);
}

// ── Version parsing & feature gates ──────────────────────────────────────────

/**
 * Map a $ACADVER string to the DxfDocumentVersion enum.
 * Returns null for unrecognised versions.
 */
export function parseDocumentVersion(acadver: string): DxfDocumentVersion | null {
  const map: Record<string, DxfDocumentVersion> = {
    AC1009: DxfDocumentVersion.R12,
    AC1015: DxfDocumentVersion.R2000,
    AC1018: DxfDocumentVersion.R2004,
    AC1021: DxfDocumentVersion.R2007,
    AC1024: DxfDocumentVersion.R2010,
    AC1027: DxfDocumentVersion.R2013,
    AC1032: DxfDocumentVersion.R2018,
  };
  return map[acadver.toUpperCase()] ?? null;
}

const VERSION_ORDER: readonly DxfDocumentVersion[] = [
  DxfDocumentVersion.R12,
  DxfDocumentVersion.R2000,
  DxfDocumentVersion.R2004,
  DxfDocumentVersion.R2007,
  DxfDocumentVersion.R2010,
  DxfDocumentVersion.R2013,
  DxfDocumentVersion.R2018,
];

export function versionAtLeast(v: DxfDocumentVersion, minimum: DxfDocumentVersion): boolean {
  return VERSION_ORDER.indexOf(v) >= VERSION_ORDER.indexOf(minimum);
}

/** MTEXT entity was introduced in R2000 (AC1015). */
export function versionSupportsMtext(v: DxfDocumentVersion): boolean {
  return versionAtLeast(v, DxfDocumentVersion.R2000);
}

/** True-color (group 420 TRUECOLOR) was introduced in R2004 (AC1018). */
export function versionSupportsTrueColor(v: DxfDocumentVersion): boolean {
  return versionAtLeast(v, DxfDocumentVersion.R2004);
}

/** ANNOTATIVE XDATA support introduced in R2007 (AC1021). */
export function versionSupportsAnnotativeXData(v: DxfDocumentVersion): boolean {
  return versionAtLeast(v, DxfDocumentVersion.R2007);
}
