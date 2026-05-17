/**
 * ADR-362 Phase A2 — 3 built-in DIMSTYLE templates.
 *
 * Templates:
 *   - ISO 129 (default — Greek/EU architectural/civil)
 *   - ASME Y14.5 (US mechanical)
 *   - Architectural US (hybrid: closedFilled arrow + ISO text placement)
 *
 * Built-in IDs are deterministic slugs (`dimstyle_iso_129`, ...) — they remain
 * stable across reloads so persisted `DimensionEntity.styleId` references keep
 * resolving. Phase A2 is in-memory only; persistence comes in Phase F when the
 * registry gains Firestore backing (N.6 enterprise IDs convention then applies
 * to user-created styles via `generateDimStyleId()` — see registry).
 *
 * Field semantics: see `types/dimension.ts` `DimStyle` interface.
 */

import type { DimStyle } from '../../types/dimension';

// ──────────────────────────────────────────────────────────────────────────────
// Stable built-in IDs
// ──────────────────────────────────────────────────────────────────────────────

export const BUILTIN_DIM_STYLE_IDS = {
  ISO_129: 'dimstyle_iso_129',
  ASME_Y14_5: 'dimstyle_asme_y14_5',
  ARCHITECTURAL_US: 'dimstyle_arch_us',
} as const;

export type BuiltInDimStyleId = (typeof BUILTIN_DIM_STYLE_IDS)[keyof typeof BUILTIN_DIM_STYLE_IDS];

// ──────────────────────────────────────────────────────────────────────────────
// Shared defaults — fields identical across the 3 templates (avoid duplication)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Defaults shared by every built-in template. Variant templates spread this and
 * override only the fields that differ between standards (D2 + §2.4 + §3.D5).
 */
function sharedDefaults(): Omit<DimStyle, 'id' | 'name' | 'isBuiltIn'> {
  return {
    // Lines & extensions
    dimclrd: 4,
    dimclre: 4,
    dimexe: 1.25,
    dimexo: 0.625,
    dimdli: 3.75,
    suppressDimLine1: false,
    suppressDimLine2: false,
    suppressExtLine1: false,
    suppressExtLine2: false,

    // Symbols & arrows
    dimasz: 2.5,
    dimblk: 'closedFilled',
    dimblk1: '',
    dimblk2: '',
    dimcen: 2.5,
    breakGap: 3.75,

    // Text
    dimtxt: 2.5,
    dimclrt: 4,
    dimgap: 0.625,
    dimtad: 'above',
    dimtih: false,
    dimtoh: false,
    dimtfill: 'none',
    dimtfillclr: 0,
    textFontFamily: 'Arial',

    // Fit
    dimtix: false,
    dimtofl: false,
    dimatfit: 3,
    dimtmove: 0,
    dimscale: 1,
    paperTextHeight: 2.5,

    // Primary units
    dimlunit: 'decimal',
    dimaunit: 'decimalDegrees',
    dimdec: 2,
    dimadec: 0,
    dimdsep: ',',
    dimpost: '',
    dimrnd: 0,
    dimlfac: 1,
    dimzin: 0,

    // Alternate units
    dimalt: false,
    dimaltu: 'decimal',
    dimaltf: 25.4,
    dimaltd: 2,
    dimaltrnd: 0,
    dimapost: '',

    // Tolerances
    dimtol: false,
    dimlim: false,
    dimtm: 0,
    dimtp: 0,
    dimtdec: 2,
    dimtfac: 1,
    dimtolj: 'middle',

    // Inspection
    dimInspect: 'off',
    dimInspectRate: 100,

    // Associativity (D11)
    dimassoc: 2,

    // Layer (D5) — overridden per template
    targetLayer: 'Dimensions',

    // Annotation scaling (D3) — Phase 1 fixed false
    annotative: false,
  };
}

/** Build a built-in template by patching shared defaults. */
function makeBuiltInTemplate(
  id: BuiltInDimStyleId,
  name: string,
  patch: Partial<Omit<DimStyle, 'id' | 'name' | 'isBuiltIn'>>,
): DimStyle {
  return {
    id,
    name,
    isBuiltIn: true,
    ...sharedDefaults(),
    ...patch,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// ISO 129 — default (Greek/EU architectural/civil)
// ──────────────────────────────────────────────────────────────────────────────

export const ISO_129_TEMPLATE: DimStyle = makeBuiltInTemplate(
  BUILTIN_DIM_STYLE_IDS.ISO_129,
  'ISO 129',
  {
    // Oblique tick + text-above-aligned, comma decimal separator,
    // cyan ACI 4, Greek layer name.
    dimblk: 'oblique',
    dimtad: 'above',
    dimtih: false,
    dimtoh: false,
    dimdsep: ',',
    targetLayer: 'ΔΙΑΣΤΑΣΕΙΣ',
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// ASME Y14.5 — US mechanical
// ──────────────────────────────────────────────────────────────────────────────

export const ASME_Y14_5_TEMPLATE: DimStyle = makeBuiltInTemplate(
  BUILTIN_DIM_STYLE_IDS.ASME_Y14_5,
  'ASME Y14.5',
  {
    // Closed-filled arrow, text centered & horizontal, line break at text,
    // dot decimal separator, blue ACI 5, AIA layer name.
    dimblk: 'closedFilled',
    dimtad: 'centered',
    dimtih: true,
    dimtoh: true,
    dimdsep: '.',
    dimclrd: 5,
    dimclre: 5,
    dimclrt: 5,
    targetLayer: 'A-ANNO-DIMS',
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// Architectural US — hybrid (closedFilled arrow + ISO text placement)
// ──────────────────────────────────────────────────────────────────────────────

export const ARCHITECTURAL_US_TEMPLATE: DimStyle = makeBuiltInTemplate(
  BUILTIN_DIM_STYLE_IDS.ARCHITECTURAL_US,
  'Architectural US',
  {
    // Closed-filled arrow but text above & aligned (architectural convention),
    // dot decimal separator, blue ACI 5, AIA layer name.
    dimblk: 'closedFilled',
    dimtad: 'above',
    dimtih: false,
    dimtoh: false,
    dimdsep: '.',
    dimclrd: 5,
    dimclre: 5,
    dimclrt: 5,
    targetLayer: 'A-ANNO-DIMS',
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// Bulk export — registry pre-population
// ──────────────────────────────────────────────────────────────────────────────

export const BUILTIN_DIM_STYLES: readonly DimStyle[] = [
  ISO_129_TEMPLATE,
  ASME_Y14_5_TEMPLATE,
  ARCHITECTURAL_US_TEMPLATE,
] as const;

/** Default active style for new projects — Greek architectural context (D2). */
export const DEFAULT_ACTIVE_DIM_STYLE_ID: BuiltInDimStyleId = BUILTIN_DIM_STYLE_IDS.ISO_129;
