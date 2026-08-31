/**
 * 🔴 ADR-767 (Φ.ΣΤ `bound`) — **Ο ΠΙΝΑΚΑΣ ΘΥΜΑΤΑΙ ΑΠΟ ΠΟΥ ΗΡΘΕ ΚΑΙ ΔΗΛΩΝΕΙ ΠΟΤΕ ΜΠΑΓΙΑΤΕΨΕ.**
 *
 * ## Τι φυλάει αυτό το αρχείο
 * Το ADR-767 §8 #7 ονομάζει τον κίνδυνο που απειλεί **αυτή** τη φάση ονομαστικά:
 *
 * > το ADR-745 **ήδη αποθηκεύει** `TitleBlockBinding.snapshotValue` με ρητό σχόλιο «για
 * > ανίχνευση απόκλισης» — και **ο συγκριτής δεν γράφτηκε ποτέ**. Το πεδίο γράφεται,
 * > σειριοποιείται στο Firestore, εμφανίζεται στο UI, και **πουθενά δεν συγκρίνεται**.
 *
 * Πέμπτη εμφάνιση του «το πεδίο υπάρχει, κανείς δεν κοιτάζει». Το `TableBinding.revision`
 * ήταν στον ίδιο δρόμο: δηλωμένο από τη Φ.Α, **μηδέν αναγνώστες**. Αυτό το αρχείο είναι η
 * απόδειξη ότι ο συγκριτής **εκτελείται** — όχι ότι υπάρχει.
 *
 * ## Οι τρεις ιδιότητες που δεν επιτρέπεται να χαθούν
 * 1. **Early cutoff** (Δ5, Salsa «backdating») — ίδια δεδομένα ⇒ **ίδιο μοντέλο by-reference**.
 *    Δεν είναι βελτιστοποίηση: είναι η διαφορά ανάμεσα σε ένδειξη που διαβάζεται και σε
 *    θόρυβο που ο χρήστης μαθαίνει να αγνοεί.
 * 2. **Το αποτύπωμα είναι ΠΕΡΙΕΧΟΜΕΝΟ** (Δ5) — και το χαρακτηριστικό test είναι ότι το
 *    `generateSceneChecksum` θα **αποτύγχανε** εδώ.
 * 3. **Το refresh δεν πατάει άνθρωπο** (Δ2/§8 #3) — τριμερής συγχώνευση, ποτέ σιωπηλή
 *    αντικατάσταση.
 *
 * @see bim/table/binding/table-binding-refresh.ts — η ορχήστρα του §5
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §9
 */

import { commitCellWrites, writeCellInput } from '../formula/table-formula-engine';
import { fingerprintExportableTable } from '../binding/table-binding-fingerprint';
import { resolveTableSource } from '../binding/table-source-resolver';
import { refreshTableBinding } from '../binding/table-binding-refresh';
import { buildCoordinateTable } from '../../../systems/topography/deliverables/survey-tables';
import type { ExportableTable } from '../../schedule/types';
import type { TopoPoint } from '../../../systems/topography/topo-types';
import type { TableSourceContext } from '../binding/table-source-resolver';
import { activeTableModel } from '../table-worksheet-resolve';
import type {
  PersistedTableModel,
  TableBinding,
  TableCellEntry,
  TableColumn,
  TableRow,
} from '../../../types/table';
import { bookOf, commitPendingForTest } from './formula-book-fixture';

// ─── Τα δεδομένα ──────────────────────────────────────────────────────────────

const P1: TopoPoint = { x: 1000, y: 2000, z: 3000, code: 'Κ1' };
const P2: TopoPoint = { x: 4000, y: 5000, z: 6000, code: 'Κ2' };
/** Το ίδιο σημείο με το {@link P2}, **μετακινημένο** — αλλάζει η τιμή, όχι τα όρια. */
const P2_MOVED: TopoPoint = { x: 4500, y: 5000, z: 6000, code: 'Κ2' };
/** Κορυφή **χωρίς** υψόμετρο: ADR-720 — κενό κελί, ποτέ `0`. */
const P3_NO_Z: TopoPoint = { x: 7000, y: 8000, code: 'Κ3' };

const ctx = (points: readonly TopoPoint[]): TableSourceContext => ({ topoPoints: points });

/**
 * Πίνακας 2 γραμμών × 3 στηλών δεμένος στον πίνακα συντεταγμένων: `index` / `x` / `z`.
 *
 * Η στήλη `z` υπάρχει επίτηδες — είναι ο **μόνος** τρόπος να ελεγχθεί ότι ένα σημείο χωρίς
 * υψόμετρο γράφει **κενό** και όχι `0` (ADR-767 §8 #8 / ADR-720).
 */
function boundModel(): PersistedTableModel {
  const columns: TableColumn[] = [
    { id: 'cIdx', sizing: { kind: 'fixed', widthMm: 15 }, valueType: 'text', align: 'right', sourceKey: 'index' },
    { id: 'cX', sizing: { kind: 'fixed', widthMm: 25 }, valueType: 'text', align: 'right', sourceKey: 'x' },
    { id: 'cZ', sizing: { kind: 'fixed', widthMm: 25 }, valueType: 'text', align: 'right', sourceKey: 'z' },
  ];
  const rows: TableRow[] = [
    { id: 'rHead', rowClass: 'header', heightMm: 8 },
    { id: 'r1', rowClass: 'data', heightMm: 6 },
    { id: 'r2', rowClass: 'data', heightMm: 6 },
  ];
  const cells: TableCellEntry[] = [['rHead', 'cIdx', { kind: 'text', value: 'Α/Α' }]];
  return { columns, rows, cells, merges: [] };
}

const binding = (revision: string): TableBinding => ({
  mode: 'bound',
  sourceRef: { kind: 'survey-coordinates' },
  revision,
});

function cellOf(model: PersistedTableModel, rowId: string, colId: string) {
  return model.cells.find(([r, c]) => r === rowId && c === colId)?.[2];
}

// ─── 1. Επίλυση ───────────────────────────────────────────────────────────────

describe('resolveTableSource — sourceRef → ExportableTable, χωρίς νέο παραγωγό', () => {
  it('ο πίνακας συντεταγμένων επιλύεται στον ΥΠΑΡΧΟΝΤΑ buildCoordinateTable', () => {
    const resolution = resolveTableSource({ kind: 'survey-coordinates' }, ctx([P1, P2]));
    expect(resolution.status).toBe('resolved');
    if (resolution.status !== 'resolved') return;
    // ⚠️ Ταυτότητα με τον υπάρχοντα παραγωγό, όχι «μοιάζει»: το ADR-766 §10 απαγορεύει
    // ρητά τέταρτο παραγωγό δεδομένων. Αν κάποιος γράψει δικό του builder «γιατί βολεύει»,
    // αυτό εδώ πέφτει.
    expect(resolution.table).toEqual(buildCoordinateTable([P1, P2]));
  });

  it('χωρίς σημεία στο context ⇒ ΡΗΤΗ κατάσταση, ποτέ άδειος πίνακας που μοιάζει έγκυρος', () => {
    const resolution = resolveTableSource({ kind: 'survey-coordinates' }, {});
    expect(resolution.status).toBe('source-unavailable');
  });

  it('🔴 αποτύπωση ΧΩΡΙΣ σημεία ≠ «δεν ρώτησε κανείς»: 0 σημεία επιλύονται σε 0 γραμμές', () => {
    // Η διάκριση είναι ουσιώδης: «η αποτύπωση είναι άδεια» είναι **γεγονός** και ο πίνακας
    // οφείλει να το δείξει· «κανείς δεν φόρτωσε τοπογραφία» είναι **άγνοια**. Ένα σχήμα που
    // τα ισοπεδώνει θα έδειχνε άδειο πίνακα σε καθαρό project και θα έλεγε «ενημερωμένος».
    const resolution = resolveTableSource({ kind: 'survey-coordinates' }, ctx([]));
    expect(resolution.status).toBe('resolved');
    if (resolution.status !== 'resolved') return;
    expect(resolution.table.rows).toHaveLength(0);
  });

  it('κλάδος δηλωμένος αλλά ΜΗ συνδεδεμένος ⇒ «source-not-wired», ονομαστικά', () => {
    // Δ7: το ΣΧΗΜΑ καλύπτει και τους τρεις παραγωγούς από την πρώτη μέρα· ο RESOLVER
    // υλοποιείται ένας. Το κενό ανάμεσά τους δεν σιωπά ποτέ.
    for (const ref of [
      { kind: 'survey-plot-boundary' },
      { kind: 'survey-volumes' },
      { kind: 'survey-tolerance' },
      { kind: 'bim-schedule', entityType: 'door' },
    ] as const) {
      const resolution = resolveTableSource(ref, ctx([P1]));
      expect(resolution.status).toBe('source-not-wired');
      if (resolution.status !== 'source-not-wired') continue;
      expect(resolution.kind).toBe(ref.kind);
    }
  });
});

// ─── 2. Το αποτύπωμα ──────────────────────────────────────────────────────────

describe('fingerprintExportableTable — ΠΕΡΙΕΧΟΜΕΝΟ, ποτέ ρολόι (Δ5)', () => {
  it('ίδια δεδομένα ⇒ ίδιο αποτύπωμα, από δύο ανεξάρτητες κατασκευές', () => {
    expect(fingerprintExportableTable(buildCoordinateTable([P1, P2])))
      .toBe(fingerprintExportableTable(buildCoordinateTable([P1, P2])));
  });

  it('🔴 ΚΟΡΥΦΗ ΠΟΥ ΜΕΤΑΚΙΝΗΘΗΚΕ αλλάζει το αποτύπωμα — εδώ ακριβώς αστοχεί το generateSceneChecksum', () => {
    // Χαρακτηριστικό test (ADR-767 §9). Το `generateSceneChecksum` χασάρει
    // `entityCount + layerCount + bounds + units`: μια κορυφή που μετακινήθηκε **χωρίς να
    // αλλάξουν τα όρια** είναι αόρατη σε αυτό. Εδώ το πλήθος σημείων είναι το ίδιο (2) και
    // η μετακίνηση είναι **προς τα μέσα** — άρα ούτε τα bounds αλλάζουν.
    const before = fingerprintExportableTable(buildCoordinateTable([P1, P2]));
    const after = fingerprintExportableTable(buildCoordinateTable([P1, P2_MOVED]));
    expect(after).not.toBe(before);
  });

  it('η ΣΕΙΡΑ των γραμμών μετράει: ίδια σημεία αναδιατεταγμένα ⇒ άλλο αποτύπωμα', () => {
    expect(fingerprintExportableTable(buildCoordinateTable([P1, P2])))
      .not.toBe(fingerprintExportableTable(buildCoordinateTable([P2, P1])));
  });

  it('🔴 ξεχωρίζει ΚΕΝΟ από ΜΗΔΕΝ — αλλιώς το ADR-720 θα ήταν αόρατο στο αποτύπωμα', () => {
    const withNull: ExportableTable = {
      columns: [{ key: 'z', i18nKey: 'k', valueType: 'number', align: 'right' }],
      rows: [{ cells: { z: null } }],
    };
    const withZero: ExportableTable = { ...withNull, rows: [{ cells: { z: 0 } }] };
    const withEmptyText: ExportableTable = { ...withNull, rows: [{ cells: { z: '' } }] };
    const fp = fingerprintExportableTable;
    expect(fp(withNull)).not.toBe(fp(withZero));
    expect(fp(withNull)).not.toBe(fp(withEmptyText));
    expect(fp(withZero)).not.toBe(fp(withEmptyText));
  });

  it('🔴 ξεχωρίζει τον αριθμό 12 από το κείμενο «12»', () => {
    const base: ExportableTable = {
      columns: [{ key: 'v', i18nKey: 'k', valueType: 'text', align: 'left' }],
      rows: [{ cells: { v: 12 } }],
    };
    expect(fingerprintExportableTable(base))
      .not.toBe(fingerprintExportableTable({ ...base, rows: [{ cells: { v: '12' } }] }));
  });

  it('η ΤΑΥΤΟΤΗΤΑ της στήλης μετράει: ίδιες τιμές κάτω από άλλο κλειδί ⇒ άλλο αποτύπωμα', () => {
    const cols = (key: string) => [{ key, i18nKey: 'k', valueType: 'text' as const, align: 'left' as const }];
    const fp = fingerprintExportableTable;
    expect(fp({ columns: cols('x'), rows: [{ cells: { x: 5 } }] }))
      .not.toBe(fp({ columns: cols('y'), rows: [{ cells: { y: 5 } }] }));
  });

  it('δεν είναι ρολόι: δύο κλήσεις σε διαφορετική στιγμή δίνουν την ίδια τιμή', () => {
    // Bazel: «volatile statuses like timestamps are not part of an action key, as that would
    // make the cache useless». Ένα `Date.now()` μέσα στο αποτύπωμα θα κοκκίνιζε τον πίνακα
    // σε **κάθε** refresh, ακόμη κι όταν δεν άλλαξε τίποτα.
    const table = buildCoordinateTable([P1]);
    const first = fingerprintExportableTable(table);
    const spin = Array.from({ length: 5000 }, (_, i) => i).reduce((a, b) => a + b, 0);
    expect(spin).toBeGreaterThan(0);
    expect(fingerprintExportableTable(table)).toBe(first);
  });
});

// ─── 3. Η ανανέωση ────────────────────────────────────────────────────────────

describe('refreshTableBinding — η ορχήστρα του §5', () => {
  it('γεμίζει κάθε στήλη από το ΔΙΚΟ της sourceKey, με τη σειρά των γραμμών δεδομένων', () => {
    const result = refreshTableBinding({ book: bookOf(boundModel()), model: boundModel(), binding: binding(''), context: ctx([P1, P2]) });
    expect(result.status).toBe('refreshed');
    if (result.status !== 'refreshed') return;

    // 🔴 ADR-769 §11 — **το κελί κρατά ό,τι ΒΛΕΠΕΙ ο άνθρωπος**: η στήλη `x` είναι
    // `dimension-mm-to-m`, άρα 1000 mm ⇒ `1` m. Ο αύξων αριθμός (`count`) δεν αλλάζει μονάδα
    // και γι' αυτό ακριβώς η βλάβη έμεινε αόρατη επί μία φάση: η μισή γραμμή φαινόταν σωστή.
    expect(cellOf(result.model, 'r1', 'cIdx')?.value).toBe(1);
    expect(cellOf(result.model, 'r1', 'cX')?.value).toBe(1);
    expect(cellOf(result.model, 'r2', 'cIdx')?.value).toBe(2);
    expect(cellOf(result.model, 'r2', 'cX')?.value).toBe(4);
  });

  it('🔴 ADR-769 §11 — η ΒΑΣΗ μένει ΩΜΗ ενώ το κελί δείχνει μονάδες οθόνης', () => {
    const result = refreshTableBinding({ book: bookOf(boundModel()), model: boundModel(), binding: binding(''), context: ctx([P1, P2]) });
    if (result.status !== 'refreshed') throw new Error('expected refreshed');
    // Οι δύο πρέπει να **διαφέρουν** εδώ: ίδιες τιμές θα σήμαιναν ότι κάποιος από τους δύο
    // δρόμους ξέχασε τη μονάδα του — και ο CAS του Δ3 συγκρίνει τη βάση με **την πηγή**.
    expect(cellOf(result.model, 'r2', 'cX')?.value).toBe(4);
    expect(cellOf(result.model, 'r2', 'cX')?.bound?.sourceValue).toBe(4000);
  });

  it('🔴 η γραμμή ΚΕΦΑΛΙΔΑΣ δεν αγγίζεται — τα δεδομένα πάνε σε γραμμές δεδομένων', () => {
    const result = refreshTableBinding({ book: bookOf(boundModel()), model: boundModel(), binding: binding(''), context: ctx([P1, P2]) });
    if (result.status !== 'refreshed') throw new Error('expected refreshed');
    expect(cellOf(result.model, 'rHead', 'cIdx')?.value).toBe('Α/Α');
  });

  it('🔴 σημείο ΧΩΡΙΣ υψόμετρο γράφει ΚΕΝΟ, ποτέ 0 (ADR-720 / §8 #8)', () => {
    const result = refreshTableBinding({ book: bookOf(boundModel()), model: boundModel(), binding: binding(''), context: ctx([P1, P3_NO_Z]) });
    if (result.status !== 'refreshed') throw new Error('expected refreshed');
    // Ένα κατασκευασμένο `0.000` σε πίνακα συντεταγμένων που υπογράφεται είναι δηλωμένη
    // μέτρηση που κανείς δεν πήρε — και ρέει κατευθείαν σε νομικό παραδοτέο.
    expect(cellOf(result.model, 'r2', 'cZ')?.value).toBeNull();
    // 3000 mm ⇒ 3 m στην οθόνη (ADR-769 §11). Το κενό μένει **κενό** και στις δύο μονάδες:
    // ο μετατροπέας δεν γεννά `0` από `null` — αυτό θα ήταν το ίδιο ψέμα με άλλο πρόσωπο.
    expect(cellOf(result.model, 'r1', 'cZ')?.value).toBe(3);
  });

  it('κάθε γεμισμένο κελί κρατά τη ΒΑΣΗ του (sourceValue) — αλλιώς δεν υπάρχει συγχώνευση αργότερα', () => {
    const result = refreshTableBinding({ book: bookOf(boundModel()), model: boundModel(), binding: binding(''), context: ctx([P1, P2]) });
    if (result.status !== 'refreshed') throw new Error('expected refreshed');
    expect(cellOf(result.model, 'r1', 'cX')?.bound).toEqual({ sourceValue: 1000 });
  });

  it('το νέο revision είναι το αποτύπωμα των δεδομένων που ΓΡΑΦΤΗΚΑΝ', () => {
    const result = refreshTableBinding({ book: bookOf(boundModel()), model: boundModel(), binding: binding(''), context: ctx([P1, P2]) });
    if (result.status !== 'refreshed') throw new Error('expected refreshed');
    expect(result.binding.revision).toBe(fingerprintExportableTable(buildCoordinateTable([P1, P2])));
  });

  // ── Early cutoff ──

  it('🏆 EARLY CUTOFF: ίδια δεδομένα ⇒ «unchanged» και το ΙΔΙΟ μοντέλο by-reference', () => {
    const first = refreshTableBinding({ book: bookOf(boundModel()), model: boundModel(), binding: binding(''), context: ctx([P1, P2]) });
    if (first.status !== 'refreshed') throw new Error('expected refreshed');

    const again = refreshTableBinding({
      book: bookOf(first.model),
      model: first.model,
      binding: first.binding,
      context: ctx([P1, P2]),
    });

    expect(again.status).toBe('unchanged');
    // 🔴 By-reference, όχι `toEqual`: νέο αντικείμενο σημαίνει βήμα undo για το τίποτα και
    // ακύρωση κάθε `WeakMap` λανθάνουσας μνήμης που κρέμεται από το μοντέλο (§8 #2).
    expect(again.model).toBe(first.model);
    expect(again.binding).toBe(first.binding);
  });

  it('🏆 EARLY CUTOFF όταν τα δεδομένα ξαναβγήκαν ΙΔΙΑ από άλλα αντικείμενα', () => {
    // Salsa «backdating»: το κρίσιμο δεν είναι «δεν ξανατρέξαμε», είναι «το αποτέλεσμα
    // βγήκε ίδιο ⇒ η διάδοση σταματά». Εδώ τα σημεία είναι **νέα αντικείμενα** με τις ίδιες
    // τιμές: αν το κριτήριο ήταν ταυτότητα αναφοράς και όχι περιεχόμενο, θα κοκκίνιζε.
    const first = refreshTableBinding({ book: bookOf(boundModel()), model: boundModel(), binding: binding(''), context: ctx([P1, P2]) });
    if (first.status !== 'refreshed') throw new Error('expected refreshed');

    const clones = [{ ...P1 }, { ...P2 }];
    const again = refreshTableBinding({ book: bookOf(first.model), model: first.model, binding: first.binding, context: ctx(clones) });
    expect(again.status).toBe('unchanged');
    expect(again.model).toBe(first.model);
  });

  it('αλλαγή κορυφής ⇒ νέα τιμή ΚΑΙ νέο revision', () => {
    const first = refreshTableBinding({ book: bookOf(boundModel()), model: boundModel(), binding: binding(''), context: ctx([P1, P2]) });
    if (first.status !== 'refreshed') throw new Error('expected refreshed');

    const second = refreshTableBinding({
      book: bookOf(first.model),
      model: first.model,
      binding: first.binding,
      context: ctx([P1, P2_MOVED]),
    });
    expect(second.status).toBe('refreshed');
    if (second.status !== 'refreshed') return;
    expect(cellOf(second.model, 'r2', 'cX')?.value).toBe(4.5);
    expect(second.binding.revision).not.toBe(first.binding.revision);
  });

  // ── Ρητές καταστάσεις ──

  it('sourceKey που η ΠΗΓΗ δεν έχει ⇒ ονομάζεται ρητά, δεν αφήνει σιωπηλό κενό', () => {
    const model = boundModel();
    const withGhost: PersistedTableModel = {
      ...model,
      columns: [...model.columns, {
        id: 'cGhost', sizing: { kind: 'fixed', widthMm: 10 },
        valueType: 'text', align: 'left', sourceKey: 'δεν-υπάρχει',
      }],
    };
    const result = refreshTableBinding({ book: bookOf(withGhost), model: withGhost, binding: binding(''), context: ctx([P1, P2]) });
    if (result.status !== 'refreshed') throw new Error('expected refreshed');
    expect(result.unknownSourceKeys).toEqual(['δεν-υπάρχει']);
    // Η στήλη-φάντασμα μένει **κενή**, δεν γεμίζει με τίποτα.
    expect(cellOf(result.model, 'r1', 'cGhost')).toBeUndefined();
  });

  it('πίνακας ΧΩΡΙΣ καμία στήλη sourceKey ⇒ ρητή κατάσταση, όχι σιωπηλό «όλα καλά»', () => {
    const model = boundModel();
    const unbound: PersistedTableModel = {
      ...model,
      columns: model.columns.map(({ sourceKey: _drop, ...rest }) => rest),
    };
    const result = refreshTableBinding({ book: bookOf(unbound), model: unbound, binding: binding(''), context: ctx([P1, P2]) });
    expect(result.status).toBe('no-bound-columns');
  });

  it('η ΔΟΜΙΚΗ απόκλιση δηλώνεται: 3 σημεία σε πίνακα 2 γραμμών', () => {
    // Η Φ.ΣΤ γράφει **τιμές**, δεν αλλάζει τη δομή (§5: τα τέσσερα βήματα δεν περιλαμβάνουν
    // εισαγωγή γραμμής). Το να «μεγαλώσει» σιωπηλά ο πίνακας θα ήταν δομική πράξη που
    // αλλάζει ταυτότητες — ακριβώς η κλάση που έκλεισε το ADR-764 — και θα την έκανε ένας
    // μηχανισμός που κανείς δεν κάλεσε. Άρα: **λέγεται**.
    const result = refreshTableBinding({
      book: bookOf(boundModel()),
      model: boundModel(), binding: binding(''), context: ctx([P1, P2, P3_NO_Z]),
    });
    if (result.status !== 'refreshed') throw new Error('expected refreshed');
    expect(result.rowCoverage).toEqual({ table: 2, source: 3 });
  });

  it('η πηγή που δεν επιλύεται ⇒ «unresolved» με τον λόγο, και το μοντέλο ΔΕΝ αγγίζεται', () => {
    const model = boundModel();
    const result = refreshTableBinding({ model, binding: binding('παλιό'), context: {} });
    expect(result.status).toBe('unresolved');
    if (result.status !== 'unresolved') return;
    expect(result.reason).toBe('source-unavailable');
  });

  // ── Ο επαναϋπολογισμός (§8 #1) ──

  it('🔴 τύπος πάνω σε δεμένο κελί ΕΝΗΜΕΡΩΝΕΤΑΙ — ο resolver περνά από commitCellWrites', () => {
    // ADR-764: «γραφή χωρίς επαναϋπολογισμό» ήταν η κλάση που έκλεισε το Βήμα 1. Ένας
    // resolver που γράφει κελιά παρακάμπτοντας το `commitCellWrites` θα ήταν το **έκτο**
    // δείγμα — και το σύμπτωμα θα ήταν λάθος **νούμερο** σε πίνακα ποσοτήτων, όχι εξαίρεση.
    const base = boundModel();
    const withSum: PersistedTableModel = {
      ...base,
      columns: [...base.columns, {
        id: 'cSum', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'text', align: 'right',
      }],
    };
    const seeded = refreshTableBinding({ book: bookOf(withSum), model: withSum, binding: binding(''), context: ctx([P1, P2]) });
    if (seeded.status !== 'refreshed') throw new Error('expected refreshed');

    // Τύπος που αθροίζει τη δεμένη στήλη X (B2:B3 = οι δύο γραμμές δεδομένων).
    // 🔴 ADR-769 §11 — η **απόδειξη** ότι η μονάδα οθόνης έπρεπε να μπει ως **αριθμός** και όχι
    // ως κείμενο: το `SUM` εξακολουθεί να αθροίζει τη δεμένη στήλη (1 + 4 = 5 m). Με
    // `formatCellForDisplay` το κελί θα κρατούσε `"1.000"` και ο τύπος θα έδινε **μηδέν**.
    const withFormula = commitPendingForTest(writeCellInput(bookOf(activeTableModel(seeded)),activeTableModel(seeded), 'r1', 'cSum', '=SUM(B2:B3)'));
    expect(cellOf(withFormula, 'r1', 'cSum')?.value).toBe(5);

    const moved = refreshTableBinding({
      book: bookOf(withFormula),
      model: withFormula, binding: seeded.binding, context: ctx([P1, P2_MOVED]),
    });
    if (moved.status !== 'refreshed') throw new Error('expected refreshed');
    expect(cellOf(activeTableModel(moved), 'r1', 'cSum')?.value).toBe(5.5);
  });
});
