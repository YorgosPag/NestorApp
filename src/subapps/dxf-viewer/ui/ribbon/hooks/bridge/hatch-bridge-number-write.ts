/**
 * ADR-507/643/653 — hatch numeric-field write dispatcher.
 *
 * Εξήχθη από το `useRibbonHatchBridge` (N.7.1 όριο 500 γρ.). Καλύπτει ΟΛΑ τα
 * `hatch.params.*` (μη-string) πεδία: διαφάνεια, gap tolerance, gradient γωνία/shift,
 * image tile/angle/grout/tint/procedural, γωνία/απόσταση μοτίβου. Ίδιο dual-mode
 * contract με το bridge (επιλεγμένο hatch → `UpdateEntityCommand`· καμία επιλογή →
 * flat draw-defaults) — εδώ μόνο η ΣΥΝΔΕΣΗ commandKey ⇄ πεδίο· οι εξαρτήσεις
 * (patch/defaults setters + τα δύο nested-object appliers) περνάνε injected ώστε η
 * συνάρτηση να μένει pure/testable χωρίς React.
 *
 * @see ../useRibbonHatchBridge.ts — ο consumer
 */

import type { HatchEntity } from '../../../../types/entities';
import type { HatchDrawDefaults } from '../../../../bim/hatch/hatch-draw-defaults-store';
import type { GradientFieldPatch } from '../../../../bim/hatch/hatch-gradient-build';
import type { ImageFieldPatch } from '../../../../bim/hatch/hatch-image-build';
import { normalizeGradientShift } from '../../../../bim/hatch/hatch-gradient';
import { patternScaleForSpacingMm } from '../../../../bim/geometry/shared/hatch-pattern-geometry';
import { clampTransparency } from '../ribbon-entity-bridge-shared';
import { HATCH_RIBBON_KEYS, isHatchRibbonNumberKey } from './hatch-command-keys';
import type { PatchHatchFn, SetHatchDrawDefaultsFn } from './hatch-bridge-write-types';

/**
 * Dispatches a `hatch.params.*` numeric command. Returns `true` when `commandKey` was
 * a hatch numeric key (caller returns immediately after) — `false` for any other key
 * (caller falls through to its own dispatch, e.g. string keys).
 */
export function applyHatchNumberChange(
  commandKey: string,
  value: string,
  hatch: HatchEntity | null,
  defaults: HatchDrawDefaults,
  patchHatch: PatchHatchFn,
  setDrawDefaults: SetHatchDrawDefaultsFn,
  applyGradientChange: (hatch: HatchEntity | null, patch: GradientFieldPatch) => void,
  applyImageChange: (hatch: HatchEntity | null, patch: ImageFieldPatch) => void,
): boolean {
  if (!isHatchRibbonNumberKey(commandKey)) return false;
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) return true;
  // Διαφάνεια: 0 ΕΓΚΥΡΟ (αδιαφανές) → πριν τον generic >0 έλεγχο. Selected-only.
  if (commandKey === HATCH_RIBBON_KEYS.params.transparency) {
    if (numeric < 0 || !hatch) return true;
    patchHatch(hatch, { transparency: clampTransparency(numeric) });
    return true;
  }
  // Gap tolerance: 0 ΕΓΚΥΡΟ (απενεργοποίηση) → πριν από τον generic >0 έλεγχο.
  if (commandKey === HATCH_RIBBON_KEYS.params.gapTolerance) {
    if (numeric < 0) return true;
    if (hatch) patchHatch(hatch, { gapTolerance: numeric > 0 ? numeric : undefined });
    else setDrawDefaults({ gapTolerance: numeric });
    return true;
  }
  if (commandKey === HATCH_RIBBON_KEYS.params.gradientAngle) {
    applyGradientChange(hatch, { field: 'angleDeg', value: numeric });
    return true;
  }
  if (commandKey === HATCH_RIBBON_KEYS.params.gradientShift) {
    applyGradientChange(hatch, { field: 'shift', value: normalizeGradientShift(numeric) });
    return true;
  }
  // Image tile διαστάσεις (mm, >0) + γωνία (0..360· 0 ΕΓΚΥΡΟ → πριν τον generic >0 έλεγχο).
  if (commandKey === HATCH_RIBBON_KEYS.params.imageTileWidth) {
    if (numeric <= 0) return true;
    applyImageChange(hatch, { field: 'tileWidth', value: numeric });
    return true;
  }
  if (commandKey === HATCH_RIBBON_KEYS.params.imageTileHeight) {
    if (numeric <= 0) return true;
    applyImageChange(hatch, { field: 'tileHeight', value: numeric });
    return true;
  }
  if (commandKey === HATCH_RIBBON_KEYS.params.imageAngle) {
    if (numeric < 0) return true;
    applyImageChange(hatch, { field: 'angle', value: numeric });
    return true;
  }
  if (commandKey === HATCH_RIBBON_KEYS.params.groutWidth) {
    if (numeric <= 0) return true;
    applyImageChange(hatch, { field: 'groutWidth', value: numeric });
    return true;
  }
  // Ένταση duotone: UI σε % (0..100· 0 ΕΓΚΥΡΟ → πριν τον generic >0 έλεγχο)· domain 0..1.
  if (commandKey === HATCH_RIBBON_KEYS.params.tintStrength) {
    if (numeric < 0) return true;
    applyImageChange(hatch, { field: 'tintStrength', value: Math.min(numeric, 100) / 100 });
    return true;
  }
  // Αρμός procedural (mm): 0 ΕΓΚΥΡΟ (χωρίς αρμό) → πριν τον generic >0 έλεγχο.
  if (commandKey === HATCH_RIBBON_KEYS.params.procJointMm) {
    if (numeric < 0) return true;
    applyImageChange(hatch, { field: 'procJointMm', value: numeric });
    return true;
  }
  if (commandKey === HATCH_RIBBON_KEYS.params.lineAngle) {
    // «Γωνία»: predefined → patternAngle (ο renderer αγνοεί το lineAngle στο μοτίβο)·
    // αλλιώς → lineAngle (user-defined).
    const isPredef = (hatch?.fillType ?? defaults.fillType) === 'predefined';
    const patch = isPredef ? { patternAngle: numeric } : { lineAngle: numeric };
    if (hatch) patchHatch(hatch, patch);
    else setDrawDefaults(patch);
    return true;
  }
  if (commandKey === HATCH_RIBBON_KEYS.params.patternScale) {
    if (numeric <= 0) return true;
    if (hatch) patchHatch(hatch, { patternScale: numeric });
    else setDrawDefaults({ patternScale: numeric });
    return true;
  }
  if (numeric <= 0) return true;
  // «Απόσταση»: predefined → μεταφράζεται σε patternScale ώστε οι γραμμές του μοτίβου
  // να απέχουν ~numeric mm (SSoT conversion)· αλλιώς → lineSpacing (user-defined mm).
  const isPredef = (hatch?.fillType ?? defaults.fillType) === 'predefined';
  if (isPredef) {
    const patternScale = patternScaleForSpacingMm(hatch?.patternName ?? defaults.patternName, numeric);
    if (hatch) patchHatch(hatch, { patternScale });
    else setDrawDefaults({ patternScale });
    return true;
  }
  if (hatch) patchHatch(hatch, { lineSpacing: numeric });
  else setDrawDefaults({ lineSpacing: numeric });
  return true;
}
