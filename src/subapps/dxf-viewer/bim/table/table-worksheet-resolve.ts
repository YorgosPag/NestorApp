/**
 * ADR-833 Φάση 2 — **Ο ΕΝΑΣ ΑΝΑΓΝΩΣΤΗΣ ΤΩΝ ΦΥΛΛΩΝ**: από οντότητα πίνακα σε φύλλα εργασίας, και
 * από φύλλα εργασίας στο **ενεργό** μοντέλο.
 *
 * Πριν από τη Φάση 2, κάθε καταναλωτής έγραφε `entity.model`. Μετά, **κανένας** δεν το γράφει:
 * όλοι περνούν από εδώ. Το αρχείο αυτό είναι η μοναδική γέφυρα ανάμεσα σε *«ποιος πίνακας»* και
 * *«ποια κελιά»* — και ταυτόχρονα το μοναδικό σημείο που ξέρει ότι υπάρχει παλιά μορφή.
 *
 * ## 🔴 ΤΟ ΠΡΟΤΥΠΟ ΕΙΝΑΙ ΤΟ `resolveTableModel` — ΑΝΤΙΓΡΑΦΕΤΑΙ ΣΥΝΕΙΔΗΤΑ
 *
 * Το `resolveTableModel` (`table-model-helpers.ts`) λύνει το **ίδιο** πρόβλημα ένα επίπεδο πιο
 * κάτω: παράγει ακριβό παράγωγο από αμετάβλητη πηγή, με `WeakMap` και **χωρίς** ακυρωτή. Η
 * αιτιολόγησή του ισχύει εδώ αυτούσια:
 *
 * > *«κάθε αλλαγή παράγει νέο αντικείμενο ⇒ **η ταυτότητα ΕΙΝΑΙ η έκδοση** και η ακύρωση είναι
 * > φυσική. Ένα `invalidate()` θα ήταν κάτι που κάποιος, κάποτε, θα ξεχνούσε να καλέσει.»*
 *
 * Οι δύο μνήμες **αλυσιδώνονται** και αυτό είναι το κρίσιμο για την απόδοση:
 *
 * ```
 *   ίδια οντότητα  ⇒ ίδια φύλλα  ⇒ ίδιο persisted μοντέλο  ⇒ ίδιο TableModel  ⇒ ίδιο TableLayout
 * ```
 *
 * Άρα **επεξεργασία στο φύλλο Α δεν ακυρώνει τη διάταξη του φύλλου Β**: η αλυσίδα του Β κρατιέται
 * από το **δικό του** `PersistedTableModel`, που κανείς δεν άγγιξε. Αυτό δεν είναι ισχυρισμός —
 * είναι καρφωμένο σε άγκυρα με `===` (`__tests__/table-worksheet-resolve.test.ts`).
 *
 * ## Η μνήμη κρατιέται ΜΟΝΟ για την αναβάθμιση
 * Για οντότητα **νέας** μορφής η απάντηση είναι το ίδιο το `entity.worksheets`: καμία μνήμη,
 * καμία δέσμευση, η ταυτότητα διατηρείται εξ ορισμού. Ο `WeakMap` υπάρχει **αποκλειστικά** ώστε
 * η αναβάθμιση μιας παλιάς οντότητας να δίνει **την ίδια αναφορά** σε κάθε κλήση. Αλλιώς κάθε
 * ανάγνωση θα παρήγαγε **νέο** αντικείμενο φύλλου και **νέο** πίνακα φύλλων (το ίδιο το
 * `PersistedTableModel` θα έμενε το ίδιο, αλλά τα περιτυλίγματά του όχι) — και κάθε φύλακας
 * ταυτότητας πιο πάνω θα έλεγε «άλλαξε» χωρίς να έχει αλλάξει τίποτα.
 *
 * @module subapps/dxf-viewer/bim/table/table-worksheet-resolve
 * @see types/table-entity-legacy.ts — η ΜΙΑ κατοικία της παλιάς μορφής (ο μόνος του εισαγωγέας)
 * @see bim/table/table-model-helpers.ts — το πρότυπο `resolveTableModel` (WeakMap, ταυτότητα-ως-έκδοση)
 * @see bim/table/table-worksheet-write.ts — η άλλη πλευρά: πώς γράφεται ένα φύλλο
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.2
 */

import { createModuleLogger } from '@/lib/telemetry';
import {
  readPreWorksheetsTable,
  upgradePreWorksheetsTable,
} from '../../types/table-entity-legacy';
import { FIRST_TABLE_WORKSHEET_ID, type TableWorksheet } from '../../types/table-worksheet';
import type { PersistedTableModel, TableBinding } from '../../types/table';
import type { TableEntity } from '../../types/table-entity';

const logger = createModuleLogger('TableWorksheets');

/**
 * Η μνήμη της **αναβάθμισης** — δες την κεφαλίδα για το γιατί μόνο αυτής.
 *
 * Κλειδί είναι η **οντότητα**, όχι το μοντέλο της: η αναβάθμιση διαβάζει `model` **και**
 * `binding`, άρα δύο οντότητες με κοινό μοντέλο και διαφορετικό δεσμό οφείλουν να πάρουν
 * διαφορετικά φύλλα.
 */
const UPGRADED_WORKSHEETS = new WeakMap<object, readonly TableWorksheet[]>();

/**
 * Το εφεδρικό φύλλο για οντότητα **χωρίς καμία από τις δύο μορφές** — δηλαδή για JSON που κανένα
 * μονοπάτι του κώδικα δεν παράγει.
 *
 * ⚠️ **Κενό, όχι προεπιλεγμένο πλέγμα 3×3.** Ένας ψεύτικος πίνακας θα έδειχνε δομή που κανείς δεν
 * έφτιαξε — και θα ήταν ισχυρισμός. Το κενό λέει την αλήθεια: *«εδώ δεν βρέθηκε τίποτα»*. Είναι
 * επίσης ο λόγος που αυτό το module **δεν** εισάγει τον κατασκευαστή: ο μοναδικός αναγνώστης
 * κάθε πίνακα δεν πρέπει να κουβαλά τη γεννήτρια προεπιλογών για μια περίπτωση που δεν συμβαίνει.
 *
 * Σταθερή αναφορά: το συμβόλαιο «ίδια αναφορά σε κάθε κλήση» ισχύει **και** στη χαλασμένη
 * περίπτωση, αλλιώς το πρώτο πράγμα που θα έσπαγε πάνω σε χαλασμένα δεδομένα θα ήταν οι φύλακες
 * ταυτότητας — δηλαδή θα κοκκίνιζε το λάθος πράγμα.
 */
const CORRUPT_FALLBACK_WORKSHEETS: readonly [TableWorksheet] = [{
  id: FIRST_TABLE_WORKSHEET_ID,
  model: { columns: [], rows: [], cells: [], merges: [] },
}];

/**
 * Τα φύλλα εργασίας ενός πίνακα — **ποτέ κενά**, **ίδια αναφορά** σε επαναλαμβανόμενες κλήσεις.
 *
 * Τρεις περιπτώσεις, με αυτή τη σειρά:
 *  1. **νέα μορφή** → το ίδιο το `entity.worksheets`, αυτούσιο·
 *  2. **παλιά μορφή** → αναβάθμιση, απομνημονευμένη στην οντότητα·
 *  3. **καμία από τις δύο** → ένα κενό φύλλο **και `logger.error`**. Ίδια στάση με το
 *     `asSequence` του `table-model-helpers.ts`: μια χαλασμένη οντότητα εκφυλίζεται σε άδειο
 *     πίνακα, **δεν ρίχνει το καρέ** — αλλά ούτε περνά σιωπηλά.
 */
export function resolveWorksheets(entity: TableEntity): readonly TableWorksheet[] {
  const declared = entity.worksheets;
  if (Array.isArray(declared) && declared.length > 0) return declared;

  const cached = UPGRADED_WORKSHEETS.get(entity);
  if (cached) return cached;

  const legacy = readPreWorksheetsTable(entity);
  if (legacy === null) {
    logger.error('Οντότητα πίνακα χωρίς φύλλα και χωρίς μοντέλο — άδειο φύλλο αντί για κατάρρευση', {
      entityId: entity.id,
    });
    return CORRUPT_FALLBACK_WORKSHEETS;
  }

  const upgraded = upgradePreWorksheetsTable(legacy);
  UPGRADED_WORKSHEETS.set(entity, upgraded);
  return upgraded;
}

/**
 * Το **ενεργό** φύλλο.
 *
 * ⚠️ Η πτώση στο πρώτο φύλλο όταν το `activeWorksheetId` δεν δείχνει πουθενά είναι **ρητή
 * ανοχή**, όχι παράλειψη: μια αναφορά σε διαγραμμένο φύλλο είναι φυσιολογικό ενδιάμεσο στάδιο
 * (undo μιας διαγραφής, αναβαθμισμένη οντότητα, χειροποίητο JSON) — ίδια σύμβαση με το
 * `buildMergeIndex`, που παραλείπει σιωπηλά αναφορές σε σβησμένη γραμμή αντί να χάσει τον πίνακα.
 * Και το πρώτο φύλλο **υπάρχει πάντα**, γιατί το {@link resolveWorksheets} δεν επιστρέφει ποτέ κενό.
 */
export function activeWorksheet(entity: TableEntity): TableWorksheet {
  const worksheets = resolveWorksheets(entity);
  return worksheets.find((sheet) => sheet.id === entity.activeWorksheetId) ?? worksheets[0];
}

/**
 * 🔴 **Ο ΑΝΤΙΚΑΤΑΣΤΑΤΗΣ ΚΑΘΕ `entity.model`.** Τα κελιά του ενεργού φύλλου, στη μορφή που
 * ταξιδεύει (`PersistedTableModel`).
 *
 * Ο `TableModel` με τον `Map` — αυτόν που δέχονται η μηχανή διάταξης και οι καθαρές πράξεις —
 * παράγεται όπως πάντα με `resolveTableModel(activeTableModel(entity))`. Τα δύο στρώματα μένουν
 * **χωριστά επίτηδες**: μια «βολική» σύνθεση `activeTableIndex(entity)` θα ήταν **τρίτο** όνομα
 * για το ίδιο πράγμα και η πρώτη ευκαιρία να διαφωνήσουν δύο διαδρομές για το τι είναι το ενεργό
 * μοντέλο.
 */
export function activeTableModel(entity: TableEntity): PersistedTableModel {
  return activeWorksheet(entity).model;
}

/** Ο δεσμός του **ενεργού** φύλλου· απόν ⇒ `static`. Ο αντικαταστάτης κάθε `entity.binding`. */
export function activeTableBinding(entity: TableEntity): TableBinding | undefined {
  return activeWorksheet(entity).binding;
}

/**
 * 🔴 **ΚΟΥΒΑΛΑ ΑΚΟΜΗ ΑΥΤΗ Η ΟΝΤΟΤΗΤΑ ΤΑ ΠΕΔΙΑ ΤΗΣ ΠΑΛΙΑΣ ΜΟΡΦΗΣ;** — και ποια.
 *
 * Το χρειάζεται ο **γραφέας**, για να τα σβήσει στην ίδια πράξη με τη γραφή
 * (`table-worksheet-write.ts`). Ζει όμως **εδώ**, και αυτό δεν είναι τοποθέτηση ευκολίας:
 * αυτό το module είναι η **ΜΙΑ ΠΥΛΗ** προς την παλιά μορφή, και το
 * `types/table-entity-legacy.ts` έχει **ακριβώς έναν** μη-test εισαγωγέα — καρφωμένο σε άγκυρα
 * (`__tests__/table-worksheet-migration.test.ts`). Ένας δεύτερος εισαγωγέας θα σήμαινε ότι το
 * νεκρό πεδίο απέκτησε **δεύτερο** γνώστη, και κάθε νέος γνώστης είναι μια δεύτερη απάντηση
 * στο «πού είναι τα κελιά».
 *
 * Επιστρέφει **ποια** πεδία υπάρχουν και όχι σκέτο `boolean`: ένα άνευ όρων `model: undefined`
 * θα άφηνε κλειδί με τιμή `undefined` σε **κάθε** πίνακα — ακριβώς ο κίνδυνος που αποφεύγει
 * ρητά το `pickTableRenderFields`.
 */
export function preWorksheetsFieldsOf(
  entity: TableEntity,
): { readonly model: boolean; readonly binding: boolean } {
  const legacy = readPreWorksheetsTable(entity);
  if (legacy === null) return { model: false, binding: false };
  return { model: true, binding: legacy.binding !== undefined };
}

/**
 * 🔴 Τα δύο πεδία φύλλων **ΛΥΜΕΝΑ** — η μοναδική μορφή που επιτρέπεται να περάσει **σύνορο**.
 *
 * ## Το σφάλμα που αποτρέπει, μετρημένο πριν γραφτεί
 * Η προβολή προς τον ζωγράφο (`pickTableRenderFields`) αντιγράφει **μόνο ό,τι έχει τιμή** — και
 * μια οντότητα της **παλιάς** μορφής δεν έχει ούτε `worksheets` ούτε `activeWorksheetId`. Χωρίς
 * αυτή τη λύση στο σύνορο, ένας πίνακας γραμμένος πριν από τη Φάση 2 θα έφτανε στον ζωγράφο
 * **χωρίς κανένα από τα δύο σχήματα** (το `model` δεν ταξιδεύει πια) και θα ζωγραφιζόταν
 * **άδειος** — σιωπηλή απώλεια **όλων** των παλιών πινάκων, ορατή μόνο σε πραγματικό αρχείο.
 *
 * Άρα: **το σύνορο του render pipeline είναι το σημείο όπου η παλιά μορφή παύει να υπάρχει.**
 * Πίσω από αυτό, κανείς δεν χρειάζεται να ξέρει ότι υπήρξε ποτέ.
 *
 * Ταυτοδύναμη: σε ήδη λυμένη είσοδο επιστρέφει τις **ίδιες** αναφορές, οπότε η δεύτερη προβολή
 * (`DxfTable` → `EntityModel`) δεν πληρώνει τίποτα και δεν αλλοιώνει καμία ταυτότητα.
 */
export function resolveWorksheetFields(
  entity: TableEntity,
): Pick<TableEntity, 'worksheets' | 'activeWorksheetId'> {
  // Καμία δεύτερη «εύρεση ενεργού»: η ερώτηση έχει ήδη **έναν** ιδιοκτήτη.
  return { worksheets: resolveWorksheets(entity), activeWorksheetId: activeWorksheet(entity).id };
}
