/**
 * ADR-570 Φ1 — 8 built-in line-style templates (Revit-style default catalog).
 *
 * Names are i18n KEYS (N.11) resolved via `t()` at display time — no hardcoded
 * Greek in code. Built-in IDs are deterministic slugs (`linestyle_*`) so persisted
 * `BaseEntity.lineStyleId` references keep resolving across reloads. Weights follow
 * the ISO 128 pen ladder (thin .13 / medium .25 / thick .50 mm). Pen color is
 * ByLayer for every built-in (like Revit — the style differentiates weight + pattern;
 * color inherits the layer). Custom styles get `generateLineStyleId()` (see registry).
 *
 * Field semantics: see `line-style-types.ts` `LineStyle`.
 */

import { type LineStyle, LINE_STYLE_BYLAYER_PEN } from './line-style-types';

// ──────────────────────────────────────────────────────────────────────────────
// Stable built-in IDs
// ──────────────────────────────────────────────────────────────────────────────

export const BUILTIN_LINE_STYLE_IDS = {
  THIN: 'linestyle_thin',
  MEDIUM: 'linestyle_medium',
  THICK: 'linestyle_thick',
  HIDDEN: 'linestyle_hidden',
  CENTER: 'linestyle_center',
  CUT: 'linestyle_cut',
  PROJECTION: 'linestyle_projection',
  SKETCH: 'linestyle_sketch',
} as const;

export type BuiltInLineStyleId =
  (typeof BUILTIN_LINE_STYLE_IDS)[keyof typeof BUILTIN_LINE_STYLE_IDS];

/** i18n key prefix for built-in style names — see `dxf-viewer-shell.json`. */
const NAME_KEY_PREFIX = 'ribbon.commands.lineStyleNames';

/** Build a built-in template — pen color always ByLayer (Revit convention). */
function builtIn(
  id: BuiltInLineStyleId,
  nameSlug: string,
  lineweight: number,
  pattern: string,
  category: 'drafting' | 'cut',
): LineStyle {
  return {
    id,
    name: `${NAME_KEY_PREFIX}.${nameSlug}`,
    penColor: LINE_STYLE_BYLAYER_PEN,
    lineweight,
    pattern,
    category,
    isBuiltIn: true,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Default catalog — Λεπτή · Μεσαία · Χοντρή · Κρυφή · Κεντρική · Τομής · Όψης · Πρόχειρη
// ──────────────────────────────────────────────────────────────────────────────

export const BUILTIN_LINE_STYLES: readonly LineStyle[] = [
  builtIn(BUILTIN_LINE_STYLE_IDS.THIN, 'thin', 0.13, 'Continuous', 'drafting'),
  builtIn(BUILTIN_LINE_STYLE_IDS.MEDIUM, 'medium', 0.25, 'Continuous', 'drafting'),
  builtIn(BUILTIN_LINE_STYLE_IDS.THICK, 'thick', 0.5, 'Continuous', 'drafting'),
  builtIn(BUILTIN_LINE_STYLE_IDS.HIDDEN, 'hidden', 0.18, 'Hidden', 'drafting'),
  builtIn(BUILTIN_LINE_STYLE_IDS.CENTER, 'center', 0.13, 'Center', 'drafting'),
  builtIn(BUILTIN_LINE_STYLE_IDS.CUT, 'cut', 0.5, 'Continuous', 'cut'),
  builtIn(BUILTIN_LINE_STYLE_IDS.PROJECTION, 'projection', 0.18, 'Continuous', 'drafting'),
  builtIn(BUILTIN_LINE_STYLE_IDS.SKETCH, 'sketch', 0.09, 'Continuous', 'drafting'),
] as const;

/** Default active style for new work — Greek architectural mid-weight default. */
export const DEFAULT_ACTIVE_LINE_STYLE_ID: BuiltInLineStyleId =
  BUILTIN_LINE_STYLE_IDS.MEDIUM;
