/**
 * ADR-652 (M1.5) — Command-key registry για το contextual «Τοποθέτηση Block» ribbon tab.
 *
 * Mirror των `FURNITURE_RIBBON_KEYS` / `SCALE_TOOL_RIBBON_KEYS`: τα `commandKey` strings που
 * μοιράζονται η ribbon data δήλωση (`contextual-block-library-tab.ts`) και ο bridge
 * (`useRibbonBlockLibraryBridge`). Δύο comboboxes (rotation σε μοίρες / ομοιόμορφο scale) —
 * καμία επιλογή asset: το «ποιο block» το κατέχει το palette, όχι το ribbon (ADR-652).
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const BLOCK_LIBRARY_RIBBON_KEYS = {
  params: {
    /** Editable numeric combobox — γωνία τοποθέτησης σε ΜΟΙΡΕΣ (DXF group code 50). */
    rotation: 'blockLibrary.params.rotation',
    /** Editable numeric combobox — ομοιόμορφος συντελεστής κλίμακας (1 = 1:1). */
    scale: 'blockLibrary.params.scale',
  },
} as const;

export type BlockLibraryRibbonComboKey =
  | typeof BLOCK_LIBRARY_RIBBON_KEYS.params.rotation
  | typeof BLOCK_LIBRARY_RIBBON_KEYS.params.scale;

export const isBlockLibraryRibbonKey = makeKeySetGuard<BlockLibraryRibbonComboKey>([
  BLOCK_LIBRARY_RIBBON_KEYS.params.rotation,
  BLOCK_LIBRARY_RIBBON_KEYS.params.scale,
]);
