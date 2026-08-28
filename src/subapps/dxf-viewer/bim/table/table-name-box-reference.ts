/**
 * 🔴 ADR-739 §69 — **ΤΙ ΣΗΜΑΙΝΕΙ Ο,ΤΙ ΠΛΗΚΤΡΟΛΟΓΗΘΗΚΕ ΣΤΟ ΠΛΑΙΣΙΟ ΟΝΟΜΑΤΟΣ.**
 * Καθαρό: μηδέν React, μηδέν DOM, μηδέν store.
 *
 * Το πλαίσιο ονόματος του Excel δεν είναι ετικέτα — είναι **πόρτα**: γράφεις `B7` και
 * πηγαίνεις, γράφεις `A1:B5` και **μαρκάρεις**. Οι δύο απαντήσεις είναι διαφορετικές
 * (η μία κουνά τον δρομέα, η άλλη κουνά τον δρομέα **και** γράφει περιοχή), και ο
 * καλών δεν επιτρέπεται να μαντέψει ποια ισχύει.
 *
 * ## 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΓΡΑΜΜΕΣ ΣΤΟ `table-cell-reference.ts`
 * Ήταν η πρώτη επιλογή, και είναι **δομικά αδύνατη**: η ανάγνωση εδώ οφείλει να περνά από
 * το {@link resolveWrittenCellRef}, που ζει στο `formula/table-formula-absolute.ts` — και
 * **εκείνο** εισάγει ήδη από το `table-cell-reference.ts`. Ο κύκλος θα ήταν άμεσος.
 *
 * Η αναγκαστική θέση αποδεικνύεται και **σωστή**: ο ονοματοδότης κελιών απαντά «πώς
 * λέγεται αυτό το κελί;», ο αναλυτής τύπων «τι διαβάζει αυτός ο τύπος;», και εδώ ζει μια
 * τρίτη ερώτηση που δεν είναι καμία από τις δύο — «**πού με στέλνει ο άνθρωπος;**».
 *
 * ## 🔴 ΓΙΑΤΙ `resolveWrittenCellRef` ΚΑΙ ΟΧΙ `parseTableCellReference`
 * Το δεύτερο είναι πιο κοντά (ίδιο αρχείο με την ονομασία, καμία εξάρτηση από τύπους) και
 * θα ήταν **λάθος**: δεν δέχεται `$`. Το Excel δέχεται `$B$7` στο πλαίσιο ονόματος, και ο
 * χρήστης που μόλις πάτησε `F4` μέσα σε τύπο και αντέγραψε την αναφορά θα έπαιρνε σιωπηλή
 * άρνηση. Ο αποκολλητής του `$` υπάρχει ήδη και είναι **ο ΕΝΑΣ** (`resolveWrittenCellRef`,
 * ρητά τεκμηριωμένος ως «η ΜΙΑ ανάγνωση μιας γραμμένης αναφοράς», με τρεις καταναλωτές).
 * Ένα τέταρτο regex εδώ θα ήταν η **δεύτερη γραμματική** που εκείνο το αρχείο υπάρχει για
 * να αποτρέψει (N.18).
 *
 * ⚠️ Οι σημαίες `$` **απορρίπτονται** εδώ επίτηδες: μια θέση δρομέα δεν έχει απόλυτο ή
 * σχετικό. Το `$` επιτρέπεται στην **είσοδο** επειδή ο άνθρωπος το γράφει· δεν επιβιώνει
 * στην **έξοδο**, γιατί δεν σημαίνει τίποτα εκεί.
 *
 * @module subapps/dxf-viewer/bim/table/table-name-box-reference
 * @see bim/table/formula/table-formula-absolute.ts — η ΜΙΑ ανάγνωση γραμμένης αναφοράς
 * @see bim/table/table-cell-reference.ts — ο αντίστροφος δρόμος (κελί → `'B7'`)
 * @see ui/table-cell-editor/TableNameBox.tsx — ο ΕΝΑΣ καταναλωτής
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §69
 */

import { RANGE_SEPARATOR } from './table-cell-reference';
import { resolveWrittenCellRef } from './formula/table-formula-absolute';
import { tableCursorAt, type TableCursorPosition } from './table-cell-navigation';
import type { TableCellRef, TableSelectionSpan } from './table-cell-range';
import type { TableModel } from '../../types/table';

/**
 * Πού στέλνει μια πληκτρολογημένη αναφορά: **πάντα** μια θέση δρομέα, και **προαιρετικά**
 * μια περιοχή όταν γράφτηκε εύρος.
 *
 * ## Γιατί η περιοχή είναι `null` και όχι μονοκύτταρο εύρος
 * Η ρητή απόφαση του §27.15 — «**καμία επιλογή ≠ επιλογή 1×1**», επιβεβαιωμένη από τον
 * ιδιοκτήτη. Ένα `B7` που γεννούσε `B7:B7` θα μάρκαρε ένα κελί που ο χρήστης δεν ζήτησε, και
 * θα άλλαζε σιωπηλά το αντικείμενο του επόμενου `Ctrl+C`.
 */
export interface TableNameBoxTarget {
  readonly position: TableCursorPosition;
  readonly selection: TableSelectionSpan | null;
}

/**
 * `'B7'` → πήγαινε εκεί. `'A1:B5'` → πήγαινε στο `A1` **και** μάρκαρε ως το `B5`.
 *
 * `null` όταν το κείμενο δεν είναι αναφορά, δείχνει εκτός πλέγματος, ή έχει περισσότερα από
 * δύο άκρα. Οι τρεις περιπτώσεις είναι αδιάκριτες για τον καλούντα, και σωστά: και οι τρεις
 * σημαίνουν «**μη με μετακινήσεις**» — η ίδια συντηρητική σύμβαση που τηρεί ολόκληρη η
 * οικογένεια των μεταφραστών αναφοράς.
 *
 * ## Το ενεργό κελί πάει στην ΑΡΧΗ του εύρους, όχι στο τέλος
 * Ίδιο με το Excel, και ίδιο με το {@link parseTableCellReference} που λύνει ήδη ένα εύρος
 * «στην αρχή του». Εκεί κάθεται ο δρομέας, εκεί ζει το περιεχόμενο μιας συγχώνευσης, και
 * εκεί αρχίζει η πληκτρολόγηση αν ο χρήστης συνεχίσει να γράφει.
 *
 * ⚠️ **Καμία κανονικοποίηση**: το `B5:A1` περνά αυτούσιο ως `from: B5, to: A1`. Δεν είναι
 * παράλειψη — η κανονικοποίηση ζει **ολόκληρη** στο `resolveTableSelectionBounds` (ο ΕΝΑΣ
 * ερμηνευτής), και μια δεύτερη εδώ θα σήμαινε ότι το ενεργό κελί μετακινείται σε γωνία που
 * ο χρήστης δεν πληκτρολόγησε.
 */
export function parseTableNameBoxReference(
  model: TableModel,
  text: string,
): TableNameBoxTarget | null {
  const parts = text.trim().split(RANGE_SEPARATOR);
  if (parts.length > 2) return null;

  const from = writtenCellRef(model, parts[0]);
  if (from === null) return null;

  const position = tableCursorAt(from.rowId, from.colId);
  if (parts.length === 1) return { position, selection: null };

  const to = writtenCellRef(model, parts[1]);
  if (to === null) return null;
  return { position, selection: { from, to, kind: 'range' } };
}

/** Ένα άκρο → ταυτότητες κελιού, **χωρίς** τις σημαίες `$` (δες την κεφαλίδα). */
function writtenCellRef(model: TableModel, text: string): TableCellRef | null {
  const ref = resolveWrittenCellRef(model, text.trim());
  return ref === null ? null : { rowId: ref.rowId, colId: ref.colId };
}
