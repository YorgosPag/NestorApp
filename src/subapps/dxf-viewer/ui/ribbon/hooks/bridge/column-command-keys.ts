/**
 * ADR-363 Phase 4 — Column contextual ribbon command-key registry.
 *
 * Centralizes τα `commandKey` strings που μοιράζονται μεταξύ ribbon data
 * declaration (`contextual-column-tab.ts`) και bridge mappings
 * (`useRibbonColumnBridge`). Mirrors `SLAB_RIBBON_KEYS` /
 * `OPENING_RIBBON_KEYS` pattern.
 */

import type { FinishParamField } from './finish-param';

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
    /** ADR-363 Phase 2b — U-shape (Π) leg thickness (mm, only meaningful αν kind='U-shape' χωρίς polygon). */
    legThickness: 'column.params.legThickness',
    /** ADR-363 Phase 2b — U-shape (Π) base thickness (mm, only meaningful αν kind='U-shape' χωρίς polygon). */
    baseThickness: 'column.params.baseThickness',
  },
} as const;

export type ColumnRibbonNumberCommandKey =
  | typeof COLUMN_RIBBON_KEYS.params.width
  | typeof COLUMN_RIBBON_KEYS.params.depth
  | typeof COLUMN_RIBBON_KEYS.params.height
  | typeof COLUMN_RIBBON_KEYS.params.rotation
  | typeof COLUMN_RIBBON_KEYS.params.sides
  | typeof COLUMN_RIBBON_KEYS.params.flangeThickness
  | typeof COLUMN_RIBBON_KEYS.params.webThickness
  | typeof COLUMN_RIBBON_KEYS.params.legThickness
  | typeof COLUMN_RIBBON_KEYS.params.baseThickness;

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
  COLUMN_RIBBON_KEYS.params.legThickness,
  COLUMN_RIBBON_KEYS.params.baseThickness,
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
  // ADR-441 Slice GEN-COL / 3-mode — «Κολώνες από κάναβο». main = inner (default)·
  // variants = περιμετρική έδραση anchor (Εσωτερικά/Κεντρικά/Εξωτερικά).
  fromGrid: 'column.actions.fromGrid',
  fromGridCenter: 'column.actions.fromGridCenter',
  fromGridOuter: 'column.actions.fromGridOuter',
  // ADR-456 Slice 2 — «Auto οπλισμός»: code-suggested ελάχιστος-έγκυρος οπλισμός.
  autoReinforce: 'column.actions.autoReinforce',
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
  // ADR-363 Phase 2b — visible iff `kind === 'U-shape'` ΚΑΙ δεν υπάρχει polygon
  // (manual παραμετρικό Π· polygon-backed επεξεργάζεται με per-vertex grips).
  ushapeParams:     'column.visibility.ushapeParams',
  // ADR-456 Slice 2 — δομοστατικά/οπλισμός panel: visible iff RC kind
  // (rectangular/shear-wall — ο ρ-έλεγχος Slice 1 καλύπτει μόνο αυτές).
  structural:       'column.visibility.structural',
} as const;

export type ColumnRibbonVisibilityKey =
  | typeof COLUMN_RIBBON_VISIBILITY_KEYS.polygonParams
  | typeof COLUMN_RIBBON_VISIBILITY_KEYS.ishapeParams
  | typeof COLUMN_RIBBON_VISIBILITY_KEYS.shearWallCatalog
  | typeof COLUMN_RIBBON_VISIBILITY_KEYS.ishapeCatalog
  | typeof COLUMN_RIBBON_VISIBILITY_KEYS.ushapeParams
  | typeof COLUMN_RIBBON_VISIBILITY_KEYS.structural;

const COLUMN_VISIBILITY_KEY_SET: ReadonlySet<string> = new Set<string>([
  COLUMN_RIBBON_VISIBILITY_KEYS.polygonParams,
  COLUMN_RIBBON_VISIBILITY_KEYS.ishapeParams,
  COLUMN_RIBBON_VISIBILITY_KEYS.shearWallCatalog,
  COLUMN_RIBBON_VISIBILITY_KEYS.ishapeCatalog,
  COLUMN_RIBBON_VISIBILITY_KEYS.ushapeParams,
  COLUMN_RIBBON_VISIBILITY_KEYS.structural,
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

// ─── ADR-449 Slice 5 — structural finish (σοβάς) per-element override ──────────

/** Command keys για τα 4 finish πεδία της κολόνας (enabled/υλικά/πάχος). */
export const COLUMN_FINISH_KEYS = {
  enabled: 'column.params.finish.enabled',
  interiorMaterialId: 'column.params.finish.interiorMaterialId',
  exteriorMaterialId: 'column.params.finish.exteriorMaterialId',
  thickness: 'column.params.finish.thickness',
} as const;

/** commandKey → πεδίο του `StructuralFinishSpec` (καταναλώνεται από finish-param helpers). */
export const COLUMN_FINISH_KEY_TO_FIELD: Readonly<Record<string, FinishParamField>> = {
  [COLUMN_FINISH_KEYS.enabled]: 'enabled',
  [COLUMN_FINISH_KEYS.interiorMaterialId]: 'interiorMaterialId',
  [COLUMN_FINISH_KEYS.exteriorMaterialId]: 'exteriorMaterialId',
  [COLUMN_FINISH_KEYS.thickness]: 'thickness',
};

const COLUMN_FINISH_KEY_SET: ReadonlySet<string> = new Set<string>(Object.keys(COLUMN_FINISH_KEY_TO_FIELD));

export function isColumnFinishKey(commandKey: string): boolean {
  return COLUMN_FINISH_KEY_SET.has(commandKey);
}

// ─── ADR-456 Slice 2 — δομοστατικά / οπλισμός (reinforcement) ──────────────────

/**
 * Editable structural command keys. `code` = building-level κανονισμός (γράφει
 * στο `structuralSettingsStore`, ΟΧΙ στην κολώνα)· `concreteGrade` = per-element·
 * τα υπόλοιπα 6 = αριθμητικά πεδία οπλισμού (διαμήκης/συνδετήρες/επικάλυψη).
 */
export const COLUMN_STRUCTURAL_KEYS = {
  /** Building-level κανονισμός σχεδιασμού (project setting, ΟΧΙ per-column). */
  code: 'column.structural.code',
  /** Κατηγορία σκυροδέματος (per-element, EN 1992-1-1 Table 3.1). */
  concreteGrade: 'column.structural.concreteGrade',
  /** Διαμήκης οπλισμός — διάμετρος ράβδου (mm). */
  longitudinalDiameter: 'column.structural.longitudinalDiameter',
  /** Διαμήκης οπλισμός — πλήθος ράβδων. */
  longitudinalCount: 'column.structural.longitudinalCount',
  /** Συνδετήρες — διάμετρος (mm). */
  stirrupDiameter: 'column.structural.stirrupDiameter',
  /** Συνδετήρες — βήμα μεσαίας (μη-κρίσιμης) ζώνης (mm). */
  stirrupSpacing: 'column.structural.stirrupSpacing',
  /** Συνδετήρες — κρίσιμο βήμα πύκνωσης άκρων (mm). */
  stirrupCriticalSpacing: 'column.structural.stirrupCriticalSpacing',
  /** Επικάλυψη οπλισμού cnom (mm). */
  cover: 'column.structural.cover',
} as const;

/** Read-only readout keys — υπολογισμένα βάρη/ρ% (bridge δίνει value, ΟΧΙ write). */
export const COLUMN_STRUCTURAL_READOUT_KEYS = {
  /** kg — βάρος σκυροδέματος. */
  concreteWeight: 'column.structural.readout.concreteWeight',
  /** kg — βάρος χάλυβα οπλισμού B500C. */
  steelWeight: 'column.structural.readout.steelWeight',
  /** % — ποσοστό διαμήκους οπλισμού ρ = As/Ac. */
  ratio: 'column.structural.readout.ratio',
} as const;

/** Πεδίο του `ColumnReinforcement` που χειρίζεται ένα αριθμητικό structural key. */
export type StructuralReinforcementField =
  | 'longitudinalDiameter'
  | 'longitudinalCount'
  | 'stirrupDiameter'
  | 'stirrupSpacing'
  | 'stirrupCriticalSpacing'
  | 'cover';

/** commandKey → πεδίο οπλισμού (καταναλώνεται από structural-param helpers). */
export const COLUMN_STRUCTURAL_KEY_TO_FIELD: Readonly<Record<string, StructuralReinforcementField>> = {
  [COLUMN_STRUCTURAL_KEYS.longitudinalDiameter]: 'longitudinalDiameter',
  [COLUMN_STRUCTURAL_KEYS.longitudinalCount]: 'longitudinalCount',
  [COLUMN_STRUCTURAL_KEYS.stirrupDiameter]: 'stirrupDiameter',
  [COLUMN_STRUCTURAL_KEYS.stirrupSpacing]: 'stirrupSpacing',
  [COLUMN_STRUCTURAL_KEYS.stirrupCriticalSpacing]: 'stirrupCriticalSpacing',
  [COLUMN_STRUCTURAL_KEYS.cover]: 'cover',
};

const COLUMN_STRUCTURAL_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(COLUMN_STRUCTURAL_KEYS),
);
const COLUMN_STRUCTURAL_READOUT_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(COLUMN_STRUCTURAL_READOUT_KEYS),
);

export function isColumnStructuralKey(commandKey: string): boolean {
  return COLUMN_STRUCTURAL_KEY_SET.has(commandKey);
}

export function isColumnStructuralReadoutKey(commandKey: string): boolean {
  return COLUMN_STRUCTURAL_READOUT_KEY_SET.has(commandKey);
}
