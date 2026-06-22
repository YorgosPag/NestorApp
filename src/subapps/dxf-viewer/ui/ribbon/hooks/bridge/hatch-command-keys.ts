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
    /** Τύπος gradient (DXF 470) — μόνο fillType='gradient' (ADR-507 Φ5). */
    gradientType: 'hatch.params.gradientType',
    /** Πρώτο χρώμα gradient (hex). */
    gradientColor1: 'hatch.params.gradientColor1',
    /** Δεύτερο χρώμα gradient (hex) — αγνοείται όταν single-color. */
    gradientColor2: 'hatch.params.gradientColor2',
  },
  params: {
    /** Γωνία γραμμών (μοίρες) — user-defined. */
    lineAngle: 'hatch.params.lineAngle',
    /** Κάθετη απόσταση γραμμών (mm) — user-defined. */
    lineSpacing: 'hatch.params.lineSpacing',
    /** Κλίμακα predefined μοτίβου (×). */
    patternScale: 'hatch.params.patternScale',
    /** Γωνία περιστροφής gradient (μοίρες) — μόνο fillType='gradient'. */
    gradientAngle: 'hatch.params.gradientAngle',
    /** Μετατόπιση gradient 0..1 (DXF 461· 0=centered) — μόνο fillType='gradient'. */
    gradientShift: 'hatch.params.gradientShift',
  },
  toggles: {
    /** Διπλή (σταυρωτή) γραμμοσκίαση. */
    doubleCrossHatch: 'hatch.toggle.doubleCrossHatch',
    /** Single-color gradient (color1 → tint προς λευκό). */
    gradientSingleColor: 'hatch.toggle.gradientSingleColor',
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
  visibility: {
    /** Panel «Gradient» ορατό μόνο όταν fillType='gradient' (Revit-style contextual). */
    gradient: 'hatch.visibility.gradient',
  },
} as const;

export type HatchRibbonNumberCommandKey =
  | typeof HATCH_RIBBON_KEYS.params.lineAngle
  | typeof HATCH_RIBBON_KEYS.params.lineSpacing
  | typeof HATCH_RIBBON_KEYS.params.patternScale
  | typeof HATCH_RIBBON_KEYS.params.gradientAngle
  | typeof HATCH_RIBBON_KEYS.params.gradientShift;

export type HatchRibbonStringCommandKey =
  | typeof HATCH_RIBBON_KEYS.stringParams.fillType
  | typeof HATCH_RIBBON_KEYS.stringParams.fillColor
  | typeof HATCH_RIBBON_KEYS.stringParams.islandStyle
  | typeof HATCH_RIBBON_KEYS.stringParams.patternName
  | typeof HATCH_RIBBON_KEYS.stringParams.lineweight
  | typeof HATCH_RIBBON_KEYS.stringParams.gradientType
  | typeof HATCH_RIBBON_KEYS.stringParams.gradientColor1
  | typeof HATCH_RIBBON_KEYS.stringParams.gradientColor2;

export type HatchRibbonToggleKey =
  | typeof HATCH_RIBBON_KEYS.toggles.doubleCrossHatch
  | typeof HATCH_RIBBON_KEYS.toggles.gradientSingleColor;

export type HatchRibbonReadoutKey =
  | typeof HATCH_RIBBON_KEYS.readouts.area;

export type HatchRibbonActionKey =
  | typeof HATCH_RIBBON_KEYS.actions.close
  | typeof HATCH_RIBBON_KEYS.actions.delete;

export type HatchRibbonVisibilityKey =
  | typeof HATCH_RIBBON_KEYS.visibility.gradient;

const NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>([
  HATCH_RIBBON_KEYS.params.lineAngle,
  HATCH_RIBBON_KEYS.params.lineSpacing,
  HATCH_RIBBON_KEYS.params.patternScale,
  HATCH_RIBBON_KEYS.params.gradientAngle,
  HATCH_RIBBON_KEYS.params.gradientShift,
]);
const STRING_KEY_SET: ReadonlySet<string> = new Set<string>([
  HATCH_RIBBON_KEYS.stringParams.fillType,
  HATCH_RIBBON_KEYS.stringParams.fillColor,
  HATCH_RIBBON_KEYS.stringParams.islandStyle,
  HATCH_RIBBON_KEYS.stringParams.patternName,
  HATCH_RIBBON_KEYS.stringParams.lineweight,
  HATCH_RIBBON_KEYS.stringParams.gradientType,
  HATCH_RIBBON_KEYS.stringParams.gradientColor1,
  HATCH_RIBBON_KEYS.stringParams.gradientColor2,
]);
const TOGGLE_KEY_SET: ReadonlySet<string> = new Set<string>([
  HATCH_RIBBON_KEYS.toggles.doubleCrossHatch,
  HATCH_RIBBON_KEYS.toggles.gradientSingleColor,
]);
const READOUT_KEY_SET: ReadonlySet<string> = new Set<string>([
  HATCH_RIBBON_KEYS.readouts.area,
]);
const ACTION_KEY_SET: ReadonlySet<string> = new Set<string>([
  HATCH_RIBBON_KEYS.actions.close,
  HATCH_RIBBON_KEYS.actions.delete,
]);
const VISIBILITY_KEY_SET: ReadonlySet<string> = new Set<string>([
  HATCH_RIBBON_KEYS.visibility.gradient,
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
export function isHatchRibbonVisibilityKey(key: string): key is HatchRibbonVisibilityKey {
  return VISIBILITY_KEY_SET.has(key);
}
