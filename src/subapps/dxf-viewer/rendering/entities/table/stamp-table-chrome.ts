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
 * ζωγραφίζεται **επειδή ο πίνακας είναι επιλεγμένος και έξω από το πλέγμα**.
 *
 * ✅ **ΚΑΙ Η ΠΡΟΒΛΕΨΗ ΕΠΑΛΗΘΕΥΤΗΚΕ**: η λωρίδα καρτελών φύλλων (ADR-833 Φάση 3) απαντά στην
 * **ίδια** ερώτηση και μπήκε εδώ, όχι σε τρίτο σημείο.
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
import type { TableEntity } from '../../../types/table-entity';
// 🔴 ADR-833 Φάση 3 — η λωρίδα καρτελών: γεωμετρία → ζωγράφος, με τον **ίδιο** πίνακα slots
// που καταναλώνει και το πάτημα. Δες την κεφαλίδα της γεωμετρίας.
import { tableWorksheetTabLayout } from '../../../bim/table/table-worksheet-tabs-geometry';
import { resolveWorksheetFields } from '../../../bim/table/table-worksheet-resolve';
import { stampTableWorksheetTabs } from './stamp-table-worksheet-tabs';
import { getTableIndicatorHover } from '../../../state/table-indicator-hover-store';
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
 * @param entity Η **ζωντανή** οντότητα. Ήταν `entityId` μέχρι τη Φάση 3· η λωρίδα καρτελών
 *   χρειάζεται τα **φύλλα** της, όχι μόνο την ταυτότητά της. Το φιλτράρισμα ως προς ΑΥΤΟΝ τον
 *   πίνακα μένει ακέραιο (δύο πίνακες στη σκηνή δεν μοιράζονται χειριστήριο ούτε hover) — απλώς
 *   η ταυτότητα διαβάζεται πλέον από την οντότητα, δηλαδή δεν μπορεί να δοθεί ξένη.
 */
export function stampTableChromeControls(
  rc: StampTableContext,
  entity: TableEntity,
  layout: TableLayout,
): void {
  const entityId = entity.id;
  // 🔴 ADR-833 Φάση 3 — **Η ΛΩΡΙΔΑ ΠΡΩΤΗ**, και η σειρά δεν λύνει επικάλυψη: η λωρίδα ζει στην
  // **κάτω** ακμή, τα δύο χειριστήρια στην πάνω και την αριστερή (δες
  // `tableInsertControlOuterPx`). Δηλώνει προτεραιότητα **στοίβαξης**: τα `⊖`/`⊕` είναι τα
  // μόνα στοιχεία του πίνακα που λειτουργούν ως **κουμπιά**, και τίποτα δεν επιτρέπεται να τα
  // σκεπάσει — ούτε καν χρώμιο πλοήγησης που σήμερα δεν τα ακουμπά.
  //
  // ⚠️ Τα φύλλα ζητούνται από τη **ΜΙΑ ΠΥΛΗ** (`resolveWorksheetFields`), ποτέ ως ωμό
  // `entity.worksheets`: μια οντότητα της παλιάς μορφής δεν έχει κανένα από τα δύο πεδία, και
  // η ωμή ανάγνωση θα έδινε «μηδέν φύλλα» — δηλαδή σιωπηλά καμία λωρίδα, για πάντα.
  const { worksheets, activeWorksheetId } = resolveWorksheetFields(entity);
  const tabs = tableWorksheetTabLayout(
    worksheets,
    activeWorksheetId,
    layout.widthMm,
    layout.heightMm,
    rc.pxPerMm,
  );
  if (tabs.length > 0) {
    // Ίδιος κανόνας ανάγνωσης με κάθε άλλο store εδώ: getter τη στιγμή του καρέ (ADR-040), και
    // **φιλτραρισμένο ως προς ΑΥΤΟΝ** τον πίνακα — δύο πίνακες στη σκηνή δεν μοιράζονται hover.
    const hover = getTableIndicatorHover();
    const hovered =
      hover?.entityId === entityId && hover.target.kind === 'worksheet-tab'
        ? hover.target.worksheetId
        : null;
    stampTableWorksheetTabs(rc, tabs, hovered);
  }

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
