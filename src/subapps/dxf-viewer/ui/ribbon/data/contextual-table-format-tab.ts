/**
 * 🔴 ADR-739 §52 — **η contextual καρτέλα «Μορφοποίηση»**: εμφανίζεται μόλις μπεις σε κελί
 * πίνακα και **γίνεται αυτόματα ενεργή**.
 *
 * Είναι η δεύτερη μισή του σύνθετου trigger (ADR-566): η «Ιδιότητες Πίνακα» ανοίγει με την
 * επιλογή της οντότητας και **μένει** — αυτή προστίθεται δίπλα της. Ακριβώς όπως η κορδέλα
 * του Excel: το φύλλο δεν χάνει τις καρτέλες του επειδή μπήκες σε κελί, αποκτά μία ακόμη.
 *
 * ## 🔴 §56 — Η ΟΜΑΔΟΠΟΙΗΣΗ ΕΙΝΑΙ ΤΟΥ EXCEL, ΟΧΙ ΔΙΚΗ ΜΑΣ
 * ```
 *   Γραμματοσειρά:  [οικογένεια ▾][μέγεθος ▾] A↑ A↓ │ B I U  περιγράμματα▾ γέμισμα▾ χρώμα▾
 *   Στοίχιση:       πάνω μέση κάτω │ αριστερά κέντρο δεξιά  συγχώνευση▾
 *   Αριθμός:        λογιστική % 000 │ .0← .00→
 * ```
 * Δύο χειριστήρια **μετακόμισαν** και η μετακόμιση είναι όλη η ουσία του §56:
 * · τα **περιγράμματα** ήταν σε ομάδα «Κελιά» — στο Excel ζουν στη **Γραμματοσειρά**·
 * · η **συγχώνευση** ήταν δίπλα τους — στο Excel είναι η τελευταία θέση της **Στοίχισης**,
 *   γιατί **είναι** εντολή στοίχισης («Συγχώνευση και στοίχιση στο κέντρο»).
 *
 * Η ομάδα «Κελιά» έπαψε να υπάρχει: ήταν δικό μας δοχείο για ό,τι δεν είχε ακόμη σπίτι, και
 * κρατούσε μαζί δύο ερωτήσεις που το Excel χωρίζει — «πώς πλαισιώνεται» και «πού κάθεται».
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
 * ## Φάσεις (απόφαση ιδιοκτήτη 2026-08-06, αναθεωρημένη 2026-08-07)
 * **Φ1 = ό,τι υπήρχε ήδη** (Β/Ι/Υ, χρώματα, μέγεθος, merge, borders) — έκλεισε.
 * **Φ2 = §56**: οικογένεια γραμματοσειράς · στοίχιση · μορφή αριθμού. Και τα τρία είχαν ήδη
 * **μοντέλο, γραφέα και ανάγνωση** από το §55 — έλειπε μόνο η επιφάνεια.
 * Μένουν, με σειρά που όρισε ο ιδιοκτήτης: ομάδα **«Πρόχειρο»** (αποκοπή/αντιγραφή/επικόλληση,
 * όπου μετακομίζει και το πινέλο), και τελευταία η **αναδίπλωση κειμένου** — η μόνη που
 * απαιτεί νέα μηχανή αντί για νέο κουμπί (αλλάζει ύψος γραμμής, άρα γεωμετρία οντότητας).
 *
 * @see ui/ribbon/data/contextual-table-tab.ts — η πρώτη μισή του σύνθετου trigger
 * @see ui/ribbon/hooks/useRibbonTableFormatBridge.ts — ο bridge
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §52, §56
 */

import type { RibbonTab } from '../types/ribbon-types';
import { TABLE_FORMAT_RIBBON_KEYS } from '../hooks/bridge/table-format-command-keys';
import { TABLE_TEXT_HEIGHT_SCALE_MM } from '../../../bim/table/table-text-height-scale';
import { TABLE_FORMAT_CLIPBOARD_PANEL } from './contextual-table-format-clipboard-panel';
import { TABLE_FORMAT_ALIGN_PANEL } from './contextual-table-format-align-panel';
import { TABLE_FORMAT_NUMBER_PANEL } from './contextual-table-format-number-panel';

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

const BORDERS_WIDGET_COMMAND = {
  id: 'tableFormat.borders',
  labelKey: 'ribbon.commands.tableFormat.borders',
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
    // 🔴 §57 — **πρώτη**, όπως στο Excel. Δες την κεφαλίδα της για το γιατί η θέση είναι μνήμη
    // χεριού και όχι αισθητική.
    TABLE_FORMAT_CLIPBOARD_PANEL,
    {
      id: 'table-format-font',
      labelKey: 'ribbon.panels.tableFont',
      keepsTableCellSession: true,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            // 🔴 §56 — **η οικογένεια, πρώτη θέση**, όπως στο Excel. Οι επιλογές της είναι
            // δυναμικές (έρχονται από τη σκηνή μέσω του bridge) — γι' αυτό καμία `options` εδώ:
            // μια στατική λίστα θα ήταν δεύτερη απάντηση στο «ποιες γραμματοσειρές υπάρχουν».
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'tableFormat.fontFamily',
                labelKey: 'ribbon.commands.tableFormat.fontFamily',
                commandKey: TABLE_FORMAT_RIBBON_KEYS.fontFamily,
                comboboxWidthPx: 148,
              },
            },
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
          ],
        },
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
            // 🔴 §56 — τα **περιγράμματα** μετακόμισαν εδώ από την πρώην ομάδα «Κελιά»: στο
            // Excel είναι η τέταρτη θέση της σειράς 2 της «Γραμματοσειράς», ανάμεσα στο «Υ» και
            // στο γέμισμα. Ίδιο widget, άλλη ομάδα — καμία αλλαγή στη συμπεριφορά του.
            { type: 'widget', size: 'small', widgetId: 'table-borders', command: BORDERS_WIDGET_COMMAND },
            // Τα δύο χρώματα είναι **widgets** και όχι κουμπιά κορδέλας: το καθένα είναι split
            // button με παλέτα, «Αυτόματο», «χρώματα του σχεδίου» και διάλογο true-color — ένα
            // ολόκληρο χειριστήριο που ήδη υπάρχει (`TableAxisColorMenu`). Ξαναγράψιμό του ως
            // ribbon combobox θα ήταν το τρίτο αντίγραφο της ίδιας παλέτας.
            { type: 'widget', size: 'small', widgetId: 'table-fill-color', command: FILL_COLOR_WIDGET_COMMAND },
            { type: 'widget', size: 'small', widgetId: 'table-text-color', command: TEXT_COLOR_WIDGET_COMMAND },
            // ✅ §57 — **το πινέλο ΜΕΤΑΚΟΜΙΣΕ** στην ομάδα «Πρόχειρο», όπου ζει και στο Excel.
            // Η προσωρινότητα της θέσης του εδώ ήταν δηλωμένη από το §56· ο λόγος της μετακόμισης
            // είναι σημασιολογικός και ζει στην κεφαλίδα του `contextual-table-format-clipboard-panel.ts`.
            //
            // ⚠️ Η «Επαναφορά μορφοποίησης» από κάτω **μένει** εδώ: στο Excel ζει στο
            // «Επεξεργασία → Απαλοιφή», ομάδα που δεν υπάρχει ακόμη. Δηλωμένη απόκλιση.
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
    TABLE_FORMAT_ALIGN_PANEL,
    TABLE_FORMAT_NUMBER_PANEL,
  ],
};
