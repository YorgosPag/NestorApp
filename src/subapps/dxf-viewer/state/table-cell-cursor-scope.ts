/**
 * 🔴 ADR-833 Φάση 2 — **ΣΕ ΠΟΙΟΝ ΑΝΗΚΕΙ Ο ΔΡΟΜΕΑΣ**: ο ΕΝΑΣ φύλακας «ποιος πίνακας **και ποιο
 * φύλλο**».
 *
 * ## Το σφάλμα, ολόκληρο
 * Πριν από τα φύλλα, η ερώτηση ήταν μισή και η απάντηση αντιγραφόταν σε **οκτώ** σημεία:
 *
 * ```ts
 *   cursor.entityId === entity.id      // «ο δρομέας είναι δικός μου;»
 * ```
 *
 * Με φύλλα, αυτή η γραμμή απαντά **λάθος** και δεν το λέει: ο δρομέας του φύλλου Α περνά τον
 * έλεγχο ενώ ενεργό είναι το Β, γιατί ο πίνακας είναι όντως ο ίδιος. Και οι ταυτότητες
 * γραμμής/στήλης **συμπίπτουν** ανάμεσα στα φύλλα (κάθε φύλλο ξεκινά με `r0…`/`c0…` από τον
 * ίδιο κατασκευαστή), οπότε το επόμενο γράψιμο δεν αποτυγχάνει — **προσγειώνεται στο ομώνυμο
 * κελί του λάθους φύλλου**. Σφάλμα τιμής, χωρίς εξαίρεση, χωρίς μήνυμα.
 *
 * ## Γιατί ΕΝΑ αρχείο και όχι μια γραμμή σε κάθε αναγνώστη
 * Οκτώ αντίγραφα σημαίνει **οκτώ** ευκαιρίες να ξεχαστεί το δεύτερο σκέλος — και το ξεχασμένο
 * αντίγραφο δεν κοκκινίζει πουθενά, γιατί με **ένα** φύλλο (η κατάσταση σήμερα, και για κάθε
 * πίνακα που δεν άνοιξε ποτέ δεύτερη καρτέλα) οι δύο ερωτήσεις δίνουν την ίδια απάντηση.
 * Δηλαδή: η παράλειψη θα ήταν **αόρατη μέχρι να μετρήσει**.
 *
 * ## Τα δύο πρόσωπα της ίδιας ερώτησης
 * ```
 *   έχω οντότητα, θέλω τον δρομέα της   →  tableCursorFor(entity)     (getter, ADR-040 κανόνας #2)
 *   έχω δρομέα, θέλω την οντότητά του   →  tableForCursor(entity, cursor)  (καθαρό, για render)
 * ```
 * Δύο ονόματα, **ένα** κριτήριο: το `matchesCursorScope` από κάτω. Χωρίς αυτόν τον διαχωρισμό,
 * ο ένας από τους δύο δρόμους θα ξαναέγραφε το κριτήριο — και θα ήταν ο πρώτος που θα αποκλίνει.
 *
 * ⚠️ **Ο δρομέας ΔΕΝ μεταναστεύει σε αλλαγή καρτέλας**: κρίνεται **άκυρος**. Το Excel θυμάται
 * χωριστό ενεργό κελί ανά φύλλο και θα το κάνουμε κι εμείς — αλλά αυτό είναι **μνήμη ανά
 * φύλλο**, δηλαδή δεδομένα που κανείς δεν κρατά ακόμη, και έρχεται με τις καρτέλες (Φάση 3).
 * Μέχρι τότε το «άκυρος» είναι η **ασφαλής** και ειλικρινής απάντηση: ένας δρομέας που δεν
 * ξέρουμε πού ανήκει δεν επιτρέπεται να γράψει πουθενά.
 *
 * @module subapps/dxf-viewer/state/table-cell-cursor-scope
 * @see state/table-cell-cursor-store.ts — ο μηχανισμός του δρομέα
 * @see bim/table/table-worksheet-resolve.ts — ποιο είναι το ενεργό φύλλο
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.2
 */

import { getTableCellCursor } from './table-cell-cursor-store';
import { activeWorksheet } from '../bim/table/table-worksheet-resolve';
import type { TableCellCursorState } from './table-cell-cursor-state';
import type { TableEntity } from '../types/table-entity';

/**
 * Το **ΕΝΑ** κριτήριο. Ιδιωτικό επίτηδες: οι δύο δημόσιες συναρτήσεις είναι κατευθύνσεις της
 * ίδιας ερώτησης, όχι δύο ερωτήσεις.
 */
function matchesCursorScope(
  cursor: TableCellCursorState | null,
  entity: TableEntity | null,
): boolean {
  if (!cursor || !entity) return false;
  if (cursor.entityId !== entity.id) return false;
  return cursor.worksheetId === activeWorksheet(entity).id;
}

/**
 * Ο δρομέας **αυτού** του πίνακα και του **ενεργού** του φύλλου — `null` σε κάθε άλλη περίπτωση.
 *
 * Διαβάζει το store **τη στιγμή της κλήσης** (getter, ADR-040 κανόνας #2): οι καταναλωτές του
 * είναι ο ζωγράφος (χρόνος καρέ) και χειριστές συμβάντων, και κανένας από τους δύο δεν
 * επιτρέπεται να δει την κατάσταση του τελευταίου render.
 */
export function tableCursorFor(entity: TableEntity): TableCellCursorState | null {
  const cursor = getTableCellCursor();
  return matchesCursorScope(cursor, entity) ? cursor : null;
}

/**
 * Η **οντότητα** του δρομέα — `null` όταν ο δρομέας δεν ανήκει στο ενεργό της φύλλο.
 *
 * Καθαρή (δέχεται και τα δύο ως ορίσματα) ώστε να μπορεί να κληθεί μέσα σε απόδοση React, όπου
 * ο δρομέας έρχεται από `useTableCellCursor()` και πρέπει να είναι μέρος των εξαρτήσεων.
 */
export function tableForCursor(
  entity: TableEntity | null,
  cursor: TableCellCursorState | null,
): TableEntity | null {
  return matchesCursorScope(cursor, entity) ? entity : null;
}
