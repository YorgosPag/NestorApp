/**
 * ADR-507 S2 — Hatch contextual ribbon command-key registry.
 *
 * Κεντρικοποιεί τα `commandKey` strings που μοιράζονται η δήλωση δεδομένων
 * (`contextual-hatch-tab.ts`) και το bridge (`useRibbonHatchBridge`). Mirror του
 * `floor-finish-command-keys.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const HATCH_RIBBON_KEYS = {
  stringParams: {
    /** Τύπος γεμίσματος: 'solid' | 'user-defined' | 'predefined'. */
    fillType: 'hatch.params.fillType',
    /** Χρώμα γεμίσματος/γραμμών (hex preset). */
    fillColor: 'hatch.params.fillColor',
    /** Island detection style: 'normal' | 'outer' | 'ignore'. */
    islandStyle: 'hatch.params.islandStyle',
    /** Επίπεδο (layer) — per-object `layerId` (επιλεγμένο) ή current drawing layer (defaults). */
    layer: 'hatch.params.layer',
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
    /** ADR-643 Φ3 — asset id υλικού εικόνας (catalog `matimg-*`) — μόνο fillType='image'. */
    imageAsset: 'hatch.params.imageAsset',
    /** ADR-643 Φ5 — χρώμα αρμού (hex) — μόνο fillType='image'. */
    groutColor: 'hatch.params.groutColor',
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
    /** ADR-643 Φ3 — πραγματικό πλάτος tile εικόνας (mm) — μόνο fillType='image'. */
    imageTileWidth: 'hatch.params.imageTileWidth',
    /** ADR-643 Φ3 — πραγματικό ύψος tile εικόνας (mm) — μόνο fillType='image'. */
    imageTileHeight: 'hatch.params.imageTileHeight',
    /** ADR-643 Φ3 — γωνία περιστροφής μοτίβου εικόνας (μοίρες) — μόνο fillType='image'. */
    imageAngle: 'hatch.params.imageAngle',
    /** ADR-643 Φ5 — πραγματικό πλάτος αρμού (mm) — μόνο fillType='image'. */
    groutWidth: 'hatch.params.groutWidth',
    /** Gap tolerance (AutoCAD HPGAPTOL, world units) — pick-point (ADR-507 Φ3/§5β.1). */
    gapTolerance: 'hatch.params.gapTolerance',
    /** Διαφάνεια (AutoCAD object transparency 0..90· DXF 440) — μόνο επιλεγμένη γραμμοσκίαση. */
    transparency: 'hatch.params.transparency',
  },
  toggles: {
    /** Διπλή (σταυρωτή) γραμμοσκίαση. */
    doubleCrossHatch: 'hatch.toggle.doubleCrossHatch',
    /** Single-color gradient (color1 → tint προς λευκό). */
    gradientSingleColor: 'hatch.toggle.gradientSingleColor',
    /** ADR-643 Φ5 — αρμοί (grout) πάνω από την εικόνα — μόνο fillType='image'. */
    grout: 'hatch.toggle.grout',
    /** «Επιλογή γραμμοσκίασης» — armed pick-existing (πατημένο = armed, one-shot). */
    selectExisting: 'hatch.toggle.selectExisting',
    // ADR-507 Φ3 — Μέθοδος ορίου ως 2 μεγάλα radio-toggles (αντί dropdown): το ένα
    // πάντα ενεργό, driven από το ΚΟΙΝΟ `hatch-pick-mode-store` SSoT.
    /** «Επιλογή σημείου» (Τρόπος Β / auto-detect) — pressed = pickMode==='pick-point'. */
    methodPickPoint: 'hatch.toggle.methodPickPoint',
    /** «Σχεδίαση ορίου» (Τρόπος Α / N-click boundary) — pressed = pickMode==='boundary'. */
    methodBoundary: 'hatch.toggle.methodBoundary',
    /**
     * «Πίσω πλάνο» — η γραμμοσκίαση ζωγραφίζεται ΚΑΤΩ από τις υπόλοιπες οντότητες
     * (AutoCAD «Send Hatches to Back»). pressed = drawOrder===0 (back bucket). Enact =
     * `ReorderEntityCommand` (array-order = paint-order). Μόνο επιλεγμένη γραμμοσκίαση.
     */
    sendToBack: 'hatch.toggle.sendToBack',
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
    /** ADR-643 Φ3 — Panel «Εικόνα» (swatch grid + διαστάσεις) ορατό μόνο όταν fillType='image'. */
    image: 'hatch.visibility.image',
  },
} as const;

export type HatchRibbonNumberCommandKey =
  | typeof HATCH_RIBBON_KEYS.params.lineAngle
  | typeof HATCH_RIBBON_KEYS.params.lineSpacing
  | typeof HATCH_RIBBON_KEYS.params.patternScale
  | typeof HATCH_RIBBON_KEYS.params.gradientAngle
  | typeof HATCH_RIBBON_KEYS.params.gradientShift
  | typeof HATCH_RIBBON_KEYS.params.gapTolerance
  | typeof HATCH_RIBBON_KEYS.params.transparency
  | typeof HATCH_RIBBON_KEYS.params.imageTileWidth
  | typeof HATCH_RIBBON_KEYS.params.imageTileHeight
  | typeof HATCH_RIBBON_KEYS.params.imageAngle
  | typeof HATCH_RIBBON_KEYS.params.groutWidth;

export type HatchRibbonStringCommandKey =
  | typeof HATCH_RIBBON_KEYS.stringParams.fillType
  | typeof HATCH_RIBBON_KEYS.stringParams.fillColor
  | typeof HATCH_RIBBON_KEYS.stringParams.islandStyle
  | typeof HATCH_RIBBON_KEYS.stringParams.layer
  | typeof HATCH_RIBBON_KEYS.stringParams.patternName
  | typeof HATCH_RIBBON_KEYS.stringParams.lineweight
  | typeof HATCH_RIBBON_KEYS.stringParams.gradientType
  | typeof HATCH_RIBBON_KEYS.stringParams.gradientColor1
  | typeof HATCH_RIBBON_KEYS.stringParams.gradientColor2
  | typeof HATCH_RIBBON_KEYS.stringParams.imageAsset
  | typeof HATCH_RIBBON_KEYS.stringParams.groutColor;

export type HatchRibbonToggleKey =
  | typeof HATCH_RIBBON_KEYS.toggles.doubleCrossHatch
  | typeof HATCH_RIBBON_KEYS.toggles.gradientSingleColor
  | typeof HATCH_RIBBON_KEYS.toggles.grout
  | typeof HATCH_RIBBON_KEYS.toggles.selectExisting
  | typeof HATCH_RIBBON_KEYS.toggles.methodPickPoint
  | typeof HATCH_RIBBON_KEYS.toggles.methodBoundary
  | typeof HATCH_RIBBON_KEYS.toggles.sendToBack;

export type HatchRibbonReadoutKey =
  | typeof HATCH_RIBBON_KEYS.readouts.area;

export type HatchRibbonActionKey =
  | typeof HATCH_RIBBON_KEYS.actions.close
  | typeof HATCH_RIBBON_KEYS.actions.delete;

export type HatchRibbonVisibilityKey =
  | typeof HATCH_RIBBON_KEYS.visibility.gradient
  | typeof HATCH_RIBBON_KEYS.visibility.image;

export const isHatchRibbonNumberKey = makeKeySetGuard<HatchRibbonNumberCommandKey>([
  HATCH_RIBBON_KEYS.params.lineAngle,
  HATCH_RIBBON_KEYS.params.lineSpacing,
  HATCH_RIBBON_KEYS.params.patternScale,
  HATCH_RIBBON_KEYS.params.gradientAngle,
  HATCH_RIBBON_KEYS.params.gradientShift,
  HATCH_RIBBON_KEYS.params.gapTolerance,
  HATCH_RIBBON_KEYS.params.transparency,
  HATCH_RIBBON_KEYS.params.imageTileWidth,
  HATCH_RIBBON_KEYS.params.imageTileHeight,
  HATCH_RIBBON_KEYS.params.imageAngle,
  HATCH_RIBBON_KEYS.params.groutWidth,
]);
export const isHatchRibbonStringKey = makeKeySetGuard<HatchRibbonStringCommandKey>([
  HATCH_RIBBON_KEYS.stringParams.fillType,
  HATCH_RIBBON_KEYS.stringParams.fillColor,
  HATCH_RIBBON_KEYS.stringParams.islandStyle,
  HATCH_RIBBON_KEYS.stringParams.layer,
  HATCH_RIBBON_KEYS.stringParams.patternName,
  HATCH_RIBBON_KEYS.stringParams.lineweight,
  HATCH_RIBBON_KEYS.stringParams.gradientType,
  HATCH_RIBBON_KEYS.stringParams.gradientColor1,
  HATCH_RIBBON_KEYS.stringParams.gradientColor2,
  HATCH_RIBBON_KEYS.stringParams.imageAsset,
  HATCH_RIBBON_KEYS.stringParams.groutColor,
]);
export const isHatchRibbonToggleKey = makeKeySetGuard<HatchRibbonToggleKey>([
  HATCH_RIBBON_KEYS.toggles.doubleCrossHatch,
  HATCH_RIBBON_KEYS.toggles.gradientSingleColor,
  HATCH_RIBBON_KEYS.toggles.grout,
  HATCH_RIBBON_KEYS.toggles.selectExisting,
  HATCH_RIBBON_KEYS.toggles.methodPickPoint,
  HATCH_RIBBON_KEYS.toggles.methodBoundary,
  HATCH_RIBBON_KEYS.toggles.sendToBack,
]);
export const isHatchRibbonReadoutKey = makeKeySetGuard<HatchRibbonReadoutKey>([
  HATCH_RIBBON_KEYS.readouts.area,
]);
export const isHatchRibbonActionKey = makeKeySetGuard<HatchRibbonActionKey>([
  HATCH_RIBBON_KEYS.actions.close,
  HATCH_RIBBON_KEYS.actions.delete,
]);
export const isHatchRibbonVisibilityKey = makeKeySetGuard<HatchRibbonVisibilityKey>([
  HATCH_RIBBON_KEYS.visibility.gradient,
  HATCH_RIBBON_KEYS.visibility.image,
]);
