/**
 * ADR-363 Phase 3 — Slab contextual ribbon command-key registry.
 *
 * Centralizes τα `commandKey` strings που μοιράζονται μεταξύ ribbon data
 * declaration (`contextual-slab-tab.ts`) και bridge mappings
 * (`useRibbonSlabBridge`). Mirrors `WALL_RIBBON_KEYS` / `OPENING_RIBBON_KEYS`
 * pattern.
 *
 * ADR-476 — οι δομοστατικές/οπλισμού κλειδιά της πλάκας (Properties palette +
 * structural ribbon panel) ζουν επίσης εδώ (mirror `beam-command-keys.ts`).
 */

import type { SlabParams } from '../../../../bim/types/slab-types';
import { makeKeySetGuard } from './make-key-set-guard';

export const SLAB_RIBBON_KEYS = {
  stringParams: {
    /** Slab kind selector (5 options: floor/ceiling/roof/ground/foundation). */
    kind: 'slab.params.kind',
    /** Reinforcement hint (one-way / two-way / waffle / flat). */
    reinforcement: 'slab.params.reinforcement',
    /** Material key (rc / composite / wood). */
    material: 'slab.params.material',
    // ADR-534 Φ4 — φινίρισμα παρειάς οροφής (soffit finish), μόνο σε kind='ceiling'.
    /** Soffit finish material (none + paints + σοβάς/σπατουλαριστό/gypsum). */
    soffitFinish: 'slab.params.soffitFinish',
  },
  params: {
    /** mm — slab thickness. */
    thickness: 'slab.params.thickness',
    /** mm — top face (FFL) από project origin. ADR-369 §2.1. */
    levelElevation: 'slab.params.levelElevation',
  },
  // ─── ADR-404 Phase 5c — κεκλιμένη/ρύση πλάκας (sloped slab) ───────────────
  // `geometryType:'box'|'tilted'` + `SlabSlope {direction°, angle%, pivotEdge}`
  // (SSoT `slab-types.ts` + invariant `withSlabSlope`). Selected → params· drawing
  // → tool overrides (born-sloped). Logic SSoT = `slab-slope-param.ts`. Η μονάδα
  // εμφάνισης (%/μοίρες/λόγος) είναι ribbon pref (`slab-slope-unit`), ΟΧΙ key πεδίο.
  slope: {
    /** on/off — κεκλιμένη ή επίπεδη (toggle geometryType↔slope). */
    enabled: 'slab.params.slopeEnabled',
    /** percent/degrees/ratio — μονάδα εμφάνισης της τιμής (display pref). */
    unit: 'slab.params.slopeUnit',
    /** Τιμή κλίσης στη επιλεγμένη μονάδα (stored ΠΑΝΤΑ %). */
    angle: 'slab.params.slopeAngle',
    /** μοίρες CCW from +X (0=Αν, 90=Β) — φορά «ανηφόρας». Ελεύθερη 0..360. */
    direction: 'slab.params.slopeDirection',
    /** center/N/S/E/W — άξονας/ακμή που μένει στη nominal στάθμη. */
    pivot: 'slab.params.slopePivot',
  },
} as const;

export type SlabRibbonNumberCommandKey =
  | typeof SLAB_RIBBON_KEYS.params.thickness
  | typeof SLAB_RIBBON_KEYS.params.levelElevation;

export type SlabRibbonStringCommandKey =
  | typeof SLAB_RIBBON_KEYS.stringParams.kind
  | typeof SLAB_RIBBON_KEYS.stringParams.reinforcement
  | typeof SLAB_RIBBON_KEYS.stringParams.material
  | typeof SLAB_RIBBON_KEYS.stringParams.soffitFinish;

export const SLAB_RIBBON_NUMBER_KEYS: readonly SlabRibbonNumberCommandKey[] = [
  SLAB_RIBBON_KEYS.params.thickness,
  SLAB_RIBBON_KEYS.params.levelElevation,
];

export const SLAB_RIBBON_STRING_KEYS: readonly SlabRibbonStringCommandKey[] = [
  SLAB_RIBBON_KEYS.stringParams.kind,
  SLAB_RIBBON_KEYS.stringParams.reinforcement,
  SLAB_RIBBON_KEYS.stringParams.material,
  SLAB_RIBBON_KEYS.stringParams.soffitFinish,
];

export const SLAB_RIBBON_KEYS_ACTIONS = {
  close: 'slab.actions.close',
  delete: 'slab.actions.delete',
  // ADR-441 Slice GEN-SLAB — one-shot «Πλάκες από κάναβο» (δεν θέλουν επιλογή slab).
  /** Εδαφόπλακα: ΕΝΑ ενιαίο slab kind='foundation' σε όλο το αποτύπωμα. */
  fromGridMat: 'slab.actions.fromGridMat',
  /** Δάπεδα: ΠΟΛΛΑ slab kind='floor', ένα ανά φάτνωμα (Slice FLOOR). */
  fromGridFloor: 'slab.actions.fromGridFloor',
  /** Οροφές: ΠΟΛΛΑ slab kind='roof', ένα ανά φάτνωμα (Slice ROOF). */
  fromGridRoof: 'slab.actions.fromGridRoof',
  // ADR-534 — «Πλάκα οροφής (auto)»: ΠΟΛΛΑ slab kind='ceiling', ένα ανά φάτνωμα, **member-based**
  // (από δοκάρια+κολόνες, ΟΧΙ κάναβο), flush στην κορυφή των δοκαριών. One-shot, δεν θέλει επιλογή.
  fromStructureCeiling: 'slab.actions.fromStructureCeiling',
  // ADR-476 — «Αυτόματος Οπλισμός» contextual (parity με κολόνα/δοκάρι/πέδιλο):
  // routes στο undoable organism pipeline μέσω `bim:auto-reinforce-requested`.
  autoReinforce: 'slab.actions.autoReinforce',
  // ADR-476 Slice 5 — «Λεπτομέρεια Οπλισμού»: άνοιγμα φύλλου σχεδίου (κάτοψη/τομή/3Δ/
  // στοιχεία) + PDF μέσω `bim:slab-detail-requested` (parity κολόνας/πεδίλου/δοκού).
  reinforcementDetail: 'slab.actions.reinforcementDetail',
} as const;

export const isSlabActionKey = makeKeySetGuard(Object.values(SLAB_RIBBON_KEYS_ACTIONS));

/** Visibility key (red badge when `validation.hasCodeViolations === true`). */
export const SLAB_RIBBON_BADGE_KEYS = {
  violations: 'slab.badge.violations',
} as const;

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

export const isSlabRibbonKey = makeKeySetGuard(SLAB_RIBBON_NUMBER_KEYS);

export const isSlabRibbonStringKey = makeKeySetGuard(SLAB_RIBBON_STRING_KEYS);

// ─── ADR-404 Phase 5c — slope key set + guard ─────────────────────────────────

/**
 * Τα 5 command keys της κλίσης (enabled/unit/angle/direction/pivot). Διακριτό set
 * ώστε ο bridge να τα δρομολογεί στον dedicated `slab-slope-param` resolver (μηδέν
 * διπλό μέσα στους generic param-helpers). ⚠️ Πρέπει να προστεθεί ΚΑΙ στα 2 guards
 * του `useRibbonCommands` (onComboboxChange + getComboboxState) — αλλιώς no-op.
 */
export const SLAB_RIBBON_SLOPE_KEYS = [
  SLAB_RIBBON_KEYS.slope.enabled,
  SLAB_RIBBON_KEYS.slope.unit,
  SLAB_RIBBON_KEYS.slope.angle,
  SLAB_RIBBON_KEYS.slope.direction,
  SLAB_RIBBON_KEYS.slope.pivot,
] as const;

export const isSlabSlopeKey = makeKeySetGuard(SLAB_RIBBON_SLOPE_KEYS);

// ─── ADR-476 — δομοστατικά / οπλισμός πλάκας (reinforcement) ───────────────────

/**
 * Editable structural command keys πλάκας (mirror `BEAM_STRUCTURAL_KEYS`). `code`
 * = building-level κανονισμός (γράφει στο `structuralSettingsStore`, ΟΧΙ στην πλάκα)·
 * `concreteGrade` = per-element· τα υπόλοιπα = αριθμητικά πεδία οπλισμού (κάτω/άνω
 * σχάρα Ø+βήμα + επικάλυψη). Η πλάκα οπλίζεται με **σχάρες** (ΟΧΙ διαμήκεις+συνδετήρες
 * όπως δοκός/κολόνα): ένα ζεύγος combos κάτω + ένα άνω (X/Y ίδια στο default UI).
 */
export const SLAB_STRUCTURAL_KEYS = {
  /** Building-level κανονισμός σχεδιασμού (project setting, ΟΧΙ per-slab). */
  code: 'slab.structural.code',
  /** Κατηγορία σκυροδέματος (per-element, EN 1992-1-1 Table 3.1). */
  concreteGrade: 'slab.structural.concreteGrade',
  /** Κάτω σχάρα (κύρια καμπτική, φάτνωμα) — διάμετρος ράβδου (mm). */
  bottomMeshDiameter: 'slab.structural.bottomMeshDiameter',
  /** Κάτω σχάρα — βήμα ράβδων (mm). */
  bottomMeshSpacing: 'slab.structural.bottomMeshSpacing',
  /** Άνω σχάρα (στηρίξεις/hogging) — διάμετρος ράβδου (mm). */
  topMeshDiameter: 'slab.structural.topMeshDiameter',
  /** Άνω σχάρα — βήμα ράβδων (mm). */
  topMeshSpacing: 'slab.structural.topMeshSpacing',
  /** Επικάλυψη οπλισμού cnom (mm). */
  cover: 'slab.structural.cover',
} as const;

/** Read-only readout keys πλάκας — labels σχάρας / βάρος / ρ% / φορτία (bridge δίνει value). */
export const SLAB_STRUCTURAL_READOUT_KEYS = {
  /** Ετικέτα κάτω σχάρας — π.χ. «Ø12/200». */
  bottomLabel: 'slab.structural.readout.bottomLabel',
  /** Ετικέτα άνω σχάρας — π.χ. «Ø10/250». */
  topLabel: 'slab.structural.readout.topLabel',
  /** kg — συνολικό βάρος χάλυβα οπλισμού B500C (κάτω + άνω σχάρα). */
  steelWeight: 'slab.structural.readout.steelWeight',
  /** % — ποσοστό κύριου (κάτω) οπλισμού ρ = As/(b·d). */
  ratio: 'slab.structural.readout.ratio',
  // ADR-467 — επιφανειακό φορτίο σχεδιασμού από τη διαδρομή φορτίων (`params.appliedLoad`,
  // tributary ÷ εμβαδό). Read-only mirror του δοκαριού «Φορτίο Σχεδιασμού».
  /** kN/m² — μόνιμο επιφανειακό φορτίο g (χαρακτηριστικό). */
  loadDeadArea: 'slab.structural.readout.loadDeadArea',
  /** kN/m² — μεταβλητό επιφανειακό φορτίο q (χαρακτηριστικό). */
  loadLiveArea: 'slab.structural.readout.loadLiveArea',
  /** kN/m² — φορτίο σχεδιασμού ULS q_Ed = γ_G·g + γ_Q·q (EN1990 6.10). */
  loadUlsArea: 'slab.structural.readout.loadUlsArea',
} as const;

/** Πεδίο της `SlabFoundationReinforcement` που χειρίζεται ένα αριθμητικό structural key. */
export type SlabStructuralReinforcementField =
  | 'bottomMeshDiameter'
  | 'bottomMeshSpacing'
  | 'topMeshDiameter'
  | 'topMeshSpacing'
  | 'cover';

/** commandKey → λογικό πεδίο σχάρας (καταναλώνεται από slab-structural-bridge). */
export const SLAB_STRUCTURAL_KEY_TO_FIELD: Readonly<Record<string, SlabStructuralReinforcementField>> = {
  [SLAB_STRUCTURAL_KEYS.bottomMeshDiameter]: 'bottomMeshDiameter',
  [SLAB_STRUCTURAL_KEYS.bottomMeshSpacing]: 'bottomMeshSpacing',
  [SLAB_STRUCTURAL_KEYS.topMeshDiameter]: 'topMeshDiameter',
  [SLAB_STRUCTURAL_KEYS.topMeshSpacing]: 'topMeshSpacing',
  [SLAB_STRUCTURAL_KEYS.cover]: 'cover',
};

export const isSlabStructuralKey = makeKeySetGuard(Object.values(SLAB_STRUCTURAL_KEYS));

export const isSlabStructuralReadoutKey = makeKeySetGuard(Object.values(SLAB_STRUCTURAL_READOUT_KEYS));

/**
 * Panel visibility keys πλάκας (Properties palette + structural ribbon panel gating).
 * `structural` = ορατό μόνο σε **οπλισμένο-σκυρόδεμα** πλάκα (όχι σύμμικτη/ξύλινη —
 * εκεί ο οπλισμός σχάρας δεν έχει νόημα). Mirror του `BEAM_STRUCTURAL_VISIBILITY_KEYS`.
 */
export const SLAB_STRUCTURAL_VISIBILITY_KEYS = {
  structural: 'slab.visibility.structural',
  // ADR-534 Φ4 — «Φινίρισμα οροφής» panel: ορατό ΜΟΝΟ σε kind='ceiling'.
  ceilingFinish: 'slab.visibility.ceilingFinish',
} as const;

export const isSlabStructuralVisibilityKey = makeKeySetGuard(Object.values(SLAB_STRUCTURAL_VISIBILITY_KEYS));

/**
 * Pure SSoT: αποφασίζει αν ένα visibility-gated section/panel της πλάκας πρέπει να
 * φαίνεται. `structural` = ΜΟΝΟ για RC πλάκα (σκυρόδεμα)· σε σύμμικτη/ξύλινη ο
 * οπλισμός κρύβεται. keys εκτός set → `true` (no-op). `params === null` → `false`.
 */
export function resolveSlabPanelVisibility(visibilityKey: string, params: SlabParams | null): boolean {
  if (!isSlabStructuralVisibilityKey(visibilityKey)) return true;
  if (!params) return false;
  if (visibilityKey === SLAB_STRUCTURAL_VISIBILITY_KEYS.structural) {
    // material undefined → default RC (οι περισσότερες πλάκες)· composite/wood → κρυφό.
    return params.material === undefined || params.material === 'rc';
  }
  if (visibilityKey === SLAB_STRUCTURAL_VISIBILITY_KEYS.ceilingFinish) {
    // ADR-534 Φ4 — φινίρισμα soffit μόνο σε πλάκα οροφής.
    return params.kind === 'ceiling';
  }
  return false;
}
