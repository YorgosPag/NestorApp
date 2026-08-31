/**
 * ADR-833 Φάση 2 — **Η ΑΛΛΗ ΠΛΕΥΡΑ: ΠΩΣ ΓΡΑΦΕΤΑΙ ΕΝΑ ΦΥΛΛΟ.**
 *
 * Πριν από τη Φάση 2 υπήρχαν **οκτώ** σημεία που έγραφαν `{ model }` πάνω στην οντότητα. Αν κάθε
 * ένα από αυτά έχτιζε μόνο του τον νέο πίνακα φύλλων
 * (`worksheets.map(w => w.id === activeId ? {…w, model} : w)`), θα ήταν **οκτώ αντίγραφα** της
 * ίδιας απάντησης στο ερώτημα *«τι σημαίνει γράφω στο ενεργό φύλλο»* — δηλαδή ακριβώς η κλάση
 * που το ίδιο αυτό ADR έκλεισε στη Φάση 0 για τις τρεις λίστες πεδίων. **ΕΝΑ SSoT.**
 *
 * ## 🔴 Η ΕΓΓΥΗΣΗ ΤΑΥΤΟΤΗΤΑΣ ΑΝΕΒΑΙΝΕΙ ΕΝΑ ΕΠΙΠΕΔΟ — ΚΑΙ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΣΠΑΣΕΙ
 *
 * Ολόκληρο το σύστημα πινάκων στηρίζεται σε **έναν** φύλακα no-op, γραμμένο σε κάθε γραφέα:
 *
 * ```ts
 *   if (nextModel === entity.model) return null;   // «τίποτα δεν άλλαξε» — ΤΑΥΤΟΤΗΤΑ, όχι βάθος
 * ```
 *
 * Είναι η εγγύηση 4 του ADR-739 Φ.Δ: *«κάθε καθαρός γραφέας επιστρέφει το ίδιο αντικείμενο
 * by-reference όταν καμία τιμή δεν αλλάζει»*. Χάρη σε αυτόν, «διάλεξα το στυλ που είχα ήδη» δεν
 * γεννά βήμα αναίρεσης και ο `Ctrl+Z` δεν «γεμίζει» με το τίποτα.
 *
 * Οι συναρτήσεις εδώ **διατηρούν** αυτή την εγγύηση ένα επίπεδο πιο πάνω: όταν το φύλλο δεν
 * αλλάζει, επιστρέφουν **τον ίδιο πίνακα φύλλων** by-reference. Έτσι ο φύλακας των καλούντων
 * γίνεται `nextWorksheets === resolveWorksheets(entity)` και συνεχίζει να απαντά ακριβώς το ίδιο.
 * ⛔ **Μια `map()` που πάντα δεσμεύει νέο πίνακα θα ακύρωνε και τους οκτώ φύλακες ταυτόχρονα.**
 *
 * ## 🔴 ΚΑΘΑΡΙΣΜΑ ΤΗΣ ΠΑΛΙΑΣ ΜΟΡΦΗΣ — ΓΙΑΤΙ ΣΤΟ ΙΔΙΟ ΜΠΑΛΩΜΑ
 *
 * Το `UpdateEntityCommand` κάνει **μερικό** μπάλωμα (`{ ...entity, ...patch }`). Γράφοντας μόνο
 * `worksheets` πάνω σε αναβαθμισμένη οντότητα, το παλιό `model` θα **έμενε** δίπλα στα φύλλα —
 * δηλαδή θα γεννιόταν το **πεδίο-καθρέφτης** που το §5.2 απαγορεύει, και μάλιστα σε
 * **μπαγιάτικη** εκδοχή. Γι' αυτό η μετανάστευση και η γραφή είναι **ένα** μπάλωμα, **μία**
 * εντολή, **ένα** undo.
 *
 * ⚠️ Τα κλειδιά καθαρισμού μπαίνουν **μόνο όταν υπάρχει τι να καθαριστεί**. Ένα άνευ όρων
 * `model: undefined` θα άφηνε κλειδί με τιμή `undefined` σε **κάθε** πίνακα — τον ίδιο κίνδυνο
 * που αποφεύγει ρητά το `pickTableRenderFields` (*«ποτέ ως κλειδιά με τιμή `undefined` →
 * Firestore-safe»*).
 *
 * @module subapps/dxf-viewer/bim/table/table-worksheet-write
 * @see bim/table/table-worksheet-resolve.ts — η πλευρά της ανάγνωσης
 * @see bim/table/table-cell-edit-session.ts — οι δύο εντολές που το καταναλώνουν
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.2
 */

import {
  activeWorksheet,
  preWorksheetsFieldsOf,
  resolveWorksheets,
} from './table-worksheet-resolve';
import { worksheetsAfterHomeChange } from './table-worksheet-formulas';
import type { PersistedTableModel, TableBinding } from '../../types/table';
import type { TableEntity } from '../../types/table-entity';
import type { TableWorksheet } from '../../types/table-worksheet';

/**
 * Το μπάλωμα οντότητας που γράφει φύλλα — και **σβήνει** ό,τι απέμεινε από την παλιά μορφή.
 *
 * Τα δύο προαιρετικά κλειδιά δηλώνονται ως `undefined` επίτηδες: **δεν είναι πεδία του
 * `TableEntity`** (έφυγαν), και ο μόνος λόγος που εμφανίζονται είναι για να **πάψουν** να
 * υπάρχουν πάνω σε μια αναβαθμιζόμενη οντότητα.
 */
export interface TableWorksheetsPatch extends Partial<TableEntity> {
  readonly worksheets: readonly TableWorksheet[];
  readonly model?: undefined;
  readonly binding?: undefined;
}

/**
 * Ο **ΕΝΑΣ** πυρήνας: αντικαθιστά το ενεργό φύλλο με το αποτέλεσμα του `next`, **διατηρώντας
 * ταυτότητα** όταν το `next` επιστρέψει το ίδιο φύλλο.
 *
 * Ιδιωτικός επίτηδες: οι δύο δημόσιες συναρτήσεις είναι **ονόματα προθέσεων**, όχι παραλλαγές
 * υλοποίησης — και έτσι δεν υπάρχει δίδυμο σώμα να αποκλίνει (N.18).
 */
function withActiveWorksheet(
  entity: TableEntity,
  next: (sheet: TableWorksheet) => TableWorksheet,
): readonly TableWorksheet[] {
  const worksheets = resolveWorksheets(entity);
  const active = activeWorksheet(entity);
  const replacement = next(active);
  // Ταυτότητα μέσα ⇒ ταυτότητα έξω. Δες την κεφαλίδα: εδώ κρέμονται και οι οκτώ φύλακες no-op.
  if (replacement === active) return worksheets;
  const replaced = worksheets.map((sheet) => (sheet === active ? replacement : sheet));

  // 🔴 ADR-833 §5.9.2 — **ΕΔΩ φτάνει η αλλαγή στα ΑΛΛΑ φύλλα.** Αυτή η συνάρτηση είναι το ένα
  // σημείο όπου ένα μοντέλο γίνεται βιβλίο («κάθε γραφέας πινάκων περνά από εδώ — και μόνο από
  // εδώ»), άρα είναι και το ένα σημείο όπου ένας τύπος του Φύλλου3 μπορεί να μάθει ότι το
  // Φύλλο1 άλλαξε. Ο επαναϋπολογισμός δεν είναι προαιρετικός και δεν ανατίθεται σε καλούντα
  // που μπορεί να τον ξεχάσει (ADR-764 §47.5).
  //
  // ⚠️ **Μόνο όταν άλλαξε ΜΟΝΤΕΛΟ**: μια ανανέωση που άγγιξε μόνο τον δεσμό δεν μπορεί να
  // κάνει μπαγιάτικο κανέναν τύπο, και ο φύλακας by-reference το λέει χωρίς καμία σάρωση.
  return replacement.model === active.model
    ? replaced
    : worksheetsAfterHomeChange(replaced, active.id, active.model);
}

/**
 * Τα φύλλα με **νέο μοντέλο** στο ενεργό φύλλο. Ίδια αναφορά όταν το μοντέλο είναι το ίδιο.
 *
 * Ο αντικαταστάτης του `{ model: nextModel }` σε κάθε γραφέα μοντέλου.
 */
export function worksheetsWithActiveModel(
  entity: TableEntity,
  model: PersistedTableModel,
): readonly TableWorksheet[] {
  return withActiveWorksheet(entity, (sheet) => (sheet.model === model ? sheet : { ...sheet, model }));
}

/**
 * Τα φύλλα με **νέο μοντέλο ΚΑΙ νέο δεσμό** στο ενεργό φύλλο, ως **μία** αλλαγή.
 *
 * 🔴 Η ατομικότητα είναι το νόημα, όχι λεπτομέρεια υλοποίησης: το
 * `buildTableBindingRefreshCommand` υπάρχει ακριβώς επειδή *«δύο εντολές θα σήμαιναν ότι ένα
 * `Ctrl+Z` αναιρεί τα νούμερα αλλά αφήνει το νέο αποτύπωμα»*. Τώρα που και τα δύο ζουν στο ίδιο
 * φύλλο, η ατομικότητα είναι **δομική**: ένα αντικείμενο, μία αντικατάσταση.
 *
 * Ο διπλός φύλακας no-op μένει διπλός — ανανέωση που δεν άλλαξε τιμές **ούτε** αποτύπωμα
 * επιστρέφει το ίδιο φύλλο, άρα τον ίδιο πίνακα φύλλων, άρα καμία εντολή.
 */
export function worksheetsWithActiveModelAndBinding(
  entity: TableEntity,
  model: PersistedTableModel,
  binding: TableBinding | undefined,
): readonly TableWorksheet[] {
  return withActiveWorksheet(entity, (sheet) => {
    if (sheet.model === model && sheet.binding === binding) return sheet;
    // 🔴 Ο δεσμός **αφαιρείται** με αποδόμηση, ποτέ με `binding: undefined`: ίδια σύμβαση
    // παράλειψης με το `upgradePreWorksheetsTable` και το `pickTableRenderFields`. Και η
    // αποδόμηση κρατά **κάθε άλλο** πεδίο του φύλλου (σήμερα το `name`, αύριο ό,τι προστεθεί) —
    // μια χειρόγραφη απαρίθμηση εδώ θα ήταν η ένατη εμφάνιση της κλάσης που έκλεισε η Φάση 0.
    const { binding: _removed, ...rest } = sheet;
    return binding === undefined ? { ...rest, model } : { ...rest, model, binding };
  });
}

/**
 * Φύλλα → μπάλωμα οντότητας, με τον καθαρισμό της παλιάς μορφής **στην ίδια πράξη**.
 *
 * Κάθε γραφέας πινάκων περνά από εδώ — και μόνο από εδώ — ώστε η μετανάστευση να μη γίνει ποτέ
 * «κάτι που κάποιος ξέχασε».
 */
export function tableWorksheetsPatch(
  entity: TableEntity,
  worksheets: readonly TableWorksheet[],
): TableWorksheetsPatch {
  // ⚠️ Η ερώτηση πάει στη **ΜΙΑ ΠΥΛΗ** της παλιάς μορφής, ποτέ κατευθείαν στο σχήμα της: το
  // `types/table-entity-legacy.ts` έχει **ακριβώς έναν** μη-test εισαγωγέα, με άγκυρα.
  const legacy = preWorksheetsFieldsOf(entity);
  if (!legacy.model) return { worksheets };
  return {
    worksheets,
    model: undefined,
    ...(legacy.binding ? { binding: undefined } : {}),
  };
}
