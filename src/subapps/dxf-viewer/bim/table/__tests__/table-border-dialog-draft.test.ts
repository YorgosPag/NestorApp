/**
 * ADR-750 Φ6 — **η μηχανή του προσχεδίου** του διαλόγου «Περισσότερα περιγράμματα…».
 *
 * Δύο επίπεδα απόδειξης, όπως και στις 13 εντολές (`table-range-border-ops.test.ts`):
 *
 * 1. **Στο μοντέλο** — ποιες ακμές/διαγώνιοι γράφτηκαν, με ποιο μολύβι, και τι **δεν** γράφτηκε.
 * 2. **Στην οθόνη** — μέσω πραγματικού `resolveTableModel` + `layoutTable`, δηλαδή της ίδιας
 *    διαδρομής που τροφοδοτεί καμβά / PDF / DXF. Χωρίς το δεύτερο, ένα test λέει «το πεδίο
 *    γράφτηκε» και ποτέ «ο χρήστης βλέπει γραμμή».
 *
 * Ο μετρητής κειμένου είναι ενεθειμένος και ντετερμινιστικός, για τον λόγο που εξηγεί το
 * `table-layout.test.ts` — **όχι** ως δεύτερη υλοποίηση μέτρησης (N.18).
 */

import { layoutTable } from '../table-layout';
import { resolveTableModel } from '../table-model-helpers';
import { HIDDEN_TABLE_EDGE } from '../table-edge-model';
import {
  TABLE_BORDER_DIALOG_POSITIONS,
  availableTableBorderDialogPositions,
  isTableBorderDialogPositionAvailable,
  tableBorderDialogPositionState,
  tableBorderDialogSnapshot,
  tableDiagonalPositionId,
} from '../table-border-dialog-positions';
import {
  applyTableBorderDialogDecisions,
  applyTableBorderDialogPreset,
  isTableBorderDialogPresetAvailable,
  setTableBorderDialogPositions,
  tableBorderDialogDecisions,
  toggleTableBorderDialogPosition,
} from '../table-border-dialog-draft';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { TableBorderSegment, TableTextMeasurer } from '../table-layout-types';
import type { PersistedTableModel, TableColumn, TableRow } from '../../../types/table';
import type { TableBorderSpec } from '../../../types/table-edges';
import type { TableCellRangeBounds } from '../table-cell-range';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

const measureText: TableTextMeasurer = (text, heightMm) => text.length * heightMm * 0.6;

const STANDARD: TableStyle = (() => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!style) throw new Error('missing preset: standard');
  return style;
})();

const W = 10;
const H = 6;

/** Το μολύβι του διαλόγου — εμφανώς διαφορετικό από ό,τι λέει το στυλ (`#666666`, 0.25mm). */
const PEN: TableBorderSpec = { visible: true, colorHex: '#ff00ff', widthMm: 0.25 };
/** Δεύτερο μολύβι, για το «άλλαξε στυλ και ξαναπάτησε». */
const OTHER_PEN: TableBorderSpec = { visible: true, colorHex: '#00ff00', widthMm: 0.5 };

const DOWN = tableDiagonalPositionId('down');
const UP = tableDiagonalPositionId('up');

function persisted(rowCount: number, colCount: number): PersistedTableModel {
  const columns: TableColumn[] = Array.from({ length: colCount }, (_, c) => ({
    id: `c${c + 1}`,
    sizing: { kind: 'fixed', widthMm: W },
    valueType: 'text',
    align: 'left',
  }));
  const rows: TableRow[] = Array.from({ length: rowCount }, (_, r) => ({
    id: `r${r + 1}`,
    rowClass: 'data',
    heightMm: H,
  }));
  return { columns, rows, cells: [], merges: [] };
}

function bounds(
  firstRow: number,
  lastRow: number,
  firstCol: number,
  lastCol: number,
): TableCellRangeBounds {
  return { firstRow, lastRow, firstCol, lastCol };
}

/** Τα τμήματα που πράγματι φτάνουν στον ζωγράφο, με το μολύβι που ζήτησε ο χρήστης. */
function segmentsWithPen(model: PersistedTableModel, colorHex: string): TableBorderSegment[] {
  const layout = layoutTable(resolveTableModel(model), STANDARD, measureText);
  return layout.borders.filter((segment) => segment.spec.colorHex === colorHex);
}

// ── 1. Διαθεσιμότητα ────────────────────────────────────────────────────────

describe('ADR-750 Φ6 — τι μπορεί καν να πατηθεί', () => {
  const single = bounds(1, 1, 1, 1);

  it('ΕΝΑ κελί: οι εσωτερικές ΔΕΝ είναι διαθέσιμες — δεν υπάρχει τίποτα ανάμεσα', () => {
    expect(isTableBorderDialogPositionAvailable('insideH', single)).toBe(false);
    expect(isTableBorderDialogPositionAvailable('insideV', single)).toBe(false);
  });

  it('ΕΝΑ κελί: το υπόδειγμα «Εσωτερικά» (Πλέγμα) είναι γκριζαρισμένο', () => {
    expect(isTableBorderDialogPresetAvailable('inside', single)).toBe(false);
  });

  it('ΕΝΑ κελί: περίμετρος, «Κανένα», «Περίγραμμα» και οι δύο διαγώνιοι μένουν ενεργά', () => {
    for (const id of ['top', 'bottom', 'left', 'right', DOWN, UP] as const) {
      expect(isTableBorderDialogPositionAvailable(id, single)).toBe(true);
    }
    expect(isTableBorderDialogPresetAvailable('none', single)).toBe(true);
    expect(isTableBorderDialogPresetAvailable('outline', single)).toBe(true);
  });

  it('1×3: η ΚΑΤΑΚΟΡΥΦΗ εσωτερική υπάρχει, η οριζόντια όχι — «Εσωτερικά» ενεργό', () => {
    const strip = bounds(0, 0, 0, 2);
    expect(isTableBorderDialogPositionAvailable('insideV', strip)).toBe(true);
    expect(isTableBorderDialogPositionAvailable('insideH', strip)).toBe(false);
    expect(isTableBorderDialogPresetAvailable('inside', strip)).toBe(true);
  });

  it('3×3: και οι οκτώ θέσεις είναι διαθέσιμες', () => {
    expect(availableTableBorderDialogPositions(bounds(0, 2, 0, 2))).toEqual(
      TABLE_BORDER_DIALOG_POSITIONS,
    );
  });

  it('το widget έχει ακριβώς 8 θέσεις: 6 πλευρές + 2 διαγώνιοι', () => {
    expect(TABLE_BORDER_DIALOG_POSITIONS).toHaveLength(8);
    expect(new Set(TABLE_BORDER_DIALOG_POSITIONS).size).toBe(8);
  });

  it('μη διαθέσιμη θέση δεν γράφει τίποτα — ούτε μέσω εναλλαγής ούτε μέσω δέσμης', () => {
    const model = persisted(3, 3);
    expect(toggleTableBorderDialogPosition(model, single, 'insideH', PEN)).toBe(model);
    expect(setTableBorderDialogPositions(model, single, ['insideV'], PEN)).toBe(model);
  });
});

// ── 2. Η τρέχουσα κατάσταση ─────────────────────────────────────────────────

describe('ADR-750 Φ6 — οι τρεις καταστάσεις μιας θέσης', () => {
  const all = bounds(0, 2, 0, 2);

  it('καθαρός πίνακας ⇒ κάθε θέση `absent` (ισχύει η κληρονομιά)', () => {
    const model = persisted(3, 3);
    for (const id of TABLE_BORDER_DIALOG_POSITIONS) {
      expect(tableBorderDialogPositionState(model, all, id).kind).toBe('absent');
    }
  });

  it('όλη η πλευρά με το ίδιο μολύβι ⇒ `uniform`, και δίνει ΤΟ μολύβι', () => {
    const model = setTableBorderDialogPositions(persisted(3, 3), all, ['top'], PEN);
    const state = tableBorderDialogPositionState(model, all, 'top');
    expect(state).toEqual({ kind: 'uniform', spec: PEN });
  });

  it('🔴 ΜΕΡΙΚΕΣ ακμές της πλευράς ⇒ `mixed` — το widget δεν επιτρέπεται να πει ψέματα', () => {
    // Πάνω περίγραμμα μόνο στην πρώτη στήλη· η επιλογή όμως πιάνει και τις τρεις.
    const model = setTableBorderDialogPositions(persisted(3, 3), bounds(0, 0, 0, 0), ['top'], PEN);
    expect(tableBorderDialogPositionState(model, all, 'top').kind).toBe('mixed');
  });

  it('ίδιες ακμές αλλά ΔΙΑΦΟΡΕΤΙΚΟ μολύβι ⇒ `mixed`', () => {
    const first = setTableBorderDialogPositions(persisted(3, 3), all, ['left'], PEN);
    const mixed = setTableBorderDialogPositions(first, bounds(0, 0, 0, 2), ['left'], OTHER_PEN);
    expect(tableBorderDialogPositionState(mixed, all, 'left').kind).toBe('mixed');
  });

  it('🔑 ρητό ΑΟΡΑΤΟ μολύβι ⇒ `uniform`, ΟΧΙ `absent` — η Α14 είναι ορατή στο widget', () => {
    const model = setTableBorderDialogPositions(persisted(3, 3), all, ['bottom'], HIDDEN_TABLE_EDGE);
    const state = tableBorderDialogPositionState(model, all, 'bottom');
    expect(state).toEqual({ kind: 'uniform', spec: HIDDEN_TABLE_EDGE });
  });

  it('🔴 διαγώνιος σε ΜΕΡΙΚΑ κελιά ⇒ `mixed` — τα κελιά που λείπουν από τον αραιό χάρτη μετρούν', () => {
    const model = setTableBorderDialogPositions(persisted(3, 3), bounds(0, 0, 0, 0), [DOWN], PEN);
    expect(tableBorderDialogPositionState(model, all, DOWN).kind).toBe('mixed');
    expect(tableBorderDialogPositionState(model, bounds(0, 0, 0, 0), DOWN)).toEqual({
      kind: 'uniform',
      spec: PEN,
    });
  });

  it('το στιγμιότυπο δίνει διαθεσιμότητα + κατάσταση για κάθε θέση με ένα πέρασμα', () => {
    const model = setTableBorderDialogPositions(persisted(1, 1), bounds(0, 0, 0, 0), ['top'], PEN);
    const snapshot = tableBorderDialogSnapshot(model, bounds(0, 0, 0, 0));
    expect(snapshot.size).toBe(8);
    expect(snapshot.get('top')).toEqual({ available: true, state: { kind: 'uniform', spec: PEN } });
    expect(snapshot.get('insideH')).toEqual({ available: false, state: { kind: 'absent' } });
  });
});

// ── 3. Εναλλαγή — και οι τρεις δρόμοι ───────────────────────────────────────

describe('ADR-750 Φ6 — η εναλλαγή θέσης', () => {
  const all = bounds(0, 2, 0, 2);

  it('`absent` → βάζει το τρέχον μολύβι', () => {
    const model = toggleTableBorderDialogPosition(persisted(3, 3), all, 'top', PEN);
    expect(tableBorderDialogPositionState(model, all, 'top')).toEqual({
      kind: 'uniform',
      spec: PEN,
    });
  });

  it('`uniform` με ΤΟ ΙΔΙΟ μολύβι → σβήνει, και σβήνει με ΔΙΑΓΡΑΦΗ (επιστροφή στην κληρονομιά)', () => {
    const on = toggleTableBorderDialogPosition(persisted(3, 3), all, 'top', PEN);
    const off = toggleTableBorderDialogPosition(on, all, 'top', PEN);
    expect(tableBorderDialogPositionState(off, all, 'top').kind).toBe('absent');
    // Διαγραφή και όχι αόρατο μολύβι: δεν έμεινε ΚΑΜΙΑ ρητή ακμή πίσω.
    expect(off.edges).toBeUndefined();
  });

  it('`uniform` με ΑΛΛΟ μολύβι → αντικαθιστά με μία κίνηση, δεν σβήνει πρώτα', () => {
    const on = toggleTableBorderDialogPosition(persisted(3, 3), all, 'top', PEN);
    const changed = toggleTableBorderDialogPosition(on, all, 'top', OTHER_PEN);
    expect(tableBorderDialogPositionState(changed, all, 'top')).toEqual({
      kind: 'uniform',
      spec: OTHER_PEN,
    });
  });

  it('`mixed` → ομογενοποιεί στο τρέχον μολύβι', () => {
    const partial = setTableBorderDialogPositions(
      persisted(3, 3),
      bounds(0, 0, 0, 0),
      ['top'],
      OTHER_PEN,
    );
    expect(tableBorderDialogPositionState(partial, all, 'top').kind).toBe('mixed');
    const homogenised = toggleTableBorderDialogPosition(partial, all, 'top', PEN);
    expect(tableBorderDialogPositionState(homogenised, all, 'top')).toEqual({
      kind: 'uniform',
      spec: PEN,
    });
  });

  it('το «Καμία» του listbox γράφει ΡΗΤΟ αόρατο — δεύτερο πάτημα το επαναφέρει στην κληρονομιά', () => {
    const hidden = toggleTableBorderDialogPosition(persisted(3, 3), all, 'top', HIDDEN_TABLE_EDGE);
    expect(tableBorderDialogPositionState(hidden, all, 'top')).toEqual({
      kind: 'uniform',
      spec: HIDDEN_TABLE_EDGE,
    });
    const cleared = toggleTableBorderDialogPosition(hidden, all, 'top', HIDDEN_TABLE_EDGE);
    expect(tableBorderDialogPositionState(cleared, all, 'top').kind).toBe('absent');
  });
});

// ── 4. Τα τρία υποδείγματα ──────────────────────────────────────────────────

describe('ADR-750 Φ6 — τα υποδείγματα', () => {
  const all = bounds(0, 2, 0, 2);

  it('«Περίγραμμα» γράφει ΜΟΝΟ την περίμετρο — οι εσωτερικές μένουν ανέγγιχτες (Α10)', () => {
    const model = applyTableBorderDialogPreset(persisted(3, 3), all, 'outline', PEN);
    for (const id of ['top', 'bottom', 'left', 'right'] as const) {
      expect(tableBorderDialogPositionState(model, all, id)).toEqual({ kind: 'uniform', spec: PEN });
    }
    expect(tableBorderDialogPositionState(model, all, 'insideH').kind).toBe('absent');
    expect(tableBorderDialogPositionState(model, all, 'insideV').kind).toBe('absent');
  });

  it('«Εσωτερικά» γράφει ΜΟΝΟ τις εσωτερικές', () => {
    const model = applyTableBorderDialogPreset(persisted(3, 3), all, 'inside', PEN);
    expect(tableBorderDialogPositionState(model, all, 'insideH')).toEqual({
      kind: 'uniform',
      spec: PEN,
    });
    expect(tableBorderDialogPositionState(model, all, 'top').kind).toBe('absent');
  });

  it('«Εσωτερικά» σε ΕΝΑ κελί δεν γράφει τίποτα — by-reference', () => {
    const model = persisted(3, 3);
    expect(applyTableBorderDialogPreset(model, bounds(1, 1, 1, 1), 'inside', PEN)).toBe(model);
  });

  it('«Κανένα» σβήνει ΤΑ ΠΑΝΤΑ, μαζί με τις διαγωνίους', () => {
    const drawn = applyTableBorderDialogPreset(persisted(3, 3), all, 'outline', PEN);
    const withDiagonals = setTableBorderDialogPositions(drawn, all, [DOWN, UP], PEN);
    const cleared = applyTableBorderDialogPreset(withDiagonals, all, 'none', PEN);

    for (const id of TABLE_BORDER_DIALOG_POSITIONS) {
      const state = tableBorderDialogPositionState(cleared, all, id);
      const erased = state.kind === 'absent' || (state.kind === 'uniform' && !state.spec.visible);
      expect(erased).toBe(true);
    }
  });

  it('🔑 «Κανένα» στις ΑΚΜΕΣ γράφει ρητό αόρατο (Α14) — αλλιώς θα ξαναζωντάνευε το πλέγμα του στυλ', () => {
    const cleared = applyTableBorderDialogPreset(persisted(3, 3), all, 'none', PEN);
    expect(tableBorderDialogPositionState(cleared, all, 'insideH')).toEqual({
      kind: 'uniform',
      spec: HIDDEN_TABLE_EDGE,
    });
    // 🔴 Στην οθόνη, **μετρημένα**: ένας καθαρός 3×3 με το `standard` ζωγραφίζει πλήρες
    // πλέγμα· μετά το «Κανένα» δεν μένει ΟΥΤΕ ΜΙΑ γραμμή. Ο έλεγχος είναι **πλήθος** και όχι
    // «όσες έμειναν είναι ορατές»: το `buildTableBorders` πετά τα αόρατα τμήματα (γραμμή 168),
    // οπότε το δεύτερο θα ήταν αληθές και για διαγραφή — δηλαδή πράσινο χωρίς να ελέγχει τίποτα.
    const before = layoutTable(resolveTableModel(persisted(3, 3)), STANDARD, measureText);
    const after = layoutTable(resolveTableModel(cleared), STANDARD, measureText);
    expect(before.borders.length).toBeGreaterThan(0);
    expect(after.borders).toHaveLength(0);
  });

  it('οι ΔΙΑΓΩΝΙΟΙ του «Κανένα» διαγράφονται — το μοντέλο δεν έχει τρίτη κατάσταση για αυτές', () => {
    const withDiagonals = setTableBorderDialogPositions(persisted(2, 2), all, [DOWN], PEN);
    const cleared = applyTableBorderDialogPreset(withDiagonals, all, 'none', PEN);
    expect(cleared.cells.every(([, , cell]) => cell.diagonal === undefined)).toBe(true);
  });
});

// ── 5. Διαγώνιοι — δύο ΑΝΕΞΑΡΤΗΤΕΣ θέσεις ───────────────────────────────────

describe('ADR-750 Φ6 — οι δύο διαγώνιοι', () => {
  const all = bounds(0, 1, 0, 1);

  it('🔴 το άναμμα της ↗ ΔΕΝ σβήνει τη ↘ που ήδη υπάρχει', () => {
    const down = setTableBorderDialogPositions(persisted(2, 2), all, [DOWN], PEN);
    const both = setTableBorderDialogPositions(down, all, [UP], OTHER_PEN);

    expect(tableBorderDialogPositionState(both, all, DOWN)).toEqual({ kind: 'uniform', spec: PEN });
    expect(tableBorderDialogPositionState(both, all, UP)).toEqual({
      kind: 'uniform',
      spec: OTHER_PEN,
    });
  });

  it('η εναλλαγή της ↘ αφήνει την ↗ ακέραιη', () => {
    const both = setTableBorderDialogPositions(persisted(2, 2), all, [DOWN, UP], PEN);
    const off = toggleTableBorderDialogPosition(both, all, DOWN, PEN);
    expect(tableBorderDialogPositionState(off, all, DOWN).kind).toBe('absent');
    expect(tableBorderDialogPositionState(off, all, UP)).toEqual({ kind: 'uniform', spec: PEN });
  });

  it('όταν φύγει και η τελευταία, το πεδίο `diagonal` ΑΦΑΙΡΕΙΤΑΙ (όχι `{}`)', () => {
    const both = setTableBorderDialogPositions(persisted(2, 2), all, [DOWN, UP], PEN);
    const none = setTableBorderDialogPositions(both, all, [DOWN, UP], null);
    expect(none.cells.every(([, , cell]) => !('diagonal' in cell))).toBe(true);
  });
});

// ── 6. Το τελικό μοντέλο + οι εγγυήσεις ─────────────────────────────────────

describe('ADR-750 Φ6 — από αποφάσεις σε μοντέλο', () => {
  const all = bounds(0, 2, 0, 2);

  it('εφαρμόζει τις αποφάσεις με τη σειρά — η τελευταία για την ίδια θέση νικά', () => {
    const model = applyTableBorderDialogDecisions(persisted(3, 3), all, [
      { position: 'top', spec: PEN },
      { position: 'insideV', spec: PEN },
      { position: 'top', spec: OTHER_PEN },
    ]);
    expect(tableBorderDialogPositionState(model, all, 'top')).toEqual({
      kind: 'uniform',
      spec: OTHER_PEN,
    });
    expect(tableBorderDialogPositionState(model, all, 'insideV')).toEqual({
      kind: 'uniform',
      spec: PEN,
    });
  });

  it('`null` σε απόφαση ⇒ επιστροφή στην κληρονομιά', () => {
    const drawn = applyTableBorderDialogDecisions(persisted(3, 3), all, [
      { position: 'left', spec: PEN },
    ]);
    const reset = applyTableBorderDialogDecisions(drawn, all, [{ position: 'left', spec: null }]);
    expect(reset.edges).toBeUndefined();
  });

  it('🔴 by-reference: καμία αλλαγή ⇒ ΤΟ ΙΔΙΟ αντικείμενο (καμία ακύρωση μνήμης, κανένα undo)', () => {
    const model = persisted(3, 3);
    expect(applyTableBorderDialogDecisions(model, all, [])).toBe(model);
    expect(applyTableBorderDialogDecisions(model, all, [{ position: 'top', spec: null }])).toBe(
      model,
    );

    const drawn = applyTableBorderDialogDecisions(model, all, [{ position: 'top', spec: PEN }]);
    expect(applyTableBorderDialogDecisions(drawn, all, [{ position: 'top', spec: PEN }])).toBe(
      drawn,
    );
  });

  it('🔴 by-reference και για τις διαγωνίους: ίδια διαγώνιος δεύτερη φορά ⇒ κανένα βήμα undo', () => {
    const drawn = setTableBorderDialogPositions(persisted(2, 2), bounds(0, 1, 0, 1), [DOWN], PEN);
    expect(
      setTableBorderDialogPositions(drawn, bounds(0, 1, 0, 1), [DOWN], PEN),
    ).toBe(drawn);
  });

  it('η ανάγνωση αποφάσεων είναι αντίστροφη της εγγραφής — και παραλείπει τις `mixed`', () => {
    const drawn = setTableBorderDialogPositions(persisted(3, 3), all, ['top', 'insideV'], PEN);
    const partial = setTableBorderDialogPositions(drawn, bounds(0, 0, 0, 0), ['left'], OTHER_PEN);

    const decisions = tableBorderDialogDecisions(partial, all);
    expect(decisions.find((d) => d.position === 'top')?.spec).toEqual(PEN);
    expect(decisions.find((d) => d.position === 'insideV')?.spec).toEqual(PEN);
    expect(decisions.find((d) => d.position === 'bottom')?.spec).toBeNull();
    // Η `left` είναι μεικτή: καμία μοναδική απόφαση δεν την περιγράφει.
    expect(decisions.find((d) => d.position === 'left')).toBeUndefined();
  });

  it('οι αποφάσεις που διαβάστηκαν αναπαράγουν το ίδιο μοντέλο πάνω σε καθαρό πίνακα', () => {
    const drawn = setTableBorderDialogPositions(persisted(3, 3), all, ['top', 'insideV'], PEN);
    const replayed = applyTableBorderDialogDecisions(
      persisted(3, 3),
      all,
      tableBorderDialogDecisions(drawn, all),
    );
    expect(replayed.edges).toEqual(drawn.edges);
  });
});

// ── 7. Στην οθόνη ───────────────────────────────────────────────────────────

describe('ADR-750 Φ6 — ό,τι γράφεται, φαίνεται', () => {
  const all = bounds(0, 2, 0, 2);

  it('το «Περίγραμμα» φτάνει στον ζωγράφο ως τέσσερις πλευρές με το μολύβι του διαλόγου', () => {
    const model = applyTableBorderDialogPreset(persisted(3, 3), all, 'outline', PEN);
    const segments = segmentsWithPen(model, PEN.colorHex);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((segment) => segment.spec.widthMm === PEN.widthMm)).toBe(true);
  });

  it('η διαγώνιος του διαλόγου φτάνει στη διάταξη του κελιού', () => {
    const model = setTableBorderDialogPositions(persisted(2, 2), bounds(0, 1, 0, 1), [DOWN], PEN);
    const layout = layoutTable(resolveTableModel(model), STANDARD, measureText);
    const diagonals = layout.cells.filter((cell) => cell.diagonals !== undefined);
    expect(diagonals.length).toBe(4);
  });
});
