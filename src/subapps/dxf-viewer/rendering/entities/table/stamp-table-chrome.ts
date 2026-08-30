/**
 * ADR-833 §0.2 — **τα χειριστήρια-κουμπιά του πίνακα**, βγαλμένα από τον `TableRenderer`.
 *
 * Ζωγραφίζει το `⊖` της διαγραφής και το `⊕` της εισαγωγής: τα **μόνα** στοιχεία ολόκληρης
 * της διαδρομής απόδοσης του πίνακα που λειτουργούν ως **κουμπιά** — κάθονται έξω από το
 * πλέγμα, δεν σκεπάζουν δεδομένα, και τίποτα δεν επιτρέπεται να σκεπάσει **αυτά**.
 *
 * ## Γιατί εξήχθη (και γιατί ΟΧΙ ως «καθάρισμα»)
 *
 * Ο `TableRenderer.ts` ήταν στις **494/500** γραμμές. Το ADR-833 προσθέτει μία κλήση
 * (`stampTableWorksheetTabs`) — δηλαδή η **πύλη μεγέθους (CHECK 4)** θα μπλόκαρε το commit
 * πριν καν γραφτεί η λειτουργία. Η εξαγωγή δεν είναι αισθητική: είναι το **προαπαιτούμενο**.
 *
 * Η τομή δεν είναι αυθαίρετη — είναι το ήδη υπάρχον `if (selected)` μπλοκ, δηλαδή ό,τι
 * ζωγραφίζεται **επειδή ο πίνακας είναι επιλεγμένος και έξω από το πλέγμα**. Η λωρίδα
 * καρτελών φύλλων (ADR-833 Φάση 3) απαντά στην **ίδια** ερώτηση και θα προστεθεί εδώ, όχι
 * σε τρίτο σημείο.
 *
 * ⚠️ **Καθαρή μετακίνηση**: τα σχόλια των δύο περιστατικών (§40 ανακάλυψη κατά Word, §42
 * στοίβαξη πλυσίματος) ήρθαν **αυτούσια** — δεν συνοψίστηκαν. Ένα σχόλιο που εξηγεί γιατί
 * μια σειρά είναι έτσι χάνει την αξία του τη στιγμή που θα κοπεί στο μισό.
 *
 * @module rendering/entities/table/stamp-table-chrome
 * @see rendering/entities/TableRenderer.ts — ο μοναδικός καλών
 */

import type { StampTableContext } from './stamp-table-layout';
import type { TableLayout } from '../../../bim/table/table-layout-types';
import { stampTableInsertControl } from './stamp-table-insert-control';
import { getTableInsertControl } from '../../../state/table-insert-control-store';
import { stampTableDeleteControl } from './stamp-table-delete-control';
import { getTableDeleteControl } from '../../../state/table-delete-control-store';
import { tableDeleteSpanRectMm } from '../../../bim/table/table-delete-control';
import { tableIndicatorBandsMm } from '../../../bim/table/table-indicator-geometry';

/**
 * 🔴 ADR-739 §40 — **ΤΟ ⊕ ΤΗΣ ΕΙΣΑΓΩΓΗΣ, ΕΞΩ ΑΠΟ ΤΟΝ ΔΡΟΜΕΑ.**
 *
 * Η θέση αυτού του μπλοκ **είναι** η προδιαγραφή, όχι λεπτομέρεια στοίβαξης. Ο Giorgio το
 * ζήτησε ως full parity με το Word (04/08), όπου το ⊕ εμφανίζεται μόλις αγγίξεις τον πίνακα —
 * χωρίς να μπεις μέσα του. Πίσω από τον δρομέα θα ζωγραφιζόταν **μόνο** μετά από διπλό κλικ,
 * δηλαδή θα το έβρισκε μόνο όποιος ήδη ξέρει ότι υπάρχει: ακριβώς η αστοχία ανακάλυψης που το
 * §31.8 μέτρησε ζωντανά δύο φορές.
 *
 * Ο φύλακας είναι το `selected` — το ίδιο που φυλά και τον δρομέα. Καλύπτει **και τις δύο**
 * καταστάσεις με μία συνθήκη, γιατί σε λειτουργία πίνακα η οντότητα είναι επιλεγμένη ούτως ή
 * άλλως. Ποια από τις δύο τρέχει το ξέρει η **γεωμετρία** (`TableInsertControlMode`), όχι ο
 * ζωγράφος: εδώ ζωγραφίζεται ό,τι απάντησε η σάρωση, στη θέση που εκείνη υπολόγισε.
 *
 * Τελευταίο σε ολόκληρη τη διαδρομή: κάθεται **έξω** από το πλέγμα, άρα δεν σκεπάζει δεδομένα —
 * αλλά τίποτα δεν επιτρέπεται να σκεπάσει αυτό, γιατί είναι το μόνο στοιχείο του πίνακα που
 * λειτουργεί ως κουμπί.
 *
 * @param entityId Φιλτράρισμα ως προς ΑΥΤΟΝ τον πίνακα: δύο πίνακες στη σκηνή δεν μοιράζονται
 *   χειριστήριο — ο ίδιος έλεγχος που κάνει ήδη ο hover των ζωνών και ο δρομέας.
 */
export function stampTableChromeControls(
  rc: StampTableContext,
  entityId: string,
  layout: TableLayout,
): void {
  // 🔴 ADR-739 §42 — **το ⊖ της διαγραφής, ΠΡΙΝ το ⊕.**
  //
  // Η σειρά δεν λύνει επικάλυψη (το ⊕ ζει έξω από τη ζώνη, το ⊖ μέσα της) — δηλώνει
  // **στοίβαξη του πλυσίματος**: η κόκκινη προεπισκόπηση καλύπτει ζώνη + κενό + πλέγμα,
  // και τίποτα δεν επιτρέπεται να την αφήσει να περάσει πάνω από το ⊕. Με αντίστροφη
  // σειρά, ένα ⊖ οπλισμένο στην πρώτη στήλη θα ξέπλενε τον δίσκο της εισαγωγής από δίπλα.
  //
  // ⚠️ Το ορθογώνιο υπολογίζεται **εδώ** από τον στόχο που κουβαλά το store, ποτέ από τη
  // λωρίδα κάτω από το ποντίκι: με τρεις στήλες μαρκαρισμένες φεύγουν τρεις (§27.17), και
  // η προεπισκόπηση οφείλει να βάψει ό,τι ακριβώς θα σβήσει το πάτημα.
  const remove = getTableDeleteControl();
  if (remove?.entityId === entityId) {
    stampTableDeleteControl(
      rc,
      remove.control,
      tableDeleteSpanRectMm(
        layout,
        remove.target.axis,
        remove.target.firstIndex,
        remove.target.lastIndex,
        tableIndicatorBandsMm(rc.pxPerMm),
      ),
    );
  }
  const insert = getTableInsertControl();
  if (insert?.entityId === entityId) {
    stampTableInsertControl(rc, insert.control, {
      widthMm: layout.widthMm,
      heightMm: layout.heightMm,
    });
  }
}
