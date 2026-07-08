/**
 * ADR-363 Phase 5 — Beam contextual ribbon command-key registry.
 *
 * Centralizes τα `commandKey` strings που μοιράζονται μεταξύ ribbon data
 * declaration (`contextual-beam-tab.ts`) και bridge mappings
 * (`useRibbonBeamBridge`). Mirrors `COLUMN_RIBBON_KEYS` pattern.
 */

import type { BeamParams } from '../../../../bim/types/beam-types';
import type { FinishParamField } from './finish-param';
import { makeKeySetGuard } from './make-key-set-guard';

export const BEAM_RIBBON_KEYS = {
  stringParams: {
    /** Beam kind selector (3 options: straight/curved/cantilever). */
    kind: 'beam.params.kind',
    /** Structural support type (simple/fixed/cantilever). */
    supportType: 'beam.params.supportType',
    /** ADR-363 Phase 5.5c — Material picker (rc/steel/glulam). */
    material: 'beam.params.material',
    /** ADR-363 Phase 5.5i+ — Steel section type (I / H). */
    sectionType: 'beam.params.sectionType',
    /** ADR-363 Phase 5.5i+ — Free-text profile designation (e.g. "IPE 300"). */
    profileDesignation: 'beam.params.profileDesignation',
    /** ADR-396 v2 Φ6a — ETICS envelope-function override (auto/exterior/interior). */
    envelopeFunction: 'beam.params.envelopeFunction',
    /** ADR-363 Φ2 — σχήμα διατομής (rectangular / I-shape). */
    sectionKind: 'beam.params.sectionKind',
    /** ADR-363 Φ2 — EN 10365 catalog profile ID (π.χ. 'IPE-300'). */
    catalogProfile: 'beam.params.catalogProfile',
  },
  params: {
    /** mm — beam cross-section width. */
    width: 'beam.params.width',
    /** mm — beam structural depth (cross-section Y). */
    depth: 'beam.params.depth',
    /** mm — top face (top-of-beam) από project origin. ADR-369 §2.2. */
    topElevation: 'beam.params.topElevation',
    /**
     * mm — άνω παρειά στο τέλος (endPoint) της δοκού. ADR-401 Phase E.2.
     * Όταν διαφέρει από `topElevation` → κεκλιμένη δοκός (Revit sloped beam).
     */
    topElevationEnd: 'beam.params.topElevationEnd',
    /** ADR-363 Φ2 — mm. Πάχος πέλματος (tf) — nested `ishape.flangeThickness`. */
    flangeThickness: 'beam.params.flangeThickness',
    /** ADR-363 Φ2 — mm. Πάχος κορμού (tw) — nested `ishape.webThickness`. */
    webThickness: 'beam.params.webThickness',
  },
} as const;

/**
 * ADR-363 Φ2 — panel visibility keys (mirror COLUMN_RIBBON_VISIBILITY_KEYS).
 *   - `ishapeCatalog`: visible iff `params.sectionKind === 'I-shape'` — EN 10365 dropdown.
 *   - `ishapeParams`:  visible iff `params.sectionKind === 'I-shape'` — flange/web + I/H hint.
 */
export const BEAM_RIBBON_VISIBILITY_KEYS = {
  ishapeCatalog: 'beam.visibility.ishapeCatalog',
  ishapeParams:  'beam.visibility.ishapeParams',
} as const;

export type BeamRibbonVisibilityKey =
  | typeof BEAM_RIBBON_VISIBILITY_KEYS.ishapeCatalog
  | typeof BEAM_RIBBON_VISIBILITY_KEYS.ishapeParams;

export const isBeamVisibilityKey = makeKeySetGuard<BeamRibbonVisibilityKey>([
  BEAM_RIBBON_VISIBILITY_KEYS.ishapeCatalog,
  BEAM_RIBBON_VISIBILITY_KEYS.ishapeParams,
]);

export type BeamRibbonNumberCommandKey =
  | typeof BEAM_RIBBON_KEYS.params.width
  | typeof BEAM_RIBBON_KEYS.params.depth
  | typeof BEAM_RIBBON_KEYS.params.topElevation
  | typeof BEAM_RIBBON_KEYS.params.topElevationEnd
  | typeof BEAM_RIBBON_KEYS.params.flangeThickness
  | typeof BEAM_RIBBON_KEYS.params.webThickness;

export type BeamRibbonStringCommandKey =
  | typeof BEAM_RIBBON_KEYS.stringParams.kind
  | typeof BEAM_RIBBON_KEYS.stringParams.supportType
  | typeof BEAM_RIBBON_KEYS.stringParams.material
  | typeof BEAM_RIBBON_KEYS.stringParams.sectionType
  | typeof BEAM_RIBBON_KEYS.stringParams.profileDesignation
  | typeof BEAM_RIBBON_KEYS.stringParams.envelopeFunction
  | typeof BEAM_RIBBON_KEYS.stringParams.sectionKind
  | typeof BEAM_RIBBON_KEYS.stringParams.catalogProfile;

export const BEAM_RIBBON_NUMBER_KEYS: readonly BeamRibbonNumberCommandKey[] = [
  BEAM_RIBBON_KEYS.params.width,
  BEAM_RIBBON_KEYS.params.depth,
  BEAM_RIBBON_KEYS.params.topElevation,
  BEAM_RIBBON_KEYS.params.topElevationEnd,
  BEAM_RIBBON_KEYS.params.flangeThickness,
  BEAM_RIBBON_KEYS.params.webThickness,
];

export const BEAM_RIBBON_STRING_KEYS: readonly BeamRibbonStringCommandKey[] = [
  BEAM_RIBBON_KEYS.stringParams.kind,
  BEAM_RIBBON_KEYS.stringParams.supportType,
  BEAM_RIBBON_KEYS.stringParams.material,
  BEAM_RIBBON_KEYS.stringParams.sectionType,
  BEAM_RIBBON_KEYS.stringParams.profileDesignation,
  BEAM_RIBBON_KEYS.stringParams.envelopeFunction,
  BEAM_RIBBON_KEYS.stringParams.sectionKind,
  BEAM_RIBBON_KEYS.stringParams.catalogProfile,
];

export const BEAM_RIBBON_KEYS_ACTIONS = {
  close: 'beam.actions.close',
  delete: 'beam.actions.delete',
  // ADR-441 Slice GEN-BEAM / 3-mode — «Δοκάρια από κάναβο». main = inner (default)·
  // variants = περιμετρική έδραση (Εσωτερικά/Κεντρικά/Εξωτερικά, Revit Location Line).
  fromGrid: 'beam.actions.fromGrid',
  fromGridCenter: 'beam.actions.fromGridCenter',
  fromGridOuter: 'beam.actions.fromGridOuter',
  // ADR-459 Φ4d — «Αυτόματος Οπλισμός» contextual (parity με κολόνα): routes στο
  // undoable AutoReinforceOrganismCommand μέσω `bim:auto-reinforce-requested`.
  autoReinforce: 'beam.actions.autoReinforce',
  // ADR-471 — «Λεπτομέρεια Οπλισμού» contextual (parity με κολόνα/πέδιλο): emits
  // `bim:beam-detail-requested` → BeamDetailHost (PDF detail sheet).
  reinforcementDetail: 'beam.actions.reinforcementDetail',
} as const;

export const isBeamActionKey = makeKeySetGuard(
  Object.values(BEAM_RIBBON_KEYS_ACTIONS),
);

/** Visibility key (red badge when `validation.hasCodeViolations === true`). */
export const BEAM_RIBBON_BADGE_KEYS = {
  violations: 'beam.badge.violations',
} as const;

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

export const isBeamRibbonKey = makeKeySetGuard(BEAM_RIBBON_NUMBER_KEYS);
export const isBeamRibbonStringKey = makeKeySetGuard(BEAM_RIBBON_STRING_KEYS);

// ─── ADR-449 Slice 5 — structural finish (σοβάς) per-element override ──────────

/** Command keys για τα 4 finish πεδία του δοκαριού (enabled/υλικά/πάχος). */
export const BEAM_FINISH_KEYS = {
  enabled: 'beam.params.finish.enabled',
  interiorMaterialId: 'beam.params.finish.interiorMaterialId',
  exteriorMaterialId: 'beam.params.finish.exteriorMaterialId',
  thickness: 'beam.params.finish.thickness',
} as const;

/** commandKey → πεδίο του `StructuralFinishSpec` (καταναλώνεται από finish-param helpers). */
export const BEAM_FINISH_KEY_TO_FIELD: Readonly<Record<string, FinishParamField>> = {
  [BEAM_FINISH_KEYS.enabled]: 'enabled',
  [BEAM_FINISH_KEYS.interiorMaterialId]: 'interiorMaterialId',
  [BEAM_FINISH_KEYS.exteriorMaterialId]: 'exteriorMaterialId',
  [BEAM_FINISH_KEYS.thickness]: 'thickness',
};

export const isBeamFinishKey = makeKeySetGuard(Object.keys(BEAM_FINISH_KEY_TO_FIELD));

// ─── ADR-471 — δομοστατικά / οπλισμός δοκού (reinforcement) ────────────────────

/**
 * Editable structural command keys δοκού (mirror `COLUMN_STRUCTURAL_KEYS`). `code`
 * = building-level κανονισμός (γράφει στο `structuralSettingsStore`, ΟΧΙ στη δοκό)·
 * `concreteGrade` = per-element· τα υπόλοιπα = αριθμητικά/string πεδία οπλισμού
 * (κάτω/άνω διαμήκης + συνδετήρες + επικάλυψη). Το δοκάρι έχει ΔΥΟ στρώσεις
 * διαμήκων (κάτω/άνω) — γι' αυτό bottom/top αντί ενιαίου longitudinal.
 */
export const BEAM_STRUCTURAL_KEYS = {
  /** Building-level κανονισμός σχεδιασμού (project setting, ΟΧΙ per-beam). */
  code: 'beam.structural.code',
  /** Κατηγορία σκυροδέματος (per-element, EN 1992-1-1 Table 3.1). */
  concreteGrade: 'beam.structural.concreteGrade',
  /** Τύπος συνδετήρα — closed-hooked/closed-welded/spiral (string, per-element). */
  stirrupType: 'beam.structural.stirrupType',
  /** Κάτω διαμήκης (εφελκυσμός ανοίγματος) — διάμετρος ράβδου (mm). */
  bottomDiameter: 'beam.structural.bottomDiameter',
  /** Κάτω διαμήκης — πλήθος ράβδων. */
  bottomCount: 'beam.structural.bottomCount',
  /** Άνω διαμήκης (στηρίξεις/αναρτήρες) — διάμετρος ράβδου (mm). */
  topDiameter: 'beam.structural.topDiameter',
  /** Άνω διαμήκης — πλήθος ράβδων. */
  topCount: 'beam.structural.topCount',
  /** Συνδετήρες — διάμετρος (mm). */
  stirrupDiameter: 'beam.structural.stirrupDiameter',
  /** Συνδετήρες — βήμα μεσαίας (μη-κρίσιμης) ζώνης (mm). */
  stirrupSpacing: 'beam.structural.stirrupSpacing',
  /** Συνδετήρες — κρίσιμο βήμα πύκνωσης άκρων (mm, EC8 §5.4.3.1.2). */
  stirrupCriticalSpacing: 'beam.structural.stirrupCriticalSpacing',
  /** Συνδετήρες — πλήθος σκελών (δίτμητος/τρίτμητος…). */
  stirrupLegs: 'beam.structural.stirrupLegs',
  /** Επικάλυψη οπλισμού cnom (mm). */
  cover: 'beam.structural.cover',
} as const;

/** Read-only readout keys δοκού — υπολογισμένα βάρη/ρ%/φορτία (bridge δίνει value). */
export const BEAM_STRUCTURAL_READOUT_KEYS = {
  /** m³ — μικτός (gross) όγκος σκυροδέματος (b·h·span). */
  concreteVolumeGross: 'beam.structural.readout.concreteVolumeGross',
  /** m³ — καθαρός (net) όγκος = μικτός − όγκος χάλυβα (βάρος/7850). */
  concreteVolumeNet: 'beam.structural.readout.concreteVolumeNet',
  /** kg — βάρος σκυροδέματος. */
  concreteWeight: 'beam.structural.readout.concreteWeight',
  /** kg — βάρος χάλυβα οπλισμού B500C (διαμήκη + συνδετήρες). */
  steelWeight: 'beam.structural.readout.steelWeight',
  /** % — ποσοστό εφελκυόμενου (κάτω) οπλισμού ρ = As,bottom/(b·d). */
  ratio: 'beam.structural.readout.ratio',
  // ADR-467 — γραμμικό φορτίο σχεδιασμού από τη διαδρομή φορτίων (`params.appliedLoad`,
  // tributary takedown). Read-only mirror του column «Φορτίο Σχεδιασμού».
  /** kN/m — μόνιμο γραμμικό φορτίο g (χαρακτηριστικό). */
  loadDeadLine: 'beam.structural.readout.loadDeadLine',
  /** kN/m — μεταβλητό γραμμικό φορτίο q (χαρακτηριστικό). */
  loadLiveLine: 'beam.structural.readout.loadLiveLine',
  /** kN/m — γραμμικό φορτίο σχεδιασμού ULS w_Ed = γ_G·g + γ_Q·q (EN1990 6.10). */
  loadUlsLine: 'beam.structural.readout.loadUlsLine',
} as const;

/** Πεδίο του `BeamReinforcement` που χειρίζεται ένα αριθμητικό structural key. */
export type BeamStructuralReinforcementField =
  | 'bottomDiameter'
  | 'bottomCount'
  | 'topDiameter'
  | 'topCount'
  | 'stirrupDiameter'
  | 'stirrupSpacing'
  | 'stirrupCriticalSpacing'
  | 'stirrupLegs'
  | 'cover';

/** commandKey → πεδίο οπλισμού (καταναλώνεται από beam-structural-param helpers). */
export const BEAM_STRUCTURAL_KEY_TO_FIELD: Readonly<Record<string, BeamStructuralReinforcementField>> = {
  [BEAM_STRUCTURAL_KEYS.bottomDiameter]: 'bottomDiameter',
  [BEAM_STRUCTURAL_KEYS.bottomCount]: 'bottomCount',
  [BEAM_STRUCTURAL_KEYS.topDiameter]: 'topDiameter',
  [BEAM_STRUCTURAL_KEYS.topCount]: 'topCount',
  [BEAM_STRUCTURAL_KEYS.stirrupDiameter]: 'stirrupDiameter',
  [BEAM_STRUCTURAL_KEYS.stirrupSpacing]: 'stirrupSpacing',
  [BEAM_STRUCTURAL_KEYS.stirrupCriticalSpacing]: 'stirrupCriticalSpacing',
  [BEAM_STRUCTURAL_KEYS.stirrupLegs]: 'stirrupLegs',
  [BEAM_STRUCTURAL_KEYS.cover]: 'cover',
};

export const isBeamStructuralKey = makeKeySetGuard(
  Object.values(BEAM_STRUCTURAL_KEYS),
);

export const isBeamStructuralReadoutKey = makeKeySetGuard(
  Object.values(BEAM_STRUCTURAL_READOUT_KEYS),
);

/**
 * Panel visibility keys δοκού (Properties palette gating). `structural` = ορατό
 * μόνο σε **οπλισμένο-σκυρόδεμα** δοκό (όχι μεταλλική Ι / glulam — εκεί ο οπλισμός
 * δεν έχει νόημα). Mirror του `COLUMN_RIBBON_VISIBILITY_KEYS.structural` pattern.
 */
export const BEAM_STRUCTURAL_VISIBILITY_KEYS = {
  structural: 'beam.visibility.structural',
} as const;

export const isBeamStructuralVisibilityKey = makeKeySetGuard(
  Object.values(BEAM_STRUCTURAL_VISIBILITY_KEYS),
);

/**
 * Pure SSoT: αποφασίζει αν ένα visibility-gated section του beam Properties panel
 * πρέπει να φαίνεται. `structural` = ΜΟΝΟ για RC δοκό (rectangular σκυρόδεμα)· σε
 * μεταλλική Ι / glulam ο οπλισμός κρύβεται. keys εκτός set → `true` (no-op).
 * `params === null` (καμία επιλογή) → `false`.
 */
export function resolveBeamPanelVisibility(visibilityKey: string, params: BeamParams | null): boolean {
  if (!isBeamStructuralVisibilityKey(visibilityKey)) return true;
  if (!params) return false;
  if (visibilityKey === BEAM_STRUCTURAL_VISIBILITY_KEYS.structural) {
    const isSteelOrTimber =
      params.sectionKind === 'I-shape' || params.material === 'steel' || params.material === 'glulam';
    return !isSteelOrTimber;
  }
  return false;
}
