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
    /** Τύπος γεμίσματος: 'solid' | 'user-defined'. */
    fillType: 'hatch.params.fillType',
    /** Χρώμα γεμίσματος/γραμμών (hex preset). */
    fillColor: 'hatch.params.fillColor',
    /** Island detection style: 'normal' | 'outer' | 'ignore'. */
    islandStyle: 'hatch.params.islandStyle',
  },
  params: {
    /** Γωνία γραμμών (μοίρες) — user-defined. */
    lineAngle: 'hatch.params.lineAngle',
    /** Κάθετη απόσταση γραμμών (mm) — user-defined. */
    lineSpacing: 'hatch.params.lineSpacing',
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
  | typeof HATCH_RIBBON_KEYS.params.lineSpacing;

export type HatchRibbonStringCommandKey =
  | typeof HATCH_RIBBON_KEYS.stringParams.fillType
  | typeof HATCH_RIBBON_KEYS.stringParams.fillColor
  | typeof HATCH_RIBBON_KEYS.stringParams.islandStyle;

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
]);
const STRING_KEY_SET: ReadonlySet<string> = new Set<string>([
  HATCH_RIBBON_KEYS.stringParams.fillType,
  HATCH_RIBBON_KEYS.stringParams.fillColor,
  HATCH_RIBBON_KEYS.stringParams.islandStyle,
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
