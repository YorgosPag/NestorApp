/**
 * 🔴 ADR-769 Δ7 — **Ο ΕΝΑΣ ΚΡΙΤΗΣ ΤΟΥ «ΠΟΥ ΠΑΕΙ Η ΓΡΑΦΗ ΑΥΤΟΥ ΤΟΥ ΚΕΛΙΟΥ;»**
 *
 * ## Γιατί υπάρχει: η Φ.ΣΤ είχε **δύο** απαντήσεις, η Φ.Η έχει **τρεις**
 * Μέχρι το ADR-767 η ερώτηση ήταν δυαδική και την απαντούσε το `isBoundCellWritable`:
 * *γράφεται στο μοντέλο* ή *δεν γράφεται*. Η Φ.Η προσθέτει τρίτη απάντηση — *γράφεται, αλλά
 * **αλλού***: στην οντότητα, μέσω του ιδιοκτήτη της. Ένα κελί συντεταγμένης **δεν** είναι
 * read-only· είναι ο **ΠΙΟ** γράψιμος τύπος κελιού που έχει το σύστημα.
 *
 * ⚠️ Αν η τρίτη απάντηση δεν γεννιόταν εδώ, θα γεννιόταν **τρεις φορές**: στον επεξεργαστή
 * (`readOnly`), στον φρουρό της εντολής, και στον ζωγράφο του Δ7. Την πρώτη μέρα θα
 * συμφωνούσαν· την πρώτη φορά που μια στήλη άλλαζε ιδιοκτήτη, ο χρήστης θα έβλεπε πεδίο που
 * δέχεται πληκτρολόγηση και commit που τη ρίχνει στο κενό — **ακριβώς** το σφάλμα που το
 * ADR-767 §11.2 #4 τεκμηρίωσε ζωντανά (η κρίση υπήρχε και κανείς δεν τη ρωτούσε).
 *
 * ## 🔑 Η παράκαμψη **δεν** είναι write-back, και αυτό είναι απόφαση
 * Κελί σε κατάσταση `overridden`/`conflict` απαντά `'model'`: ο άνθρωπος δήλωσε ρητά «θέλω
 * **δική μου** τιμή εδώ, όχι της πηγής» (ADR-767 Δ2). Στέλνοντάς την στον ιδιοκτήτη θα
 * **μετακινούσαμε την κορυφή** επειδή ο χρήστης ζήτησε να μη μετακινηθεί — η ακριβώς αντίθετη
 * πράξη από αυτή που ζήτησε. Οι δύο δρόμοι είναι διακριτοί επειδή οι δύο **προθέσεις** είναι.
 *
 * @module subapps/dxf-viewer/bim/table/write-back/table-cell-write-route
 * @see bim/table/binding/table-binding-state.ts — ο κριτής της Φ.ΣΤ, που καταναλώνεται εδώ
 * @see docs/centralized-systems/reference/adrs/ADR-769-table-live-write-back.md §4 Δ2, Δ7
 */

import { findPersistedCell } from '../table-cell-content';
import { isBoundCellWritable } from '../binding/table-binding-state';
import { tableSourceColumnWriteBack } from '../binding/table-source-resolver';
import type {
  TableColumnUnwritableReason,
  TableWriteBackField,
} from './table-write-back-plan';
import type {
  PersistedTableModel,
  TableBinding,
  TableColumnId,
  TableRowId,
} from '../../../types/table';

/** Γράφεται **στο μοντέλο**, όπως κάθε κελί που πληκτρολογεί ο χρήστης. */
export interface TableWriteRouteModel {
  readonly kind: 'model';
}

/**
 * Γράφεται **στην οντότητα** — ο πίνακας θα ζητήσει από τον ιδιοκτήτη (Δ1).
 *
 * Κουβαλά ό,τι χρειάζεται ο συναρμολογητής του αιτήματος ώστε να μην ξαναρωτήσει το μητρώο:
 * δύο αναγνώσεις της ίδιας απόφασης είναι δύο ευκαιρίες να αποκλίνουν.
 */
export interface TableWriteRouteOwner {
  readonly kind: 'owner';
  readonly sourceKey: string;
  readonly field: TableWriteBackField;
}

/**
 * Δεν γράφεται — με **λόγο** όταν υπάρχει.
 *
 * Το `reason` λείπει μόνο όταν η ίδια η **διαμόρφωση** είναι ελλιπής (δεμένο κελί σε στήλη
 * χωρίς `sourceKey`, ή σε πίνακα χωρίς δεσμό): εκεί δεν υπάρχει απόφαση γραψιμότητας να
 * αναφερθεί, γιατί δεν υπάρχει στήλη πηγής να την κατέχει.
 */
export interface TableWriteRouteReadOnly {
  readonly kind: 'read-only';
  readonly reason?: TableColumnUnwritableReason;
}

export type TableCellWriteRoute =
  | TableWriteRouteModel
  | TableWriteRouteOwner
  | TableWriteRouteReadOnly;

const READ_ONLY: TableWriteRouteReadOnly = { kind: 'read-only' };
const MODEL: TableWriteRouteModel = { kind: 'model' };

/**
 * Πού πάει η γραφή αυτού του κελιού — **μία** ερώτηση, **μία** απάντηση.
 *
 * Καθαρή συνάρτηση πάνω στο ταξιδεύον σχήμα: μηδέν store, μηδέν σκηνή. Η ίδια απάντηση
 * δίνεται στον επεξεργαστή (πριν την πληκτρολόγηση), στον φρουρό (πριν τη γραφή) και στον
 * ζωγράφο (πριν από όλα) — δηλαδή το Δ7 «η γραψιμότητα **φαίνεται** πριν τη γραφή» δεν είναι
 * δεύτερη υλοποίηση της ίδιας κρίσης, είναι **η ίδια κρίση ζωγραφισμένη**.
 */
export function resolveTableCellWriteRoute(
  model: PersistedTableModel,
  binding: TableBinding | undefined,
  rowId: TableRowId,
  colId: TableColumnId,
): TableCellWriteRoute {
  // Ο κριτής της Φ.ΣΤ πρώτος: `unbound` / `overridden` / `conflict` γράφονται στο μοντέλο, και
  // ο λόγος ζει στο ADR-767 Δ1/Δ2 — δεν ξαναγράφεται εδώ ως δεύτερη ανάγνωση του `cell.bound`.
  if (isBoundCellWritable(findPersistedCell(model, rowId, colId))) return MODEL;

  // Από εδώ και κάτω το κελί είναι `bound`: η πηγή το γέμισε και ο άνθρωπος δεν διαφώνησε.
  if (binding === undefined) return READ_ONLY;
  const sourceKey = model.columns.find((column) => column.id === colId)?.sourceKey;
  if (sourceKey === undefined) return READ_ONLY;

  const writeBack = tableSourceColumnWriteBack(binding.sourceRef.kind, sourceKey);
  return writeBack.kind === 'writable'
    ? { kind: 'owner', sourceKey, field: writeBack.field }
    : { kind: 'read-only', reason: writeBack.reason };
}

/**
 * Δέχεται αυτό το κελί πληκτρολόγηση; — η ερώτηση του **επεξεργαστή**, όχι του φρουρού.
 *
 * 🔴 `'owner'` απαντά **ναι**: η γραφή έχει παραλήπτη, απλώς δεν είναι το μοντέλο. Το να
 * άνοιγε read-only θα έκλεινε τη Φ.Η πριν αρχίσει — και θα ήταν το κατοπτρικό σφάλμα του
 * ADR-767 §11.2 #4 (πεδίο που δέχεται και γραφή που δεν προσγειώνεται, ανάποδα).
 */
export function isTableCellTypeable(route: TableCellWriteRoute): boolean {
  return route.kind !== 'read-only';
}
