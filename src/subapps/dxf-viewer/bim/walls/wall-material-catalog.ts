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
  'mat-eps-graphite',
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

// ============================================================================
// THERMAL CONDUCTIVITY (λ) — ADR-396 P8 SSoT (§3.2b)
// ============================================================================

/**
 * Θερμική αγωγιμότητα λ (W/mK) ανά preset υλικό. SSoT για τον υπολογισμό
 * U-value (ETICS θερμοπρόσοψη — ADR-396 P8) + μελλοντικό IFC `Pset_MaterialThermal`
 * (P9). Τιμές αντιπροσωπευτικές (ΤΟΤΕΕ 20701-2 / EN ISO 10456). Υλικά χωρίς
 * θερμική σημασία (vapor barrier, tile, marble, osb, cladding) παραλείπονται.
 */
export const WALL_MATERIAL_LAMBDA: Partial<Record<WallMaterialPresetId, number>> = {
  // Μονωτικά (ETICS + cavity core)
  'mat-eps-graphite': 0.031, // γραφιτούχα EPS (Neopor)
  'mat-xps': 0.034, // εξηλασμένη πολυστερίνη
  'mat-eps': 0.035, // διογκωμένη πολυστερίνη
  'mat-mineral-wool': 0.035, // ορυκτοβάμβακας
  'mat-plaster-thermal': 0.09, // θερμομονωτικό επίχρισμα
  // Φέρων / πλήρωση
  'mat-concrete-c20': 2.0,
  'mat-concrete-c25': 2.0,
  'mat-concrete-c30': 2.0,
  'mat-concrete-block': 1.0,
  'mat-brick-masonry': 0.51, // οπτοπλινθοδομή
  'mat-stone-masonry': 2.0, // λιθοδομή
  // Επιχρίσματα / επενδύσεις
  'mat-plaster-ext': 0.87, // εξωτ. σοβάς
  'mat-plaster-int': 0.7, // εσωτ. σοβάς
  'mat-gypsum-board': 0.25, // γυψοσανίδα
};

/**
 * Επιστρέφει τη θερμική αγωγιμότητα λ (W/mK) ενός υλικού, ή `undefined` αν
 * δεν είναι γνωστό preset (custom / άγνωστο → ο caller αποφασίζει fallback).
 */
export function getThermalConductivityLambda(
  materialId: string | undefined,
): number | undefined {
  if (!materialId) return undefined;
  return WALL_MATERIAL_LAMBDA[materialId as WallMaterialPresetId];
}
