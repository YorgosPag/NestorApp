/**
 * ADR-651 Φάση Γ — Contextual ribbon tab «Πινακίδα Σχεδίου».
 *
 * Trigger: `title-block-tool-active` (tool-active μοτίβο — mirror του block-library tab).
 * Ο χρήστης ρυθμίζει ΠΡΙΝ το κλικ:
 *   - **Πρότυπο**: ποιο preset της βιβλιοθήκης (Απόφαση #3) — options από το `TITLE_BLOCK_PRESETS`
 *     (registry SSoT· ΟΧΙ χειρόγραφη λίστα που θα ξέφευγε όταν προστεθεί preset).
 *   - **Φύλλο**: μέγεθος χαρτιού (paper SSoT `PAPER_SIZE_ORDER`) + προσανατολισμός + κορνίζα
 *     (πλήρες φύλλο ISO 5457 ή μόνο το κουτί). Το μέγεθος **προτείνεται αυτόματα** από το bbox
 *     του σχεδίου· μόλις ο χρήστης το αγγίξει, η πρόταση σταματά (Απόφαση #2).
 *   - **Μετασχηματισμός**: γωνία + κλίμακα τοποθέτησης (τα placement overrides του εργαλείου).
 *
 * ⚠️ ΚΑΜΙΑ δήλωση κουμπιού «Κλείσιμο» — το `withStandardClose` το προσθέτει κεντρικά.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-651-auto-title-block-generator.md
 */

import type { RibbonComboboxOption, RibbonTab } from '../types/ribbon-types';
import { TITLE_BLOCK_RIBBON_KEYS, TITLE_BLOCK_FRAME_MODES } from '../hooks/bridge/title-block-command-keys';
import { TITLE_BLOCK_PRESETS } from '../../../text-engine/title-block/title-block-presets';
import { PAPER_SIZE_ORDER } from '../../../print/config/paper-constants';
import { literalNumberOptions } from './ribbon-numeric-options';

export const TITLE_BLOCK_CONTEXTUAL_TRIGGER = 'title-block-tool-active';

const CMD = 'ribbon.commands.titleBlockEditor';

/**
 * Options από το registry — προσθέτεις preset ⇒ εμφανίζεται μόνο του στο ribbon.
 *
 * ADR-651 Φάση Θ: εξάγεται, γιατί το `useRibbonTitleBlockBridge` χτίζει πάνω σε ΑΥΤΗ τη λίστα
 * το **ενωμένο** dropdown (built-ins + αποθηκευμένα πρότυπα βιβλιοθήκης). Μία πηγή για τα
 * built-in options, δύο καταναλωτές (N.18) — εδώ είναι το στατικό fallback της δήλωσης, εκεί
 * το δυναμικό υπερσύνολο.
 */
export const TITLE_BLOCK_PRESET_OPTIONS: readonly RibbonComboboxOption[] = TITLE_BLOCK_PRESETS.map(
  (preset) => ({
    value: preset.id,
    labelKey: preset.labelKey,
    isLiteralLabel: false,
  }),
);

/** A4…A0 από το **paper SSoT** — η ετικέτα ΕΙΝΑΙ το μέγεθος (δεν μεταφράζεται το «A3»). */
const PAPER_SIZE_OPTIONS: readonly RibbonComboboxOption[] = PAPER_SIZE_ORDER.map((size) => ({
  value: size,
  labelKey: size,
  isLiteralLabel: true,
}));

const ORIENTATION_OPTIONS: readonly RibbonComboboxOption[] = [
  { value: 'portrait', labelKey: `${CMD}.orientationOptions.portrait`, isLiteralLabel: false },
  { value: 'landscape', labelKey: `${CMD}.orientationOptions.landscape`, isLiteralLabel: false },
];

const FRAME_MODE_OPTIONS: readonly RibbonComboboxOption[] = TITLE_BLOCK_FRAME_MODES.map((mode) => ({
  value: mode,
  labelKey: `${CMD}.frameModeOptions.${mode}`,
  isLiteralLabel: false,
}));

const ROTATION_DEG_OPTIONS = literalNumberOptions([0, 90, 180, 270]);
const SCALE_OPTIONS = literalNumberOptions([0.5, 1, 2]);

export const CONTEXTUAL_TITLE_BLOCK_TAB: RibbonTab = {
  id: 'title-block-placement',
  labelKey: 'ribbon.tabs.titleBlockPlacement',
  isContextual: true,
  contextualTrigger: TITLE_BLOCK_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'title-block-template',
      labelKey: 'ribbon.panels.titleBlockTemplate',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'titleBlock.preset',
                labelKey: `${CMD}.preset`,
                commandKey: TITLE_BLOCK_RIBBON_KEYS.stringParams.preset,
                comboboxWidthPx: 160,
                options: TITLE_BLOCK_PRESET_OPTIONS,
              },
            },
            {
              // ADR-651 Φάση Θ — βιβλιοθήκη προτύπων: αποθήκευση στο γραφείο, δημοσίευση,
              // απόσπαση παραλλαγής έργου, ενημέρωση από τον γονιό.
              type: 'simple',
              size: 'small',
              command: {
                id: 'titleBlock.library',
                labelKey: 'ribbon.commands.titleBlockLibrary',
                tooltipKey: 'ribbon.commands.titleBlockLibraryTooltip',
                icon: 'title-block-library',
                commandKey: 'open-title-block-library-dialog',
                action: 'open-title-block-library-dialog',
              },
            },
            {
              // ADR-651 Φάση Δ — δημιουργία πινακίδας με AI (εικόνα ή περιγραφή → πρότυπο).
              type: 'simple',
              size: 'small',
              command: {
                id: 'titleBlock.ai',
                labelKey: 'ribbon.commands.aiTitleBlock',
                tooltipKey: 'ribbon.commands.aiTitleBlockTooltip',
                icon: 'ai-title-block',
                commandKey: 'open-ai-title-block-dialog',
                action: 'open-ai-title-block-dialog',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'title-block-sheet',
      labelKey: 'ribbon.panels.titleBlockSheet',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'titleBlock.paperSize',
                labelKey: `${CMD}.paperSize`,
                commandKey: TITLE_BLOCK_RIBBON_KEYS.stringParams.paperSize,
                comboboxWidthPx: 80,
                options: PAPER_SIZE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'titleBlock.orientation',
                labelKey: `${CMD}.orientation`,
                commandKey: TITLE_BLOCK_RIBBON_KEYS.stringParams.orientation,
                comboboxWidthPx: 120,
                options: ORIENTATION_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'titleBlock.frameMode',
                labelKey: `${CMD}.frameMode`,
                commandKey: TITLE_BLOCK_RIBBON_KEYS.stringParams.frameMode,
                comboboxWidthPx: 170,
                options: FRAME_MODE_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-651 Φάση Ε — η σφραγίδα/υπογραφή του μηχανικού (upload μία φορά → κάθε πινακίδα).
      id: 'title-block-stamp',
      labelKey: 'ribbon.panels.titleBlockStamp',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'titleBlock.stamp',
                labelKey: 'ribbon.commands.titleBlockStamp',
                tooltipKey: 'ribbon.commands.titleBlockStampTooltip',
                icon: 'stamp',
                commandKey: 'open-stamp-dialog',
                action: 'open-stamp-dialog',
              },
            },
            {
              // ADR-651 Φάση Η — πίνακας αναθεωρήσεων + AI πρόταση «τι άλλαξε» (Απόφαση #9).
              type: 'simple',
              size: 'small',
              command: {
                id: 'titleBlock.revisions',
                labelKey: 'ribbon.commands.titleBlockRevisions',
                tooltipKey: 'ribbon.commands.titleBlockRevisionsTooltip',
                icon: 'revisions',
                commandKey: 'open-revisions-dialog',
                action: 'open-revisions-dialog',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'title-block-transform',
      labelKey: 'ribbon.panels.titleBlockTransform',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'titleBlock.rotation',
                labelKey: `${CMD}.rotation`,
                commandKey: TITLE_BLOCK_RIBBON_KEYS.params.rotation,
                comboboxWidthPx: 80,
                options: ROTATION_DEG_OPTIONS,
                numericInput: { editable: true, allowNegative: true, allowDecimal: true },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'titleBlock.scale',
                labelKey: `${CMD}.scale`,
                commandKey: TITLE_BLOCK_RIBBON_KEYS.params.scale,
                comboboxWidthPx: 80,
                options: SCALE_OPTIONS,
                numericInput: { editable: true, allowNegative: false, allowDecimal: true, min: 0 },
              },
            },
          ],
        },
      ],
    },
  ],
};
