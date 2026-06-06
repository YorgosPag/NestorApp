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

export const ROOF_RIBBON_KEYS_ACTIONS = {
  close: 'roof.actions.close',
  delete: 'roof.actions.delete',
} as const;

const ROOF_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(ROOF_RIBBON_KEYS_ACTIONS),
);

export function isRoofActionKey(action: string): boolean {
  return ROOF_ACTION_KEY_SET.has(action);
}

/** Visibility key (red badge when `validation.hasCodeViolations === true`). */
export const ROOF_RIBBON_BADGE_KEYS = {
  violations: 'roof.badge.violations',
} as const;

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

const ROOF_NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>(ROOF_RIBBON_NUMBER_KEYS);
const ROOF_STRING_KEY_SET: ReadonlySet<string> = new Set<string>(ROOF_RIBBON_STRING_KEYS);
const ROOF_TOGGLE_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(ROOF_RIBBON_TOGGLE_KEYS),
);

export function isRoofRibbonKey(commandKey: string): boolean {
  return ROOF_NUMBER_KEY_SET.has(commandKey);
}

export function isRoofRibbonStringKey(commandKey: string): boolean {
  return ROOF_STRING_KEY_SET.has(commandKey);
}

export function isRoofRibbonToggleKey(commandKey: string): boolean {
  return ROOF_TOGGLE_KEY_SET.has(commandKey);
}
