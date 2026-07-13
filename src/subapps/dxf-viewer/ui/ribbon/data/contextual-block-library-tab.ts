/**
 * ADR-652 (M1.5) — Contextual ribbon tab για την τοποθέτηση block από τη βιβλιοθήκη.
 *
 * Trigger: `block-library-tool-active` (από το `app/resolve-tool-active-trigger.ts` όταν
 * `activeTool === 'block-library'` — το TOOL-active μοτίβο, mirror του furniture tab).
 *
 * ΔΕΝ έχει panel επιλογής block: το «ποιο block» το κατέχει το palette «Τα Blocks μου»
 * (`block-library-selection-store`, ADR-652 SSoT). Εδώ ο χρήστης ρυθμίζει ΜΟΝΟ το transform
 * της επόμενης τοποθέτησης — γωνία (μοίρες) + ομοιόμορφη κλίμακα — δεμένο live στο
 * `blockLibraryToolBridgeStore` μέσω του `useRibbonBlockLibraryBridge`.
 *
 * ⚠️ ΚΑΜΙΑ δήλωση κουμπιού «Κλείσιμο» — το `withStandardClose` το προσθέτει κεντρικά.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-652-block-library.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { BLOCK_LIBRARY_RIBBON_KEYS } from '../hooks/bridge/block-library-command-keys';
import { literalNumberOptions } from './ribbon-numeric-options';

export const BLOCK_LIBRARY_CONTEXTUAL_TRIGGER = 'block-library-tool-active';

// ─── Combobox options ────────────────────────────────────────────────────────
// Χτισμένα από τον SSoT builder (`literalNumberOptions`) — ΟΧΙ χειρόγραφος πίνακας
// `{ value, labelKey, isLiteralLabel }` (N.18 / CHECK 3.28: το ladder αυτό είναι ήδη
// copy-paste σε 3 tabs· εδώ δεν προστίθεται 4ο clone).

/** Γωνία τοποθέτησης σε μοίρες (τα presets· ο χρήστης μπορεί να πληκτρολογήσει ό,τι θέλει). */
const ROTATION_DEG_OPTIONS = literalNumberOptions([0, 45, 90, 135, 180, 225, 270, 315]);

/** Ομοιόμορφος συντελεστής κλίμακας (1 = 1:1 — όπως έφτασε το block από το DXF). */
const SCALE_OPTIONS = literalNumberOptions([0.25, 0.5, 0.75, 1, 1.5, 2, 5]);

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_BLOCK_LIBRARY_TAB: RibbonTab = {
  id: 'block-library-placement',
  labelKey: 'ribbon.tabs.blockLibraryPlacement',
  isContextual: true,
  contextualTrigger: BLOCK_LIBRARY_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'block-library-transform',
      labelKey: 'ribbon.panels.blockLibraryTransform',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'blockLibrary.rotation',
                labelKey: 'ribbon.commands.blockLibraryEditor.rotation',
                commandKey: BLOCK_LIBRARY_RIBBON_KEYS.params.rotation,
                comboboxWidthPx: 80,
                options: ROTATION_DEG_OPTIONS,
                // Ρητό (τα presets είναι ακέραιοι/θετικοί, άρα το auto-infer θα απέκλειε
                // και τα δύο): επιτρέπονται δεκαδικές μοίρες (22.5°) και αρνητικές (-90°).
                numericInput: { editable: true, allowNegative: true, allowDecimal: true },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'blockLibrary.scale',
                labelKey: 'ribbon.commands.blockLibraryEditor.scale',
                commandKey: BLOCK_LIBRARY_RIBBON_KEYS.params.scale,
                comboboxWidthPx: 80,
                options: SCALE_OPTIONS,
                // Δεκαδικά ναι (0.35×)· αρνητικά ΟΧΙ — το αρνητικό scale είναι καθρέφτισμα,
                // όχι κλίμακα, και δεν ανήκει σε αυτό το πεδίο.
                numericInput: { editable: true, allowNegative: false, allowDecimal: true, min: 0 },
              },
            },
          ],
        },
      ],
    },
  ],
};
