/**
 * ADR-507 / ADR-643 — pure read-side SSoT του hatch bridge.
 *
 * `readHatchComboboxState` = η ΜΙΑ συνάρτηση που διαβάζει την τιμή ενός hatch
 * combobox/numeric/readout πεδίου από (επιλεγμένο hatch ή draw-defaults). Εξήχθη
 * από το `useRibbonHatchBridge` (single-responsibility + όριο 500 γρ.) — καθαρή,
 * χωρίς closures/commands, ώστε να είναι unit-testable και ελαφριά.
 *
 * @see ../useRibbonHatchBridge.ts — ο consumer (wrapper σε useCallback)
 * @see ./hatch-command-keys.ts — command-key registry
 */

import type { HatchEntity, LineweightMm } from '../../../../types/entities';
import type { HatchDrawDefaults } from '../../../../bim/hatch/hatch-draw-defaults-store';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';
import { isConcreteLineweight } from '../../../../config/lineweight-iso-catalog';
import { LINEWEIGHT_BYLAYER_VALUE } from '../../data/lineweight-ribbon-options';
import { computeHatchAreaMm2 } from '../../../../bim/hatch/hatch-completion';
import { hatchMinWorldSpacing } from '../../../../bim/geometry/shared/hatch-pattern-geometry';
import { formatAreaForDisplay } from '../../../../config/display-length-format';
import { entityTransparencyValue } from '../ribbon-entity-bridge-shared';
import {
  HATCH_RIBBON_KEYS,
  isHatchRibbonNumberKey,
  isHatchRibbonStringKey,
  isHatchRibbonReadoutKey,
} from './hatch-command-keys';

/** Ελάχιστο layer-field API που χρειάζεται το read (μόνο get). */
interface LayerFieldRead {
  getState(hatch: HatchEntity | null): RibbonComboboxState;
}

/** lineweightMm → option value ('ByLayer' ή «0.50»· toFixed(2) ταιριάζει με LINEWEIGHT_RIBBON_OPTIONS). */
export function lineweightToOptionValue(lw: LineweightMm | undefined): string {
  return isConcreteLineweight(lw) ? lw.toFixed(2) : LINEWEIGHT_BYLAYER_VALUE;
}

/**
 * Τιμή ενός hatch combobox/numeric/readout πεδίου από (επιλεγμένο hatch ή defaults).
 * `null` για command keys εκτός του hatch registry.
 */
export function readHatchComboboxState(
  commandKey: string,
  hatch: HatchEntity | null,
  defaults: HatchDrawDefaults,
  layerField: LayerFieldRead,
): RibbonComboboxState | null {
  // Readout: live εμβαδόν (μόνο όταν υπάρχει επιλεγμένη γραμμοσκίαση).
  if (isHatchRibbonReadoutKey(commandKey)) {
    return { value: hatch ? formatAreaForDisplay(computeHatchAreaMm2(hatch)) : '—', options: [] };
  }
  if (isHatchRibbonStringKey(commandKey)) {
    if (commandKey === HATCH_RIBBON_KEYS.stringParams.layer) {
      return layerField.getState(hatch);
    }
    if (commandKey === HATCH_RIBBON_KEYS.stringParams.fillType) {
      return { value: hatch?.fillType ?? defaults.fillType, options: [] };
    }
    if (commandKey === HATCH_RIBBON_KEYS.stringParams.fillColor) {
      return { value: hatch?.fillColor ?? defaults.fillColor, options: [] };
    }
    if (commandKey === HATCH_RIBBON_KEYS.stringParams.patternName) {
      return { value: hatch?.patternName ?? defaults.patternName, options: [] };
    }
    if (commandKey === HATCH_RIBBON_KEYS.stringParams.lineweight) {
      return { value: lineweightToOptionValue(hatch?.lineweightMm ?? defaults.lineweightMm), options: [] };
    }
    if (commandKey === HATCH_RIBBON_KEYS.stringParams.gradientType) {
      return { value: hatch?.gradient?.type ?? defaults.gradientType, options: [] };
    }
    if (commandKey === HATCH_RIBBON_KEYS.stringParams.gradientColor1) {
      return { value: hatch?.gradient?.color1 ?? defaults.gradientColor1, options: [] };
    }
    if (commandKey === HATCH_RIBBON_KEYS.stringParams.gradientColor2) {
      return { value: hatch?.gradient?.color2 ?? defaults.gradientColor2, options: [] };
    }
    if (commandKey === HATCH_RIBBON_KEYS.stringParams.imageAsset) {
      return { value: hatch?.imageFill?.assetId ?? defaults.imageAssetId, options: [] };
    }
    return { value: hatch?.islandStyle ?? defaults.islandStyle, options: [] };
  }
  if (isHatchRibbonNumberKey(commandKey)) {
    // Διαφάνεια: ιδιότητα ΜΟΝΟ επιλεγμένης γραμμοσκίασης (mirror line-tool· χωρίς draw-default).
    if (commandKey === HATCH_RIBBON_KEYS.params.transparency) {
      return { value: hatch ? entityTransparencyValue(hatch) : '0', options: [] };
    }
    if (commandKey === HATCH_RIBBON_KEYS.params.gapTolerance) {
      return { value: String(hatch?.gapTolerance ?? defaults.gapTolerance), options: [] };
    }
    if (commandKey === HATCH_RIBBON_KEYS.params.lineAngle) {
      // «Γωνία»: στο «έτοιμο μοτίβο» οδηγεί το patternAngle (ο predefined renderer
      // αγνοεί το lineAngle)· αλλιώς το lineAngle (user-defined).
      const isPredef = (hatch?.fillType ?? defaults.fillType) === 'predefined';
      const angle = isPredef
        ? (hatch?.patternAngle ?? defaults.patternAngle)
        : (hatch?.lineAngle ?? defaults.lineAngle);
      return { value: String(angle), options: [] };
    }
    if (commandKey === HATCH_RIBBON_KEYS.params.patternScale) {
      return { value: String(hatch?.patternScale ?? defaults.patternScale), options: [] };
    }
    if (commandKey === HATCH_RIBBON_KEYS.params.gradientAngle) {
      return { value: String(hatch?.gradient?.angleDeg ?? defaults.gradientAngle), options: [] };
    }
    if (commandKey === HATCH_RIBBON_KEYS.params.gradientShift) {
      return { value: String(hatch?.gradient?.shift ?? defaults.gradientShift), options: [] };
    }
    if (commandKey === HATCH_RIBBON_KEYS.params.imageTileWidth) {
      return { value: String(hatch?.imageFill?.tileWidth ?? defaults.imageTileWidth), options: [] };
    }
    if (commandKey === HATCH_RIBBON_KEYS.params.imageTileHeight) {
      return { value: String(hatch?.imageFill?.tileHeight ?? defaults.imageTileHeight), options: [] };
    }
    if (commandKey === HATCH_RIBBON_KEYS.params.imageAngle) {
      return { value: String(hatch?.imageFill?.angle ?? defaults.imageAngle), options: [] };
    }
    // «Απόσταση»: στο «έτοιμο μοτίβο» δείχνει την ΠΡΑΓΜΑΤΙΚΗ world απόσταση γραμμών
    // (min-spacing), που προκύπτει από το patternScale· αλλιώς το lineSpacing (mm).
    const isPredef = (hatch?.fillType ?? defaults.fillType) === 'predefined';
    if (isPredef) {
      const worldSpacing = hatchMinWorldSpacing(
        hatch ?? { fillType: 'predefined', patternName: defaults.patternName, patternScale: defaults.patternScale },
      );
      return { value: String(Math.round(worldSpacing)), options: [] };
    }
    return { value: String(hatch?.lineSpacing ?? defaults.lineSpacing), options: [] };
  }
  return null;
}
