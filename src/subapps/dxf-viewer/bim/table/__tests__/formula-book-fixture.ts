/**
 * 🔴 ADR-833 Φάση 7 — **ΤΟ ΒΙΒΛΙΟ ΕΝΟΣ ΦΥΛΛΟΥ, ΓΙΑ ΤΑ TEST ΠΟΥ ΔΕΝ ΕΧΟΥΝ ΒΙΒΛΙΟ.**
 *
 * Η μηχανή τύπων δέχεται πλέον **βιβλίο** και όχι μοντέλο, γιατί ένας τύπος μπορεί να διαβάζει
 * άλλο φύλλο. Οι δεκάδες υπάρχουσες σουίτες όμως ρωτούν πράγματα που **δεν αφορούν** τα φύλλα
 * (προτεραιότητα τελεστών, συρρίκνωση ευρών, μετακόμιση αναφορών), και για εκείνες η αλήθεια
 * είναι ακριβώς αυτή: *«εδώ υπάρχει ένα φύλλο»*.
 *
 * ## Γιατί fixture και όχι προεπιλεγμένη παράμετρος στην παραγωγή
 * Μια προεπιλογή στο `soleWorksheetBook` θα σήμαινε ότι μια **παραγωγική** διαδρομή που ξέχασε
 * το βιβλίο δίνει `#REF!` σε κάθε δια-φυλλική αναφορά — **σιωπηλά**, και ακριβώς εκεί που
 * μετράει (ADR-833 §5.6.5: «καμία σιωπηλή απώλεια»). Το ρητό όνομα εδώ κρατά τη διάκριση
 * ορατή: ό,τι καλεί αυτή τη συνάρτηση **δηλώνει** ότι δεν έχει βιβλίο.
 *
 * @module subapps/dxf-viewer/bim/table/__tests__/formula-book-fixture
 * @see bim/table/formula/table-formula-workbook.ts — ο πραγματικός τύπος
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.9
 */

import type { PersistedTableModel, TableModel } from '../../../types/table';
import type { PendingCellWrites } from '../table-cell-content';
import { commitCellWrites } from '../formula/table-formula-engine';
import {
  soleWorksheetBook,
  type TableFormulaWorkbook,
} from '../formula/table-formula-workbook';
import { resolveTableModel } from '../table-model-helpers';

/**
 * **Το αποθηκευμένο σχήμα κρατά πίνακα κελιών· το υπολογιστικό, `Map`.** Η διάκριση γίνεται
 * με κατηγόρημα τύπου και όχι με `as`: ένας ισχυρισμός εδώ θα δεχόταν σιωπηλά λάθος σχήμα και
 * θα έσκαγε βαθιά μέσα στη μηχανή, με μήνυμα που δεν λέει ποιος το έδωσε.
 */
function isPersisted(model: PersistedTableModel | TableModel): model is PersistedTableModel {
  return Array.isArray(model.cells);
}

/** Βιβλίο ενός φύλλου γύρω από **οποιοδήποτε** από τα δύο σχήματα μοντέλου. */
export function bookOf(model: PersistedTableModel | TableModel): TableFormulaWorkbook {
  return soleWorksheetBook(isPersisted(model) ? resolveTableModel(model) : model);
}

/**
 * `commitCellWrites` με το βιβλίο του **ίδιου** του εκκρεμούς μοντέλου.
 *
 * ⚠️ Το βιβλίο βγαίνει από το `pending.model` και όχι από κάποιο προηγούμενο στιγμιότυπο, με
 * τον ίδιο λόγο που το κάνει και η παραγωγή: η πόρτα εγκαθιστά **το ζωντανό πλέγμα** πριν
 * αξιολογήσει, αλλιώς ο τύπος που μόλις γράφτηκε διαβάζεται πάνω στο προηγούμενο.
 */
export function commitPendingForTest(pending: PendingCellWrites): PersistedTableModel {
  return commitCellWrites(bookOf(pending.model), pending);
}
