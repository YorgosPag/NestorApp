/**
 * ADR-833 Φάση 3 — **Η ΑΛΛΑΓΗ ΕΝΕΡΓΟΥ ΦΥΛΛΟΥ**, ως καθαρός σχεδιαστής.
 *
 * Καμία παρενέργεια: παίρνει οντότητα + στόχο + τον δρομέα της στιγμής, δίνει **ένα** μπάλωμα
 * και **μία** θέση δρομέα προς επαναφορά. Ποιος το γράφει στη σκηνή είναι δουλειά του
 * καλούντος — και είναι ο **υπάρχων** γραφέας χωρίς ιστορικό, όχι νέο μονοπάτι.
 *
 * ## 🔴 ΓΙΑΤΙ Η ΕΝΕΡΓΟΠΟΙΗΣΗ **ΔΕΝ ΕΙΝΑΙ ΒΗΜΑ UNDO**
 * Το `activeWorksheetId` ζει στην **οντότητα** (επιβιώνει αποθήκευσης, όπως το `activeTab` του
 * Excel) αλλά γράφεται **χωρίς** `UpdateEntityCommand`. Ούτε το Excel βάζει την ενεργοποίηση
 * φύλλου στη στοίβα αναίρεσης: ο χρήστης που πατά `Ctrl+Z` θέλει πίσω τα **δεδομένα** του, όχι
 * την καρτέλα — και μια στοίβα γεμάτη «άλλαξα καρτέλα» θα έθαβε την πράξη που όντως θέλει να
 * αναιρέσει.
 *
 * ⛔ Και **ποτέ store «ενεργό φύλλο»**: θα ήταν δεύτερη αλήθεια δίπλα στο πεδίο της οντότητας,
 * και θα έπαυε να επιβιώνει save. Το ADR-833 §5.3 το απαγορεύει ονομαστικά.
 *
 * ## 🔴 Η ΜΝΗΜΗ ΕΝΕΡΓΟΥ ΚΕΛΙΟΥ ΑΝΑ ΦΥΛΛΟ — ΓΡΑΦΕΤΑΙ **ΕΔΩ**, ΚΑΙ ΜΟΝΟ ΕΔΩ
 * Η Φάση 2 άφησε γραμμένη υπόσχεση στο `state/table-cell-cursor-scope.ts`: *«Το Excel θυμάται
 * χωριστό ενεργό κελί ανά φύλλο και **θα το κάνουμε κι εμείς** — αλλά αυτό είναι μνήμη ανά
 * φύλλο, δηλαδή δεδομένα που κανείς δεν κρατά ακόμη, και έρχεται με τις καρτέλες (Φάση 3)»*.
 * Αυτή είναι η Φάση 3.
 *
 * Το κρίσιμο είναι **πότε** γράφεται: στη στιγμή που το φύλλο **εγκαταλείπεται**, μέσα στο
 * **ίδιο** μπάλωμα που αλλάζει το ενεργό φύλλο. Μία εγγραφή σκηνής ανά αλλαγή καρτέλας —
 * όχι μία ανά πάτημα βέλους. Δες τη δήλωση του πεδίου (`types/table-worksheet.ts`) για το
 * γιατί η προφανής εναλλακτική είναι απόδοση React σε θερμή διαδρομή.
 *
 * ## Η εγγύηση ταυτότητας ανεβαίνει, όπως στο `table-worksheet-write.ts`
 * Όταν τίποτα δεν αλλάζει σε ένα φύλλο, επιστρέφεται **το ίδιο αντικείμενο** — και όταν
 * τίποτα δεν αλλάζει συνολικά, `null`. Χωρίς αυτό, ένα κλικ στην **ήδη ενεργή** καρτέλα θα
 * παρήγαγε νέα οντότητα ⇒ ακύρωση κάθε απομνημόνευσης διάταξης ⇒ πλήρες ξαναχτίσιμο, για το
 * τίποτα. Είναι ο ίδιος φύλακας no-op που κρατά όλο το σύστημα πινάκων.
 *
 * @module subapps/dxf-viewer/bim/table/table-worksheet-activate
 * @see bim/table/table-worksheet-write.ts — η αδελφή πλευρά (γραφή **μοντέλου** στο ενεργό)
 * @see state/table-cell-cursor-scope.ts — η υπόσχεση της Φάσης 2 που κλείνει εδώ
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.3
 */

import { resolveTableModel } from './table-model-helpers';
import { tableCursorAt, tableFirstCursorPosition } from './table-cell-navigation';
import type { TableCursorPosition } from './table-cell-navigation';
import { activeWorksheet, resolveWorksheets } from './table-worksheet-resolve';
import { tableWorksheetsPatch, type TableWorksheetsPatch } from './table-worksheet-write';
import type { TableEntity } from '../../types/table-entity';
import type { TableWorksheet, TableWorksheetId } from '../../types/table-worksheet';

/** Ό,τι παράγει μια αλλαγή καρτέλας: **ένα** μπάλωμα, **μία** θέση δρομέα. */
export interface TableWorksheetActivation {
  /**
   * Το μπάλωμα οντότητας — φύλλα **και** νέο ενεργό, μαζί.
   *
   * 🔑 **Ατομικά, και αυτό είναι δομικό.** Το `activeWorksheetId` και η μνήμη δρομέα του φύλλου
   * που εγκαταλείπεται είναι δύο πεδία που **απαγορεύεται** να γραφτούν χωριστά: ανάμεσά τους ο
   * δρομέας θα ανήκε σε φύλλο που δεν είναι πια ενεργό, δηλαδή θα κρινόταν άκυρος
   * (`tableCursorFor`) και η μνήμη θα γραφόταν **κενή**. Ίδιο ακριβώς επιχείρημα με το ζεύγος
   * `{ model, binding }` του `buildTableBindingRefreshCommand` (ADR-833 §5.2).
   */
  readonly patch: TableWorksheetsPatch;
  /**
   * Πού πρέπει να προσγειωθεί ο δρομέας στο **νέο** φύλλο· `null` όταν δεν υπάρχει δρομέας να
   * μετακινηθεί (απλή επιλογή — ο χρήστης δεν είναι **μέσα** στον πίνακα).
   *
   * ⚠️ `null` σημαίνει «**μην** δημιουργήσεις δρομέα». Μια αλλαγή καρτέλας δεν είναι είσοδος σε
   * λειτουργία πίνακα: εκείνη ανοίγει με διπλό κλικ ή `Enter`/`F2`, και μόνο.
   */
  readonly restoreCursor: TableCursorPosition | null;
}

/**
 * Το σχέδιο της αλλαγής, ή `null` όταν δεν αλλάζει τίποτα (κλικ στην **ήδη ενεργή** καρτέλα,
 * ή στόχος που δεν υπάρχει).
 *
 * @param cursor Ο δρομέας **αυτού** του πίνακα και του **ενεργού** του φύλλου, ή `null`. Έρχεται
 *   ως όρισμα και δεν διαβάζεται εδώ, με τη σύμβαση που κρατά καθαρό ολόκληρο το `bim/`: εδώ
 *   απαντιέται «τι πρέπει να γίνει», ποτέ «τι κατάσταση έχει η εφαρμογή». Ο **ΕΝΑΣ** φύλακας
 *   που κρίνει αν ο δρομέας είναι «δικός μου» ζει στο `state/table-cell-cursor-scope.ts` και
 *   τον εφαρμόζει ο καλών — μια δεύτερη κρίση εδώ θα ήταν δεύτερη απάντηση στο ίδιο ερώτημα.
 */
export function planWorksheetActivation(
  entity: TableEntity,
  targetId: TableWorksheetId,
  cursor: TableCursorPosition | null,
): TableWorksheetActivation | null {
  const worksheets = resolveWorksheets(entity);
  const leaving = activeWorksheet(entity);
  const target = worksheets.find((sheet) => sheet.id === targetId);
  // Άγνωστος στόχος ⇒ **τίποτα**, ποτέ πτώση στο πρώτο φύλλο. Η ανοχή του `activeWorksheet`
  // υπάρχει για **ανάγνωση** μπαγιάτικης κατάστασης· εδώ πρόκειται για **πράξη** που ζήτησε
  // άνθρωπος, και μια πράξη που προσγειώνεται αλλού από εκεί που δείχτηκε είναι χειρότερη από
  // μια πράξη που δεν έγινε.
  if (!target || target.id === leaving.id) return null;

  const remembered = rememberCursor(leaving, cursor);
  const next = remembered === leaving
    ? worksheets
    : worksheets.map((sheet) => (sheet === leaving ? remembered : sheet));

  return {
    patch: { ...tableWorksheetsPatch(entity, next), activeWorksheetId: targetId },
    // Ο δρομέας επαναφέρεται **μόνο** αν υπήρχε. Δες το πεδίο.
    restoreCursor: cursor ? worksheetLandingCursor(target) : null,
  };
}

/**
 * Το φύλλο που εγκαταλείπεται, με τη θέση του δρομέα γραμμένη πάνω του — **ίδια αναφορά** όταν
 * δεν υπάρχει δρομέας ή όταν η μνήμη είναι ήδη η ίδια.
 *
 * ⚠️ Ο φύλακας ισότητας δεν είναι μικρο-βελτιστοποίηση: χωρίς αυτόν, δύο εναλλαγές μπρος-πίσω
 * ανάμεσα σε δύο φύλλα θα παρήγαγαν **κάθε φορά** νέο αντικείμενο φύλλου ⇒ νέο
 * `PersistedTableModel` περιτύλιγμα ⇒ ακύρωση της αλυσίδας WeakMap που κρατά τη διάταξη του
 * ανενεργού φύλλου ζωντανή (ADR-833 §5.2, «η ταυτότητα ΕΙΝΑΙ η έκδοση»).
 */
function rememberCursor(
  leaving: TableWorksheet,
  cursor: TableCursorPosition | null,
): TableWorksheet {
  if (!cursor) return leaving;
  const previous = leaving.cursor;
  if (previous?.rowId === cursor.rowId && previous?.colId === cursor.colId) return leaving;
  // Μόνο η **θέση**, ποτέ το `anchorColId`: δες τη δήλωση του πεδίου για το γιατί η στήλη
  // αγκύρωσης είναι κατάσταση χειρονομίας και όχι θέσης.
  return { ...leaving, cursor: { rowId: cursor.rowId, colId: cursor.colId } };
}

/**
 * Πού προσγειώνεται ο δρομέας στο φύλλο που **ανοίγει**: εκεί που το άφησε ο χρήστης, αλλιώς
 * στο πρώτο κελί.
 *
 * 🔴 **Η μνήμη επικυρώνεται, δεν εμπιστεύεται.** Ένα `rowId` που δεν υπάρχει πια (διαγράφηκε
 * όσο το φύλλο ήταν ανενεργό — ή, πιο ρεαλιστικά, ένα `Ctrl+Z` που γύρισε το μοντέλο πίσω)
 * θα έδινε δρομέα σε **ανύπαρκτο** κελί: το `moveTableCursor` απορρίπτει μπαγιάτικη αφετηρία
 * (`return null`), δηλαδή ο χρήστης θα έβλεπε πλαίσιο και **κανένα βέλος δεν θα δούλευε**.
 * Σφάλμα χωρίς εξαίρεση και χωρίς ίχνος — ακριβώς η κλάση που κυνήγησε ολόκληρη η Φάση 2.
 *
 * 🔑 **ADR-833 Φάση 4 — εξάγεται, γιατί απέκτησε δεύτερο καλούντα.** Η **διαγραφή** του ενεργού
 * φύλλου κάνει κάποιο άλλο φύλλο ενεργό, δηλαδή ρωτά **το ίδιο ακριβώς** ερώτημα («πού
 * προσγειώνεται ο δρομέας στο φύλλο που ανοίγει;»). Ένα δεύτερο σώμα στο `table-worksheet-ops`
 * θα ήταν sibling clone (N.18) — και, χειρότερα, θα ήταν το αντίγραφο που ξεχνά την
 * **επικύρωση** της μνήμης, δηλαδή θα ξαναγεννούσε ακριβώς το σφάλμα που περιγράφεται από πάνω.
 */
export function worksheetLandingCursor(target: TableWorksheet): TableCursorPosition | null {
  // Ο **ίδιος** απομνημονευμένος (WeakMap) δρόμος που περνά και η γεωμετρία: ίδιο persisted ⇒
  // ίδιο μοντέλο, άρα καμία δεύτερη αποσειριοποίηση για μια ερώτηση ύπαρξης.
  const model = resolveTableModel(target.model);
  const remembered = target.cursor;
  if (
    remembered &&
    model.rows.some((row) => row.id === remembered.rowId) &&
    model.columns.some((column) => column.id === remembered.colId)
  ) {
    // Νέα στήλη αγκύρωσης: η επιστροφή σε φύλλο είναι νέα αφετηρία, όπως ένα κλικ.
    return tableCursorAt(remembered.rowId, remembered.colId);
  }
  return tableFirstCursorPosition(model);
}
