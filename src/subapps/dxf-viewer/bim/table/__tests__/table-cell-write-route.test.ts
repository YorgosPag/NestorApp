/**
 * 🔴 ADR-769 Δ7 — **Ο ΕΝΑΣ ΚΡΙΤΗΣ**: πού πάει η γραφή αυτού του κελιού.
 *
 * ## Γιατί αυτό το αρχείο φυλάει κάτι που κανένα άλλο δεν φυλά
 * Μέχρι τη Φ.Η η ερώτηση ήταν **δυαδική** και οι τρεις καταναλωτές (επεξεργαστής, φρουρός,
 * ζωγράφος) συμφωνούσαν επειδή ρωτούσαν την ίδια `isBoundCellWritable`. Η τρίτη απάντηση
 * («γράφεται, αλλά **στην οντότητα**») είναι ακριβώς το σημείο όπου τρεις υλοποιήσεις θα
 * απέκλιναν — και η απόκλιση θα φαινόταν ως **πεδίο που δέχεται πληκτρολόγηση και commit που
 * τη ρίχνει στο κενό** (ADR-767 §11.2 #4, ανάποδα).
 *
 * @see bim/table/write-back/table-cell-write-route.ts — ο κριτής
 */

import { resolveTableCellWriteRoute, isTableCellTypeable } from '../write-back/table-cell-write-route';
import type {
  PersistedTableModel,
  TableBinding,
  TableCellEntry,
  TableColumn,
  TableRow,
} from '../../../types/table';

// ─── Σκηνικό: ο πίνακας συντεταγμένων, με τις ΤΡΕΙΣ κατηγορίες στηλών ─────────

const BINDING: TableBinding = {
  mode: 'bound',
  sourceRef: { kind: 'survey-coordinates' },
  revision: 'r0',
};

/** `cIdx` = ordinal (ποτέ) · `cX` = γράψιμη · `cZ` = no-owner · `cNote` = ελεύθερη. */
function model(cells: TableCellEntry[]): PersistedTableModel {
  const columns: TableColumn[] = [
    { id: 'cIdx', sizing: { kind: 'fixed', widthMm: 15 }, valueType: 'text', align: 'right', sourceKey: 'index' },
    { id: 'cX', sizing: { kind: 'fixed', widthMm: 25 }, valueType: 'text', align: 'right', sourceKey: 'x' },
    { id: 'cZ', sizing: { kind: 'fixed', widthMm: 25 }, valueType: 'text', align: 'right', sourceKey: 'z' },
    { id: 'cNote', sizing: { kind: 'fixed', widthMm: 30 }, valueType: 'text', align: 'left' },
  ];
  const rows: TableRow[] = [
    { id: 'rHead', rowClass: 'header', heightMm: 8 },
    { id: 'r1', rowClass: 'data', heightMm: 6 },
  ];
  return { columns, rows, cells, merges: [] };
}

const boundCell = (colId: string, extra: Record<string, unknown> = {}): TableCellEntry =>
  ['r1', colId, { kind: 'text', value: 1, bound: { sourceValue: 1, ...extra } }] as TableCellEntry;

// ─── 1. Οι τρεις απαντήσεις ──────────────────────────────────────────────────

describe('ADR-769 Δ7 — τρεις απαντήσεις, όχι δύο', () => {
  it('🔴 δεμένο κελί σε ΓΡΑΨΙΜΗ στήλη πάει στον ΙΔΙΟΚΤΗΤΗ — και δηλώνει ποιο πεδίο', () => {
    const route = resolveTableCellWriteRoute(model([boundCell('cX')]), BINDING, 'r1', 'cX');
    expect(route).toEqual({ kind: 'owner', sourceKey: 'x', field: 'x' });
  });

  it('δεμένο κελί σε παράγωγη στήλη είναι read-only — **με τον δομικό λόγο**', () => {
    const route = resolveTableCellWriteRoute(model([boundCell('cIdx')]), BINDING, 'r1', 'cIdx');
    expect(route).toEqual({ kind: 'read-only', reason: 'ordinal' });
  });

  it('στήλη ΧΩΡΙΣ ιδιοκτήτη ξεχωρίζει από παράγωγη — δεν λέμε ψέματα για το γιατί', () => {
    const route = resolveTableCellWriteRoute(model([boundCell('cZ')]), BINDING, 'r1', 'cZ');
    expect(route).toEqual({ kind: 'read-only', reason: 'no-owner' });
  });

  it('ελεύθερο κελί μέσα σε δεμένο πίνακα γράφεται ΣΤΟ ΜΟΝΤΕΛΟ, όπως πάντα', () => {
    const route = resolveTableCellWriteRoute(model([]), BINDING, 'r1', 'cNote');
    expect(route).toEqual({ kind: 'model' });
  });
});

// ─── 2. Η παράκαμψη ΔΕΝ είναι write-back (η απόφαση του Δ7) ───────────────────

describe('ADR-769 Δ7 — ο άνθρωπος που παρέκαμψε ζήτησε το ΑΝΤΙΘΕΤΟ από μετακίνηση', () => {
  it('🔴 παρακαμμένο κελί σε γράψιμη στήλη γράφεται ΣΤΟ ΜΟΝΤΕΛΟ, όχι στην κορυφή', () => {
    // Στέλνοντάς το στον ιδιοκτήτη θα **μετακινούσαμε την κορυφή** επειδή ο χρήστης δήλωσε
    // ρητά ότι θέλει δική του τιμή εκεί — η ακριβώς αντίθετη πράξη από αυτή που ζήτησε.
    const route = resolveTableCellWriteRoute(
      model([boundCell('cX', { overridden: true })]), BINDING, 'r1', 'cX',
    );
    expect(route).toEqual({ kind: 'model' });
  });

  it('κελί σε σύγκρουση επίσης — η απόφαση ανήκει στον άνθρωπο, όχι στη διαδρομή', () => {
    const route = resolveTableCellWriteRoute(
      model([boundCell('cX', { overridden: true, conflict: true })]), BINDING, 'r1', 'cX',
    );
    expect(route).toEqual({ kind: 'model' });
  });
});

// ─── 3. Ασυνεπής διαμόρφωση — άρνηση ΧΩΡΙΣ λόγο, γιατί δεν υπάρχει λόγος ──────

describe('ADR-769 — δεμένο κελί χωρίς πηγή να το κατέχει', () => {
  it('πίνακας χωρίς δεσμό: δεμένο κελί δεν έχει ποιον να ρωτήσει', () => {
    const route = resolveTableCellWriteRoute(model([boundCell('cX')]), undefined, 'r1', 'cX');
    expect(route).toEqual({ kind: 'read-only' });
  });

  it('στήλη χωρίς `sourceKey`: δεν υπάρχει απόφαση γραψιμότητας να αναφερθεί', () => {
    const route = resolveTableCellWriteRoute(model([boundCell('cNote')]), BINDING, 'r1', 'cNote');
    expect(route).toEqual({ kind: 'read-only' });
  });

  it('🔴 `sourceKey` που η ΠΗΓΗ δεν έχει ⇒ `no-owner`, ΠΟΤΕ γράψιμο από παράλειψη', () => {
    // Χειρόγραφο κλειδί που απέκλινε, ή στήλη που η πηγή έπαψε να παράγει. Το προεπιλεγμένο
    // του μητρώου **πρέπει** να είναι άρνηση: ένα γράψιμο-εξ-αγνοίας θα έστελνε την τιμή σε
    // πεδίο που κανείς δεν δήλωσε ότι κατέχει.
    const drifted = model([boundCell('cX')]);
    const withUnknownKey = {
      ...drifted,
      columns: drifted.columns.map((c) => (c.id === 'cX' ? { ...c, sourceKey: 'χ' } : c)),
    };
    expect(resolveTableCellWriteRoute(withUnknownKey, BINDING, 'r1', 'cX')).toEqual({
      kind: 'read-only',
      reason: 'no-owner',
    });
  });

  it('🔴 πηγή ΧΩΡΙΣ παραγωγό: καμία στήλη της δεν γράφεται — ούτε μία, ούτε κατά λάθος', () => {
    const otherSource: TableBinding = { ...BINDING, sourceRef: { kind: 'survey-volumes' } };
    for (const colId of ['cIdx', 'cX', 'cZ']) {
      expect(resolveTableCellWriteRoute(model([boundCell(colId)]), otherSource, 'r1', colId))
        .toEqual({ kind: 'read-only', reason: 'no-owner' });
    }
  });
});

// ─── 4. Τι σημαίνει για τον ΕΠΕΞΕΡΓΑΣΤΗ ──────────────────────────────────────

describe('ADR-769 Δ7 — η γραψιμότητα που ΒΛΕΠΕΙ ο επεξεργαστής', () => {
  it('🔴 κελί συντεταγμένης ΔΕΧΕΤΑΙ πληκτρολόγηση — αλλιώς η Φ.Η κλείνει πριν αρχίσει', () => {
    expect(isTableCellTypeable({ kind: 'owner', sourceKey: 'x', field: 'x' })).toBe(true);
  });

  it('ελεύθερο κελί δέχεται, όπως πάντα', () => {
    expect(isTableCellTypeable({ kind: 'model' })).toBe(true);
  });

  it('read-only δεν δέχεται — και οι δύο εκδοχές του', () => {
    expect(isTableCellTypeable({ kind: 'read-only', reason: 'ordinal' })).toBe(false);
    expect(isTableCellTypeable({ kind: 'read-only' })).toBe(false);
  });
});
