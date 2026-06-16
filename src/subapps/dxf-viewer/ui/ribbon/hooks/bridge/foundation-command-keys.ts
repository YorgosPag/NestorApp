/**
 * ADR-436 Slice 1 — Foundation ribbon command-key registry.
 *
 * Central string-constant registry shared μεταξύ του contextual foundation tab
 * data (`contextual-foundation-tab.ts`) και του bridge hook
 * (`useRibbonFoundationBridge.ts`). Mirror του `column-command-keys.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §6
 */

export const FOUNDATION_RIBBON_KEYS = {
  stringParams: {
    kind: 'foundation.params.kind',
    anchor: 'foundation.params.anchor',
    material: 'foundation.params.material',
    // ADR-441 Slice 5a-control — Location Line (justification) γραμμικού πεδίλου/συνδετήριας.
    justification: 'foundation.params.justification',
  },
  params: {
    width: 'foundation.params.width',
    length: 'foundation.params.length',
    thickness: 'foundation.params.thickness',
    rotation: 'foundation.params.rotation',
    topElevation: 'foundation.params.topElevation',
  },
} as const;

export type FoundationRibbonNumberCommandKey =
  (typeof FOUNDATION_RIBBON_KEYS.params)[keyof typeof FOUNDATION_RIBBON_KEYS.params];

export type FoundationRibbonStringCommandKey =
  (typeof FOUNDATION_RIBBON_KEYS.stringParams)[keyof typeof FOUNDATION_RIBBON_KEYS.stringParams];

export const FOUNDATION_RIBBON_NUMBER_KEYS: readonly FoundationRibbonNumberCommandKey[] = [
  FOUNDATION_RIBBON_KEYS.params.width,
  FOUNDATION_RIBBON_KEYS.params.length,
  FOUNDATION_RIBBON_KEYS.params.thickness,
  FOUNDATION_RIBBON_KEYS.params.rotation,
  FOUNDATION_RIBBON_KEYS.params.topElevation,
];

export const FOUNDATION_RIBBON_STRING_KEYS: readonly FoundationRibbonStringCommandKey[] = [
  FOUNDATION_RIBBON_KEYS.stringParams.kind,
  FOUNDATION_RIBBON_KEYS.stringParams.anchor,
  FOUNDATION_RIBBON_KEYS.stringParams.material,
  FOUNDATION_RIBBON_KEYS.stringParams.justification,
];

export const FOUNDATION_RIBBON_KEYS_ACTIONS = {
  close: 'foundation.actions.close',
  delete: 'foundation.actions.delete',
  // ADR-441 Slice 2 — one-shot «Εσχάρα πεδιλοδοκών από κάναβο» (default = inner).
  fromGrid: 'foundation.actions.fromGrid',
  // ADR-441 — περιμετρική έδραση εσχάρας (split-button variants, Giorgio 2026-06-12).
  fromGridCenter: 'foundation.actions.fromGridCenter',
  fromGridOuter: 'foundation.actions.fromGridOuter',
  // ADR-441 Slice GEN-TIE — one-shot «Συνδετήριες δοκοί από κάναβο» (κεντραρισμένες).
  tieBeamsFromGrid: 'foundation.actions.tieBeamsFromGrid',
  // ADR-459 Φ4d — «Αυτόματος Οπλισμός» πεδίλου/πεδιλοδοκού/συνδετήριας (parity με
  // κολόνα): routes στο undoable AutoReinforceOrganismCommand.
  autoReinforce: 'foundation.actions.autoReinforce',
} as const;

export const FOUNDATION_RIBBON_BADGE_KEYS = {
  violations: 'foundation.badge.violations',
} as const;

/**
 * ADR-436 Slice 2 — panel visibility keys (kind-conditional). Το kind ορίζεται
 * από το tool id (Revit 3 separate tools)· τα panels εμφανίζονται ανά geometry
 * family: `padOnly` (anchor + length + rotation) vs `lineOnly` (band width).
 */
export const FOUNDATION_RIBBON_VISIBILITY_KEYS = {
  padOnly: 'foundation.visibility.pad',
  lineOnly: 'foundation.visibility.line',
} as const;

export function isFoundationActionKey(action: string): boolean {
  return (
    action === FOUNDATION_RIBBON_KEYS_ACTIONS.close ||
    action === FOUNDATION_RIBBON_KEYS_ACTIONS.delete ||
    action === FOUNDATION_RIBBON_KEYS_ACTIONS.fromGrid ||
    action === FOUNDATION_RIBBON_KEYS_ACTIONS.fromGridCenter ||
    action === FOUNDATION_RIBBON_KEYS_ACTIONS.fromGridOuter ||
    action === FOUNDATION_RIBBON_KEYS_ACTIONS.tieBeamsFromGrid ||
    action === FOUNDATION_RIBBON_KEYS_ACTIONS.autoReinforce
  );
}

export function isFoundationRibbonKey(commandKey: string): boolean {
  return (FOUNDATION_RIBBON_NUMBER_KEYS as readonly string[]).includes(commandKey);
}

export function isFoundationRibbonStringKey(commandKey: string): boolean {
  return (FOUNDATION_RIBBON_STRING_KEYS as readonly string[]).includes(commandKey);
}

export function isFoundationBadgeKey(badgeKey: string): boolean {
  return badgeKey === FOUNDATION_RIBBON_BADGE_KEYS.violations;
}

// ─── ADR-463 — δομοστατικά / οπλισμός (reinforcement) ──────────────────────────

/**
 * Editable structural command keys (kind-aware). `code` = building-level
 * κανονισμός (γράφει στο `structuralSettingsStore`)· `cover` = κοινό σε όλα τα
 * kinds· τα υπόλοιπα είναι kind-specific πεδία οπλισμού (το Properties descriptor
 * εμφανίζει μόνο τα κατάλληλα ανά `params.kind`). Mirror του `COLUMN_STRUCTURAL_KEYS`.
 */
export const FOUNDATION_STRUCTURAL_KEYS = {
  /** Building-level κανονισμός σχεδιασμού (project setting, ΟΧΙ per-foundation). */
  code: 'foundation.structural.code',
  /** Επικάλυψη οπλισμού cnom (mm) — κοινό σε όλα τα kinds. */
  cover: 'foundation.structural.cover',
  // pad — δι-διευθυντική κάτω σχάρα + προαιρετική άνω σχάρα.
  padBottomXDiameter: 'foundation.structural.pad.bottomXDiameter',
  padBottomXSpacing: 'foundation.structural.pad.bottomXSpacing',
  padBottomYDiameter: 'foundation.structural.pad.bottomYDiameter',
  padBottomYSpacing: 'foundation.structural.pad.bottomYSpacing',
  padTopEnabled: 'foundation.structural.pad.topEnabled',
  padTopDiameter: 'foundation.structural.pad.topDiameter',
  padTopSpacing: 'foundation.structural.pad.topSpacing',
  // strip — εγκάρσιες (κύριος) + διαμήκεις διανομής + προαιρετικοί συνδετήρες.
  stripTransverseDiameter: 'foundation.structural.strip.transverseDiameter',
  stripTransverseSpacing: 'foundation.structural.strip.transverseSpacing',
  stripLongitudinalDiameter: 'foundation.structural.strip.longitudinalDiameter',
  stripLongitudinalCount: 'foundation.structural.strip.longitudinalCount',
  stripStirrupEnabled: 'foundation.structural.strip.stirrupEnabled',
  stripStirrupDiameter: 'foundation.structural.strip.stirrupDiameter',
  stripStirrupSpacing: 'foundation.structural.strip.stirrupSpacing',
  // tie-beam — κάτω/άνω διαμήκης + συνδετήρες (είναι δοκός).
  tieBottomDiameter: 'foundation.structural.tieBeam.bottomDiameter',
  tieBottomCount: 'foundation.structural.tieBeam.bottomCount',
  tieTopDiameter: 'foundation.structural.tieBeam.topDiameter',
  tieTopCount: 'foundation.structural.tieBeam.topCount',
  tieStirrupDiameter: 'foundation.structural.tieBeam.stirrupDiameter',
  tieStirrupSpacing: 'foundation.structural.tieBeam.stirrupSpacing',
  tieStirrupCriticalSpacing: 'foundation.structural.tieBeam.stirrupCriticalSpacing',
} as const;

/** Read-only readout keys — υπολογισμένα (bridge δίνει value, ΟΧΙ write). */
export const FOUNDATION_STRUCTURAL_READOUT_KEYS = {
  /** Σύντομη ετικέτα κύριου οπλισμού (π.χ. «Ø12/200» ή «4Ø16»). */
  mainLabel: 'foundation.structural.readout.mainLabel',
  /** kg — βάρος χάλυβα οπλισμού B500C. */
  steelWeight: 'foundation.structural.readout.steelWeight',
  /** % — ποσοστό κύριου (καμπτικού) οπλισμού ρ. */
  ratio: 'foundation.structural.readout.ratio',
} as const;

/** String/select structural keys (κανονισμός + on/off toggles). */
const FOUNDATION_STRUCTURAL_STRING_KEY_SET: ReadonlySet<string> = new Set<string>([
  FOUNDATION_STRUCTURAL_KEYS.code,
  FOUNDATION_STRUCTURAL_KEYS.padTopEnabled,
  FOUNDATION_STRUCTURAL_KEYS.stripStirrupEnabled,
]);

const FOUNDATION_STRUCTURAL_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(FOUNDATION_STRUCTURAL_KEYS),
);
const FOUNDATION_STRUCTURAL_READOUT_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(FOUNDATION_STRUCTURAL_READOUT_KEYS),
);

export function isFoundationStructuralKey(commandKey: string): boolean {
  return FOUNDATION_STRUCTURAL_KEY_SET.has(commandKey);
}

export function isFoundationStructuralStringKey(commandKey: string): boolean {
  return FOUNDATION_STRUCTURAL_STRING_KEY_SET.has(commandKey);
}

export function isFoundationStructuralReadoutKey(commandKey: string): boolean {
  return FOUNDATION_STRUCTURAL_READOUT_KEY_SET.has(commandKey);
}
