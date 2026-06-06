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

// ============================================================================
// SPECIFIC HEAT CAPACITY (cp) & DENSITY (ρ) — ADR-396 P10 SSoT
// ============================================================================

/**
 * Ειδική θερμοχωρητικότητα cp (J/kgK) ανά preset υλικό.
 * Τιμές: EN ISO 10456 / ΤΟΤΕΕ 20701-2. IFC4: `Pset_MaterialThermal.SpecificHeatCapacity`.
 * Υλικά χωρίς θερμική σημασία (vapor barrier, tile κ.λπ.) παραλείπονται.
 */
export const WALL_MATERIAL_SPECIFIC_HEAT: Partial<Record<WallMaterialPresetId, number>> = {
  'mat-concrete-c20':     840,
  'mat-concrete-c25':     840,
  'mat-concrete-c30':     840,
  'mat-concrete-block':   840,
  'mat-brick-masonry':    840,
  'mat-stone-masonry':    840,
  'mat-eps':             1500,
  'mat-eps-graphite':    1500,
  'mat-xps':             1500,
  'mat-mineral-wool':    1030,
  'mat-plaster-ext':     1000,
  'mat-plaster-int':     1000,
  'mat-plaster-thermal': 1000,
  'mat-gypsum-board':    1090,
  'mat-osb':             1700,
};

/**
 * Πυκνότητα ρ (kg/m³) ανά preset υλικό.
 * Τιμές: EN ISO 10456 / ΤΟΤΕΕ 20701-2. IFC4: `Pset_MaterialCommon.MassDensity`.
 */
export const WALL_MATERIAL_DENSITY: Partial<Record<WallMaterialPresetId, number>> = {
  'mat-concrete-c20':     2300,
  'mat-concrete-c25':     2400,
  'mat-concrete-c30':     2500,
  'mat-concrete-block':   1200,
  'mat-brick-masonry':    1800,
  'mat-stone-masonry':    2200,
  'mat-eps':               15,
  'mat-eps-graphite':      15,
  'mat-xps':               30,
  'mat-mineral-wool':      30,
  'mat-plaster-ext':      1800,
  'mat-plaster-int':      1200,
  'mat-plaster-thermal':   400,
  'mat-gypsum-board':      900,
  'mat-osb':               650,
};

/** cp (J/kgK) ή `undefined` αν άγνωστο. */
export function getSpecificHeat(materialId: string | undefined): number | undefined {
  if (!materialId) return undefined;
  return WALL_MATERIAL_SPECIFIC_HEAT[materialId as WallMaterialPresetId];
}

/** ρ (kg/m³) ή `undefined` αν άγνωστο. */
export function getDensity(materialId: string | undefined): number | undefined {
  if (!materialId) return undefined;
  return WALL_MATERIAL_DENSITY[materialId as WallMaterialPresetId];
}
