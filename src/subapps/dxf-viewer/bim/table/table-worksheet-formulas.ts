/**
 * 🔴 ADR-833 §5.9.2 — **Η ΠΥΛΗ ΤΟΥ ΒΙΒΛΙΟΥ**: ό,τι έγινε στο ενεργό φύλλο, φτάνει στα άλλα.
 *
 * ## Το πρόβλημα, σε μία γραμμή
 * Ολόκληρη η αλυσίδα εγγραφής δουλεύει πάνω σε **ένα** `PersistedTableModel`
 * (`writeCellInput` → `commitCellWrites` → μοντέλο). Με το `=Φύλλο2!A1`, μια αλλαγή στο
 * Φύλλο1 μπορεί να κάνει **μπαγιάτικο κελί στο Φύλλο3** — και ο τύπος επιστροφής «ένα
 * μοντέλο» δεν έχει πού να το βάλει.
 *
 * ## Γιατί ΕΔΩ, και όχι στο `commitCellWrites`
 * Ο πειρασμός είναι να δεχτεί βιβλίο το `commitCellWrites`. Θα άλλαζε **επτά** καλούντες και
 * θα ανάγκαζε καθαρές πράξεις του `bim/` (συγχώνευση, γέμισμα, επικόλληση, μεταφορά) να
 * μάθουν έννοια που δεν έχουν — σπάζοντας τον κανόνα που κρατά καθαρό ολόκληρο τον φάκελο:
 * *«εδώ απαντιέται τι πρέπει να γίνει, ποτέ τι κατάσταση έχει η εφαρμογή»*.
 *
 * Υπάρχει όμως **ήδη ένα** σημείο όπου ένα μοντέλο γίνεται βιβλίο, και είναι δηλωμένο ως το
 * μοναδικό: το `table-worksheet-write.ts` (*«κάθε γραφέας πινάκων περνά από εδώ — και μόνο από
 * εδώ»*). Η ευθύνη μοιράζεται καθαρά, και **καθεμιά τη χρεώνει ο τύπος επιστροφής της**
 * (ADR-764 §47.5):
 *
 * ```
 *   ΑΝΑ ΦΥΛΛΟ   commitCellWrites(book, pending) → PersistedTableModel   τα κατάντη ΜΕΣΑ
 *   ΑΝΑ ΒΙΒΛΙΟ  worksheetsAfterHomeChange(...)  → TableWorksheet[]      τα κατάντη ΕΞΩ
 * ```
 *
 * ## 🔑 Η ΔΟΜΙΚΗ ΚΟΠΗ ΑΝΑΓΝΩΡΙΖΕΤΑΙ, ΔΕΝ ΑΝΑΓΓΕΛΛΕΤΑΙ
 * Ένα `=SUM(Φύλλο1!A1:A4)` που ζει στο Φύλλο2 πρέπει να **συρρικνωθεί** όταν σβήνεται η γραμμή
 * 4 του Φύλλου1 — αλλιώς πεθαίνει σε `#REF!` ενώ το Excel το κρατά ζωντανό (ADR-764 §3.1).
 * Η πύλη όμως δέχεται μόνο «το νέο μοντέλο»· κανείς δεν της λέει ότι έγινε διαγραφή.
 *
 * 👉 **Το ρωτά μόνη της, και δωρεάν**: οι άξονες είναι αμετάβλητοι πίνακες, οπότε
 * `πριν.rows !== μετά.rows` είναι **ταυτότητα αντικειμένου** — αληθεύει μόνο όταν κάποια
 * πράξη τους άγγιξε, και μια απλή γραφή κελιού (`{...model, cells}`) την αφήνει ψευδή. Έτσι η
 * θεραπεία γίνεται **αδύνατο να ξεχαστεί**, αντί να είναι σύμβαση που θυμάται κάθε νέα δομική
 * πράξη — η ακριβώς αντίθετη επιλογή από εκείνη που γέννησε το ADR-764 («καμία πύλη δεν βλέπει
 * αυτή την κλάση: παράγει σιωπηλά λάθος νούμερα, όχι εξαίρεση»).
 *
 * @module subapps/dxf-viewer/bim/table/table-worksheet-formulas
 * @see bim/table/table-worksheet-write.ts — ο ΕΝΑΣ γραφέας που την καλεί
 * @see bim/table/formula/table-formula-workbook.ts — ο φρουρός `sheetsReading`
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.9.2
 */

import type { PersistedTableModel } from '../../types/table';
import type { TableWorksheetId } from '../../types/table-ids';
import type { TableWorksheet } from '../../types/table-worksheet';
import type { TableAxis } from './table-cell-order';
import {
  evaluateWorkbookFormulas,
  type WorkbookCellAddress,
} from './formula/table-formula-recalc';
import {
  healTableFormulaRefs,
  planTableAxisCut,
} from './formula/table-formula-structural-heal';
import { sheetsReading } from './formula/table-formula-workbook';
import { withRecalculatedValues } from './formula/table-formula-cells';
import { cellKey } from './table-model-helpers';
import { worksheetsFormulaBook } from './table-worksheet-book';

/**
 * **Τα φύλλα, αφού το σπίτι άλλαξε.** Ό,τι δεν αφορά το σπίτι επιστρέφεται **by-reference**.
 *
 * @param worksheets Τα φύλλα **με το νέο μοντέλο ήδη μέσα** στο σπίτι.
 * @param homeId Το φύλλο που άλλαξε.
 * @param before Το μοντέλο του σπιτιού **πριν** — χρειάζεται μόνο για την αναγνώριση κοπής.
 */
export function worksheetsAfterHomeChange(
  worksheets: readonly TableWorksheet[],
  homeId: TableWorksheetId,
  before: PersistedTableModel,
): readonly TableWorksheet[] {
  const home = worksheets.find((sheet) => sheet.id === homeId);
  if (home === undefined) return worksheets;

  // 🔑 Ο φρουρός του §5.9.2: **ποια φύλλα διαβάζουν το σπίτι**, μεταβατικά. Η απάντηση είναι
  // αναζητήσεις σε `WeakMap` (μία ανά φύλλο) και για κάθε βιβλίο χωρίς δια-φυλλικούς τύπους —
  // δηλαδή για **κάθε** βιβλίο που υπάρχει σήμερα — βγαίνει κενή. Μετρημένο: **×1,0**.
  const book = worksheetsFormulaBook(worksheets, homeId);
  const dependents = [...sheetsReading(book, [homeId])].filter((id) => id !== homeId);
  if (dependents.length === 0) return worksheets;

  const healed = healForeignRanges(worksheets, homeId, before, home.model);
  return recalculateDependents(healed, homeId, dependents);
}

/**
 * Τα **ξένα** εύρη που δείχνουν στο σπίτι, συρρικνωμένα για κάθε ταυτότητα που έφυγε.
 *
 * ## Γιατί ένα σχέδιο ανά σβησμένη ταυτότητα, και όχι ένα για όλες
 * Η συρρίκνωση μετακινεί ένα άκρο στον **γείτονά** του — και ο γείτονας μπορεί να είναι κι
 * εκείνος σβησμένος. Η επανάληψη ανά ταυτότητα αναπαράγει **ακριβώς** ό,τι κάνει η μονή πράξη
 * όταν την τυλίγει το `table-row-column-bulk-ops` (*«αναδιπλώνεται πάνω στις μονές πράξεις,
 * άρα κληρονόμησε και τις δύο εγγυήσεις χωρίς μία γραμμή»*), οπότε το ξένο φύλλο καταλήγει
 * στο ίδιο αποτέλεσμα με το δικό του — και όχι σε δεύτερη, «έξυπνη» σημασιολογία.
 *
 * ⚠️ Η λίστα των στοιχείων συρρικνώνεται **μαζί**: κάθε σχέδιο βλέπει τη σειρά όπως ήταν
 * ακριβώς πριν από τη δική του κοπή, όχι όπως ήταν στην αρχή.
 */
function healForeignRanges(
  worksheets: readonly TableWorksheet[],
  homeId: TableWorksheetId,
  before: PersistedTableModel,
  after: PersistedTableModel,
): readonly TableWorksheet[] {
  let current = worksheets;
  for (const axis of AXES) {
    // Ταυτότητα αντικειμένου: μια σκέτη γραφή κελιού αφήνει τους άξονες **αυτούσιους**, οπότε
    // η συνηθισμένη περίπτωση κοστίζει δύο συγκρίσεις δεικτών και τίποτα άλλο.
    if (axisItems(before, axis) === axisItems(after, axis)) continue;
    const surviving = new Set(axisItems(after, axis).map((item) => item.id));
    let items = axisItems(before, axis);
    for (const item of axisItems(before, axis)) {
      if (surviving.has(item.id)) continue;
      const cut = planTableAxisCut(items, axis, item.id, homeId);
      items = items.filter((candidate) => candidate.id !== item.id);
      if (cut === null) continue;
      current = current.map((sheet) => {
        if (sheet.id === homeId) return sheet;
        const model = healTableFormulaRefs(sheet.model, cut);
        return model === sheet.model ? sheet : { ...sheet, model };
      });
    }
  }
  return current;
}

/** Οι δύο άξονες, δηλωμένοι ονομαστικά ώστε ο βρόχος να μην είναι δύο αντιγραμμένα σώματα. */
const AXES: readonly TableAxis[] = ['row', 'column'];

/** Η ακολουθία ενός άξονα — **by-reference**, γιατί η ταυτότητά της είναι το κριτήριο. */
function axisItems(
  model: PersistedTableModel,
  axis: TableAxis,
): readonly { readonly id: string }[] {
  return axis === 'row' ? model.rows : model.columns;
}

/**
 * Τα εξαρτημένα φύλλα ξαναϋπολογισμένα πάνω στο **φρέσκο** σπίτι.
 *
 * ## Γιατί σπέρνονται **όλοι** οι τύποι των εξαρτημένων φύλλων
 * Η πύλη δεν ξέρει **ποια κελιά** του σπιτιού άλλαξαν — βλέπει «νέο μοντέλο», όχι λίστα
 * κλειδιών. Είναι η **ίδια** κατάσταση που ο ADR-764 §4.2 συνάντησε στη δομική πράξη, με την
 * ίδια απάντηση: *ένα αφελές `changed: []` δίνει καμία δουλειά — κώδικας που περνά κάθε test
 * και δεν κάνει τίποτα*. Το κόστος είναι `O(τύποι των εξαρτημένων)` **μία φορά ανά εντολή**,
 * και πληρώνεται **μόνο** όταν υπάρχουν πράγματι δια-φυλλικοί τύποι.
 *
 * Η εγγύηση ταυτότητας επιβιώνει: φύλλο του οποίου καμία τιμή δεν άλλαξε επιστρέφεται
 * αυτούσιο, άρα ο πίνακας φύλλων επίσης — καμία εντολή, κανένα βήμα undo για το τίποτα.
 */
function recalculateDependents(
  worksheets: readonly TableWorksheet[],
  homeId: TableWorksheetId | null,
  dependents: readonly TableWorksheetId[],
): readonly TableWorksheet[] {
  const book = worksheetsFormulaBook(worksheets, homeId ?? worksheets[0].id);
  const seed: WorkbookCellAddress[] = [];
  for (const worksheetId of dependents) {
    const sheet = worksheets.find((candidate) => candidate.id === worksheetId);
    if (sheet === undefined) continue;
    for (const [rowId, colId, cell] of sheet.model.cells) {
      if (cell.kind === 'formula' && cell.formula !== undefined) {
        seed.push({ worksheetId, key: cellKey(rowId, colId) });
      }
    }
  }
  if (seed.length === 0) return worksheets;

  const results = evaluateWorkbookFormulas(book, seed);
  if (results.size === 0) return worksheets;

  let touchedAny = false;
  const next = worksheets.map((sheet) => {
    const values = results.get(sheet.id);
    if (sheet.id === homeId || values === undefined || values.size === 0) return sheet;
    const model = withRecalculatedValues(sheet.model, values);
    if (model === sheet.model) return sheet;
    touchedAny = true;
    return { ...sheet, model };
  });
  return touchedAny ? next : worksheets;
}

/**
 * 🔴 **ΤΟ ΦΥΛΛΟ ΠΟΥ ΕΦΥΓΕ** — τα φύλλα που το διάβαζαν ξαναϋπολογίζονται, εδώ και τώρα.
 *
 * ## Το κενό που έκλεισε — βρέθηκε από άγκυρα, όχι από ανάγνωση
 * Ο **εκτυπωτής** έλεγε ήδη `#REF!` (το `isLiveCellRef` δεν βρίσκει το φύλλο), αλλά η
 * **αποθηκευμένη τιμή** έμενε ο παλιός αριθμός: κανείς δεν ζητούσε επαναϋπολογισμό, γιατί η
 * διαγραφή φύλλου δεν αγγίζει **κανένα κελί**. Δηλαδή η γραμμή τύπων θα έγραφε `#REF!` ενώ το
 * κελί θα έδειχνε αριθμό — **κατά λέξη** το σφάλμα του ADR-764, ανάποδα, και σε πίνακα
 * ποσοτήτων σφάλμα **τιμής** που ταξιδεύει σε DXF και σε `.xlsx`.
 *
 * 🔑 Ζει στον **σχεδιαστή** της πράξης και όχι στον εκτελεστή, με τον ίδιο λόγο που ο ADR-764
 * έβαλε τον μετασχηματισμό **μέσα** στη δομική πράξη: μία εντολή, **ένα** `Ctrl+Z`.
 *
 * ⚠️ Ο φρουρός είναι ο ίδιος: βιβλίο που δεν διάβαζε το σβησμένο φύλλο επιστρέφεται
 * **αυτούσιο** by-reference, οπότε η συνηθισμένη διαγραφή δεν πληρώνει τίποτα.
 */
export function worksheetsAfterRemoval(
  remaining: readonly TableWorksheet[],
  removed: readonly TableWorksheetId[],
): readonly TableWorksheet[] {
  if (remaining.length === 0 || removed.length === 0) return remaining;
  const book = worksheetsFormulaBook(remaining, remaining[0].id);
  const dependents = [...sheetsReading(book, removed)].filter((id) => !removed.includes(id));
  if (dependents.length === 0) return remaining;
  return recalculateDependents(remaining, null, dependents);
}
