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
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-recalc
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §9.2
 */

import type { CellKey, TableModel } from '../../../types/table';
import type { TableFormula, TableFormulaCellRef, TableFormulaNode } from '../../../types/table-formula';
import type { ScheduleCellValue } from '../../schedule/types';
import { cellKey } from '../table-model-helpers';
import { evaluateTableFormula, expandRange, type TableFormulaScope } from './table-formula-eval';
import { readCellRefValue } from './table-formula-ref-scope';
import { FORMULA_ERROR, toCellValue, type TableFormulaValue } from './table-formula-value';

/** Ένα κελί που κρατά τύπο, με ό,τι χρειάζεται ο υπολογισμός του. */
interface FormulaCell {
  readonly key: CellKey;
  readonly formula: TableFormula;
  /** Τα κελιά που διαβάζει — ευρέα ήδη ανοιγμένα σε μεμονωμένα. */
  readonly precedents: readonly CellKey[];
}

/**
 * Τα νέα αποτελέσματα για όσα κελιά χρειάστηκε να ξαναϋπολογιστούν.
 *
 * Ο καλών είναι το `table-formula-engine.ts`· η υπογραφή είναι **αυτούσια** εκείνη που
 * δεσμεύτηκε το ADR-739 §9.2, μήνες πριν γραφτεί αυτό το αρχείο.
 */
export function evaluateTableFormulas(
  model: TableModel,
  changed: readonly CellKey[],
): ReadonlyMap<CellKey, ScheduleCellValue> {
  const cells = collectFormulaCells(model);
  if (cells.size === 0) return new Map();

  const dirty = collectDirty(cells, changed);
  if (dirty.size === 0) return new Map();

  const { order, circular } = topologicalOrder(cells, dirty);
  const computed = new Map<CellKey, TableFormulaValue>();
  const scope: TableFormulaScope = {
    model,
    valueAt: (ref) => readValue(model, computed, ref),
  };

  for (const key of order) {
    const cell = cells.get(key);
    if (cell !== undefined) computed.set(key, evaluateTableFormula(scope, cell.formula));
  }
  for (const key of circular) computed.set(key, FORMULA_ERROR.circular);

  return new Map([...computed].map(([key, value]) => [key, toCellValue(value)]));
}

/** Κάθε κελί με τύπο, με τους προγόνους του ήδη υπολογισμένους. */
function collectFormulaCells(model: TableModel): ReadonlyMap<CellKey, FormulaCell> {
  const cells = new Map<CellKey, FormulaCell>();
  for (const [key, cell] of model.cells) {
    if (cell.kind !== 'formula' || cell.formula === undefined) continue;
    cells.set(key, {
      key,
      formula: cell.formula,
      precedents: collectPrecedents(model, cell.formula.root),
    });
  }
  return cells;
}

/** Οι αναφορές ενός δέντρου, με τα εύρη ανοιγμένα σε μεμονωμένα κελιά. */
function collectPrecedents(model: TableModel, node: TableFormulaNode): readonly CellKey[] {
  const keys: CellKey[] = [];
  walk(node, (found) => keys.push(cellKey(found.rowId, found.colId)));
  return keys;

  function walk(current: TableFormulaNode, visit: (ref: TableFormulaCellRef) => void): void {
    switch (current.kind) {
      case 'ref':
        visit(current.cell);
        return;
      case 'range':
        for (const cell of expandRange(model, current.from, current.to)) visit(cell);
        return;
      case 'group':
        walk(current.inner, visit);
        return;
      case 'unary':
        walk(current.operand, visit);
        return;
      case 'binary':
        walk(current.left, visit);
        walk(current.right, visit);
        return;
      case 'call':
        for (const arg of current.args) walk(arg, visit);
        return;
      // 🔴 ADR-765 — **ήταν `default:`, και γι' αυτό δεν θα είχε σπάσει.** Τα φύλλα χωρίς
      // διεύθυνση απαριθμούνται πλέον ονομαστικά: ο μεταγλωττιστής οφείλει να ρωτήσει «έχει
      // αυτό το νέο είδος κόμβου προγόνους;» κάθε φορά που η ένωση μεγαλώνει. Ένα `default:`
      // απαντά **«όχι»** μόνο του — και η μέρα που η απάντηση θα ήταν «ναι» είναι η μέρα που
      // ένας τύπος θα έπαυε σιωπηλά να ξαναϋπολογίζεται.
      case 'number':
      case 'text':
      case 'boolean':
      case 'error':
      case 'name':
      case 'blank':
        return;
    }
  }
}

/**
 * Τα κελιά που πρέπει να ξαναϋπολογιστούν: τα αλλαγμένα που είναι τύποι, **και** ό,τι
 * εξαρτάται από αυτά, μεταβατικά.
 *
 * Ο ίδιος ο γράφος αντιστρέφεται εδώ και όχι στη συλλογή: η ερώτηση «ποιος με διαβάζει;»
 * χρειάζεται μόνο σε αυτό το βήμα, ενώ η «ποιον διαβάζω;» χρειάζεται και στην ταξινόμηση.
 */
function collectDirty(
  cells: ReadonlyMap<CellKey, FormulaCell>,
  changed: readonly CellKey[],
): ReadonlySet<CellKey> {
  const dependents = new Map<CellKey, CellKey[]>();
  for (const cell of cells.values()) {
    for (const precedent of cell.precedents) {
      const list = dependents.get(precedent);
      if (list === undefined) dependents.set(precedent, [cell.key]);
      else list.push(cell.key);
    }
  }

  const dirty = new Set<CellKey>();
  const visited = new Set<CellKey>();
  const queue = [...changed];
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
  readonly order: readonly CellKey[];
  readonly circular: readonly CellKey[];
}

/**
 * Kahn πάνω **μόνο** στο βρόμικο υποσύνολο: οι ακμές από καθαρά κελιά αγνοούνται, γιατί η
 * τιμή τους είναι ήδη σταθερή. Ό,τι μείνει με βαθμό εισόδου > 0 στο τέλος είναι κύκλος.
 *
 * 🔑 **Η αυτοαναφορά ΔΕΝ εξαιρείται από τις ακμές.** Ένα `A1 = A1+1` κρατά ακμή προς τον
 * εαυτό του, άρα δεν γίνεται ποτέ έτοιμο, μένει στο `pending` και βγαίνει `#CIRCULAR!` —
 * μαζί με ό,τι το διαβάζει. Αν φιλτραριζόταν ως «ακμή προς τον εαυτό», θα ταξινομούνταν
 * κανονικά και θα διάβαζε την **παλιά του τιμή**: αριθμός που μοιάζει σωστός και δεν είναι.
 */
function topologicalOrder(
  cells: ReadonlyMap<CellKey, FormulaCell>,
  dirty: ReadonlySet<CellKey>,
): TopologicalResult {
  const pending = new Map<CellKey, number>();
  const unlocks = new Map<CellKey, CellKey[]>();

  for (const key of dirty) {
    const precedents = new Set((cells.get(key)?.precedents ?? []).filter((p) => dirty.has(p)));
    pending.set(key, precedents.size);
    for (const precedent of precedents) {
      const list = unlocks.get(precedent);
      if (list === undefined) unlocks.set(precedent, [key]);
      else list.push(key);
    }
  }

  const order: CellKey[] = [];
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
 */
function readValue(
  model: TableModel,
  computed: ReadonlyMap<CellKey, TableFormulaValue>,
  ref: TableFormulaCellRef,
): TableFormulaValue {
  const fresh = computed.get(cellKey(ref.rowId, ref.colId));
  return fresh ?? readCellRefValue(model, ref);
}
