/**
 * 🔴 ADR-739 §56 — **η ομάδα «Στοίχιση»** της καρτέλας «Μορφοποίηση», 1:1 με του Excel.
 *
 * ## 🔴 ΕΞΙ ΚΟΥΜΠΙΑ, ΟΧΙ ΕΝΑ ΠΤΥΣΣΟΜΕΝΟ — και δεν είναι ασυνέπεια
 * Το mini toolbar δείχνει **ένα** κουμπί με βελάκι για την ίδια εντολή ({@link TableAlignMenu}),
 * και αυτό είναι σωστό εκεί: η γραμμή πρέπει να χωρά πάνω από το μενού δεξιού κλικ. Το Excel
 * κάνει **ακριβώς το ίδιο** — πτυσσόμενο όπου δεν υπάρχει πλάτος, έξι κουμπιά στην κορδέλα όπου
 * υπάρχει. Η κοινή γνώση δεν είναι η διάταξη· είναι ο **κανόνας**, και ζει στο
 * `bim/table/table-align-ops.ts` που ρωτούν και οι δύο επιφάνειες.
 *
 * ## 🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟΥ EXCEL, ΚΑΙ ΕΙΝΑΙ ΜΝΗΜΗ ΧΕΡΙΟΥ
 * ```
 *   σειρά 1:  πάνω     μέση     κάτω
 *   σειρά 2:  αριστερά κέντρο   δεξιά    │ συγχώνευση
 * ```
 * Η **κάθετη** στοίχιση πάνω και η **οριζόντια** κάτω — όχι το αντίστροφο. Ο χρήστης που ξέρει
 * Excel φτάνει χωρίς να διαβάσει εικονίδια, και μια «λογικότερη» σειρά θα ακύρωνε ακριβώς αυτό
 * που ζητήθηκε.
 *
 * ⚠️ **Η συγχώνευση ζει ΕΔΩ** και όχι σε ομάδα «Κελιά»: στο Excel το «Συγχώνευση και στοίχιση
 * στο κέντρο» είναι η τελευταία θέση της ομάδας «Στοίχιση», γιατί **είναι** εντολή στοίχισης —
 * το ίδιο της το όνομα το λέει. Μέχρι το §56 καθόταν δίπλα στα περιγράμματα, που είναι άλλη
 * ερώτηση (πώς πλαισιώνεται, όχι πού κάθεται το κείμενο).
 *
 * ## Τι ΔΕΝ υπάρχει εδώ, και γιατί
 * · **Προσανατολισμός** (γωνία κειμένου) και **εσοχή ±**: δεν υπάρχουν στο μοντέλο κελιού —
 *   ούτε ως πεδίο, ούτε ως μηχανή απόδοσης. Κουμπί χωρίς πράξη είναι υπόσχεση που δεν τηρείται
 *   (§52: «δεν έλειπε κουμπί, έλειπε η πράξη»).
 * · **Αναδίπλωση κειμένου**: το `TableCellOverflow` έχει σήμερα **μία** τιμή (`'clip'`) και το
 *   ίδιο του το σχόλιο απαιτεί «κάθε νέα τιμή μπαίνει **μαζί** με τη μηχανή της» — εδώ η μηχανή
 *   αλλάζει **ύψος γραμμής**, δηλαδή γεωμετρία οντότητας. Δική της φάση, με απόφαση ιδιοκτήτη.
 *
 * @module subapps/dxf-viewer/ui/ribbon/data/contextual-table-format-align-panel
 * @see bim/table/table-align-ops.ts — τι κάνει το πάτημα (SSoT)
 */

import type { RibbonButton, RibbonPanelDef } from '../types/ribbon-types';
import { TABLE_FORMAT_RIBBON_KEYS } from '../hooks/bridge/table-format-command-keys';

/**
 * Ένα κουμπί στοίχισης — **παράγεται**, ποτέ γραμμένο έξι φορές.
 *
 * Οι έξι δηλώσεις διαφέρουν σε **τρία** αλφαριθμητικά και τίποτε άλλο· γραμμένες με το χέρι θα
 * ήταν ο κλασικός sibling clone μέσα στο ίδιο diff (N.18, CHECK 3.28) — και, χειρότερα, έξι
 * ευκαιρίες να ξεχαστεί το `size` ή να γραφτεί λάθος `commandKey` σε ένα από αυτά.
 */
function alignButton(commandKey: string, id: string, icon: string): RibbonButton {
  return {
    type: 'toggle',
    size: 'small',
    command: {
      id: `tableFormat.align.${id}`,
      labelKey: `ribbon.commands.tableFormat.align.${id}`,
      icon,
      commandKey,
    },
  };
}

const MERGE_WIDGET_COMMAND = {
  id: 'tableFormat.merge',
  labelKey: 'ribbon.commands.tableFormat.merge',
  commandKey: '',
} as const;

export const TABLE_FORMAT_ALIGN_PANEL: RibbonPanelDef = {
  id: 'table-format-align',
  labelKey: 'ribbon.panels.tableAlign',
  // 🔴 §52 — χωρίς αυτό, το κλικ στο «στοίχιση αριστερά» κλείνει τον δρομέα και μαζί του την
  // ίδια την καρτέλα που μόλις πάτησες. Δες `TABLE_SESSION_KEEPALIVE_MARKER`.
  keepsTableCellSession: true,
  rows: [
    {
      isInFlyout: false,
      buttons: [
        alignButton(TABLE_FORMAT_RIBBON_KEYS.align.top, 'top', 'table-align-top'),
        alignButton(TABLE_FORMAT_RIBBON_KEYS.align.middle, 'middle', 'table-align-middle'),
        alignButton(TABLE_FORMAT_RIBBON_KEYS.align.bottom, 'bottom', 'table-align-bottom'),
      ],
    },
    {
      isInFlyout: false,
      buttons: [
        alignButton(TABLE_FORMAT_RIBBON_KEYS.align.left, 'left', 'table-align-left'),
        alignButton(TABLE_FORMAT_RIBBON_KEYS.align.center, 'center', 'table-align-center'),
        alignButton(TABLE_FORMAT_RIBBON_KEYS.align.right, 'right', 'table-align-right'),
        // Widget και όχι κουμπί κορδέλας: είναι split button με μενού («συγχώνευση», «κατά
        // γραμμές», «αναίρεση») που **ήδη υπάρχει** (`TableMergeMenu`). Ξαναγράψιμό του για την
        // κορδέλα θα ήταν δεύτερη υλοποίηση της ίδιας εντολής.
        { type: 'widget', size: 'small', widgetId: 'table-merge', command: MERGE_WIDGET_COMMAND },
      ],
    },
  ],
};
