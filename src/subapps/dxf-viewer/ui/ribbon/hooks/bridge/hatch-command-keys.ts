/**
 * ADR-507 S2 — Hatch contextual ribbon command-key registry.
 *
 * Κεντρικοποιεί τα `commandKey` strings που μοιράζονται η δήλωση δεδομένων
 * (`contextual-hatch-tab.ts`) και το bridge (`useRibbonHatchBridge`). Mirror του
 * `floor-finish-command-keys.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

export const HATCH_RIBBON_KEYS = {
  stringParams: {
    /** Τύπος γεμίσματος: 'solid' | 'user-defined' | 'predefined'. */
    fillType: 'hatch.params.fillType',
    /** Χρώμα γεμίσματος/γραμμών (hex preset). */
    fillColor: 'hatch.params.fillColor',
    /** Island detection style: 'normal' | 'outer' | 'ignore'. */
    islandStyle: 'hatch.params.islandStyle',
    /** Όνομα predefined μοτίβου (PAT catalog) — π.χ. 'ANSI31'. */
    patternName: 'hatch.params.patternName',
    /** Πάχος γραμμών (AutoCAD LWT) — 'ByLayer' ή mm ως string (ADR-507 Φ2). */
    lineweight: 'hatch.params.lineweight',
  },
  params: {
    /** Γωνία γραμμών (μοίρες) — user-defined. */
    lineAngle: 'hatch.params.lineAngle',
    /** Κάθετη απόσταση γραμμών (mm) — user-defined. */
    lineSpacing: 'hatch.params.lineSpacing',
    /** Κλίμακα predefined μοτίβου (×). */
    patternScale: 'hatch.params.patternScale',
  },
  toggles: {
    /** Διπλή (σταυρωτή) γραμμοσκίαση. */
    doubleCrossHatch: 'hatch.toggle.doubleCrossHatch',
  },
  readouts: {
    /** Live εμβαδόν (read-only, m²). */
    area: 'hatch.readout.area',
  },
  actions: {
    /** Επιστροφή στην επιλογή (Select). */
    close: 'hatch.action.close',
    /** Διαγραφή της γραμμοσκίασης. */
    delete: 'hatch.action.delete',
  },
} as const;

export type HatchRibbonNumberCommandKey =
  | typeof HATCH_RIBBON_KEYS.params.lineAngle
  | typeof HATCH_RIBBON_KEYS.params.lineSpacing
  | typeof HATCH_RIBBON_KEYS.params.patternScale;

export type HatchRibbonStringCommandKey =
  | typeof HATCH_RIBBON_KEYS.stringParams.fillType
  | typeof HATCH_RIBBON_KEYS.stringParams.fillColor
  | typeof HATCH_RIBBON_KEYS.stringParams.islandStyle
  | typeof HATCH_RIBBON_KEYS.stringParams.patternName
  | typeof HATCH_RIBBON_KEYS.stringParams.lineweight;

export type HatchRibbonToggleKey =
  | typeof HATCH_RIBBON_KEYS.toggles.doubleCrossHatch;

export type HatchRibbonReadoutKey =
  | typeof HATCH_RIBBON_KEYS.readouts.area;

export type HatchRibbonActionKey =
  | typeof HATCH_RIBBON_KEYS.actions.close
  | typeof HATCH_RIBBON_KEYS.actions.delete;

const NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>([
  HATCH_RIBBON_KEYS.params.lineAngle,
  HATCH_RIBBON_KEYS.params.lineSpacing,
  HATCH_RIBBON_KEYS.params.patternScale,
]);
const STRING_KEY_SET: ReadonlySet<string> = new Set<string>([
  HATCH_RIBBON_KEYS.stringParams.fillType,
  HATCH_RIBBON_KEYS.stringParams.fillColor,
  HATCH_RIBBON_KEYS.stringParams.islandStyle,
  HATCH_RIBBON_KEYS.stringParams.patternName,
  HATCH_RIBBON_KEYS.stringParams.lineweight,
]);
const TOGGLE_KEY_SET: ReadonlySet<string> = new Set<string>([
  HATCH_RIBBON_KEYS.toggles.doubleCrossHatch,
]);
const READOUT_KEY_SET: ReadonlySet<string> = new Set<string>([
  HATCH_RIBBON_KEYS.readouts.area,
]);
const ACTION_KEY_SET: ReadonlySet<string> = new Set<string>([
  HATCH_RIBBON_KEYS.actions.close,
  HATCH_RIBBON_KEYS.actions.delete,
]);

export function isHatchRibbonNumberKey(key: string): key is HatchRibbonNumberCommandKey {
  return NUMBER_KEY_SET.has(key);
}
export function isHatchRibbonStringKey(key: string): key is HatchRibbonStringCommandKey {
  return STRING_KEY_SET.has(key);
}
export function isHatchRibbonToggleKey(key: string): key is HatchRibbonToggleKey {
  return TOGGLE_KEY_SET.has(key);
}
export function isHatchRibbonReadoutKey(key: string): key is HatchRibbonReadoutKey {
  return READOUT_KEY_SET.has(key);
}
export function isHatchRibbonActionKey(key: string): key is HatchRibbonActionKey {
  return ACTION_KEY_SET.has(key);
}
