/**
 * ADR-363 Phase 4 — Column contextual ribbon command-key registry.
 *
 * Centralizes τα `commandKey` strings που μοιράζονται μεταξύ ribbon data
 * declaration (`contextual-column-tab.ts`) και bridge mappings
 * (`useRibbonColumnBridge`). Mirrors `SLAB_RIBBON_KEYS` /
 * `OPENING_RIBBON_KEYS` pattern.
 */

export const COLUMN_RIBBON_KEYS = {
  stringParams: {
    /** Column kind selector (7 options: rectangular/circular/L-shape/T-shape/polygon/shear-wall/I-shape). */
    kind: 'column.params.kind',
    /** 9-position anchor selector. */
    anchor: 'column.params.anchor',
    /** ADR-363 Phase 4.5d — material library ID (4 options: rc/steel/masonry/wood). */
    material: 'column.params.material',
    /** ADR-363 Phase 8E — catalog profile ID (e.g. 'IPE-300', 'C25/30', or 'custom' sentinel). */
    catalogProfile: 'column.params.catalogProfile',
    /** ADR-396 v2 Φ6a — ETICS envelope-function override (auto/exterior/interior). */
    envelopeFunction: 'column.params.envelopeFunction',
  },
  params: {
    /** mm — column width (διάμετρος αν circular). */
    width: 'column.params.width',
    /** mm — column depth (αγνοείται αν circular). */
    depth: 'column.params.depth',
    /** mm — storey height. */
    height: 'column.params.height',
    /** deg — rotation around anchor (αγνοείται αν circular). */
    rotation: 'column.params.rotation',
    /** ADR-363 Phase 8D — polygon sides (3-12, only meaningful αν kind='polygon'). */
    sides: 'column.params.sides',
    /** ADR-363 Phase 8D — I-shape flange thickness (mm, only meaningful αν kind='I-shape'). */
    flangeThickness: 'column.params.flangeThickness',
    /** ADR-363 Phase 8D — I-shape web thickness (mm, only meaningful αν kind='I-shape'). */
    webThickness: 'column.params.webThickness',
  },
} as const;

export type ColumnRibbonNumberCommandKey =
  | typeof COLUMN_RIBBON_KEYS.params.width
  | typeof COLUMN_RIBBON_KEYS.params.depth
  | typeof COLUMN_RIBBON_KEYS.params.height
  | typeof COLUMN_RIBBON_KEYS.params.rotation
  | typeof COLUMN_RIBBON_KEYS.params.sides
  | typeof COLUMN_RIBBON_KEYS.params.flangeThickness
  | typeof COLUMN_RIBBON_KEYS.params.webThickness;

export type ColumnRibbonStringCommandKey =
  | typeof COLUMN_RIBBON_KEYS.stringParams.kind
  | typeof COLUMN_RIBBON_KEYS.stringParams.anchor
  | typeof COLUMN_RIBBON_KEYS.stringParams.material
  | typeof COLUMN_RIBBON_KEYS.stringParams.catalogProfile
  | typeof COLUMN_RIBBON_KEYS.stringParams.envelopeFunction;

export const COLUMN_RIBBON_NUMBER_KEYS: readonly ColumnRibbonNumberCommandKey[] = [
  COLUMN_RIBBON_KEYS.params.width,
  COLUMN_RIBBON_KEYS.params.depth,
  COLUMN_RIBBON_KEYS.params.height,
  COLUMN_RIBBON_KEYS.params.rotation,
  COLUMN_RIBBON_KEYS.params.sides,
  COLUMN_RIBBON_KEYS.params.flangeThickness,
  COLUMN_RIBBON_KEYS.params.webThickness,
];

export const COLUMN_RIBBON_STRING_KEYS: readonly ColumnRibbonStringCommandKey[] = [
  COLUMN_RIBBON_KEYS.stringParams.kind,
  COLUMN_RIBBON_KEYS.stringParams.anchor,
  COLUMN_RIBBON_KEYS.stringParams.material,
  COLUMN_RIBBON_KEYS.stringParams.catalogProfile,
  COLUMN_RIBBON_KEYS.stringParams.envelopeFunction,
];

export const COLUMN_RIBBON_KEYS_ACTIONS = {
  close: 'column.actions.close',
  delete: 'column.actions.delete',
  // ADR-401 Phase F.3 — manual detach of column top/base from its structural host.
  detachTop: 'column.actions.detachTop',
  detachBase: 'column.actions.detachBase',
} as const;

const COLUMN_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(COLUMN_RIBBON_KEYS_ACTIONS),
);

export function isColumnActionKey(action: string): boolean {
  return COLUMN_ACTION_KEY_SET.has(action);
}

/** Visibility key (red badge when `validation.hasCodeViolations === true`). */
export const COLUMN_RIBBON_BADGE_KEYS = {
  violations: 'column.badge.violations',
} as const;

/**
 * ADR-363 Phase 8D/8E — panel visibility keys (ADR-358 Phase 7b2b-β pattern).
 *   - `polygonParams`:      visible iff `params.kind === 'polygon'` — surfaces sides input.
 *   - `ishapeParams`:       visible iff `params.kind === 'I-shape'` — surfaces flange + web thickness inputs.
 *   - `shearWallCatalog`:   visible iff `params.kind === 'shear-wall'` — RC concrete catalog dropdown.
 *   - `ishapeCatalog`:      visible iff `params.kind === 'I-shape'` — IPE/HEA catalog dropdown.
 */
export const COLUMN_RIBBON_VISIBILITY_KEYS = {
  polygonParams:    'column.visibility.polygonParams',
  ishapeParams:     'column.visibility.ishapeParams',
  shearWallCatalog: 'column.visibility.shearWallCatalog',
  ishapeCatalog:    'column.visibility.ishapeCatalog',
} as const;

export type ColumnRibbonVisibilityKey =
  | typeof COLUMN_RIBBON_VISIBILITY_KEYS.polygonParams
  | typeof COLUMN_RIBBON_VISIBILITY_KEYS.ishapeParams
  | typeof COLUMN_RIBBON_VISIBILITY_KEYS.shearWallCatalog
  | typeof COLUMN_RIBBON_VISIBILITY_KEYS.ishapeCatalog;

const COLUMN_VISIBILITY_KEY_SET: ReadonlySet<string> = new Set<string>([
  COLUMN_RIBBON_VISIBILITY_KEYS.polygonParams,
  COLUMN_RIBBON_VISIBILITY_KEYS.ishapeParams,
  COLUMN_RIBBON_VISIBILITY_KEYS.shearWallCatalog,
  COLUMN_RIBBON_VISIBILITY_KEYS.ishapeCatalog,
]);

export function isColumnVisibilityKey(key: string): key is ColumnRibbonVisibilityKey {
  return COLUMN_VISIBILITY_KEY_SET.has(key);
}

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

const COLUMN_NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>(COLUMN_RIBBON_NUMBER_KEYS);
const COLUMN_STRING_KEY_SET: ReadonlySet<string> = new Set<string>(COLUMN_RIBBON_STRING_KEYS);

export function isColumnRibbonKey(commandKey: string): boolean {
  return COLUMN_NUMBER_KEY_SET.has(commandKey);
}

export function isColumnRibbonStringKey(commandKey: string): boolean {
  return COLUMN_STRING_KEY_SET.has(commandKey);
}
