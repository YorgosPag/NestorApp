/**
 * 🏆 ADR-767 Δ1+Δ2+Δ4 — **Η ΠΑΡΑΚΑΜΨΗ ΔΕΝ ΚΑΤΑΣΤΡΕΦΕΙ, ΚΑΙ Ο ΣΥΓΚΡΙΤΗΣ ΕΚΤΕΛΕΙΤΑΙ.**
 *
 * ## Πού είμαστε καλύτεροι από τους μεγάλους — και τι το φυλάει
 * Το CAD status quo είναι **δυαδικό**: ή κλειδωμένο-και-ασφαλές, ή γραμμένο-και-αποσυνδεδεμένο.
 *
 * | | Τι κάνει όταν ο άνθρωπος γράψει πάνω στον δεσμό |
 * |---|---|
 * | **Excel** | ο τύπος **χάνεται σιωπηλά** — καμία προειδοποίηση |
 * | **AutoCAD Data Link** | μετά το ξεκλείδωμα, το επόμενο `DATALINKUPDATE` **πατάει** την ανθρώπινη τιμή |
 * | **Figma** | override **χωρίς να σπάσει** ο δεσμός, ορατό, με «Reset all changes» |
 *
 * Εμείς κρατάμε **και τις δύο** πληροφορίες ταυτόχρονα (Δ2) — και το `sourceValue` παίζει τον
 * ρόλο του **merge base**, οπότε το refresh γίνεται τριμερής συγχώνευση αντί για μάχη.
 *
 * ## 🔴 Η μεσαία γραμμή είναι το όλο νόημα
 * «Παράκαμψη + πηγή **αμετάβλητη** ⇒ **καμία** σύγκρουση». Χωρίς τη βάση, κάθε refresh θα
 * κήρυσσε σύγκρουση σε κάθε παρακαμμένο κελί — αφού η παράκαμψη *εξ ορισμού* διαφέρει από την
 * πηγή — και ο χρήστης θα μάθαινε μέσα σε μια μέρα να την αγνοεί. Είναι η ίδια αστοχία με το
 * «QA που κραυγάζει» (ADR-720 §3.3) και με τον λόγο ύπαρξης του early cutoff.
 *
 * @see bim/table/binding/table-binding-state.ts — ο ΣΥΓΚΡΙΤΗΣ (§8 #7)
 * @see bim/table/binding/table-binding-override.ts — παράκαμψη + επαναφορά
 */

import {
  classifyBoundCell,
  isBoundCellWritable,
  assessTableFreshness,
} from '../binding/table-binding-state';
import { commitCellWrites } from '../formula/table-formula-engine';
import {
  overrideBoundCell,
  resetBoundCellToSource,
  resetAllBoundCellsToSource,
  keepOverrideOverSource,
} from '../binding/table-binding-override';
import { refreshTableBinding } from '../binding/table-binding-refresh';
import { fingerprintExportableTable } from '../binding/table-binding-fingerprint';
import { buildCoordinateTable } from '../../../systems/topography/deliverables/survey-tables';
import type { TopoPoint } from '../../../systems/topography/topo-types';
import type { TableSourceContext } from '../binding/table-source-resolver';
import type {
  PersistedTableModel,
  TableBinding,
  TableColumn,
  TableRow,
} from '../../../types/table';

const P1: TopoPoint = { x: 1000, y: 2000, z: 3000, code: 'Κ1' };
const P2: TopoPoint = { x: 4000, y: 5000, z: 6000, code: 'Κ2' };
const P2_MOVED: TopoPoint = { x: 4500, y: 5000, z: 6000, code: 'Κ2' };

const ctx = (points: readonly TopoPoint[]): TableSourceContext => ({ topoPoints: points });

const BINDING: TableBinding = { mode: 'bound', sourceRef: { kind: 'survey-coordinates' }, revision: '' };

function emptyBoundModel(): PersistedTableModel {
  const columns: TableColumn[] = [
    { id: 'cX', sizing: { kind: 'fixed', widthMm: 25 }, valueType: 'text', align: 'right', sourceKey: 'x' },
    { id: 'cCode', sizing: { kind: 'fixed', widthMm: 25 }, valueType: 'text', align: 'left', sourceKey: 'code' },
  ];
  const rows: TableRow[] = [
    { id: 'r1', rowClass: 'data', heightMm: 6 },
    { id: 'r2', rowClass: 'data', heightMm: 6 },
  ];
  return { columns, rows, cells: [], merges: [] };
}

/** Γεμισμένος από τα {@link P1}/{@link P2} — η αφετηρία κάθε σεναρίου παρακάτω. */
function filled(): { model: PersistedTableModel; binding: TableBinding } {
  const result = refreshTableBinding({ model: emptyBoundModel(), binding: BINDING, context: ctx([P1, P2]) });
  if (result.status !== 'refreshed') throw new Error('η αφετηρία πρέπει να γεμίζει');
  return { model: result.model, binding: result.binding };
}

function cellOf(model: PersistedTableModel, rowId: string, colId: string) {
  return model.cells.find(([r, c]) => r === rowId && c === colId)?.[2];
}

// ─── 1. Read-only εξ ορισμού (Δ1) ─────────────────────────────────────────────

describe('Δ1 — το δεμένο κελί είναι read-only εξ ορισμού', () => {
  it('δεμένο κελί ΔΕΝ γράφεται· ελεύθερο κελί γράφεται', () => {
    const { model } = filled();
    expect(isBoundCellWritable(cellOf(model, 'r1', 'cX'))).toBe(false);
    expect(isBoundCellWritable(undefined)).toBe(true);
  });

  it('μετά από ρητό ξεκλείδωμα, το κελί γράφεται — ο δεσμός όμως ΔΕΝ σπάει', () => {
    const { model } = filled();
    const unlocked = { model: commitCellWrites(overrideBoundCell(model, 'r1', 'cX', 9999)) };
    expect(isBoundCellWritable(cellOf(unlocked.model, 'r1', 'cX'))).toBe(true);
    expect(cellOf(unlocked.model, 'r1', 'cX')?.bound?.sourceValue).toBe(1000);
  });

  it('🔴 δεν υπερφορτώνει το `locked` — αυτό δηλώνει την ΑΝΤΙΘΕΤΗ κατεύθυνση', () => {
    // `TableCell.locked` σημαίνει «δεν δέχεται write-back **προς το μοντέλο**» (Φ.Η).
    // Δύο σημασίες στην ίδια λέξη ήταν η παγίδα του ADR-764 §2.1. Ο δεσμός έχει δικό του πεδίο.
    const { model } = filled();
    expect(cellOf(model, 'r1', 'cX')?.locked).toBeUndefined();
    expect(cellOf(model, 'r1', 'cX')?.bound).toBeDefined();
  });
});

// ─── 2. Οι τέσσερις καταστάσεις κελιού ────────────────────────────────────────

describe('classifyBoundCell — τέσσερις ρητές καταστάσεις, καμία μαντεψιά', () => {
  it('ελεύθερο / δεμένο / παρακαμμένο', () => {
    const { model } = filled();
    expect(classifyBoundCell(undefined)).toBe('unbound');
    expect(classifyBoundCell(cellOf(model, 'r1', 'cX'))).toBe('bound');

    const overridden = commitCellWrites(overrideBoundCell(model, 'r1', 'cX', 9999));
    expect(classifyBoundCell(cellOf(overridden, 'r1', 'cX'))).toBe('overridden');
  });

  it('η ΣΥΓΚΡΟΥΣΗ είναι δική της κατάσταση — μόνο η ArchiCAD έχει έστω δύο τεκμηριωμένες', () => {
    const { model, binding } = filled();
    const overridden = commitCellWrites(overrideBoundCell(model, 'r1', 'cX', 9999));
    const after = refreshTableBinding({ model: overridden, binding, context: ctx([{ ...P1, x: 1111 }, P2]) });
    if (after.status !== 'refreshed') throw new Error('expected refreshed');
    expect(classifyBoundCell(cellOf(after.model, 'r1', 'cX'))).toBe('conflict');
  });
});

// ─── 3. Η τριμερής συγχώνευση (Δ2) ────────────────────────────────────────────

describe('Δ2 — το refresh ΔΕΝ πατάει τον άνθρωπο', () => {
  it('🔴 refresh πάνω σε παρακαμμένο κελί ΔΕΝ αλλάζει την ανθρώπινη τιμή', () => {
    const { model, binding } = filled();
    const overridden = commitCellWrites(overrideBoundCell(model, 'r1', 'cX', 9999));

    const after = refreshTableBinding({ model: overridden, binding, context: ctx([{ ...P1, x: 1111 }, P2]) });
    if (after.status !== 'refreshed') throw new Error('expected refreshed');
    // Το AutoCAD εδώ θα έγραφε `1111` πάνω από το `9999` και το Excel θα είχε ήδη σβήσει
    // τον δεσμό. Εμείς κρατάμε **και τα δύο**.
    expect(cellOf(after.model, 'r1', 'cX')?.value).toBe(9999);
    expect(cellOf(after.model, 'r1', 'cX')?.bound?.sourceValue).toBe(1111);
    expect(after.conflicts).toEqual([{ rowId: 'r1', colId: 'cX' }]);
  });

  it('🏆 παράκαμψη + πηγή ΑΜΕΤΑΒΛΗΤΗ ⇒ ΚΑΜΙΑ σύγκρουση — η βάση κάνει τη διαφορά', () => {
    const { model, binding } = filled();
    const overridden = commitCellWrites(overrideBoundCell(model, 'r1', 'cX', 9999));

    // Ίδια σημεία: η πηγή δεν κουνήθηκε. Ο άνθρωπος έχει ήδη αποφασίσει — καμία ενόχληση.
    const after = refreshTableBinding({ model: overridden, binding, context: ctx([P1, P2]) });
    if (after.status === 'unresolved' || after.status === 'no-bound-columns') throw new Error('bad status');
    if (after.status === 'refreshed') expect(after.conflicts).toEqual([]);
    expect(classifyBoundCell(cellOf(after.model, 'r1', 'cX'))).toBe('overridden');
    expect(cellOf(after.model, 'r1', 'cX')?.value).toBe(9999);
  });

  it('τα ΜΗ παρακαμμένα κελιά ενημερώνονται κανονικά στο ίδιο refresh', () => {
    const { model, binding } = filled();
    const overridden = commitCellWrites(overrideBoundCell(model, 'r1', 'cX', 9999));
    const after = refreshTableBinding({ model: overridden, binding, context: ctx([P1, P2_MOVED]) });
    if (after.status !== 'refreshed') throw new Error('expected refreshed');
    // ADR-769 §11 — **μονάδες ΟΘΟΝΗΣ** στο κελί (4500 mm ⇒ 4,5 m)· η **ωμή** τιμή ζει στο
    // `sourceValue`, που είναι η βάση σύγκρισης με την πηγή. Δες `table-binding-cells`.
    expect(cellOf(after.model, 'r2', 'cX')?.value).toBe(4.5);
    expect(cellOf(after.model, 'r2', 'cX')?.bound?.sourceValue).toBe(4500);
    expect(cellOf(after.model, 'r1', 'cX')?.value).toBe(9999);
  });

  it('η σύγκρουση ΔΕΝ σβήνεται από επόμενο refresh — μόνο από άνθρωπο', () => {
    const { model, binding } = filled();
    const overridden = commitCellWrites(overrideBoundCell(model, 'r1', 'cX', 9999));
    const conflicted = refreshTableBinding({ model: overridden, binding, context: ctx([{ ...P1, x: 1111 }, P2]) });
    if (conflicted.status !== 'refreshed') throw new Error('expected refreshed');

    const again = refreshTableBinding({
      model: conflicted.model, binding: conflicted.binding, context: ctx([{ ...P1, x: 1111 }, P2]),
    });
    // Σιωπηλό σβήσιμο της σύγκρουσης θα ήταν η αντικατάσταση του Δ2, με ένα βήμα καθυστέρηση.
    expect(classifyBoundCell(cellOf(again.model, 'r1', 'cX'))).toBe('conflict');
  });
});

// ─── 4. Επαναφορά στην πηγή (Δ2) ──────────────────────────────────────────────

describe('«Επαναφορά στην πηγή» — ανά κελί ΚΑΙ συνολικά (Figma per-property + reset all)', () => {
  it('ανά κελί: η τιμή γίνεται ξανά της πηγής και το κελί ξανακλειδώνει', () => {
    const { model } = filled();
    const overridden = commitCellWrites(overrideBoundCell(model, 'r1', 'cX', 9999));
    const reset = { model: commitCellWrites(resetBoundCellToSource(overridden, 'r1', 'cX')) };
    expect(cellOf(reset.model, 'r1', 'cX')?.value).toBe(1000);
    expect(classifyBoundCell(cellOf(reset.model, 'r1', 'cX'))).toBe('bound');
    expect(isBoundCellWritable(cellOf(reset.model, 'r1', 'cX'))).toBe(false);
  });

  it('συνολικά: καθαρίζει ΚΑΘΕ παράκαμψη και ΚΑΘΕ σύγκρουση, τίποτε άλλο', () => {
    const { model, binding } = filled();
    let m = commitCellWrites(overrideBoundCell(model, 'r1', 'cX', 9999));
    m = commitCellWrites(overrideBoundCell(m, 'r2', 'cCode', 'χειροκίνητο'));
    const conflicted = refreshTableBinding({ model: m, binding, context: ctx([{ ...P1, x: 1111 }, P2]) });
    if (conflicted.status !== 'refreshed') throw new Error('expected refreshed');

    const reset = { model: commitCellWrites(resetAllBoundCellsToSource(conflicted.model)) };
    expect(cellOf(reset.model, 'r1', 'cX')?.value).toBe(1111);
    expect(cellOf(reset.model, 'r2', 'cCode')?.value).toBe('Κ2');
    expect(classifyBoundCell(cellOf(reset.model, 'r1', 'cX'))).toBe('bound');
    expect(classifyBoundCell(cellOf(reset.model, 'r2', 'cCode'))).toBe('bound');
  });

  it('🔴 συνολική επαναφορά ΧΩΡΙΣ καμία παράκαμψη ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference', () => {
    // Η τέταρτη εγγύηση του γραφέα (ADR-739 §50), ταξιδεμένη: κανένα βήμα undo για το τίποτα.
    const { model } = filled();
    expect(commitCellWrites(resetAllBoundCellsToSource(model))).toBe(model);
  });

  it('«κράτα το δικό μου»: η σύγκρουση λύνεται, η παράκαμψη ΕΠΙΒΙΩΝΕΙ', () => {
    const { model, binding } = filled();
    const overridden = commitCellWrites(overrideBoundCell(model, 'r1', 'cX', 9999));
    const conflicted = refreshTableBinding({ model: overridden, binding, context: ctx([{ ...P1, x: 1111 }, P2]) });
    if (conflicted.status !== 'refreshed') throw new Error('expected refreshed');

    const kept = keepOverrideOverSource(conflicted.model, 'r1', 'cX');
    expect(classifyBoundCell(cellOf(kept, 'r1', 'cX'))).toBe('overridden');
    expect(cellOf(kept, 'r1', 'cX')?.value).toBe(9999);
    // Η βάση μένει η **φρέσκια** τιμή: μια μελλοντική αλλαγή της πηγής θα ξαναδηλωθεί.
    expect(cellOf(kept, 'r1', 'cX')?.bound?.sourceValue).toBe(1111);
  });
});

// ─── 5. Ο συγκριτής μπαγιάτικου (§8 #7) ───────────────────────────────────────

describe('assessTableFreshness — ΤΟ ΠΕΔΙΟ ΠΟΥ ΚΑΠΟΙΟΣ ΟΝΤΩΣ ΔΙΑΒΑΖΕΙ', () => {
  it('μόλις ανανεωμένος ⇒ φρέσκος', () => {
    const { model, binding } = filled();
    expect(model.cells.length).toBeGreaterThan(0);
    expect(assessTableFreshness(binding, ctx([P1, P2])).status).toBe('fresh');
  });

  it('🔴 αλλαγή κορυφής ⇒ ΜΠΑΓΙΑΤΙΚΟΣ, με το φρέσκο αποτύπωμα στο χέρι', () => {
    const { binding } = filled();
    const verdict = assessTableFreshness(binding, ctx([P1, P2_MOVED]));
    expect(verdict.status).toBe('stale');
    if (verdict.status !== 'stale') return;
    expect(verdict.freshRevision).toBe(fingerprintExportableTable(buildCoordinateTable([P1, P2_MOVED])));
  });

  it('🔴 αλλαγή ΑΣΧΕΤΗΣ οντότητας ⇒ ΟΧΙ μπαγιάτικος — εδώ πεθαίνει ο μετρητής του SceneStore', () => {
    // Ο μετρητής έκδοσης του `SceneStore` είναι **ανά level**: μια μετακίνηση τοίχου θα τον
    // αύξανε και θα κοκκίνιζε τον πίνακα συντεταγμένων που δεν άγγιξε κανείς. Εδώ η «άσχετη
    // αλλαγή» εκφράζεται ως ό,τι **δεν** μπαίνει στα δεδομένα της πηγής: το context είναι
    // ίδιο ως προς τα σημεία, νέα αντικείμενα ως προς την ταυτότητα.
    const { binding } = filled();
    expect(assessTableFreshness(binding, ctx([{ ...P1 }, { ...P2 }])).status).toBe('fresh');
  });

  it('πηγή που δεν επιλύεται ⇒ «unknown» με λόγο — ΠΟΤΕ ψεύτικο «ενημερωμένος»', () => {
    const { binding } = filled();
    const verdict = assessTableFreshness(binding, {});
    expect(verdict.status).toBe('unknown');
    if (verdict.status !== 'unknown') return;
    expect(verdict.reason).toBe('source-unavailable');
  });

  it('🔴 πίνακας που ΔΕΝ ανανεώθηκε ποτέ (revision κενό) ⇒ μπαγιάτικος, όχι φρέσκος', () => {
    // Κενό αποτύπωμα δεν ταιριάζει ποτέ με πραγματικό ⇒ η κατάσταση προκύπτει από τη
    // σύγκριση, χωρίς ειδική περίπτωση. Το αντίθετο θα σήμαινε ότι ένας άδειος δεσμός
    // παρουσιάζεται ως ενημερωμένος.
    expect(assessTableFreshness(BINDING, ctx([P1, P2])).status).toBe('stale');
  });
});
