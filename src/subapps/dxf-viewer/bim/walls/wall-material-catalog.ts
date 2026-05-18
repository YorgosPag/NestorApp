/**
 * ADR-363 Phase 1D — Wall Material Catalog SSoT (stub for DNA editor).
 *
 * Mirrors `stair-material-catalog.ts` (ADR-358 Phase 7b2a). Industry pattern:
 * categorized material library picker + custom override. Nestor has no
 * material catalog SSoT yet (Phase 6+ Asset Manager backed by Firestore) —
 * this module exposes hardcoded presets covering the common wall-layer
 * materials (concrete/masonry/insulation/plaster/cladding) plus a
 * `MaterialCatalogProvider` interface that Phase 6+ will swap.
 *
 * Material IDs persisted on `WallDnaLayer.materialId`. Preset IDs match
 * i18n key suffixes under `dxf-viewer-shell:wallAdvancedPanel.materials.preset.*`.
 *
 * `'custom'` is the sentinel that triggers free-form text input; when the
 * user types a custom name the persisted value is the typed string (NOT
 * `'custom'`), so a future swap to a real catalog can detect unknown IDs
 * and surface a "legacy/free-form" badge.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3 §6 Phase 1D
 */

export const WALL_MATERIAL_PRESET_IDS = [
  'mat-concrete-c20',
  'mat-concrete-c25',
  'mat-concrete-c30',
  'mat-brick-masonry',
  'mat-stone-masonry',
  'mat-concrete-block',
  'mat-eps',
  'mat-xps',
  'mat-mineral-wool',
  'mat-plaster-int',
  'mat-plaster-ext',
  'mat-plaster-thermal',
  'mat-gypsum-board',
  'mat-osb',
  'mat-vapor-barrier',
  'mat-tile',
  'mat-marble',
  'mat-aluminum-cladding',
] as const;

export type WallMaterialPresetId = (typeof WALL_MATERIAL_PRESET_IDS)[number];

export const WALL_MATERIAL_CUSTOM_ID = 'custom' as const;
export type WallMaterialCustomId = typeof WALL_MATERIAL_CUSTOM_ID;

export interface WallMaterialOption {
  /** Stable persisted ID (preset slug) or `'custom'` sentinel. */
  readonly id: WallMaterialPresetId | WallMaterialCustomId;
  /** i18n key suffix under `wallAdvancedPanel.materials.preset.<suffix>`. */
  readonly labelKeySuffix: WallMaterialPresetId | WallMaterialCustomId;
}

export interface WallMaterialCatalogProvider {
  readonly listMaterialIds: () => readonly WallMaterialOption[];
  readonly resolvePreset: (id: string | undefined) => WallMaterialPresetId | null;
}

const WALL_MATERIAL_OPTIONS: readonly WallMaterialOption[] = [
  ...WALL_MATERIAL_PRESET_IDS.map((id) => ({ id, labelKeySuffix: id })),
  { id: WALL_MATERIAL_CUSTOM_ID, labelKeySuffix: WALL_MATERIAL_CUSTOM_ID },
];

const PRESET_SET: ReadonlySet<string> = new Set<string>(WALL_MATERIAL_PRESET_IDS);

export const defaultWallMaterialCatalog: WallMaterialCatalogProvider = {
  listMaterialIds: () => WALL_MATERIAL_OPTIONS,
  resolvePreset: (id) => {
    if (!id) return null;
    return PRESET_SET.has(id) ? (id as WallMaterialPresetId) : null;
  },
};

export type WallMaterialKind = 'preset' | 'custom' | 'empty';

export function classifyWallMaterial(
  id: string | undefined,
  catalog: WallMaterialCatalogProvider = defaultWallMaterialCatalog,
): WallMaterialKind {
  if (id === undefined || id === '') return 'empty';
  return catalog.resolvePreset(id) === null ? 'custom' : 'preset';
}
