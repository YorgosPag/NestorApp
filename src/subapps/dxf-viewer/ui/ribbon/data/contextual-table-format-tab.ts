/**
 * 🔴 ADR-739 §52 — **η contextual καρτέλα «Μορφοποίηση»**: εμφανίζεται μόλις μπεις σε κελί
 * πίνακα και **γίνεται αυτόματα ενεργή**.
 *
 * Είναι η δεύτερη μισή του σύνθετου trigger (ADR-566): η «Ιδιότητες Πίνακα» ανοίγει με την
 * επιλογή της οντότητας και **μένει** — αυτή προστίθεται δίπλα της. Ακριβώς όπως η κορδέλα
 * του Excel: το φύλλο δεν χάνει τις καρτέλες του επειδή μπήκες σε κελί, αποκτά μία ακόμη.
 *
 * ## 🔴 ΓΙΑΤΙ ΚΑΘΕ PANEL ΔΗΛΩΝΕΙ `keepsTableCellSession`
 * Χωρίς αυτό, το κλικ στο «Β» **κλείνει τον δρομέα** — και μαζί του εξαφανίζεται η ίδια η
 * καρτέλα που μόλις πάτησες: ο φύλακας `useTableCellSessionBlur` βλέπει την εστίαση να φεύγει
 * σε μη-μέλος και κλείνει τη συνεδρία σε `requestAnimationFrame`, που μπορεί να τρέξει **πριν**
 * από το `click`. Δες το `TABLE_SESSION_KEEPALIVE_MARKER` για ολόκληρη τη διάγνωση.
 *
 * ## Τι ΔΕΝ δηλώνεται εδώ
 *  - **Κλείσιμο / σύριγγα**: τα βάζει αυτόματα το `withStandardLeadPanel` (ADR-581).
 *  - **Ετικέτες περιγραμμάτων / συγχώνευσης**: τα δύο widgets **τυλίγουν** τα υπάρχοντα
 *    components, που ήδη μεταφράζουν από το `dxf-viewer` namespace (`table.borders.*`,
 *    `table.merge.*`). Δεύτερος κατάλογος κλειδιών θα απέκλινε στην πρώτη αλλαγή ετικέτας.
 *
 * ## Φάσεις (απόφαση ιδιοκτήτη, 2026-08-06)
 * **Φ1 = ό,τι υπάρχει ήδη** (Β/Ι/Υ, χρώματα, μέγεθος, merge, borders). Στοίχιση + οικογένεια
 * γραμματοσειράς είναι **Φ2**· μορφή αριθμού **Φ3**. Μία τη φορά — και καμία δεν μπαίνει εδώ
 * πριν υπάρχει η πράξη της, γιατί ένα κουμπί χωρίς πράξη είναι υπόσχεση που δεν τηρείται
 * (§52: «δεν έλειπε κουμπί, έλειπε η πράξη»).
 *
 * @see ui/ribbon/data/contextual-table-tab.ts — η πρώτη μισή του σύνθετου trigger
 * @see ui/ribbon/hooks/useRibbonTableFormatBridge.ts — ο bridge
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §52
 */

import type { RibbonTab } from '../types/ribbon-types';
import { TABLE_FORMAT_RIBBON_KEYS } from '../hooks/bridge/table-format-command-keys';
import { TABLE_TEXT_HEIGHT_SCALE_MM } from '../../../bim/table/table-text-height-scale';

export const TABLE_FORMAT_CONTEXTUAL_TRIGGER = 'table-cell-active';

/**
 * 🔴 Οι επιλογές ύψους **παράγονται από τη σκάλα**, ποτέ γραμμένες ξανά.
 *
 * Είναι η ίδια λίστα που κινούν τα `A↑`/`A↓` (`TABLE_TEXT_HEIGHT_SCALE_MM`). Μια δεύτερη,
 * χειρόγραφη λίστα θα σήμαινε ότι το βήμα προσγειώνεται σε τιμή που το dropdown δεν προσφέρει
 * — και αντίστροφα· δηλαδή δύο απαντήσεις στο «ποια μεγέθη υπάρχουν».
 *
 * `isLiteralLabel` γιατί το κείμενο **είναι** ο αριθμός: δεν υπάρχει κλειδί i18n για το «2.5».
 */
const TEXT_HEIGHT_OPTIONS = TABLE_TEXT_HEIGHT_SCALE_MM.map((mm) => ({
  value: String(mm),
  labelKey: String(mm),
  isLiteralLabel: true,
}));

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά — οι «εντολές» των widgets (δηλώνονται ΠΡΙΝ τον πίνακα: module-level `const`)
// ──────────────────────────────────────────────────────────────────────────────
//
// ⚠️ Ένα `type: 'widget'` κουμπί απαιτεί `command` από τον τύπο, αλλά το `RibbonPanel` δεν το
// αποδίδει ποτέ: το widget είναι αυτοτελές. Το `id` όμως **χρησιμοποιείται** ως React `key`,
// άρα οφείλει να είναι μοναδικό — και το `commandKey` μένει κενό επίτηδες, ώστε καμία
// διαδρομή dispatch να μη νομίσει ότι υπάρχει εντολή να δρομολογήσει.

const WIDGET_NO_COMMAND = { commandKey: '' } as const;

const TEXT_COLOR_WIDGET_COMMAND = {
  id: 'tableFormat.textColor',
  labelKey: 'ribbon.commands.tableFormat.textColor',
  ...WIDGET_NO_COMMAND,
};

const FILL_COLOR_WIDGET_COMMAND = {
  id: 'tableFormat.fillColor',
  labelKey: 'ribbon.commands.tableFormat.fillColor',
  ...WIDGET_NO_COMMAND,
};

const MERGE_WIDGET_COMMAND = {
  id: 'tableFormat.merge',
  labelKey: 'ribbon.commands.tableFormat.merge',
  ...WIDGET_NO_COMMAND,
};

const BORDERS_WIDGET_COMMAND = {
  id: 'tableFormat.borders',
  labelKey: 'ribbon.commands.tableFormat.borders',
  ...WIDGET_NO_COMMAND,
};

const FORMAT_PAINTER_WIDGET_COMMAND = {
  id: 'tableFormat.formatPainter',
  labelKey: 'ribbon.commands.tableFormat.formatPainter',
  ...WIDGET_NO_COMMAND,
};

export const CONTEXTUAL_TABLE_FORMAT_TAB: RibbonTab = {
  id: 'table-format',
  labelKey: 'ribbon.tabs.tableFormat',
  isContextual: true,
  contextualTrigger: TABLE_FORMAT_CONTEXTUAL_TRIGGER,
  // 🔴 §52 — ο κοινός κανόνας του `RibbonRoot` **δεν** θα την ενεργοποιούσε ποτέ: η
  // «Ιδιότητες Πίνακα» είναι ήδη ενεργή όταν εμφανίζεται αυτή. Δες το σχόλιο του πεδίου.
  autoActivateOnAppear: true,
  panels: [
    {
      id: 'table-format-font',
      labelKey: 'ribbon.panels.tableFont',
      keepsTableCellSession: true,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'tableFormat.bold',
                labelKey: 'ribbon.commands.tableFormat.bold',
                icon: 'text-bold',
                commandKey: TABLE_FORMAT_RIBBON_KEYS.toggles.bold,
              },
            },
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'tableFormat.italic',
                labelKey: 'ribbon.commands.tableFormat.italic',
                icon: 'text-italic',
                commandKey: TABLE_FORMAT_RIBBON_KEYS.toggles.italic,
              },
            },
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'tableFormat.underline',
                labelKey: 'ribbon.commands.tableFormat.underline',
                icon: 'text-underline',
                commandKey: TABLE_FORMAT_RIBBON_KEYS.toggles.underline,
              },
            },
            // Τα δύο χρώματα είναι **widgets** και όχι κουμπιά κορδέλας: το καθένα είναι split
            // button με παλέτα, «Αυτόματο», «χρώματα του σχεδίου» και διάλογο true-color — ένα
            // ολόκληρο χειριστήριο που ήδη υπάρχει (`TableAxisColorMenu`). Ξαναγράψιμό του ως
            // ribbon combobox θα ήταν το τρίτο αντίγραφο της ίδιας παλέτας.
            { type: 'widget', size: 'small', widgetId: 'table-text-color', command: TEXT_COLOR_WIDGET_COMMAND },
            { type: 'widget', size: 'small', widgetId: 'table-fill-color', command: FILL_COLOR_WIDGET_COMMAND },
          ],
        },
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'tableFormat.textHeight',
                labelKey: 'ribbon.commands.tableFormat.textHeight',
                commandKey: TABLE_FORMAT_RIBBON_KEYS.textHeight,
                comboboxWidthPx: 84,
                options: TEXT_HEIGHT_OPTIONS,
                // 🔴 `paper-length` και **όχι** `model-length`: το `textHeightMm` είναι ύψος
                // στο **χαρτί** (DXF group code 140), δεμένο στην κλίμακα σχεδίου — πρέπει να
                // μείνει 2.5mm όποια κι αν είναι η μονάδα του έργου (ADR-677 §7.1 / ADR-716).
                numericInput: { quantityKind: 'paper-length', editable: true, allowDecimal: true },
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'tableFormat.sizeUp',
                labelKey: 'ribbon.commands.tableFormat.sizeUp',
                icon: 'table-size-up',
                commandKey: TABLE_FORMAT_RIBBON_KEYS.actions.sizeUp,
                action: TABLE_FORMAT_RIBBON_KEYS.actions.sizeUp,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'tableFormat.sizeDown',
                labelKey: 'ribbon.commands.tableFormat.sizeDown',
                icon: 'table-size-down',
                commandKey: TABLE_FORMAT_RIBBON_KEYS.actions.sizeDown,
                action: TABLE_FORMAT_RIBBON_KEYS.actions.sizeDown,
              },
            },
            // 🔴 ADR-768 Βήμα 5 — **«αντίγραψε μορφή» ακριβώς πριν από «καθάρισε μορφή»**: το
            // ζευγάρι του Excel Home tab, όπου το Format Painter και το Clear Formats απαντούν
            // στην ίδια ερώτηση από τις δύο πλευρές. Widget και όχι κουμπί κορδέλας — δες το
            // μητρώο για το γιατί το `RibbonToggleState` δεν χωρά το «κλειδωμένο».
            //
            // ⚠️ Είναι **η μόνιμη** επιφάνεια του πινέλου: το mini toolbar ζει σε μενού δεξιού
            // κλικ που κλείνει με το πρώτο βάψιμο. Δες `RibbonTableFormatPainterWidget`.
            {
              type: 'widget',
              size: 'small',
              widgetId: 'table-format-painter',
              command: FORMAT_PAINTER_WIDGET_COMMAND,
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'tableFormat.reset',
                labelKey: 'ribbon.commands.tableFormat.reset',
                icon: 'table-reset-format',
                commandKey: TABLE_FORMAT_RIBBON_KEYS.actions.reset,
                action: TABLE_FORMAT_RIBBON_KEYS.actions.reset,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'table-format-cells',
      labelKey: 'ribbon.panels.tableCells',
      keepsTableCellSession: true,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            { type: 'widget', size: 'small', widgetId: 'table-merge', command: MERGE_WIDGET_COMMAND },
            { type: 'widget', size: 'small', widgetId: 'table-borders', command: BORDERS_WIDGET_COMMAND },
          ],
        },
      ],
    },
  ],
};
