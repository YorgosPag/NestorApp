/**
 * ADR-651 Φάση Γ — Command-key registry για το contextual «Πινακίδα Σχεδίου» ribbon tab.
 *
 * Mirror των `BLOCK_LIBRARY_RIBBON_KEYS` / `SCALE_BAR_RIBBON_KEYS`: τα `commandKey` strings που
 * μοιράζονται η ribbon data δήλωση (`contextual-title-block-tab.ts`) και ο bridge
 * (`useRibbonTitleBlockBridge`).
 *
 * Δύο οικογένειες, δύο SSoT:
 *  - **stringParams** (preset / χαρτί / προσανατολισμός / κορνίζα) → `title-block-options-store`
 *  - **params** (rotation / scale) → το handle του εργαλείου (placement overrides, ADR-600)
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const TITLE_BLOCK_RIBBON_KEYS = {
  stringParams: {
    /** Ποιο built-in preset («Τυπική» / «Άδεια δόμησης» / «Απλή» / «Λεπτομέρεια»). */
    preset: 'titleBlock.stringParams.preset',
    /** Μέγεθος χαρτιού A4…A0 (paper SSoT). */
    paperSize: 'titleBlock.stringParams.paperSize',
    /** Όρθιο / πλαγιαστό. */
    orientation: 'titleBlock.stringParams.orientation',
    /** Πλήρες φύλλο με κορνίζα ISO 5457, ή μόνο το κουτί της πινακίδας. */
    frameMode: 'titleBlock.stringParams.frameMode',
    /** ADR-651 Φάση Λ — κελί QR (σύνδεσμος + αποτύπωμα έκδοσης) δεξιά στην πινακίδα, ή χωρίς. */
    qrMode: 'titleBlock.stringParams.qrMode',
  },
  params: {
    /** Editable numeric combobox — γωνία τοποθέτησης σε ΜΟΙΡΕΣ. */
    rotation: 'titleBlock.params.rotation',
    /** Editable numeric combobox — ομοιόμορφος συντελεστής κλίμακας. */
    scale: 'titleBlock.params.scale',
  },
} as const;

export type TitleBlockRibbonStringKey =
  | typeof TITLE_BLOCK_RIBBON_KEYS.stringParams.preset
  | typeof TITLE_BLOCK_RIBBON_KEYS.stringParams.paperSize
  | typeof TITLE_BLOCK_RIBBON_KEYS.stringParams.orientation
  | typeof TITLE_BLOCK_RIBBON_KEYS.stringParams.frameMode
  | typeof TITLE_BLOCK_RIBBON_KEYS.stringParams.qrMode;

export type TitleBlockRibbonComboKey =
  | typeof TITLE_BLOCK_RIBBON_KEYS.params.rotation
  | typeof TITLE_BLOCK_RIBBON_KEYS.params.scale;

export const isTitleBlockRibbonStringKey = makeKeySetGuard<TitleBlockRibbonStringKey>([
  TITLE_BLOCK_RIBBON_KEYS.stringParams.preset,
  TITLE_BLOCK_RIBBON_KEYS.stringParams.paperSize,
  TITLE_BLOCK_RIBBON_KEYS.stringParams.orientation,
  TITLE_BLOCK_RIBBON_KEYS.stringParams.frameMode,
  TITLE_BLOCK_RIBBON_KEYS.stringParams.qrMode,
]);

export const isTitleBlockRibbonKey = makeKeySetGuard<TitleBlockRibbonComboKey>([
  TITLE_BLOCK_RIBBON_KEYS.params.rotation,
  TITLE_BLOCK_RIBBON_KEYS.params.scale,
]);

/** Οι δύο τιμές του «Κορνίζα» picker (string enum — καμία boolean σε wire format). */
export const TITLE_BLOCK_FRAME_MODES = ['sheet', 'box'] as const;
export type TitleBlockFrameMode = (typeof TITLE_BLOCK_FRAME_MODES)[number];

/** Οι δύο τιμές του «QR» picker (ADR-651 Φάση Λ — string enum, ίδιο μοτίβο με το «Κορνίζα»). */
export const TITLE_BLOCK_QR_MODES = ['on', 'off'] as const;
export type TitleBlockQrMode = (typeof TITLE_BLOCK_QR_MODES)[number];
