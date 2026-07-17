/**
 * Opening Material Catalog SSoT (κάσα/φύλλο/υαλοστάσιο/χειρολαβή surfaces).
 *
 * Mirrors `wall-material-catalog.ts` (ADR-363) / `stair-material-catalog.ts`
 * (ADR-358): one categorized material-library picker per domain + custom
 * override — the Revit/ArchiCAD material-browser pattern. Centralizes the
 * opening-surface preset list that previously lived hardcoded inside
 * `OpeningMaterialSelectCell.tsx` (N.0.2 Boy Scout — SSoT gap closed).
 *
 * Unlike stairs (arbitrary preset slugs), opening surfaces persist REAL ids
 * from the shared `MATERIAL_DEFS` catalog (`material-catalog-defs.ts`): `mat-wood`
 * (κάσα/φύλλο), `mat-metal` (χειρολαβή/αλουμίνιο), `mat-glass` (υαλοστάσιο). A
 * user-library `bmat_*` id (or any other free-form id) still round-trips through
 * the custom text input — the resolver treats every part as an opaque id string.
 *
 * IDs persist on `OpeningMaterials.{frame,leaf,glass,hardware}` (opening-types.ts)
 * and are resolved by `resolveOpeningMaterial`. Preset labels resolve via
 * `t('ribbon.commands.bimFamilyType.<labelKeySuffix>')`.
 *
 * `'custom'` is the sentinel that triggers the free-form text input; the value
 * persisted is the typed string (NOT `'custom'`), so a future swap to a real
 * Asset-Manager provider can detect unknown ids and badge them «legacy/custom».
 *
 * @see bim/family-types/resolve-opening-material.ts — the resolver these ids feed
 * @see bim/walls/wall-material-catalog.ts — sibling catalog idiom
 */

/** Opening-surface `mat-*` ids already registered in `MATERIAL_DEFS`. */
export const OPENING_MATERIAL_PRESET_IDS = ['mat-wood', 'mat-metal', 'mat-glass'] as const;

export type OpeningMaterialPresetId = (typeof OPENING_MATERIAL_PRESET_IDS)[number];

export const OPENING_MATERIAL_CUSTOM_ID = 'custom' as const;
export type OpeningMaterialCustomId = typeof OPENING_MATERIAL_CUSTOM_ID;

/** i18n key suffix (under `ribbon.commands.bimFamilyType.`) per preset id. */
const PRESET_LABEL_KEY: Readonly<Record<OpeningMaterialPresetId, string>> = {
  'mat-wood': 'materialPresetWood',
  'mat-metal': 'materialPresetMetal',
  'mat-glass': 'materialPresetGlass',
};

export interface OpeningMaterialOption {
  /** Stable persisted id (`mat-*`) or the `'custom'` sentinel. */
  readonly id: OpeningMaterialPresetId | OpeningMaterialCustomId;
  /** i18n key suffix under `ribbon.commands.bimFamilyType.<suffix>`. */
  readonly labelKeySuffix: string;
}

/**
 * Provider abstraction — the Asset-Manager swap seam (mirrors wall/stair). The
 * real implementation will list `bmat_*` user-library ids from the
 * `companyId`-scoped material registry alongside the base presets.
 */
export interface OpeningMaterialCatalogProvider {
  /** All selectable options in display order (presets + custom sentinel). */
  readonly listMaterialIds: () => readonly OpeningMaterialOption[];
  /** Resolve a persisted id to its preset, or `null` when free-form (custom/library). */
  readonly resolvePreset: (id: string | undefined) => OpeningMaterialPresetId | null;
}

const OPENING_MATERIAL_OPTIONS: readonly OpeningMaterialOption[] = [
  ...OPENING_MATERIAL_PRESET_IDS.map((id) => ({ id, labelKeySuffix: PRESET_LABEL_KEY[id] })),
  { id: OPENING_MATERIAL_CUSTOM_ID, labelKeySuffix: 'materialPresetCustom' },
];

const PRESET_SET: ReadonlySet<string> = new Set<string>(OPENING_MATERIAL_PRESET_IDS);

export const defaultOpeningMaterialCatalog: OpeningMaterialCatalogProvider = {
  listMaterialIds: () => OPENING_MATERIAL_OPTIONS,
  resolvePreset: (id) => {
    if (!id) return null;
    return PRESET_SET.has(id) ? (id as OpeningMaterialPresetId) : null;
  },
};

/**
 * Classifies a persisted opening-material id for UI rendering:
 * - `preset` — render the localized preset label in the select value slot
 * - `custom` — render the free-form text input pre-filled with the raw string
 * - `empty`  — no material set (cleared → part falls back to resolver default)
 */
export type OpeningMaterialKind = 'preset' | 'custom' | 'empty';

export function classifyOpeningMaterial(
  id: string | undefined,
  catalog: OpeningMaterialCatalogProvider = defaultOpeningMaterialCatalog,
): OpeningMaterialKind {
  if (id === undefined || id === '') return 'empty';
  return catalog.resolvePreset(id) === null ? 'custom' : 'preset';
}
