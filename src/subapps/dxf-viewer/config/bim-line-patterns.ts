/**
 * ADR-377 — BIM Line Patterns
 *
 * AutoCAD acad.lin–compatible set (28 built-in patterns) + custom user-defined.
 * Used in SubcategoryStyle.linePattern for per-subcategory line pattern overrides.
 *
 * `BIM_LINE_PATTERNS` (key list) + `LinePatternKey` (type) remain the canonical
 * BIM pattern identifiers (UI dropdowns, SubcategoryStyle, V/G overrides).
 *
 * ⚠️ ADR-510 Φ2C — pattern DATA is now unified in `config/linetype-iso-catalog.ts`
 * (mm, zoom-scaled). Renderers resolve via `config/bim-dash-resolver.ts`
 * (`bimDashPx`/`bimDashMm`), NOT via the px arrays below. `BUILT_IN_DASH_ARRAYS`
 * + `linePatternToDashArray` are @deprecated (legacy fixed-px reference, kept for
 * back-compat + custom-pattern Map). Do NOT add new consumers — use the catalog.
 */

export const BIM_LINE_PATTERNS = [
  'solid',
  // Dashed variants (3×)
  'dashed', 'dashed2', 'dashedX2',
  // Dotted variants (3×)
  'dotted', 'dotted2', 'dottedX2',
  // Center — long dash + short dash (3×)
  'center', 'center2', 'centerX2',
  // Hidden — dense short dashes (3×)
  'hidden', 'hidden2', 'hiddenX2',
  // Dash-dot (3×)
  'dashdot', 'dashdot2', 'dashdotX2',
  // Divide — dash + 2 dots (3×)
  'divide', 'divide2', 'divideX2',
  // Phantom — long dash + 2 short dashes (3×)
  'phantom', 'phantom2', 'phantomX2',
  // Border — 2 dashes + 1 dot (3×)
  'border', 'border2', 'borderX2',
  // Specials
  'double',  // alternating double-dash
  'dot',     // pure point marks
  'zigzag',  // insulation/batting
] as const;

export type LinePatternKey =
  | typeof BIM_LINE_PATTERNS[number]
  | `custom_${string}`;

/**
 * Stroke arrays for each built-in pattern. Values are pixel units (96-dpi).
 * @deprecated ADR-510 Φ2C — superseded by `linetype-iso-catalog.ts` (mm) +
 * `bim-dash-resolver.ts`. Kept for back-compat + tests; not used by renderers.
 */
export const BUILT_IN_DASH_ARRAYS: Readonly<
  Record<typeof BIM_LINE_PATTERNS[number], ReadonlyArray<number>>
> = {
  solid:      [],
  dashed:     [8, 4],
  dashed2:    [4, 2],
  dashedX2:   [16, 8],
  dotted:     [2, 4],
  dotted2:    [1, 2],
  dottedX2:   [4, 8],
  center:     [20, 6, 4, 6],
  center2:    [10, 3, 2, 3],
  centerX2:   [40, 12, 8, 12],
  hidden:     [4, 2],
  hidden2:    [2, 2],
  hiddenX2:   [8, 4],
  dashdot:    [12, 4, 2, 4],
  dashdot2:   [6, 2, 1, 2],
  dashdotX2:  [24, 8, 4, 8],
  divide:     [12, 4, 2, 4, 2, 4],
  divide2:    [6, 2, 1, 2, 1, 2],
  divideX2:   [24, 8, 4, 8, 4, 8],
  phantom:    [20, 4, 4, 4, 4, 4],
  phantom2:   [10, 2, 2, 2, 2, 2],
  phantomX2:  [40, 8, 8, 8, 8, 8],
  border:     [12, 4, 4, 4, 2, 4],
  border2:    [6, 2, 2, 2, 1, 2],
  borderX2:   [24, 8, 8, 8, 4, 8],
  double:     [8, 2, 4, 2],
  dot:        [0, 4],
  zigzag:     [4, 2, 2, 2],
};

export interface CustomLinePattern {
  /** Must start with 'custom_' prefix. */
  key: `custom_${string}`;
  displayName: string;
  strokeArray: ReadonlyArray<number>;
}

/**
 * Resolve a LinePatternKey to a canvas stroke array.
 *
 * built-in key  → BUILT_IN_DASH_ARRAYS lookup (zero allocation).
 * custom_* key  → customPatterns map lookup.
 * unknown/missing custom → [] (solid fallback).
 *
 * @deprecated ADR-510 Φ2C — use `bim-dash-resolver.ts` `bimDashPx(key, scale)`
 * (zoom-scaled) or `bimDashMm(key)` (catalog mm). This returns legacy fixed-px.
 */
export function linePatternToDashArray(
  key: LinePatternKey,
  customPatterns?: Map<string, ReadonlyArray<number>>,
): ReadonlyArray<number> {
  const lookup = (BUILT_IN_DASH_ARRAYS as Record<string, ReadonlyArray<number> | undefined>)[key];
  if (lookup !== undefined) return lookup;
  if (customPatterns !== undefined) {
    const custom = customPatterns.get(key);
    if (custom !== undefined) return custom;
  }
  return [];
}
