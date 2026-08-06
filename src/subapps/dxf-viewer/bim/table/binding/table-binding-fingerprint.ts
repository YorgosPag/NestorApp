/**
 * 🔴 ADR-767 Δ5 — **το `revision` ενός δεμένου πίνακα: αποτύπωμα ΠΕΡΙΕΧΟΜΕΝΟΥ, ποτέ ρολόι.**
 *
 * Καθαρή, ντετερμινιστική συνάρτηση πάνω στο {@link ExportableTable} που παρήγαγε ο resolver.
 * Ίδια δεδομένα ⇒ ίδιο αποτύπωμα ⇒ **early cutoff**: ο πίνακας δεν κοκκινίζει, το μοντέλο δεν
 * ξαναγράφεται, κανένα βήμα undo δεν γεννιέται.
 *
 * ## Γιατί ΟΧΙ οι τρεις προφανείς εναλλακτικές
 * | Εναλλακτική | Γιατί αστοχεί |
 * |---|---|
 * | `Date.now()` | Bazel: *«volatile statuses like timestamps are not part of an action key, as that would make the cache useless»*. Κάθε refresh θα κήρυσσε αλλαγή, ακόμη κι όταν δεν άλλαξε τίποτα |
 * | ο μετρητής του `SceneStore` | είναι **ανά level** — κάθε μετακίνηση τοίχου θα κοκκίνιζε τον πίνακα συντεταγμένων |
 * | `generateSceneChecksum` | χασάρει `entityCount + layerCount + bounds + units`: **κορυφή που μετακινήθηκε χωρίς να αλλάξουν τα όρια είναι ΑΟΡΑΤΗ**. Απαντά άλλη, ασθενέστερη ερώτηση |
 *
 * ## 🔑 Γιατί χασάρεται ΟΛΟΚΛΗΡΟ το `ExportableTable` και όχι μόνο οι στήλες που διαβάζει ο πίνακας
 * Συνειδητή επιλογή, με ρητό trade-off. Ένας πίνακας που δείχνει μόνο `x`/`y` θα κοκκινίσει και
 * όταν αλλάξει ένα `z` — αλλαγή που δεν φαίνεται στα κελιά του. Η εναλλακτική είναι χειρότερη:
 * αποτύπωμα μόνο των **διαβασμένων** στηλών θα άλλαζε κάθε φορά που ο χρήστης προσθέτει ή σβήνει
 * στήλη, δηλαδή ο πίνακας θα δήλωνε «η πηγή άλλαξε» από **δική του** δομική επεξεργασία. Το
 * «μπαγιάτικος» σημαίνει *«αυτός ο πίνακας δεν αντιπροσωπεύει την τρέχουσα κατάσταση της πηγής»* —
 * και αυτό είναι αλήθεια ακόμη και για στήλη που ο χρήστης δεν έχει ακόμη προσθέσει.
 *
 * @module subapps/dxf-viewer/bim/table/binding/table-binding-fingerprint
 * @see utils/fnv1a-hash.ts — η ΜΙΑ μηχανή αποτυπώματος (Δ6)
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ5
 */

import { fnv1aBase36 } from '../../../utils/fnv1a-hash';
import type { ExportableTable, ScheduleCellValue } from '../../schedule/types';

/**
 * Διαχωριστικά **εκτός τυπώσιμου εύρους**, ώστε καμία τιμή κελιού να μην μπορεί να τα
 * παραστήσει: το `JSON.stringify` κωδικοποιεί κάθε χαρακτήρα ελέγχου μέσα σε string ως
 * `\uXXXX`, οπότε περιεχόμενο κελιού δεν μπορεί να μιμηθεί όριο πεδίου και να κάνει δύο
 * διαφορετικούς πίνακες να χασάρουν ίδια.
 *
 * ⚠️ Γράφονται ως **escape sequences** και ποτέ ωμοί: ένα ωμό byte ελέγχου κάνει το αρχείο
 * «binary» για το ripgrep, δηλαδή **αόρατο σε κάθε grep-based πύλη** του έργου (το
 * `table-cell-content.ts` το έχει ήδη πάθει).
 */
const FIELD_SEPARATOR = '\u0001';
const ROW_SEPARATOR = '\u0002';

/**
 * Κωδικοποίηση **με τον τύπο μέσα**.
 *
 * 🔴 Το πρόθεμα δεν είναι διακόσμηση: χωρίς αυτό, `null`, `0` και `''` θα κατέληγαν στην ίδια
 * συμβολοσειρά και το αποτύπωμα θα ήταν **τυφλό στο ADR-720** — ένα κελί που πέρασε από
 * «καμία μέτρηση» σε «μέτρηση 0» δεν θα κήρυσσε τον πίνακα μπαγιάτικο. Το ίδιο ισχύει για τη
 * διάκριση αριθμού `12` από κείμενο `'12'`, που στην εξαγωγή στοιχίζονται διαφορετικά.
 */
function encodeValue(value: ScheduleCellValue | undefined): string {
  if (value === null || value === undefined) return '~';
  if (typeof value === 'number') return `#${value}`;
  return `$${JSON.stringify(value)}`;
}

/**
 * Κανονική μορφή του πίνακα: **κλειδιά στηλών**, μετά κάθε γραμμή στη σειρά των στηλών.
 *
 * Τα κλειδιά μπαίνουν πρώτα ώστε «ίδιες τιμές κάτω από άλλο κλειδί» να δίνει άλλο αποτύπωμα:
 * μια στήλη που μετονομάστηκε αλλάζει **ποιο** κελί του πίνακα τρέφει, δηλαδή είναι αλλαγή
 * περιεχομένου με κάθε πρακτική έννοια.
 */
function canonicalize(table: ExportableTable): string {
  const keys = table.columns.map((column) => column.key);
  const header = `${keys.length}${FIELD_SEPARATOR}${keys.map((k) => JSON.stringify(k)).join(FIELD_SEPARATOR)}`;
  const body = table.rows.map(
    (row) => keys.map((key) => encodeValue(row.cells[key])).join(FIELD_SEPARATOR),
  );
  return [`${table.rows.length}`, header, ...body].join(ROW_SEPARATOR);
}

/**
 * Το αποτύπωμα των δεδομένων που παρήγαγε ο resolver — αυτό που αποθηκεύεται στο
 * `TableBinding.revision` και συγκρίνεται σε κάθε έλεγχο φρεσκάδας.
 */
export function fingerprintExportableTable(table: ExportableTable): string {
  return fnv1aBase36(canonicalize(table));
}
