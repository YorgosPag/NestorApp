/**
 * ADR-739 Φ.Ζ — **ο επαναϋπολογισμός**: γράφος εξαρτήσεων, τοπολογική σειρά, ανίχνευση
 * κύκλου. Ο τρίτος από τους τρεις δεσμευτικούς λόγους του §9.2 — και ο λόγος που καμία
 * βιβλιοθήκη δεν θα τον έκανε για εμάς: μια βιβλιοθήκη αξιολογεί **έναν** τύπο, δεν
 * διαχειρίζεται φύλλο.
 *
 * ## Τρία πράγματα, με αυτή τη σειρά
 * 1. **Ποιος εξαρτάται από ποιον** — από το ίδιο το δέντρο, όχι από κείμενο.
 * 2. **Ποιοι πρέπει να ξαναϋπολογιστούν** — μόνο οι κατάντη των αλλαγμένων κελιών. Ένας
 *    πίνακας 500 γραμμών δεν ξαναϋπολογίζεται επειδή ο χρήστης πάτησε ένα πλήκτρο.
 * 3. **Με ποια σειρά** — τοπολογική (Kahn), ώστε ένα `=B1*2` να διαβάζει το **νέο** `B1`.
 *    Χωρίς αυτό ο πίνακας θα ήθελε δεύτερο πέρασμα για να συγκλίνει.
 *
 * ## Ο κύκλος δεν είναι κρέμασμα, είναι απάντηση
 * Ό,τι δεν ταξινομείται τοπολογικά **είναι** κύκλος (ή κατάντη κύκλου) και παίρνει
 * `#CIRCULAR!`. Δεν χρειάζεται χρονικό όριο: χωρίς `eval`, χωρίς βρόχους και χωρίς
 * συναρτήσεις χρήστη, ο υπολογισμός είναι πεπερασμένος **εξ ορισμού** — ένα timeout θα ήταν
 * θεραπεία για πρόβλημα που δεν μπορεί να υπάρξει.
 *
 * ## 🔴 ADR-833 Φάση 7 — Ο ΓΡΑΦΟΣ ΕΙΝΑΙ ΤΟΥ **ΒΙΒΛΙΟΥ**, ΟΧΙ ΤΟΥ ΦΥΛΛΟΥ
 * Η υπογραφή `evaluate(model, changed)` ήταν **αυτούσια** από το ADR-739 §9.2, γραμμένη πριν
 * υπάρξει μηχανή, και έμεινε άθικτη επί τρία ADR. Η Φάση 7 την αλλάζει — και είναι ο **μόνος**
 * τρόπος να μην είναι λάθος: με το `=Φύλλο2!A1`, μια αλλαγή στο Φύλλο1 μπορεί να κάνει
 * μπαγιάτικο κελί στο Φύλλο3, και ένας γράφος που βλέπει ένα φύλλο **δεν έχει τον κόμβο**.
 * Ο τεμπέλης δρόμος («ξαναϋπολόγισε όταν γίνει ενεργό») αποκλείστηκε από το ήδη γραμμένο
 * δόγμα του ADR-764 §6: *το μοντέλο μας **είναι** το ωφέλιμο φορτίο που εξάγεται*.
 *
 * 🔑 **Δεν γεννήθηκε δεύτερη μηχανή.** Ο ίδιος Kahn, οι ίδιες τρεις φάσεις — απλώς ο κόμβος
 * απέκτησε φύλλο. Άμεση ανταμοιβή: ένας **κύκλος ανάμεσα σε φύλλα** (`Φύλλο1!A1 = =Φύλλο2!A1`
 * και αντίστροφα) δίνει `#CIRCULAR!` χωρίς **καμία** γραμμή επιπλέον.
 *
 * ⚠️ Και δεν σαρώνονται όλα τα φύλλα: σαρώνονται **μόνο τα συμμετέχοντα** — δες το
 * `sheetsReading` του `table-formula-workbook.ts`, που το ρωτούν **δύο** καταναλωτές (αυτός
 * και η πύλη του βιβλίου) και γι' αυτό δεν ζει εδώ. Βιβλίο χωρίς δια-φυλλικούς τύπους
 * πληρώνει **μηδέν**.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-recalc
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §9.2
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.9.2
 */

import type { CellKey } from '../../../types/table';
import type { TableFormula, TableFormulaCellRef, TableFormulaNode } from '../../../types/table-formula';
import type { TableWorksheetId } from '../../../types/table-ids';
import type { ScheduleCellValue } from '../../schedule/types';
import { cellKey } from '../table-model-helpers';
import { evaluateTableFormula, expandRange, type TableFormulaScope } from './table-formula-eval';
import { readCellRefValue } from './table-formula-ref-scope';
import { forEachTableFormulaRefLeaf } from './table-formula-rewrite';
import {
  bookAtSheet,
  sheetIdOfRef,
  sheetsReading,
  type TableFormulaWorkbook,
} from './table-formula-workbook';
import { FORMULA_ERROR, toCellValue, type TableFormulaValue } from './table-formula-value';

/**
 * Η διεύθυνση ενός κελιού **μέσα σε βιβλίο**: φύλλο + κελί.
 *
 * 🔴 **Branded, και ο διαχωριστής είναι ο ίδιος `\u0000` με το {@link cellKey}** — όχι από
 * τύχη: ο μηδενικός χαρακτήρας είναι ο μόνος που δεν μπορεί να εμφανιστεί σε καμία ταυτότητα
 * του πίνακα (τις παράγει ο `nextPrefixedId` από γράμματα και ψηφία). Οποιοσδήποτε άλλος
 * διαχωριστής θα άφηνε δύο διαφορετικά ζεύγη να παράγουν το **ίδιο** κλειδί, δηλαδή δύο κελιά
 * να γίνουν ένας κόμβος του γράφου — σιωπηλά.
 */
type WorkbookCellKey = string & { readonly __workbookCellKeyBrand: unique symbol };

/** Η **μόνη** νόμιμη πηγή {@link WorkbookCellKey}. */
function workbookCellKey(worksheetId: TableWorksheetId, key: CellKey): WorkbookCellKey {
  return `${worksheetId}\u0000${key}` as WorkbookCellKey;
}

/** Ένα κελί που άλλαξε, με το φύλλο του — η είσοδος του επαναϋπολογισμού. */
export interface WorkbookCellAddress {
  readonly worksheetId: TableWorksheetId;
  readonly key: CellKey;
}

/** Τα νέα αποτελέσματα, ομαδοποιημένα **ανά φύλλο** — έτσι τα ζητά ο γραφέας του μοντέλου. */
export type WorkbookFormulaResults = ReadonlyMap<
  TableWorksheetId,
  ReadonlyMap<CellKey, ScheduleCellValue>
>;

/** Ένα κελί που κρατά τύπο, με ό,τι χρειάζεται ο υπολογισμός του. */
interface FormulaCell {
  readonly key: WorkbookCellKey;
  readonly worksheetId: TableWorksheetId;
  readonly cellKey: CellKey;
  readonly formula: TableFormula;
  /** Τα κελιά που διαβάζει — ευρέα ήδη ανοιγμένα, φύλλα ήδη λυμένα. */
  readonly precedents: readonly WorkbookCellKey[];
}

/**
 * Τα νέα αποτελέσματα για όσα κελιά χρειάστηκε να ξαναϋπολογιστούν, **σε ολόκληρο το βιβλίο**.
 *
 * Ο καλών είναι το `table-formula-engine.ts`.
 */
export function evaluateWorkbookFormulas(
  book: TableFormulaWorkbook,
  changed: readonly WorkbookCellAddress[],
): WorkbookFormulaResults {
  const seed = changed.map((address) => address.worksheetId);
  const cells = collectFormulaCells(book, sheetsReading(book, seed));
  if (cells.size === 0) return EMPTY_RESULTS;

  const dirty = collectDirty(cells, changed);
  if (dirty.size === 0) return EMPTY_RESULTS;

  const { order, circular } = topologicalOrder(cells, dirty);
  const computed = new Map<WorkbookCellKey, TableFormulaValue>();

  for (const key of order) {
    const cell = cells.get(key);
    if (cell === undefined) continue;
    const home = bookAtSheet(book, cell.worksheetId);
    const scope: TableFormulaScope = {
      book: home,
      valueAt: (ref) => readValue(home, computed, ref),
    };
    computed.set(key, evaluateTableFormula(scope, cell.formula));
  }
  for (const key of circular) computed.set(key, FORMULA_ERROR.circular);

  return groupBySheet(cells, computed);
}

/** Καμία δουλειά ⇒ **σταθερή** κενή απάντηση: ούτε ένα `Map` ανά πάτημα πλήκτρου. */
const EMPTY_RESULTS: WorkbookFormulaResults = new Map();

/** Κάθε κελί με τύπο **των συμμετεχόντων φύλλων**, με τους προγόνους του ήδη υπολογισμένους. */
function collectFormulaCells(
  book: TableFormulaWorkbook,
  sheets: ReadonlySet<TableWorksheetId>,
): ReadonlyMap<WorkbookCellKey, FormulaCell> {
  const cells = new Map<WorkbookCellKey, FormulaCell>();
  for (const worksheetId of sheets) {
    const model = book.sheets.get(worksheetId);
    if (model === undefined) continue;
    const home = bookAtSheet(book, worksheetId);
    for (const [key, cell] of model.cells) {
      if (cell.kind !== 'formula' || cell.formula === undefined) continue;
      const bookKey = workbookCellKey(worksheetId, key);
      cells.set(bookKey, {
        key: bookKey,
        worksheetId,
        cellKey: key,
        formula: cell.formula,
        precedents: collectPrecedents(home, cell.formula.root),
      });
    }
  }
  return cells;
}

/**
 * Οι αναφορές ενός δέντρου, με τα εύρη ανοιγμένα σε μεμονωμένα κελιά και **το φύλλο λυμένο**.
 *
 * 🔴 ADR-833 Φάση 7 — ο ιδιωτικός `walk` επτά περιπτώσεων που ζούσε εδώ **έφυγε**: ήταν
 * κυριολεκτικό δίδυμο του `rewriteTableFormulaRefs` (ADR-754 Γ1), δηλαδή ακριβώς ο structural
 * clone που η κεφαλίδα εκείνου του αρχείου προειδοποιούσε ότι πιάνει το **CHECK 3.28** — και
 * η προσθήκη ενός νέου είδους κόμβου θα έπρεπε να θυμηθεί **δύο** θέσεις. Πλέον μία κάθοδος,
 * με δύο ονόματα προθέσεων ({@link forEachTableFormulaRefLeaf}).
 */
function collectPrecedents(
  book: TableFormulaWorkbook,
  node: TableFormulaNode,
): readonly WorkbookCellKey[] {
  const keys: WorkbookCellKey[] = [];
  const push = (ref: TableFormulaCellRef): void => {
    keys.push(workbookCellKey(sheetIdOfRef(book, ref), cellKey(ref.rowId, ref.colId)));
  };
  forEachTableFormulaRefLeaf(node, (leaf) => {
    if (leaf.kind === 'ref') {
      push(leaf.cell);
      return;
    }
    for (const cell of expandRange(book, leaf.from, leaf.to)) push(cell);
  });
  return keys;
}

/**
 * Τα κελιά που πρέπει να ξαναϋπολογιστούν: τα αλλαγμένα που είναι τύποι, **και** ό,τι
 * εξαρτάται από αυτά, μεταβατικά.
 *
 * Ο ίδιος ο γράφος αντιστρέφεται εδώ και όχι στη συλλογή: η ερώτηση «ποιος με διαβάζει;»
 * χρειάζεται μόνο σε αυτό το βήμα, ενώ η «ποιον διαβάζω;» χρειάζεται και στην ταξινόμηση.
 */
function collectDirty(
  cells: ReadonlyMap<WorkbookCellKey, FormulaCell>,
  changed: readonly WorkbookCellAddress[],
): ReadonlySet<WorkbookCellKey> {
  const dependents = new Map<WorkbookCellKey, WorkbookCellKey[]>();
  for (const cell of cells.values()) {
    for (const precedent of cell.precedents) {
      const list = dependents.get(precedent);
      if (list === undefined) dependents.set(precedent, [cell.key]);
      else list.push(cell.key);
    }
  }

  const dirty = new Set<WorkbookCellKey>();
  const visited = new Set<WorkbookCellKey>();
  const queue = changed.map((address) => workbookCellKey(address.worksheetId, address.key));
  // Το `visited` δεν είναι το ίδιο με το `dirty`: επισκεπτόμαστε **και** κελιά χωρίς τύπο
  // (αυτά που άλλαξε ο χρήστης), και χωρίς αυτό ένας κύκλος `A1 → A2 → A1` θα ξανάσπρωχνε
  // τους ίδιους κόμβους για πάντα — ατέρμονος βρόχος πριν καν φτάσουμε στην ανίχνευση.
  for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
    if (visited.has(key)) continue;
    visited.add(key);
    if (cells.has(key)) dirty.add(key);
    for (const dependent of dependents.get(key) ?? []) queue.push(dependent);
  }
  return dirty;
}

/** Το αποτέλεσμα της ταξινόμησης: όσα λύνονται, και όσα πιάστηκαν σε κύκλο. */
interface TopologicalResult {
  readonly order: readonly WorkbookCellKey[];
  readonly circular: readonly WorkbookCellKey[];
}

/**
 * Kahn πάνω **μόνο** στο βρόμικο υποσύνολο: οι ακμές από καθαρά κελιά αγνοούνται, γιατί η
 * τιμή τους είναι ήδη σταθερή. Ό,τι μείνει με βαθμό εισόδου > 0 στο τέλος είναι κύκλος.
 *
 * 🔑 **Η αυτοαναφορά ΔΕΝ εξαιρείται από τις ακμές.** Ένα `A1 = A1+1` κρατά ακμή προς τον
 * εαυτό του, άρα δεν γίνεται ποτέ έτοιμο, μένει στο `pending` και βγαίνει `#CIRCULAR!` —
 * μαζί με ό,τι το διαβάζει. Αν φιλτραριζόταν ως «ακμή προς τον εαυτό», θα ταξινομούνταν
 * κανονικά και θα διάβαζε την **παλιά του τιμή**: αριθμός που μοιάζει σωστός και δεν είναι.
 *
 * ⚠️ ADR-833 Φάση 7 — τα κλειδιά είναι **του βιβλίου**, άρα ο ίδιος αλγόριθμος πιάνει και τον
 * κύκλο **ανάμεσα σε φύλλα**. Καμία ειδική περίπτωση: ο κύκλος δεν ήξερε ποτέ από φύλλα.
 */
function topologicalOrder(
  cells: ReadonlyMap<WorkbookCellKey, FormulaCell>,
  dirty: ReadonlySet<WorkbookCellKey>,
): TopologicalResult {
  const pending = new Map<WorkbookCellKey, number>();
  const unlocks = new Map<WorkbookCellKey, WorkbookCellKey[]>();

  for (const key of dirty) {
    const precedents = new Set((cells.get(key)?.precedents ?? []).filter((p) => dirty.has(p)));
    pending.set(key, precedents.size);
    for (const precedent of precedents) {
      const list = unlocks.get(precedent);
      if (list === undefined) unlocks.set(precedent, [key]);
      else list.push(key);
    }
  }

  const order: WorkbookCellKey[] = [];
  const ready = [...pending].filter(([, count]) => count === 0).map(([key]) => key);
  for (let key = ready.shift(); key !== undefined; key = ready.shift()) {
    order.push(key);
    pending.delete(key);
    for (const dependent of unlocks.get(key) ?? []) {
      const left = (pending.get(dependent) ?? 0) - 1;
      pending.set(dependent, left);
      if (left === 0) ready.push(dependent);
    }
  }

  return { order, circular: [...pending.keys()] };
}

/**
 * Η τιμή ενός κελιού: το φρέσκο αποτέλεσμα αν υπολογίστηκε τώρα, αλλιώς ό,τι λέει το μοντέλο.
 *
 * 🔴 ADR-764 — η δεύτερη ερώτηση («ζει ακόμη αυτή η ταυτότητα;») **δεν** απαντιέται εδώ: την
 * κατέχει ο {@link readCellRefValue}, μαζί με τον εκτυπωτή και την προεπισκόπηση. Πριν από
 * αυτό, η γραμμή ήταν `getCell(...)?.value ?? ''` — δηλαδή «σβησμένη γραμμή» και «κενό κελί»
 * έδιναν **την ίδια** απάντηση, και το `=CONCATENATE(A2;" ";A3)` μετά τη διαγραφή του `A3`
 * έβγαζε `«20 »` αντί για `#REF!`.
 *
 * ⚠️ ADR-833 Φάση 7 — το `book` εδώ είναι **η όψη του σπιτιού του τύπου**, όχι του βιβλίου
 * γενικά: ένα σκέτο `A1` γραμμένο στο Φύλλο2 σημαίνει `Φύλλο2!A1`. Δες {@link bookAtSheet}.
 */
function readValue(
  book: TableFormulaWorkbook,
  computed: ReadonlyMap<WorkbookCellKey, TableFormulaValue>,
  ref: TableFormulaCellRef,
): TableFormulaValue {
  const key = workbookCellKey(sheetIdOfRef(book, ref), cellKey(ref.rowId, ref.colId));
  const fresh = computed.get(key);
  return fresh ?? readCellRefValue(book, ref);
}

/** Τα αποτελέσματα ξανά **ανά φύλλο** — η μορφή που γράφει πίσω ο μηχανισμός του μοντέλου. */
function groupBySheet(
  cells: ReadonlyMap<WorkbookCellKey, FormulaCell>,
  computed: ReadonlyMap<WorkbookCellKey, TableFormulaValue>,
): WorkbookFormulaResults {
  const bySheet = new Map<TableWorksheetId, Map<CellKey, ScheduleCellValue>>();
  for (const [key, value] of computed) {
    const cell = cells.get(key);
    if (cell === undefined) continue;
    const sheet = bySheet.get(cell.worksheetId) ?? new Map<CellKey, ScheduleCellValue>();
    sheet.set(cell.cellKey, toCellValue(value));
    bySheet.set(cell.worksheetId, sheet);
  }
  return bySheet;
}
