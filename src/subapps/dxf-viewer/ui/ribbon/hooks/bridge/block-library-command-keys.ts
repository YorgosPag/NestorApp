/**
 * ADR-652 (M1.5 → M5) — Command-key registry για το contextual «Τοποθέτηση Block» ribbon tab.
 *
 * Mirror των `FURNITURE_RIBBON_KEYS` / `SCALE_TOOL_RIBBON_KEYS`: τα `commandKey` strings που
 * μοιράζονται η ribbon data δήλωση (`contextual-block-library-tab.ts`) και ο bridge
 * (`useRibbonBlockLibraryBridge`). Καμία επιλογή asset: το «ποιο block» το κατέχει το palette,
 * όχι το ribbon (ADR-652).
 *
 * **M5 (AutoCAD INSERT-faithful)**: τρία comboboxes (rotation σε μοίρες / **scale X** / **scale Y**,
 * αρνητικό = mirror) + ένα **`uniform` toggle** («Ομοιόμορφη κλίμακα», AutoCAD «Uniform Scale»,
 * default ON) που δρομολογείται μέσω του κοινού ribbon-toggle SSoT (`useRibbonToggleCommands`,
 * ίδιο μοτίβο με τα toggles του scale tool, ADR-646).
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const BLOCK_LIBRARY_RIBBON_KEYS = {
  params: {
    /** Editable numeric combobox — γωνία τοποθέτησης σε ΜΟΙΡΕΣ (DXF group code 50). */
    rotation: 'blockLibrary.params.rotation',
    /** Editable numeric combobox — κλίμακα στον άξονα X (αρνητικό = mirror). */
    scaleX: 'blockLibrary.params.scaleX',
    /** Editable numeric combobox — κλίμακα στον άξονα Y (αρνητικό = mirror). */
    scaleY: 'blockLibrary.params.scaleY',
  },
  toggles: {
    /** «Ομοιόμορφη κλίμακα» lock (AutoCAD INSERT «Uniform Scale»)· default ON. */
    uniform: 'blockLibrary.toggles.uniform',
  },
} as const;

export type BlockLibraryRibbonComboKey =
  | typeof BLOCK_LIBRARY_RIBBON_KEYS.params.rotation
  | typeof BLOCK_LIBRARY_RIBBON_KEYS.params.scaleX
  | typeof BLOCK_LIBRARY_RIBBON_KEYS.params.scaleY;

export const isBlockLibraryRibbonKey = makeKeySetGuard<BlockLibraryRibbonComboKey>([
  BLOCK_LIBRARY_RIBBON_KEYS.params.rotation,
  BLOCK_LIBRARY_RIBBON_KEYS.params.scaleX,
  BLOCK_LIBRARY_RIBBON_KEYS.params.scaleY,
]);

export type BlockLibraryRibbonToggleKey = typeof BLOCK_LIBRARY_RIBBON_KEYS.toggles.uniform;

export const isBlockLibraryToggleKey = makeKeySetGuard<BlockLibraryRibbonToggleKey>([
  BLOCK_LIBRARY_RIBBON_KEYS.toggles.uniform,
]);
