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
 * ## 🔴 ΤΟ ΞΕΧΕΙΛΙΣΜΑ ΜΠΗΚΕ (§58 Γ2) — και η θέση του είναι του Excel
 * ⚠️ Εδώ έγραφε: «*Αναδίπλωση κειμένου: το `TableCellOverflow` έχει σήμερα **μία** τιμή
 * (`'clip'`)… δική της φάση*». **Η αιτία εξαφανίστηκε**: το §58 έγραψε ολόκληρη τη μηχανή
 * (γραμμοκοπή, ισορρόπηση, ύψος από περιεχόμενο, τέσσερα backends) και η ένωση έχει πλέον τρεις
 * τιμές. Το κουμπί κάθεται στο **τέλος της σειράς 1**, ακριβώς όπου το βάζει το Excel:
 * ```
 *   σειρά 1:  πάνω     μέση     κάτω   │  αναδίπλωση  σμίκρυνση
 *   σειρά 2:  αριστερά κέντρο   δεξιά  │  συγχώνευση
 * ```
 * 🏆 Η **σμίκρυνση** δεν υπάρχει στην κορδέλα του Excel (μόνο στον διάλογο «Μορφοποίηση
 * κελιών»). Μπαίνει **μετά** την αναδίπλωση, ώστε καμία θέση του Excel να μη μετακινηθεί — ίδια
 * αρχή με το «τρίτο τμήμα» του mini toolbar (§55).
 *
 * ## 🔴 Η ΕΣΟΧΗ ΜΠΗΚΕ (§59 Δ2) — και συμπληρώνει τη σειρά 2 στη θέση του Excel
 * ⚠️ Εδώ έγραφε: «*Προσανατολισμός και εσοχή ±: δεν υπάρχουν στο μοντέλο κελιού — ούτε ως
 * πεδίο, ούτε ως μηχανή απόδοσης*». **Η αιτία εξαφανίστηκε** και για τα δύο: το §59 έγραψε
 * `TableAxisStyleOverride.indentLevel` (Δ2) και `textRotationDeg` (Δ1), μαζί με τη διάταξη που
 * τα τιμά. Η πλήρης εικόνα είναι πλέον **ταυτόσημη με του Excel, θέση προς θέση**:
 * ```
 *   σειρά 1:  πάνω     μέση     κάτω   │  ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΣ▾  αναδίπλωση  σμίκρυνση
 *   σειρά 2:  αριστερά κέντρο   δεξιά  │  ΕΣΟΧΗ−  ΕΣΟΧΗ+     συγχώνευση
 * ```
 * (Η σμίκρυνση είναι η μία προσθήκη του ΝΕΣΤΟΡΑ, στο **τέλος** της σειράς — δες παραπάνω.)
 *
 * ## Τι ΔΕΝ υπάρχει εδώ, και γιατί
 * · **Η εσοχή ΔΕΝ μπήκε στο mini toolbar**, και είναι απόφαση παρότι το ξεχείλισμα μπήκε:
 *   επαληθεύτηκε ότι το mini toolbar του Excel **δεν έχει** εσοχή (έχει: γραμματοσειρά,
 *   μέγεθος, A↑/A↓, Β/Ι, περιγράμματα, γέμισμα, χρώμα, λογιστική/%/χιλιάδες, δεκαδικά ±,
 *   κεντράρισμα, συγχώνευση, πινέλο). Το επιχείρημα που έφερε τη **σμίκρυνση** εκεί —
 *   «κατάσταση χωρίς ένδειξη και χωρίς διέξοδο» — **δεν ισχύει** για την εσοχή: η μετατόπιση
 *   είναι ορατή με γυμνό μάτι, και η «Επαναφορά μορφοποίησης» (↺, θέση που **ήδη υπάρχει** στο
 *   mini toolbar) τη σβήνει.
 * · **«Αυτόματο ύψος γραμμής»**: υπάρχει, αλλά στην καρτέλα **«Ιδιότητες Πίνακα»** — γράφει σε
 *   *γραμμή*, όχι σε κελί, και το Excel το βάζει κι εκείνο στην ομάδα «Κελιά» (*Format ▸ AutoFit
 *   Row Height*), ποτέ στη «Στοίχιση».
 *
 * @module subapps/dxf-viewer/ui/ribbon/data/contextual-table-format-align-panel
 * @see bim/table/table-align-ops.ts — τι κάνει το πάτημα στοίχισης (SSoT)
 * @see bim/table/table-overflow-ops.ts — τι κάνει το πάτημα ξεχειλίσματος (SSoT)
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

/**
 * 🔴 §58 Γ2 — ένα κουμπί ξεχειλίσματος. **Ίδιο σχήμα, άλλο πρόθεμα κλειδιού** από το
 * {@link alignButton}.
 *
 * Δεν συγχωνεύεται με εκείνο σε μια κοινή «toggleButton(prefix, …)»: θα ήταν παράμετρος που
 * κρύβει ότι πρόκειται για **δύο διαφορετικές ερωτήσεις** (πού κάθεται το κείμενο · τι γίνεται
 * όταν δεν χωράει) με δύο διαφορετικούς φύλακες στον bridge — και το πρώτο ορθογραφικό λάθος σε
 * ένα πρόθεμα θα έδινε κουμπί που κανένας φύλακας δεν δέχεται, δηλαδή σιωπή.
 */
function overflowButton(commandKey: string, id: string, icon: string): RibbonButton {
  return {
    type: 'toggle',
    size: 'small',
    command: {
      id: `tableFormat.overflow.${id}`,
      labelKey: `ribbon.commands.tableFormat.overflow.${id}`,
      icon,
      commandKey,
    },
  };
}

/**
 * 🔴 §59 Δ1 — ένα κουμπί **προσανατολισμού**. `toggle` και όχι `action`, σε αντίθεση με την
 * εσοχή από κάτω: η γωνία **έχει** δίτιμη απάντηση ανά κουμπί («είναι αυτό το κελί κατακόρυφο
 * προς τα πάνω;»), η εσοχή είναι αριθμός επιπέδων και δεν έχει.
 */
function rotationButton(commandKey: string, id: string, icon: string): RibbonButton {
  return {
    type: 'toggle',
    size: 'small',
    command: {
      id: `tableFormat.rotation.${id}`,
      labelKey: `ribbon.commands.tableFormat.rotation.${id}`,
      icon,
      commandKey,
    },
  };
}

/**
 * 🔴 §59 Δ2 — ένα κουμπί **εσοχής**. `action` και όχι `toggle`: η εσοχή είναι **αριθμός**
 * επιπέδων, όχι δίτιμο — «είναι πατημένη;» δεν έχει απάντηση σε επίπεδο 3. Ίδια ακριβώς
 * διάκριση με τα δεκαδικά της ομάδας «Αριθμός», που είναι κι εκείνα στεπερ.
 */
function indentButton(commandKey: string, id: string, icon: string): RibbonButton {
  return {
    type: 'action',
    size: 'small',
    command: {
      id: `tableFormat.indent.${id}`,
      labelKey: `ribbon.commands.tableFormat.indent.${id}`,
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
        // 🔴 §59 Δ1 — **η θέση του «Προσανατολισμού» στο Excel**: αμέσως μετά τις τρεις
        // κατακόρυφες στοιχίσεις και **πριν** την αναδίπλωση. Εκεί είναι ένα πτυσσόμενο με πέντε
        // προεπιλογές· εδώ είναι τα **δύο** που έχουν νόημα σε σχέδιο, γιατί το `type: 'split'`
        // είναι δομικά αδύνατο σε contextual καρτέλα πίνακα (§57) και ένα πτυσσόμενο με δύο
        // επιλογές είναι δύο κλικ για ό,τι κάνει το ένα.
        rotationButton(TABLE_FORMAT_RIBBON_KEYS.rotation.up, 'up', 'table-rotate-text-up'),
        rotationButton(TABLE_FORMAT_RIBBON_KEYS.rotation.down, 'down', 'table-rotate-text-down'),
        // §58 Γ2 — η θέση της αναδίπλωσης στο Excel: **τέλος της σειράς 1** της ομάδας
        // «Στοίχιση». Η σμίκρυνση ακολουθεί (δεν υπάρχει στην κορδέλα του Excel — δες κεφαλίδα).
        overflowButton(TABLE_FORMAT_RIBBON_KEYS.overflow.wrap, 'wrap', 'table-wrap-text'),
        overflowButton(TABLE_FORMAT_RIBBON_KEYS.overflow.shrink, 'shrink', 'table-shrink-text'),
      ],
    },
    {
      isInFlyout: false,
      buttons: [
        alignButton(TABLE_FORMAT_RIBBON_KEYS.align.left, 'left', 'table-align-left'),
        alignButton(TABLE_FORMAT_RIBBON_KEYS.align.center, 'center', 'table-align-center'),
        alignButton(TABLE_FORMAT_RIBBON_KEYS.align.right, 'right', 'table-align-right'),
        // 🔴 §59 Δ2 — **η θέση του Excel, ακριβώς**: «Μείωση» πριν από «Αύξηση», αμέσως μετά τα
        // τρία οριζόντια και **πριν** τη συγχώνευση. Η σειρά «λιγότερο → περισσότερο» είναι
        // αντίθετη από τη διαίσθηση («πρώτα το θετικό») και είναι του Excel· ανεστραμμένη, ο
        // χρήστης με μνήμη χεριού θα έβγαζε εσοχή κάθε φορά που ήθελε να βάλει.
        indentButton(TABLE_FORMAT_RIBBON_KEYS.actions.indentDecrease, 'decrease', 'table-indent-decrease'),
        indentButton(TABLE_FORMAT_RIBBON_KEYS.actions.indentIncrease, 'increase', 'table-indent-increase'),
        // Widget και όχι κουμπί κορδέλας: είναι split button με μενού («συγχώνευση», «κατά
        // γραμμές», «αναίρεση») που **ήδη υπάρχει** (`TableMergeMenu`). Ξαναγράψιμό του για την
        // κορδέλα θα ήταν δεύτερη υλοποίηση της ίδιας εντολής.
        { type: 'widget', size: 'small', widgetId: 'table-merge', command: MERGE_WIDGET_COMMAND },
      ],
    },
  ],
};
