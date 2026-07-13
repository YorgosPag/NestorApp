/**
 * ADR-507 / ADR-643 / ADR-653 — pure «no-selection» write-side mappers του hatch bridge.
 *
 * Όταν δεν υπάρχει επιλεγμένη γραμμοσκίαση, η αλλαγή ενός nested πεδίου (gradient/image)
 * γράφεται στα flat `hatch-draw-defaults`. Αυτές οι δύο καθαρές συναρτήσεις κάνουν το
 * mapping «nested patch → flat draw-default fields». Εξήχθησαν από το `useRibbonHatchBridge`
 * (single-responsibility + όριο 500 γρ., mirror του read-side split `hatch-bridge-read.ts`).
 *
 * @see ../useRibbonHatchBridge.ts — ο consumer
 * @see ./hatch-bridge-read.ts — το αντίστοιχο pure read-side
 */

import type { HatchDrawDefaults } from '../../../../bim/hatch/hatch-draw-defaults-store';
import type { GradientFieldPatch } from '../../../../bim/hatch/hatch-gradient-build';
import {
  buildImageFillFromDefaults,
  withImageFillPatch,
  type ImageFieldPatch,
} from '../../../../bim/hatch/hatch-image-build';
import { HATCH_RIBBON_KEYS } from './hatch-command-keys';

/**
 * Image string-field command keys → το αντίστοιχο `ImageFieldPatch` field (asset/χρώμα).
 * Table-driven dispatch (asset/grout/tint/procedural χρώματα ακολουθούν το ίδιο μονοπάτι
 * `applyImageChange`) → μηδέν επαναλαμβανόμενα if-blocks στο bridge.
 */
export const IMAGE_STRING_FIELDS: Readonly<
  Record<string, Extract<ImageFieldPatch, { value: string }>['field']>
> = {
  [HATCH_RIBBON_KEYS.stringParams.imageAsset]: 'assetId',
  [HATCH_RIBBON_KEYS.stringParams.groutColor]: 'groutColor',
  [HATCH_RIBBON_KEYS.stringParams.tintColorA]: 'tintColorA',
  [HATCH_RIBBON_KEYS.stringParams.tintColorB]: 'tintColorB',
  [HATCH_RIBBON_KEYS.stringParams.procColorA]: 'procColorA',
  [HATCH_RIBBON_KEYS.stringParams.procColorB]: 'procColorB',
  [HATCH_RIBBON_KEYS.stringParams.procJointColor]: 'procJointColor',
};

/** Map ενός gradient field patch → το αντίστοιχο flat draw-default πεδίο (no-selection mode). */
export function gradientDefaultPatch(patch: GradientFieldPatch): Partial<HatchDrawDefaults> {
  switch (patch.field) {
    case 'type': return { gradientType: patch.value };
    case 'color1': return { gradientColor1: patch.value };
    case 'color2': return { gradientColor2: patch.value };
    case 'singleColor': return { gradientSingleColor: patch.value };
    case 'angleDeg': return { gradientAngle: patch.value };
    case 'shift': return { gradientShift: patch.value };
  }
}

/**
 * Map ενός image-fill patch → flat draw-default πεδία (no-selection mode). Στην αλλαγή
 * υλικού υιοθετούμε ΚΑΙ το πραγματικό default tile size του υλικού (μέσω του build SSoT),
 * ώστε το draft preview να δείχνει το σωστό μέγεθος (ίδια συμπεριφορά με selected). Καλύπτει
 * grout (Φ5), duotone tint (Φ8) και procedural χρώματα/αρμό (Φ9· γεννήτρια στο imageAssetId).
 */
export function imageDefaultPatch(
  d: HatchDrawDefaults,
  patch: ImageFieldPatch,
): Partial<HatchDrawDefaults> {
  const next = withImageFillPatch(buildImageFillFromDefaults(d), d, patch);
  return {
    imageAssetId: next.assetId,
    imageTileWidth: next.tileWidth,
    imageTileHeight: next.tileHeight,
    imageAngle: next.angle,
    groutEnabled: !!next.grout,
    groutColor: next.grout?.color ?? d.groutColor,
    groutWidthMm: next.grout?.widthMm ?? d.groutWidthMm,
    // ADR-653 Φ8 — duotone tint draw-defaults.
    tintEnabled: !!next.tint,
    tintColorA: next.tint?.colorA ?? d.tintColorA,
    tintColorB: next.tint?.colorB ?? d.tintColorB,
    tintStrength: next.tint?.strength ?? d.tintStrength,
    // ADR-653 Φ9 — procedural draw-defaults (χρώματα/αρμός· η γεννήτρια ζει στο imageAssetId).
    procColorA: next.procedural?.colors[0] ?? d.procColorA,
    procColorB: next.procedural?.colors[1] ?? d.procColorB,
    procJointMm: next.procedural?.jointMm ?? d.procJointMm,
    procJointColor: next.procedural?.jointColor ?? d.procJointColor,
  };
}
