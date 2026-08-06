/**
 * 🔴 ADR-767 §8 #7 — **Ο ΣΥΓΚΡΙΤΗΣ.** Το αρχείο που κάνει το `revision` πεδίο *με αναγνώστη*.
 *
 * ## Γιατί αυτό το αρχείο γεννήθηκε ΜΑΖΙ με το πεδίο
 * Το ADR-745 αποθηκεύει `TitleBlockBinding.snapshotValue` με ρητό σχόλιο *«τι έγραφε η πινακίδα
 * τη στιγμή της σύνδεσης — **για ανίχνευση απόκλισης**»*. Το πεδίο γράφεται, σειριοποιείται στο
 * Firestore, εμφανίζεται στο UI — και **πουθενά δεν συγκρίνεται με φρέσκια ανάγνωση**. Πέμπτη
 * εμφάνιση του σχήματος «το πεδίο υπάρχει, κανείς δεν κοιτάζει» (N.11/N.12 «0 = κανείς δεν
 * κοίταξε», ADR-587 §6.1 «ένα anchor χωρίς πύλη είναι σχόλιο»).
 *
 * Το `TableBinding.revision` ήταν στον **ίδιο** δρόμο: δηλωμένο από τη Φ.Α, μηδέν αναγνώστες.
 * Το ADR-767 απαγορεύει ρητά την επανάληψη — γι' αυτό ο συγκριτής δεν είναι «επόμενο βήμα».
 *
 * ## Οι τέσσερις καταστάσεις κελιού — μία παραπάνω από κάθε μεγάλο
 * Μόνο η ArchiCAD έχει **τεκμηριωμένη** σύμβαση («μαύρο = μη επεξεργάσιμο, μπλε = επεξεργάσιμο»),
 * και είναι δυαδική. Το Revit αφήνει τον χρήστη να ανακαλύψει με δοκιμή ποια κελιά γράφονται.
 * Εδώ οι καταστάσεις είναι ρητές και **τέσσερις**, γιατί η σύγκρουση δεν είναι είδος
 * παράκαμψης: η παράκαμψη λέει «διαφωνώ», η σύγκρουση λέει «**η πηγή κουνήθηκε κάτω από τη
 * διαφωνία σου**» — και μόνο η δεύτερη απαιτεί απόφαση.
 *
 * @module subapps/dxf-viewer/bim/table/binding/table-binding-state
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ1, §8 #7
 */

import { fingerprintExportableTable } from './table-binding-fingerprint';
import { resolveTableSource } from './table-source-resolver';
import type { TableSourceContext, TableSourceResolution } from './table-source-resolver';
import type { TableBinding, TableCell } from '../../../types/table';

/**
 * Τι είναι ένα κελί ως προς τον δεσμό του.
 *
 * - `unbound`    — ελεύθερο κελί· ο χρήστης το γράφει όπως πάντα.
 * - `bound`      — το γέμισε η πηγή· **read-only εξ ορισμού** (Δ1).
 * - `overridden` — ο χρήστης ξεκλείδωσε και έγραψε· ο δεσμός **επιβιώνει** (Δ2).
 * - `conflict`   — η πηγή άλλαξε κάτω από την παράκαμψη· **και οι δύο** τιμές ζωντανές.
 */
export type TableBoundCellState = 'unbound' | 'bound' | 'overridden' | 'conflict';

export function classifyBoundCell(cell: TableCell | undefined): TableBoundCellState {
  const bound = cell?.bound;
  if (bound === undefined) return 'unbound';
  if (bound.conflict === true) return 'conflict';
  if (bound.overridden === true) return 'overridden';
  return 'bound';
}

/**
 * Δ1 — **δεμένο κελί δεν γράφεται.**
 *
 * Πρότυπο: το AutoCAD Data Link είναι *«locked from editing by default»* και το Revit δεν
 * επιτρέπει **ποτέ** επεξεργασία σε Calculated Value. Ο λόγος εδώ είναι ακόμη πιο ισχυρός: στη
 * Φ.ΣΤ δεν υπάρχει write-back (αυτό είναι ρητά η Φ.Η), άρα **δεν υπάρχει ιδιοκτήτης να δεχτεί
 * τη γραφή** — μια πληκτρολογημένη τιμή θα εξαφανιζόταν στο επόμενο refresh.
 *
 * ⚠️ Αφορά μόνο το **περιεχόμενο**. Η μορφοποίηση (χρώμα, στοίχιση, πλάτος) μένει ελεύθερη,
 * όπως ρητά στο AutoCAD: *«Cell formatting changes do not require unlocking»*.
 */
export function isBoundCellWritable(cell: TableCell | undefined): boolean {
  const state = classifyBoundCell(cell);
  return state !== 'bound';
}

/** Ο πίνακας συμφωνεί με την πηγή. */
export interface TableFresh {
  readonly status: 'fresh';
}

/**
 * Τα νούμερα του πίνακα **δεν** είναι αυτά της πηγής.
 *
 * Το φρέσκο αποτύπωμα δίνεται μαζί ώστε ο καλών να μπορεί να δηλώσει την κατάσταση χωρίς
 * δεύτερη επίλυση — και να τη γράψει αν ο χρήστης πατήσει «Ανανέωση».
 */
export interface TableStale {
  readonly status: 'stale';
  readonly freshRevision: string;
}

/**
 * Δεν μπορεί να απαντηθεί — και **δεν** παριστάνει το «fresh».
 *
 * Ένας πίνακας που δεν μπόρεσε να ελεγχθεί δεν είναι ενημερωμένος· είναι **αβέβαιος**. Η
 * ισοπέδωση των δύο θα ήταν ακριβώς το ψεύτικο πράσινο του N.11/N.12.
 */
export interface TableFreshnessUnknown {
  readonly status: 'unknown';
  readonly reason: Exclude<TableSourceResolution['status'], 'resolved'>;
}

export type TableFreshness = TableFresh | TableStale | TableFreshnessUnknown;

/**
 * 🔴 **Ο έλεγχος μπαγιάτικου** — φθηνός, καθαρός, **χωρίς καμία γραφή**.
 *
 * Επιλύει την πηγή, χασάρει το αποτέλεσμα και το συγκρίνει με το αποθηκευμένο `revision`.
 * Είναι η ίδια διαδρομή που τρέχει και η ανανέωση, οπότε δεν υπάρχει σημείο όπου οι δύο
 * μπορούν να διαφωνήσουν για το τι σημαίνει «άλλαξε».
 *
 * **Early cutoff** (Salsa «backdating»): αν τα δεδομένα βγήκαν ίδια, το αποτύπωμα είναι ίδιο και
 * ο πίνακας **δεν κοκκινίζει** — ακόμη κι αν η σκηνή ξαναχτίστηκε ολόκληρη. Κανένα CAD δεν το
 * κάνει αυτό: όλα κηρύσσουν «changed» με βάση **συμβάν**, όχι περιεχόμενο.
 */
export function assessTableFreshness(
  binding: TableBinding,
  context: TableSourceContext,
): TableFreshness {
  const resolution = resolveTableSource(binding.sourceRef, context);
  if (resolution.status !== 'resolved') return { status: 'unknown', reason: resolution.status };

  const freshRevision = fingerprintExportableTable(resolution.table);
  return freshRevision === binding.revision ? { status: 'fresh' } : { status: 'stale', freshRevision };
}
