/**
 * ADR-739 §27.17 — **η ίδια πράξη, σε πολλούς άξονες**: διαγραφή και εισαγωγή N γραμμών ή
 * στηλών, ως **μία** μεταβολή μοντέλου (άρα ένα βήμα undo).
 *
 * ## 🔴 Καμία δεύτερη υλοποίηση — αναδίπλωση πάνω στη μία
 * Ο πειρασμός ήταν ένα `deleteTableColumns` που φιλτράρει όλες τις ταυτότητες μαζί και
 * ξαναχτίζει εύρη/ακμές/κελιά «πιο αποδοτικά». Θα ήταν **δεύτερος** ορισμός τεσσάρων
 * λεπτών κανόνων που ζουν ήδη γραμμένοι και δοκιμασμένοι στο `table-row-column-ops.ts`:
 * η μετακόμιση άγκυρας συγχώνευσης, η μετακόμιση ρητής ακμής στην επόμενη επιζώσα, το
 * φιλτράρισμα κελιών-ζόμπι, και η ταυτότητα by-reference που κρατά καθαρό το ιστορικό. Ένας
 * από αυτούς θα απέκλινε — και θα το μάθαινε ο χρήστης, όχι ο μεταγλωττιστής.
 *
 * Η αναδίπλωση είναι **γνήσια** ισοδύναμη: οι ταυτότητες δεν αλλάζουν όταν σβήνει ένας
 * γείτονας (γι' αυτό το μοντέλο διάλεξε id αντί για index), άρα η σειρά εκτέλεσης δεν
 * επηρεάζει το αποτέλεσμα. Το κόστος είναι N περάσματα σε πίνακα με **φραγμένο** πλήθος
 * γραμμών/στηλών, μία φορά ανά εντολή χρήστη — ποτέ ανά καρέ.
 *
 * ## 🔴 ΟΛΑ Ή ΤΙΠΟΤΑ — το φράγμα απαντιέται ΜΙΑ φορά, για ΟΛΟ το πλήθος
 * Ο απλοϊκός βρόχος («σβήσε μία-μία όσες προλάβεις») δίνει **σιωπηλά μερικό** αποτέλεσμα:
 * διαγραφή 5 από 5 στηλών θα έσβηνε 4 και θα σταματούσε στο φράγμα «ο πίνακας θέλει
 * τουλάχιστον μία στήλη», αφήνοντας τον χρήστη με ένα βήμα undo που δεν αναιρεί αυτό που
 * ζήτησε. Εδώ το φράγμα ρωτιέται **πριν** από την πρώτη μεταβολή, με το συνολικό πλήθος:
 * ή γίνονται όλες, ή καμία — και το μενού δείχνει το item ανενεργό, όπως ήδη κάνει για την
 * τελευταία εναπομείνασα στήλη.
 *
 * @module subapps/dxf-viewer/bim/table/table-row-column-bulk-ops
 * @see bim/table/table-row-column-ops.ts — η ΜΙΑ υλοποίηση της κάθε πράξης
 * @see bim/table/table-axis-action-target.ts — ΠΟΙΟΥΣ άξονες αφορά η πράξη
 */

import {
  canDeleteTableColumn,
  canDeleteTableRow,
  canInsertTableColumn,
  canInsertTableRow,
  deleteTableColumn,
  deleteTableRow,
  insertTableColumn,
  insertTableRow,
} from './table-row-column-ops';
import type { PersistedTableModel, TableColumnId, TableRowId } from '../../types/table';

/**
 * Σβήνει **όλες** τις γραμμές των ταυτοτήτων, ή καμία.
 *
 * Άγνωστη ταυτότητα δεν είναι σφάλμα: το αντίστοιχο πέρασμα επιστρέφει το ίδιο μοντέλο
 * by-reference (σύμβαση του `deleteTableRow`), οπότε το τελικό αποτέλεσμα είναι «σβήστηκαν
 * όσες υπήρχαν». Το φράγμα μετρά τις **ζητούμενες**, δηλαδή είναι συντηρητικό — και αυτό
 * είναι η σωστή μεριά να πέσει κανείς όταν το μοντέλο δεν συμφωνεί με το `hit`.
 */
export function deleteTableRows(
  model: PersistedTableModel,
  rowIds: readonly TableRowId[],
): PersistedTableModel {
  if (!canDeleteTableRow(model, rowIds.length)) return model;
  return rowIds.reduce((next, rowId) => deleteTableRow(next, rowId), model);
}

/** Το ίδιο για στήλες — ίδιες τέσσερις εγγυήσεις, ίδιο «όλα ή τίποτα». */
export function deleteTableColumns(
  model: PersistedTableModel,
  colIds: readonly TableColumnId[],
): PersistedTableModel {
  if (!canDeleteTableColumn(model, colIds.length)) return model;
  return colIds.reduce((next, colId) => deleteTableColumn(next, colId), model);
}

/**
 * `count` νέες γραμμές στη θέση `atIndex` — όλες μαζί ή καμία.
 *
 * Excel: με τρεις γραμμές μαρκαρισμένες, η «Εισαγωγή» βάζει **τρεις**. Η επανάληψη στην
 * **ίδια** θέση είναι το σωστό: κάθε νέα γραμμή σπρώχνει την προηγούμενη προς τα κάτω, άρα
 * το μπλοκ των `count` καταλήγει ακριβώς εκεί που δείχνει ο δείκτης.
 */
export function insertTableRows(
  model: PersistedTableModel,
  atIndex: number,
  count: number,
): PersistedTableModel {
  if (count < 1 || !canInsertTableRow(model, count)) return model;
  let next = model;
  for (let i = 0; i < count; i++) next = insertTableRow(next, atIndex);
  return next;
}

/** Το ίδιο για στήλες — η κληρονομιά μορφοποίησης από τη στήλη αναφοράς ισχύει για όλες. */
export function insertTableColumns(
  model: PersistedTableModel,
  atIndex: number,
  count: number,
): PersistedTableModel {
  if (count < 1 || !canInsertTableColumn(model, count)) return model;
  let next = model;
  for (let i = 0; i < count; i++) next = insertTableColumn(next, atIndex);
  return next;
}
