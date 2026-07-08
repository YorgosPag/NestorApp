/**
 * ADR-417 Φ1-part-2 — Roof contextual ribbon command-key registry.
 *
 * Centralizes τα `commandKey` strings που μοιράζονται μεταξύ ribbon data
 * declaration (`contextual-roof-tab.ts`) και bridge mappings
 * (`useRibbonRoofBridge`). Mirrors `SLAB_RIBBON_KEYS` pattern, με δύο επιπλέον
 * concerns που η πλάκα δεν έχει: μορφή στέγης (`shape`) ως preset + toggle
 * μονάδας κλίσης μοίρες↔ποσοστό (`slopeUnitPercent`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10
 * @see ui/ribbon/hooks/bridge/slab-command-keys.ts — το πρότυπο
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const ROOF_RIBBON_KEYS = {
  stringParams: {
    /** Roof shape preset (flat / mono-pitch / gable). Drives `applyRoofShapePreset`. */
    shape: 'roof.params.shape',
    /** Roof Type (family type) id picker — built-ins «Μπετονένιο δώμα» / «Κεραμοσκεπή». */
    roofType: 'roof.params.roofType',
  },
  params: {
    /** Slope value στη μονάδα `slopeUnit` (μοίρες ή ποσοστό), εφαρμόζεται σε slope-defining ακμές. */
    slope: 'roof.params.slope',
    /** mm — στάθμη γείσου (eaves datum / pivot line). */
    basePivotZ: 'roof.params.basePivotZ',
    /** mm — οριζόντια προεξοχή γείσου (overhang) — εφαρμόζεται ενιαία σε όλες τις ακμές. */
    overhangMm: 'roof.params.overhangMm',
  },
} as const;

export type RoofRibbonNumberCommandKey =
  | typeof ROOF_RIBBON_KEYS.params.slope
  | typeof ROOF_RIBBON_KEYS.params.basePivotZ
  | typeof ROOF_RIBBON_KEYS.params.overhangMm;

export type RoofRibbonStringCommandKey =
  | typeof ROOF_RIBBON_KEYS.stringParams.shape
  | typeof ROOF_RIBBON_KEYS.stringParams.roofType;

export const ROOF_RIBBON_NUMBER_KEYS: readonly RoofRibbonNumberCommandKey[] = [
  ROOF_RIBBON_KEYS.params.slope,
  ROOF_RIBBON_KEYS.params.basePivotZ,
  ROOF_RIBBON_KEYS.params.overhangMm,
];

export const ROOF_RIBBON_STRING_KEYS: readonly RoofRibbonStringCommandKey[] = [
  ROOF_RIBBON_KEYS.stringParams.shape,
  ROOF_RIBBON_KEYS.stringParams.roofType,
];

/** Toggle κλίσης: ON = ποσοστό (%), OFF = μοίρες (°) — ArchiCAD-style μονάδα. */
export const ROOF_RIBBON_TOGGLE_KEYS = {
  slopeUnitPercent: 'roof.toggle.slopeUnitPercent',
} as const;

// ─── ADR-417 Φ-per-edge — κλίση/προεξοχή ΑΝΑ ΑΚΜΗ (Revit «Defines Roof Slope») ──

/**
 * Τα command keys της per-edge επεξεργασίας (διάλεξε ακμή → όρισε
 * `definesSlope`/`slope`/`overhangMm` ΜΟΝΟ αυτής). Διακριτό set ώστε ο bridge να
 * τα δρομολογεί στον dedicated `roof-edge-param` resolver + στο
 * `roofEdgeSelectionStore` (highlight). ⚠️ Πρέπει να μπει ΚΑΙ στα 2 guards του
 * `useRibbonCommands` (onComboboxChange + getComboboxState) — αλλιώς no-op
 * «δεν ανταποκρίνεται» (το μάθημα πλάκας/τοίχου `isSlabSlopeKey`).
 */
export const ROOF_EDGE_KEYS = {
  /** Επιλογή ακμής υπό επεξεργασία (value = index ως string· options = compass list). */
  select: 'roof.edge.select',
  /** on/off — «Ορίζει κλίση;» (`definesSlope`) της επιλεγμένης ακμής. */
  defines: 'roof.edge.defines',
  /** Κλίση της επιλεγμένης ακμής (στη μονάδα `slopeUnit`). */
  slope: 'roof.edge.slope',
  /** mm — προεξοχή γείσου (overhang) της επιλεγμένης ακμής. */
  overhang: 'roof.edge.overhang',
} as const;

export const ROOF_EDGE_KEY_LIST: readonly string[] = [
  ROOF_EDGE_KEYS.select,
  ROOF_EDGE_KEYS.defines,
  ROOF_EDGE_KEYS.slope,
  ROOF_EDGE_KEYS.overhang,
];

export const isRoofEdgeKey = makeKeySetGuard(ROOF_EDGE_KEY_LIST);

export const ROOF_RIBBON_KEYS_ACTIONS = {
  close: 'roof.actions.close',
  delete: 'roof.actions.delete',
} as const;

export const isRoofActionKey = makeKeySetGuard(Object.values(ROOF_RIBBON_KEYS_ACTIONS));

/** Visibility key (red badge when `validation.hasCodeViolations === true`). */
export const ROOF_RIBBON_BADGE_KEYS = {
  violations: 'roof.badge.violations',
} as const;

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

export const isRoofRibbonKey = makeKeySetGuard(ROOF_RIBBON_NUMBER_KEYS);

export const isRoofRibbonStringKey = makeKeySetGuard(ROOF_RIBBON_STRING_KEYS);

export const isRoofRibbonToggleKey = makeKeySetGuard(Object.values(ROOF_RIBBON_TOGGLE_KEYS));
