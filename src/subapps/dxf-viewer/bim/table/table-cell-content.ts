/**
 * ADR-739 — **το περιεχόμενο ενός κελιού: ανάγνωση και αμετάβλητη εγγραφή.**
 *
 * Ό,τι αλλάζει περιεχόμενο κελιού (inline editor, γραμμή τύπων, επικόλληση περιοχής, εντολές
 * undo) περνά από εδώ — **ποτέ** `model.cells[i] = …` με το χέρι, που θα μετάλλασσε την
 * ακολουθία που κρατά η στοίβα undo.
 *
 * ## Γιατί χωριστό αρχείο (Φ.Ζ, 2026-08-03)
 * Ήταν η τελευταία ενότητα του `table-model-helpers.ts`. Η Φ.Ζ πρόσθεσε τον **δεύτερο**
 * γραφέα ({@link setPersistedCellFormula}) και η κοινή τους μηχανική
 * ({@link writePersistedCell}), οπότε το αρχείο πέρασε τις **500 γραμμές** (N.7.1). Η τομή
 * δεν είναι αυθαίρετη: οι βοηθοί απαντούν «**τι λέει το μοντέλο**» (κλειδιά, συγχωνεύσεις,
 * ανάλυση, σειριοποίηση), αυτό το αρχείο «**τι έχει και πώς αλλάζει ένα κελί**».
 *
 * ## 🔴 Γιατί ήρθε μαζί και το {@link cellText} — ο κύκλος που παραλίγο να γραφτεί
 * Πρώτη εκδοχή: ο γραφέας εισήγαγε το `cellText` **από** το `table-model-helpers`, το οποίο
 * επανεξήγαγε τον γραφέα. **Κύκλος εισαγωγών** — που δούλευε (ESM ανυψώνει τις δηλώσεις
 * συναρτήσεων) και γι' αυτό ακριβώς ήταν επικίνδυνος: θα περνούσε αθόρυβα και θα ήταν το
 * προηγούμενο για τον επόμενο, μέχρι κάποιος να χρειαστεί **τιμή** μέσα στον ίδιο κύκλο.
 * Η ίδια προειδοποίηση είναι ήδη γραμμένη στην κεφαλίδα του `types/table-ids.ts`.
 * Το `cellText` δεν χρησιμοποιούνταν πουθενά μέσα στους βοηθούς — μόνο **από** αυτούς.
 *
 * Καμία διαδρομή εισαγωγής δεν αλλάζει: το `table-model-helpers.ts` **επανεξάγει** και τις
 * τέσσερις συναρτήσεις, όπως ήδη κάνει το `types/table.ts` για το `table-ids.ts`.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-content
 * @see bim/table/formula/table-formula-engine.ts — η διακλάδωση `=` που επιλέγει γραφέα
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §33
 */

import { createCellRanker, insertionIndexFor } from './table-cell-order';
import { remapCellTextRuns } from './table-cell-run-ops';
import type {
  PersistedTableModel,
  TableCell,
  TableCellEntry,
  TableColumnId,
  TableRowId,
} from '../../types/table';
import type { TableFormula } from '../../types/table-formula';

/**
 * Το κείμενο ενός κελιού για **μέτρηση και ζωγραφική**, χωρίς μορφοποίηση τύπου.
 *
 * Η μορφοποίηση κατά `valueType` (mm→m, m², τεμάχια…) ανήκει στους formatters του
 * ADR-363 (`bim/schedule/exporters/value-formatters.ts`) και εφαρμόζεται ΠΡΙΝ μπει η
 * τιμή στο μοντέλο — όπως ακριβώς κάνει σήμερα το `survey-sheet.ts`. Η μηχανή διάταξης
 * δεν μορφοποιεί: αν μορφοποιούσε, θα υπήρχαν δύο απαντήσεις στο «πώς δείχνει αυτός ο
 * αριθμός» (η δική της και των exporters) και θα απέκλιναν.
 *
 * `null` ⇒ κενό αλφαριθμητικό: κενό κελί δεν είναι το κείμενο «null».
 */
export function cellText(cell: TableCell | undefined): string {
  if (!cell) return '';
  const { value } = cell;
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

/**
 * Το **αποθηκευμένο** κελί με αυτή την ταυτότητα, ή `undefined` όταν είναι κενό.
 *
 * 🔴 Ο αραιός χάρτης σημαίνει ότι «απών» **είναι** «κενός» — γι' αυτό το `undefined` δεν είναι
 * σφάλμα και κάθε καταναλωτής οφείλει να το δέχεται. Εξήχθη εδώ (ADR-769) επειδή η ίδια γραμμή
 * `model.cells.find(([r, c]) => …)` ζούσε αυτούσια σε **πέντε** αρχεία: μία γραμμή δεν την
 * πιάνει το jscpd (min-tokens 50, N.18), αλλά είναι ο ορισμός του αραιού χάρτη — και την ημέρα
 * που η αποθήκευση αποκτήσει ευρετήριο, τα πέντε αντίγραφα θα το προσπερνούσαν σιωπηλά.
 */
export function findPersistedCell(
  model: PersistedTableModel,
  rowId: TableRowId,
  colId: TableColumnId,
): TableCell | undefined {
  return model.cells.find(([r, c]) => r === rowId && c === colId)?.[2];
}

/**
 * Το κείμενο ενός κελιού απευθείας από το **ταξιδεύον** σχήμα — χωρίς να περάσει από
 * `resolveTableModel` (που θα έχτιζε/κρατούσε `Map` απομνημόνευσης άσκοπα για μία απλή
 * ανάγνωση). Ίδια σημασιολογία με {@link cellText}: κενό κελί ⇒ κενό αλφαριθμητικό.
 */
export function getPersistedCellText(
  model: PersistedTableModel,
  rowId: TableRowId,
  colId: TableColumnId,
): string {
  return cellText(findPersistedCell(model, rowId, colId));
}

/**
 * Ο **αμετάβλητος** εγγραφέας κειμένου κελιού.
 *
 * ## Οι τέσσερις εγγυήσεις
 * 1. **Καθαρή**: το `model` εισόδου (ο πίνακας `cells`, κάθε κελί μέσα του) δεν
 *    αγγίζεται ποτέ — κάθε κλάδος επιστρέφει νέο `cells` (`slice` + αντικατάσταση/`splice`,
 *    ποτέ in-place `[i] =` πάνω στον ίδιο πίνακα).
 * 2. **Ντετερμινιστική σειρά**: κελί που υπάρχει ήδη αντικαθίσταται **στην ίδια θέση**
 *    (ίδιος δείκτης)· κελί που δεν υπάρχει μπαίνει στη θέση που υπαγορεύει η σειρά
 *    γραμμή × στήλη ({@link insertionIndexFor}), όχι στο τέλος.
 * 3. **Διατήρηση**: μόνο το `value` αλλάζει — `styleOverride` / `locked` ενός υπάρχοντος
 *    κελιού περνούν αυτούσια (spread). Νέο κελί παίρνει τα προεπιλεγμένα του module:
 *    `{ kind: 'text', value: text }`, χωρίς overrides. ⚠️ Το `kind`/`formula` **εξαιρέθηκε**
 *    στη Φ.Ζ — δες {@link asTextCell}.
 * 4. **Ταυτότητα**: αν το νέο κείμενο είναι ΙΔΙΟ με το σημερινό, επιστρέφεται το **ίδιο**
 *    `model` by-reference. Χωρίς αυτό, κάθε πληκτρολόγηση χωρίς πραγματική αλλαγή θα
 *    γεννούσε νέο αντικείμενο μοντέλου — άκυρη είσοδο undo και ακύρωση του
 *    `resolveTableModel`/`resolveTableLayout` `WeakMap` χωρίς λόγο. Ισχύει **και για το
 *    απόν κελί**: αραιός χάρτης σημαίνει ότι «απών» **είναι** «κενός».
 */
export function setPersistedCellText(
  model: PersistedTableModel,
  rowId: TableRowId,
  colId: TableColumnId,
  text: string,
): PendingCellWrites {
  return writePersistedCell(model, rowId, colId, {
    // 🔴 ADR-739 Φ.Ζ — η ταυτότητα ΔΕΝ ισχύει πάνω σε κελί τύπου. Το `cellText` ενός τύπου
    // επιστρέφει το **αποτέλεσμα** (`'5'`), οπότε ο χρήστης που πληκτρολογεί σκέτο `5` πάνω
    // στο `=(2*5)/2` θα έπαιρνε «τίποτα δεν άλλαξε» — και το κελί θα έμενε τύπος, δηλαδή θα
    // ξαναϋπολογιζόταν στην επόμενη αλλαγή και θα **έσβηνε** ό,τι έγραψε.
    update: (existing) =>
      existing.kind !== 'formula' && cellText(existing) === text ? null : asTextCell(existing, text),

    // 🔴 ADR-739 Φ.Δ βήμα 8 — η **τέταρτη εγγύηση (ταυτότητα) ισχύει και για το κελί που ΔΕΝ
    // ΥΠΑΡΧΕΙ.** Το `cells` είναι **αραιό**: απόν κελί σημαίνει ήδη κενό κείμενο (το
    // `getPersistedCellText` επιστρέφει `''` γι' αυτό). Άρα «γράψε κενό σε απόν κελί» δεν
    // αλλάζει τίποτα — αλλά χωρίς αυτή τη γραμμή γεννούσε **φάντασμα εγγραφή**
    // `{ kind: 'text', value: '' }` και, μαζί της, νέο αντικείμενο μοντέλου.
    //
    // Οι δύο μετρημένες συνέπειες, και οι δύο ζωντανές πριν το βήμα 8:
    //  1. **Βήμα undo για το τίποτα** — `Delete` πάνω σε ήδη κενό κελί παρήγαγε
    //     `UpdateEntityCommand`, δηλαδή ένα `Ctrl+Z` που δεν αναιρεί τίποτα ορατό.
    //  2. **Φούσκωμα + περιττό autosave** — ένα `Delete` πάνω σε μαρκαρισμένη περιοχή 500
    //     κενών κελιών θα έγραφε 500 άχρηστες εγγραφές στη σκηνή και θα ακύρωνε τις μνήμες
    //     `resolveTableModel` / `resolveTableLayout` χωρίς κανέναν λόγο.
    create: () => (text === '' ? null : { kind: 'text', value: text }),
  });
}

/**
 * ADR-739 Φ.Ζ — ο **αδελφός γραφέας** για κελί τύπου. Ίδιες τέσσερις εγγυήσεις, ίδια
 * μηχανική θέσης: δεύτερος γραφέας θα σήμαινε δεύτερη απάντηση στο «πού μπαίνει ένα νέο κελί».
 *
 * Η **τιμή** μπαίνει κενή και τη γράφει ο επαναϋπολογισμός στο ίδιο commit — δες
 * `formula/table-formula-engine.ts`. Το κενό δεν είναι προσωρινό «άγνωστο»: ένα κελί τύπου
 * που δεν έχει υπολογιστεί ακόμη **δεν έχει** τιμή, και ένα κατασκευασμένο `0` θα ήταν
 * νούμερο που κανείς δεν μέτρησε (ADR-720).
 *
 * Ταυτότητα: ο ίδιος τύπος ξανά ⇒ **ίδιο** μοντέλο by-reference, ώστε το `Enter` πάνω σε
 * κελί που δεν πειράχτηκε να μη γεννά βήμα undo. Η σύγκριση είναι δομική μέσω `JSON`, και
 * είναι ασφαλής **επειδή** τα δέντρα είναι απλά δεδομένα φτιαγμένα πάντα από τον ίδιο
 * αναλυτή — άρα ίδια σειρά κλειδιών (δες το συμβόλαιο του `types/table-formula.ts`).
 *
 * ## 🔴 ADR-753 Φ1 — τα `runs` **φεύγουν** όταν το κελί γίνεται τύπος
 * Η τιμή μπαίνει κενή και τη γράφει ο επαναϋπολογισμός, οπότε runs που επιβίωναν θα έδειχναν
 * σε κείμενο **μηδενικού μήκους** και θα ξαναζωντάνευαν πάνω σε ένα αποτέλεσμα που κανείς δεν
 * έβαψε. Είναι και η συμπεριφορά του Excel: το αποτέλεσμα ενός τύπου έχει **ενιαία**
 * μορφοποίηση — δεν υπάρχει «βάψε τα τρία πρώτα ψηφία του αθροίσματος», γιατί δεν υπάρχει
 * κανείς να πει ποια θα είναι αυτά μετά τον επόμενο υπολογισμό.
 *
 * Η μορφοποίηση **του κελιού** (`styleOverride`) μένει ανέπαφη — εκείνη δεν δείχνει σε
 * χαρακτήρες.
 */
export function setPersistedCellFormula(
  model: PersistedTableModel,
  rowId: TableRowId,
  colId: TableColumnId,
  formula: TableFormula,
): PendingCellWrites {
  const formulaCell = (existing?: TableCell): TableCell => {
    const merged: TableCell = { ...existing, kind: 'formula', formula, value: '' };
    // Αφαίρεση **του πεδίου**, όχι `runs: undefined`: το δεύτερο επιβιώνει σε `Object.keys`
    // και σε diff — ίδια αιτιολογία με το `formula` του {@link asTextCell}.
    const { runs: _dropped, ...withoutRuns } = merged;
    return withoutRuns;
  };

  return writePersistedCell(model, rowId, colId, {
    update: (existing) =>
      existing.kind === 'formula' && JSON.stringify(existing.formula) === JSON.stringify(formula)
        ? null
        : formulaCell(existing),
    create: () => formulaCell(),
  });
}

/**
 * 🔴 ADR-750 Φ5 — **ο μαζικός αδελφός**: ο ίδιος γραφέας πάνω σε **πολλά** κελιά, με ένα πέρασμα.
 *
 * ## Γιατί όχι απλώς βρόχος πάνω στο {@link writePersistedCell}
 * Ο μονός γραφέας κάνει `findIndex` **και** `slice()` ολόκληρου του `cells` **ανά κελί**. Για
 * μια εντολή διαγωνίου πάνω σε επιλογή 500 × 8 αυτό είναι ~16 εκατομμύρια συγκρίσεις και
 * άλλα τόσα αντίγραφα στοιχείων — δηλαδή **ακριβώς** το εμπόδιο που ανάγκασε τη Φ2 να γράψει
 * τον μαζικό εγγραφέα ακμών (`setTableEdges`, ADR-750 §17.3) αντί για βρόχο. Εδώ η ίδια
 * απάντηση: ένα πέρασμα για τα υπάρχοντα, μία ταξινόμηση για τα νέα, μία συγχώνευση.
 *
 * ## Οι τέσσερις εγγυήσεις ισχύουν αυτούσιες
 * Καθαρότητα, ντετερμινιστική σειρά (μέσω {@link createCellRanker}, η **ίδια** που χρησιμοποιεί
 * ο μονός γραφέας), διατήρηση των υπολοίπων πεδίων, και ταυτότητα by-reference: αν **κανένα**
 * κελί δεν άλλαξε, επιστρέφεται το ίδιο μοντέλο και δεν γεννιέται βήμα undo.
 */
export function writePersistedCells(
  model: PersistedTableModel,
  targets: readonly CellWriteTarget[],
  write: CellWrite,
): PendingCellWrites {
  if (targets.length === 0) return unchanged(model);

  // Το κλειδί είναι **τοπικό** — ζει και πεθαίνει μέσα σε αυτή τη συνάρτηση — γι' αυτό δεν
  // περνά από το branded `cellKey()`: εκείνο υπάρχει για να μη διαρρέει χειροποίητο string σε
  // καλούντες, και εδώ δεν διαρρέει πουθενά.
  const pending = new Map<string, CellWriteTarget>();
  for (const target of targets) pending.set(`${target.rowId} ${target.colId}`, target);

  const written: CellWriteTarget[] = [];
  const kept: TableCellEntry[] = model.cells.map((entry) => {
    const [rowId, colId, cell] = entry;
    const key = `${rowId} ${colId}`;
    const target = pending.get(key);
    if (target === undefined) return entry;
    pending.delete(key);
    const next = write.update(cell, target);
    if (next === null) return entry;
    written.push(target);
    return [rowId, colId, next] as TableCellEntry;
  });

  const created: TableCellEntry[] = [];
  for (const target of pending.values()) {
    const cell = write.create(target);
    if (cell === null) continue;
    written.push(target);
    created.push([target.rowId, target.colId, cell]);
  }

  if (written.length === 0) return unchanged(model);
  const cells = created.length === 0 ? kept : mergeByRank(model, kept, created);
  return { model: { ...model, cells }, written };
}

/**
 * 🔴 ADR-739 §50 — **η όψη ΜΟΡΦΟΠΟΙΗΣΗΣ του ίδιου γραφέα**: γράφει `styleOverride` /
 * `diagonal` και επιστρέφει σκέτο μοντέλο, **χωρίς** υποχρέωση επαναϋπολογισμού.
 *
 * ## Γιατί δύο ονόματα πάνω σε ΜΙΑ μηχανή
 * Η τοποθέτηση είναι μία ({@link writePersistedCells} — ίδιος βρόχος, ίδια ταξινόμηση, ίδιες
 * τέσσερις εγγυήσεις)· αυτό που διαφέρει είναι **τι χρωστά ο καλών μετά**. Κελί που άλλαξε
 * *περιεχόμενο* κάνει μπαγιάτικο κάθε τύπο που το διαβάζει· κελί που άλλαξε *χρώμα* δεν κάνει
 * τίποτα. Το όνομα δηλώνει την πρόθεση, ο **τύπος επιστροφής την επιβάλλει**
 * ({@link PendingCellWrites}).
 *
 * 🔑 Το προεπιλεγμένο όνομα είναι επίτηδες αυτό του **περιεχομένου**: ο επόμενος που θα γράψει
 * κελιά χωρίς να το σκεφτεί παίρνει την υποχρέωση, και η **εξαίρεση** είναι που πρέπει να
 * ζητηθεί ρητά. Το αντίστροφο θα ήταν ακριβώς το σχήμα που γέννησε το §47.5.
 */
export function writePersistedCellStyles(
  model: PersistedTableModel,
  targets: readonly CellWriteTarget[],
  write: CellWrite,
): PersistedTableModel {
  return writePersistedCells(model, targets, write).model;
}

/**
 * 🔴 ADR-755 — **αδειάζει** πολλά κελιά με ένα πέρασμα.
 *
 * ## Γιατί υπάρχει ως ξεχωριστή εξαγωγή
 * Το «σβήσε το περιεχόμενο» το ζητούν πλέον **δύο** ανεξάρτητοι καλούντες, με εντελώς
 * διαφορετική αφορμή: το `Delete` πάνω σε επιλογή ({@link clearTableRange}) και η
 * **συγχώνευση**, όπου μόνο η άγκυρα επιβιώνει (ADR-755 §4). Δεύτερο σώμα θα ήταν sibling
 * clone (CHECK 3.28 / N.18) — και, χειρότερα, δύο απαντήσεις στο «τι σημαίνει άδειο κελί»:
 * το ένα μπορεί κάποτε να θυμηθεί να πετάξει τα `runs` και το άλλο όχι.
 *
 * ## ⚠️ Ο βρόχος που αντικαθιστά ΔΕΝ ήταν απλώς πιο μακρύς
 * Το `clearTableRange` καλούσε {@link setPersistedCellText} **ανά κελί**, δηλαδή `findIndex`
 * + `slice()` ολόκληρου του `cells` κάθε φορά. Ένα `Ctrl+A` + `Delete` σε πίνακα 500 × 8
 * είναι 4.000 κλήσεις — ~16 εκατομμύρια συγκρίσεις και άλλα τόσα αντίγραφα στοιχείων. Είναι
 * **ακριβώς** το μέγεθος που γέννησε τον μαζικό γραφέα (δες την κεφαλίδα του
 * {@link writePersistedCells})· απλώς ο πρώτος καταναλωτής του ήταν οι διαγώνιοι, όχι το
 * σβήσιμο.
 *
 * Το άδειασμα περνά από το ίδιο {@link asTextCell} με την πληκτρολόγηση: κελί **τύπου**
 * γίνεται κείμενο (αλλιώς θα ξαναϋπολογιζόταν και θα ξαναγέμιζε μόνο του) και τα `runs`
 * φεύγουν, γιατί δείχνουν σε χαρακτήρες που δεν υπάρχουν πια.
 *
 * Απόν κελί **δεν** αποκτά εγγραφή: ο χάρτης είναι αραιός, άρα «απών» **είναι** ήδη «κενός»
 * — η ίδια τέταρτη εγγύηση, με τον ίδιο μετρημένο λόγο (βήμα undo για το τίποτα).
 */
export function clearPersistedCells(
  model: PersistedTableModel,
  targets: readonly CellWriteTarget[],
): PendingCellWrites {
  return writePersistedCells(model, targets, {
    update: (existing) =>
      existing.kind !== 'formula' && cellText(existing) === '' && existing.runs === undefined
        ? null
        : asTextCell(existing, ''),
    create: () => null,
  });
}

/**
 * Συγχωνεύει τα νέα κελιά μέσα στα υπάρχοντα, **σε σειρά γραμμή × στήλη**.
 *
 * Τα δύο σκέλη είναι ήδη ταξινομημένα (το `kept` το κληρονομεί από το μοντέλο, το `created`
 * ταξινομείται εδώ), οπότε αρκεί μία γραμμική συγχώνευση. Κελί χωρίς έγκυρη κατάταξη
 * (ορφανή αναφορά) πηγαίνει στο τέλος — ίδια ανοχή με το {@link insertionIndexFor}.
 */
function mergeByRank(
  source: PersistedTableModel,
  kept: readonly TableCellEntry[],
  created: TableCellEntry[],
): TableCellEntry[] {
  const rank = createCellRanker(source);
  const rankOf = (entry: TableCellEntry): number =>
    rank(entry[0], entry[1]) ?? Number.POSITIVE_INFINITY;

  created.sort((a, b) => rankOf(a) - rankOf(b));

  const out: TableCellEntry[] = [];
  let i = 0;
  for (const entry of kept) {
    while (i < created.length && rankOf(created[i]) < rankOf(entry)) out.push(created[i++]);
    out.push(entry);
  }
  while (i < created.length) out.push(created[i++]);
  return out;
}

/**
 * Τι κάνει ένας γραφέας κελιού στις **δύο** καταστάσεις που μπορεί να συναντήσει. Και οι δύο
 * επιστρέφουν `null` για «τίποτα δεν άλλαξε» — η τέταρτη εγγύηση, εκφρασμένη ως τύπος.
 */
export interface CellWrite {
  /** Το κελί υπάρχει: τι γίνεται τώρα; `null` ⇒ μείνε ως έχεις. */
  readonly update: (existing: TableCell, target: CellWriteTarget) => TableCell | null;
  /** Το κελί δεν υπάρχει: τι μπαίνει; `null` ⇒ μη γεννήσεις εγγραφή-φάντασμα. */
  readonly create: (target: CellWriteTarget) => TableCell | null;
}

/**
 * 🔴 ADR-739 §36 — **ΠΟΙΟ** κελί γράφεται τώρα.
 *
 * ## Γιατί προστέθηκε (και γιατί ΟΧΙ δεύτερος μαζικός γραφέας)
 * Οι δύο πρώτοι καταναλωτές του {@link writePersistedCells} (διαγώνιοι, περιγράμματα) γράφουν
 * **την ίδια** τιμή σε κάθε κελί της περιοχής, οπότε δεν χρειάζονταν να ξέρουν πού βρίσκονται.
 * Η **μεταφορά περιοχής** γράφει σε κάθε κελί **διαφορετικό** περιεχόμενο — αυτό που κουβαλά
 * από την πηγή του. Χωρίς αυτή την παράμετρο η μόνη διέξοδος θα ήταν δεύτερος μαζικός γραφέας
 * με δική του τοποθέτηση και ταξινόμηση: ακριβώς ο structural clone που πιάνει το CHECK 3.28
 * (N.18) και, χειρότερα, **δεύτερη** απάντηση στο «πού μπαίνει ένα νέο κελί».
 *
 * Η επέκταση είναι **καθαρά προσθετική**: μια συνάρτηση επιστροφής που αγνοεί το όρισμα
 * παραμένει έγκυρη, οπότε κανένας υπάρχων καλών δεν αλλάζει ούτε κατά έναν χαρακτήρα.
 */
export interface CellWriteTarget {
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
}

/**
 * 🔴 ADR-739 §50 — **γραμμένα κελιά που ΔΕΝ έχουν ξαναϋπολογιστεί ακόμη.**
 *
 * ## Γιατί υπάρχει ως τύπος και όχι ως κανόνας που θυμάται ο καλών
 * Τέσσερις φορές συνέβη το ίδιο: κάποιος έγραψε κελιά και δεν κάλεσε `recalculateTableModel`
 * — επικόλληση (§47), `Delete` σε περιοχή (§47), καθάρισμα (§47) και **συγχώνευση** (§47.5).
 * Το σύμπτωμα ήταν κάθε φορά το ίδιο και πάντα σιωπηλό: ένα `=SUM(A1:A20)` που εξακολουθεί να
 * δείχνει το άθροισμα δεδομένων **που δεν υπάρχουν πια**, στην οθόνη, στην εξαγωγή και στο DXF.
 *
 * Η αιτία δεν ήταν απροσεξία — ήταν **ο τύπος επιστροφής**: ένας γραφέας που επιστρέφει
 * `PersistedTableModel` δίνει στον καλούντα κάτι **πλήρως χρησιμοποιήσιμο**, οπότε δεν υπάρχει
 * καμία στιγμή όπου κάτι να τον ρωτήσει «τελείωσες;». Εδώ ο καλών παίρνει κάτι που **δεν είναι
 * μοντέλο** και δεν μπορεί να το δώσει πουθενά προτού το ξετυλίξει η `commitCellWrites` — άρα
 * το πέμπτο δείγμα δεν είναι απαγορευμένο, είναι **μη εκφράσιμο**.
 *
 * Δεν χρειάζεται σαρωτής: ο μεταγλωττιστής **είναι** η πύλη — και είναι πύλη σε επίπεδο
 * **σημείου κλήσης**, όχι αρχείου. Το `contacts-query.service.ts` του CHECK 3.35 έδειξε γιατί
 * αυτό μετράει: 6 συναρτήσεις, 5 σωστές και 1 όχι· κριτήριο επιπέδου αρχείου θα έβαφε πράσινη
 * τη σπασμένη.
 *
 * ## Γιατί κουβαλά και τα κελιά
 * Ο επαναϋπολογισμός θέλει να ξέρει **από πού** να διαδώσει. Τρεις καλούντες υπολόγιζαν μόνοι
 * τους αυτή τη λίστα (`touchedKeys(plan)`, ο βρόχος `keys[]` του `clearTableRange`, το
 * `touched` της επικόλλησης) — γνώση που ο γραφέας **ήδη είχε** και πετούσε. Άρα ο τύπος δεν
 * προσθέτει υποχρέωση: **αφαιρεί** τρία αντίγραφα μιας απάντησης που γεννιέται εδώ.
 *
 * ⚠️ **Κελιά, όχι `CellKey`.** Η μορφή του κλειδιού είναι μυστικό του `table-model-helpers`
 * (δες `cellKey`) — και εκείνο το module **εισάγει** αυτό εδώ. Κωδικοποίηση σε αυτό το στρώμα
 * θα ήταν ο κύκλος εισαγωγών για τον οποίο προειδοποιεί η κεφαλίδα του αρχείου.
 *
 * `written` κενό ⇒ **τίποτα δεν άλλαξε** και το `model` είναι το αρχικό by-reference: η
 * τέταρτη εγγύηση ταξιδεύει άθικτη μέσα στον τύπο.
 *
 * @see bim/table/formula/table-formula-engine.ts — `commitCellWrites`, το ΜΟΝΟ ξετύλιγμα
 */
export interface PendingCellWrites {
  readonly model: PersistedTableModel;
  /** Τα κελιά που **όντως** άλλαξαν — υποσύνολο των στόχων, ποτέ υπερσύνολο. */
  readonly written: readonly CellWriteTarget[];
}

/**
 * 🔴 **Η ΜΙΑ μηχανική τοποθέτησης κελιού** — εξήχθη από τους δύο γραφείς (ADR-739 Φ.Ζ,
 * υπόδειξη του CHECK 3.28 / N.18: τα δύο σώματα ήταν δίδυμα 11 γραμμών).
 *
 * Εδώ ζουν οι εγγυήσεις 1, 2 και 4 — καθαρότητα, ντετερμινιστική θέση, ταυτότητα
 * by-reference. Ο κάθε γραφέας δηλώνει **μόνο τι διαφέρει**: πότε δεν άλλαξε τίποτα, και τι
 * κελί προκύπτει. Ένα τρίτο είδος κελιού αύριο (`field`, `block`) προσθέτει έναν
 * {@link CellWrite}, όχι τρίτο αντίγραφο της τοποθέτησης.
 */
function writePersistedCell(
  model: PersistedTableModel,
  rowId: TableRowId,
  colId: TableColumnId,
  write: CellWrite,
): PendingCellWrites {
  const existingIndex = model.cells.findIndex(([r, c]) => r === rowId && c === colId);
  const target: CellWriteTarget = { rowId, colId };

  if (existingIndex >= 0) {
    const next = write.update(model.cells[existingIndex][2], target);
    if (next === null) return unchanged(model);
    const cells = model.cells.slice();
    cells[existingIndex] = [rowId, colId, next];
    return { model: { ...model, cells }, written: [target] };
  }

  const created = write.create(target);
  if (created === null) return unchanged(model);
  const cells = model.cells.slice();
  cells.splice(insertionIndexFor(model, model.cells, rowId, colId), 0, [rowId, colId, created]);
  return { model: { ...model, cells }, written: [target] };
}

/**
 * «Τίποτα δεν άλλαξε», με το **ίδιο** μοντέλο by-reference και κενή λίστα.
 *
 * Η τέταρτη εγγύηση εκφρασμένη μία φορά: κάθε πρόωρη έξοδος των γραφέων περνά από εδώ, ώστε
 * να μην μπορεί κάποια να επιστρέψει `written: []` πάνω σε **νέο** αντικείμενο μοντέλου — που
 * θα ήταν βήμα undo για το τίποτα, σιωπηλό ακριβώς επειδή ο επαναϋπολογισμός θα παραλειπόταν.
 */
function unchanged(model: PersistedTableModel): PendingCellWrites {
  return { model, written: [] };
}

/**
 * 🔴 ADR-739 Φ.Ζ — το κελί ως **κείμενο**, με τον τύπο του σβησμένο.
 *
 * Η εγγύηση 3 («διατήρηση») έλεγε ότι `kind`/`formula` περνούν αυτούσια — σωστό όσο ο μόνος
 * τρόπος να γίνει κελί τύπος ήταν το να **μην υπάρχει τρόπος**. Από τη στιγμή που υπάρχει, η
 * ίδια γραμμή γίνεται ελάττωμα: γράφοντας `5` πάνω σε `=(2*5)/2` το κελί θα έμενε
 * `kind: 'formula'` με **μπαγιάτικο** δέντρο, και ο πρώτος επαναϋπολογισμός θα ξανάγραφε το
 * παλιό αποτέλεσμα πάνω από ό,τι πληκτρολόγησε ο χρήστης. *Μια εγγύηση είναι σωστή για το
 * σύνολο καταστάσεων που υπήρχε όταν γράφτηκε.*
 *
 * Το `formula` **αφαιρείται** αντί να τεθεί `undefined`: ένα πεδίο με τιμή `undefined`
 * επιβιώνει σε `Object.keys` και σε diff, και θα εμφανιζόταν σε κάθε αποθηκευμένη σκηνή ως
 * αλλαγή που κανείς δεν έκανε.
 *
 * ## 🔴 ADR-753 Φ1 — γιατί τα `runs` ΔΕΝ περνούν αυτούσια με το spread
 * Η εγγύηση 3 λέει ότι τα υπόλοιπα πεδία διατηρούνται. Για τα {@link TableCell.runs} η
 * «διατήρηση» θα ήταν **ελάττωμα**: δείχνουν σε **θέσεις χαρακτήρων** του κειμένου που μόλις
 * άλλαξε. Ένα `Α` πληκτρολογημένο στην αρχή μετακινεί κάθε γράμμα κατά ένα, και runs που
 * έμεναν ακίνητα θα έβαφαν σιωπηλά **άλλα** γράμματα — με το ελάττωμα να εμφανίζεται μία
 * πληκτρολόγηση **μετά** την αιτία του.
 *
 * *Μια εγγύηση είναι σωστή για το σύνολο πεδίων που υπήρχε όταν γράφτηκε* — το ίδιο μάθημα
 * που πλήρωσε ακριβώς από πάνω το `kind`/`formula` στη Φ.Ζ.
 */
function asTextCell(cell: TableCell, text: string): TableCell {
  const { formula: _dropped, runs: previous, ...rest } = cell;
  const runs = remapCellTextRuns(previous, cellText(cell), text);
  return { ...rest, kind: 'text', value: text, ...(runs === undefined ? {} : { runs }) };
}
