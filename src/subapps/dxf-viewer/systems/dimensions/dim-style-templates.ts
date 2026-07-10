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
import {
  NESTOR_DIM_ANNOTATION_SCALE,
  NESTOR_DIM_TEXT_HEIGHT,
  NESTOR_DIM_ARROW_SIZE,
  NESTOR_DIM_ARROW_BLOCK,
  NESTOR_DIM_TEXT_PLACEMENT,
  NESTOR_DIM_TEXT_FILL,
} from './nestor-dim-appearance';

// ──────────────────────────────────────────────────────────────────────────────
// Stable built-in IDs
// ──────────────────────────────────────────────────────────────────────────────

export const BUILTIN_DIM_STYLE_IDS = {
  /** Nestor enterprise default — Greek architectural, unified green, all-continuous. */
  NESTOR_DEFAULT: 'dimstyle_nestor_default',
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
    // ADR-362 hotfix (2026-05-19): ACI 256 = ByLayer so committed dims inherit
    // the layer color instead of hardcoded cyan (ACI 4). Cyan made every dim
    // look like a preview/ghost overlay regardless of layer color (jarring on
    // dark canvas + mismatched the green rubber-band preview). Templates that
    // intentionally want a colored DIMSTYLE override below (ASME=5, Arch=5).
    dimclrd: 256,
    dimclre: 256,
    // ADR-562 Φ1 — per-part lineweight & linetype default to ByLayer so committed
    // dims inherit the layer's LWT/linetype (mirrors the dimclrd=256 ByLayer note).
    // `arrowColor` is intentionally omitted → arrows inherit `dimclrd` at render.
    dimlwd: -2,
    dimlwe: -2,
    dimltype: 'ByLayer',
    dimltex1: 'ByLayer',
    dimltex2: 'ByLayer',
    // ADR-362 — per-part linetype density (Path A). 1 = catalog density.
    // dimltscale = dim line · dimltexscale = extension lines (independent twins).
    dimltscale: 1,
    dimltexscale: 1,
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
    // ADR-362 Round 36 — endpoint markers visible by default (both sides).
    suppressArrow1: false,
    suppressArrow2: false,
    dimcen: 2.5,
    breakGap: 3.75,

    // Text
    dimtxt: 2.5,
    // ByLayer — see dimclrd note above.
    dimclrt: 256,
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
// ΔΙΑΣΤΑΣΕΙΣ Nestor — enterprise default (Greek architectural, unified green)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The out-of-the-box default active style (Giorgio 2026-07-07). A clean-enterprise
 * derivation of ISO 129: same Greek architectural conventions inherited from
 * `sharedDefaults()` (closed-filled arrows, text-above, comma decimal, 2.5mm text)
 * but with an explicit, unified GREEN identity (#008000) on the dim line, extension
 * lines and text. Mirrors how ASME/Arch bake an explicit color (blue ACI 5) while
 * keeping linetype/lineweight ByLayer:
 *   - Color is EXPLICIT green (`dimclr*` + `*TrueColor` 0x008000) so every new
 *     dimension is green regardless of its layer's color.
 *   - Linetype/lineweight stay ByLayer (shared default) → render continuous on the
 *     ΔΙΑΣΤΑΣΕΙΣ layer (fixes the DashDot extension-line quirk of the sampled dim).
 *   - `arrowColor` intentionally unset → arrows inherit `dimclrd` (green).
 * Baked into the style fields — NOT per-entity overrides — so new dimensions inherit
 * it cleanly and `resolveDimStyle` needs no override merge. ACI `96` carries the
 * nearest-index for DXF export; the TrueColor companions win at render.
 */
export const NESTOR_DEFAULT_TEMPLATE: DimStyle = makeBuiltInTemplate(
  BUILTIN_DIM_STYLE_IDS.NESTOR_DEFAULT,
  'ΔΙΑΣΤΑΣΕΙΣ Nestor',
  {
    // Explicit unified green on dim line, extension lines & text.
    dimclrd: 96,
    dimclrdTrueColor: 0x008000,
    dimclre: 96,
    dimclreTrueColor: 0x008000,
    dimclrt: 96,
    dimclrtTrueColor: 0x008000,
    // Greek architectural: witness lines flush at the feature point, ΔΙΑΣΤΑΣΕΙΣ layer.
    dimexo: 0,
    targetLayer: 'ΔΙΑΣΤΑΣΕΙΣ',
    // ADR-608 (Giorgio 2026-07-10) — app-created dims ΙΔΙΟ μέγεθος/σχήμα/διάταξη με τα Tekton-imported:
    // κοινή SSoT `nestor-dim-appearance` (annotation scale/text/arrow/placement/mask). Μόνο το ΧΡΩΜΑ
    // μένει η πράσινη ταυτότητα Nestor (πάνω). Έτσι μηδέν απόκλιση app ↔ Tekton, χωρίς διπλά magic numbers.
    dimscale: NESTOR_DIM_ANNOTATION_SCALE,
    dimtxt: NESTOR_DIM_TEXT_HEIGHT,
    dimasz: NESTOR_DIM_ARROW_SIZE,
    dimblk: NESTOR_DIM_ARROW_BLOCK,
    dimtad: NESTOR_DIM_TEXT_PLACEMENT,
    dimtfill: NESTOR_DIM_TEXT_FILL,
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// ISO 129 — Greek/EU architectural/civil (kept pristine — do NOT fold Nestor into it)
// ──────────────────────────────────────────────────────────────────────────────

export const ISO_129_TEMPLATE: DimStyle = makeBuiltInTemplate(
  BUILTIN_DIM_STYLE_IDS.ISO_129,
  'ISO 129',
  {
    // Oblique tick + text-above-aligned, comma decimal separator,
    // ByLayer color (inherits layer), Greek layer name.
    dimblk: 'oblique',
    dimtad: 'above',
    dimtih: false,
    dimtoh: false,
    dimdsep: ',',
    targetLayer: 'ΔΙΑΣΤΑΣΕΙΣ',
    // ADR-362 Round 21 (Giorgio 2026-06-24) — witness lines must TOUCH the
    // feature point (no gap). The standard ISO/AutoCAD DIMEXO gap (0.625mm ×
    // dimscale) left a visible offset between the extension-line origin and the
    // measured endpoint/intersection; for the Greek architectural default Giorgio
    // wants them flush. (The associativity fix already lands the defPoint on the
    // true endpoint/intersection — what remained was purely this by-design gap.)
    dimexo: 0,
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
  NESTOR_DEFAULT_TEMPLATE,
  ISO_129_TEMPLATE,
  ASME_Y14_5_TEMPLATE,
  ARCHITECTURAL_US_TEMPLATE,
] as const;

/**
 * Default active style for new projects — Nestor enterprise green (Giorgio 2026-07-07).
 * ISO 129 remains available in the registry; this is just the out-of-the-box active pick.
 */
export const DEFAULT_ACTIVE_DIM_STYLE_ID: BuiltInDimStyleId = BUILTIN_DIM_STYLE_IDS.NESTOR_DEFAULT;
