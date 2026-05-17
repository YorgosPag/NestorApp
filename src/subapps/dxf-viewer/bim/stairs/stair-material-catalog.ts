/**
 * ADR-358 Phase 7b2a — Stair Material Catalog SSoT.
 *
 * Industry convergence (Revit/ArchiCAD/Vectorworks/AutoCAD Arch/Allplan):
 * categorized material library picker + custom override. Nestor has no
 * material catalog SSoT yet — this module exposes 10 hardcoded presets +
 * a `MaterialCatalogProvider` interface that Phase 9+ can swap with a
 * real Asset Manager backed by Firestore.
 *
 * Material IDs are stable strings persisted on `StairParams.materials.*`
 * and `StairParams.perTreadOverrides[i].material`. Preset values match
 * `i18n key suffixes` in `dxf-viewer-shell:stairAdvancedPanel.materials.preset.*`.
 *
 * `'custom'` is the sentinel that triggers free-form text input in the UI;
 * when the user types a custom name the value persisted is the typed
 * string (NOT `'custom'`), so future swaps to a real catalog can detect
 * unknown IDs and surface a "legacy/free-form" badge.
 */

export const STAIR_MATERIAL_PRESET_IDS = [
  'oak',
  'walnut',
  'marble',
  'granite',
  'concrete',
  'steel',
  'glass',
  'terrazzo',
  'tile',
] as const;

export type StairMaterialPresetId = (typeof STAIR_MATERIAL_PRESET_IDS)[number];

export const STAIR_MATERIAL_CUSTOM_ID = 'custom' as const;
export type StairMaterialCustomId = typeof STAIR_MATERIAL_CUSTOM_ID;

export interface StairMaterialOption {
  /** Stable persisted ID (preset slug) or `'custom'` sentinel. */
  readonly id: StairMaterialPresetId | StairMaterialCustomId;
  /** i18n key suffix (resolved by caller via `t('stairAdvancedPanel.materials.preset.<suffix>')`). */
  readonly labelKeySuffix: StairMaterialPresetId | StairMaterialCustomId;
}

/**
 * Industry-standard provider abstraction — Phase 9 swap target.
 * Real implementation will read from `materials_catalog` Firestore collection
 * scoped to `companyId` + `projectId` (Asset Manager pattern, Revit/ArchiCAD-aligned).
 */
export interface MaterialCatalogProvider {
  /** Returns all selectable material IDs in display order. */
  readonly listMaterialIds: () => readonly StairMaterialOption[];
  /** Resolves a persisted ID to its preset entry, or `null` if the ID is free-form (legacy/custom). */
  readonly resolvePreset: (id: string | undefined) => StairMaterialPresetId | null;
}

const STAIR_MATERIAL_OPTIONS: readonly StairMaterialOption[] = [
  ...STAIR_MATERIAL_PRESET_IDS.map((id) => ({
    id,
    labelKeySuffix: id,
  })),
  { id: STAIR_MATERIAL_CUSTOM_ID, labelKeySuffix: STAIR_MATERIAL_CUSTOM_ID },
];

const PRESET_SET: ReadonlySet<string> = new Set<string>(STAIR_MATERIAL_PRESET_IDS);

export const defaultStairMaterialCatalog: MaterialCatalogProvider = {
  listMaterialIds: () => STAIR_MATERIAL_OPTIONS,
  resolvePreset: (id) => {
    if (!id) return null;
    return PRESET_SET.has(id) ? (id as StairMaterialPresetId) : null;
  },
};

/**
 * Classifies a persisted material ID for UI rendering:
 * - `preset` — render the localized preset label in the combobox value slot
 * - `custom` — render the free-form text input pre-filled with the raw string
 * - `empty` — no material set (inherit / null)
 */
export type StairMaterialKind = 'preset' | 'custom' | 'empty';

export function classifyStairMaterial(
  id: string | undefined,
  catalog: MaterialCatalogProvider = defaultStairMaterialCatalog,
): StairMaterialKind {
  if (id === undefined || id === '') return 'empty';
  return catalog.resolvePreset(id) === null ? 'custom' : 'preset';
}
