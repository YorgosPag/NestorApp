/**
 * 🔴 ADR-739 §56 / ADR-760 — **η ομάδα «Αριθμός»** της καρτέλας «Μορφοποίηση».
 *
 * ## 🔴 ΤΟ ΜΟΝΤΕΛΟ ΥΠΗΡΧΕ ΟΛΟΚΛΗΡΟ· ΕΛΕΙΠΕ Η ΚΟΡΔΕΛΑ
 * Το ADR-760 έγραψε τον τύπο ({@link TableCellFormat}, οκτώ είδη) και τη μηχανή απόδοσης· το
 * §55 έγραψε τον **γραφέα** (`table-number-format-ops.ts`) και τα πέντε κουμπιά του mini
 * toolbar. Το ίδιο εκείνο αρχείο δήλωνε γραπτά ότι «θα ακολουθήσουν **δεύτερη (κορδέλα)** και
 * τρίτη (διάλογος)» επιφάνεια. Αυτή είναι η δεύτερη — και δεν φέρνει **καμία** νέα απόφαση για
 * το τι σημαίνει «%»: τη ρωτά, όπως και η πρώτη.
 *
 * ## 🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟΥ EXCEL
 * ```
 *   σειρά 1:  λογιστική   %   000
 *   σειρά 2:  .0←   .00→
 * ```
 * Ίδια θέση-θέση με το mini toolbar (§55), και για τον ίδιο λόγο: μνήμη χεριού, όχι ανάγνωση
 * εικονιδίων.
 *
 * ## Τρία toggles και δύο ενέργειες — η διάκριση είναι του μοντέλου, όχι της οθόνης
 * Τα τρία πρώτα αλλάζουν το **είδος** και έχουν κατάσταση να δείξουν («είναι ποσοστό;») ⇒
 * `toggle` με `aria-pressed`. Τα δεκαδικά μετακινούν την **ακρίβεια** μέσα σε ό,τι ισχύει ήδη ⇒
 * στεπερ, καμία `aria-pressed`. Είναι ακριβώς ο διαχωρισμός που κάνει και ο τύπος
 * `TableNumberFormatCommandId` του SSoT, όπου τα δεκαδικά **λείπουν από την ένωση επίτηδες**.
 *
 * ## Τι ΔΕΝ υπάρχει ακόμη
 * Το **πτυσσόμενο μορφής** («Γενική / Αριθμός / Νόμισμα / Ημερομηνία / …»), δηλαδή η πρώτη
 * θέση της ομάδας στο Excel. Τα οκτώ είδη υπάρχουν στον τύπο, αλλά ένα combobox εκεί οφείλει
 * να απαντά και το «με πόσα δεκαδικά;» / «ποιο νόμισμα;» — δηλαδή είναι ο **διάλογος**
 * «Μορφοποίηση κελιών» σε μικρογραφία, η τρίτη επιφάνεια που προβλέπει το ADR-760.
 *
 * @module subapps/dxf-viewer/ui/ribbon/data/contextual-table-format-number-panel
 * @see bim/table/table-number-format-ops.ts — τι κάνει το πάτημα (SSoT)
 */

import type { RibbonPanelDef } from '../types/ribbon-types';
import { TABLE_FORMAT_RIBBON_KEYS } from '../hooks/bridge/table-format-command-keys';

export const TABLE_FORMAT_NUMBER_PANEL: RibbonPanelDef = {
  id: 'table-format-number',
  labelKey: 'ribbon.panels.tableNumber',
  keepsTableCellSession: true,
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'toggle',
          size: 'small',
          command: {
            id: 'tableFormat.numberFormat.accounting',
            labelKey: 'ribbon.commands.tableFormat.numberFormat.accounting',
            icon: 'table-number-accounting',
            commandKey: TABLE_FORMAT_RIBBON_KEYS.numberFormat.accounting,
          },
        },
        {
          type: 'toggle',
          size: 'small',
          command: {
            id: 'tableFormat.numberFormat.percent',
            labelKey: 'ribbon.commands.tableFormat.numberFormat.percent',
            icon: 'table-number-percent',
            commandKey: TABLE_FORMAT_RIBBON_KEYS.numberFormat.percent,
          },
        },
        {
          type: 'toggle',
          size: 'small',
          command: {
            id: 'tableFormat.numberFormat.grouping',
            labelKey: 'ribbon.commands.tableFormat.numberFormat.grouping',
            icon: 'table-number-grouping',
            commandKey: TABLE_FORMAT_RIBBON_KEYS.numberFormat.grouping,
          },
        },
      ],
    },
    {
      isInFlyout: false,
      buttons: [
        // ⚠️ **Μείωση πρώτα, αύξηση δεύτερη** — η σειρά του Excel, που είναι αντίθετη από τη
        // διαίσθηση («πρώτα το +»). Ίδια σειρά με το mini toolbar, ώστε οι δύο επιφάνειες να
        // μη διδάσκουν διαφορετική θέση για την ίδια εντολή.
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'tableFormat.decimalDown',
            labelKey: 'ribbon.commands.tableFormat.decimalDown',
            icon: 'table-decimal-down',
            commandKey: TABLE_FORMAT_RIBBON_KEYS.actions.decimalDown,
            action: TABLE_FORMAT_RIBBON_KEYS.actions.decimalDown,
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'tableFormat.decimalUp',
            labelKey: 'ribbon.commands.tableFormat.decimalUp',
            icon: 'table-decimal-up',
            commandKey: TABLE_FORMAT_RIBBON_KEYS.actions.decimalUp,
            action: TABLE_FORMAT_RIBBON_KEYS.actions.decimalUp,
          },
        },
      ],
    },
  ],
};
