/**
 * Linetype Aliases — ADR-510 Φ2 (unified linetype SSoT bridge).
 *
 * ONE input resolver that maps every historical linetype identifier in the app
 * to a canonical `LinetypeDef` from `linetype-iso-catalog.ts` (mm patterns):
 *
 *   - canonical catalog name  ('Dashed', 'Center2', …)  → direct
 *   - legacy settings enum     ('dashed', 'dash-dot', …) → LEGACY_ENUM_TO_LINETYPE
 *   - BIM pattern key (ADR-377)('dashed', 'hiddenX2', …) → BIM_KEY_TO_LINETYPE
 *   - case-insensitive DXF name ('DASHED')               → fallback scan
 *
 * This is the bridge that lets the BIM renderers (px, fixed), the legacy
 * settings/preview path (enum, ×dashScale) and the DXF entity cascade (mm,
 * zoom-scaled) all converge on the SAME metric catalog — eliminating the 3
 * parallel pattern-data definitions.
 *
 * Unknown / `custom_*` inputs return null (the runtime LinetypeRegistry owns
 * custom resolution).
 */

import {
  type LinetypeDef,
  getCatalogLinetype,
  isCatalogLinetype,
  LINETYPE_CATALOG_NAMES,
} from './linetype-iso-catalog';

/**
 * Legacy `LineSettings.lineType` enum (settings-core/defaults.ts `DASH_PATTERNS`)
 * + entity-format enum (`dxf-renderer-entity-model.mapDxfLineTypeToEnterprise`)
 * → canonical catalog name. Both lowercase enums share this map.
 */
export const LEGACY_ENUM_TO_LINETYPE: Readonly<Record<string, string>> = Object.freeze({
  solid: 'Continuous',
  dashed: 'Dashed',
  dotted: 'Dot',
  dashdot: 'DashDot',
  'dash-dot': 'DashDot',
  'dash-dot-dot': 'Divide',
});

/**
 * ADR-377 BIM pattern key (`config/bim-line-patterns.ts` `BIM_LINE_PATTERNS`)
 * → canonical catalog name. Covers all 28 BIM keys.
 */
export const BIM_KEY_TO_LINETYPE: Readonly<Record<string, string>> = Object.freeze({
  solid: 'Continuous',
  dashed: 'Dashed', dashed2: 'Dashed2', dashedX2: 'DashedX2',
  dotted: 'Dot', dotted2: 'Dot2', dottedX2: 'DotX2',
  center: 'Center', center2: 'Center2', centerX2: 'CenterX2',
  hidden: 'Hidden', hidden2: 'Hidden2', hiddenX2: 'HiddenX2',
  dashdot: 'DashDot', dashdot2: 'DashDot2', dashdotX2: 'DashDotX2',
  divide: 'Divide', divide2: 'Divide2', divideX2: 'DivideX2',
  phantom: 'Phantom', phantom2: 'Phantom2', phantomX2: 'PhantomX2',
  border: 'Border', border2: 'Border2', borderX2: 'BorderX2',
  double: 'Double',
  dot: 'Dot',
  zigzag: 'Zigzag',
});

/** Lowercase index of catalog names for case-insensitive DXF resolution. */
const LOWER_TO_CANONICAL: Readonly<Record<string, string>> = Object.freeze(
  LINETYPE_CATALOG_NAMES.reduce<Record<string, string>>((acc, name) => {
    acc[name.toLowerCase()] = name;
    return acc;
  }, {}),
);

/**
 * Resolve ANY linetype identifier (canonical name, legacy enum, BIM key, or
 * case-variant DXF name) to a built-in catalog `LinetypeDef`. Returns null for
 * unknown / `custom_*` names (resolve those via `LinetypeRegistry`).
 */
export function resolveAnyLinetype(input: string | null | undefined): LinetypeDef | null {
  if (!input) return null;
  // 1) Exact canonical catalog name (case-sensitive, AutoCAD convention).
  if (isCatalogLinetype(input)) return getCatalogLinetype(input);
  // 2) BIM pattern key (ADR-377) — exact, case-sensitive (keys carry X2 casing).
  const bim = BIM_KEY_TO_LINETYPE[input];
  if (bim) return getCatalogLinetype(bim);
  // 3) Legacy settings/entity enum (lowercase).
  const legacy = LEGACY_ENUM_TO_LINETYPE[input.toLowerCase()];
  if (legacy) return getCatalogLinetype(legacy);
  // 4) Case-insensitive DXF name fallback ('DASHED' → 'Dashed').
  const ci = LOWER_TO_CANONICAL[input.toLowerCase()];
  if (ci) return getCatalogLinetype(ci);
  return null;
}

/**
 * Resolve any identifier to its mm pattern (positive=dash, negative=gap, 0=dot).
 * Empty array for Continuous OR unknown — callers render a solid line.
 */
export function resolveAnyDashMm(input: string | null | undefined): ReadonlyArray<number> {
  return resolveAnyLinetype(input)?.pattern ?? [];
}
