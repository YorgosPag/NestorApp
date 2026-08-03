/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 3) — **τι ζητά το χέρι**: από σημείο πλαισίου σε αίτημα μεταφοράς.
 *
 * Κλειδώνει τις δύο αποφάσεις που ήταν ανοιχτές μπαίνοντας στη φάση:
 *  - η **σχετική θέση σύλληψης διατηρείται** (Excel/Sheets/Figma: το σχήμα μένει κάτω από το
 *    δάχτυλο) — και το `to` παραμένει η **πάνω-αριστερή** γωνία, όπως το απαιτεί η Φάση 2·
 *  - με `Shift` ο άξονας που ολισθαίνει παίρνει θέση από το **σύνορο**, ο άλλος από τη
 *    **σύλληψη**.
 *
 * ⚠️ Καρφώνεται επίσης το **δηλωμένο όριο**: εισαγωγή στο τελευταίο σύνορο δεν εκφράζεται από
 * το λεξιλόγιο της Φάσης 2 (`to` = κελί) ⇒ άρνηση **με λόγο**, ποτέ σιωπηλή διόρθωση σε άλλη
 * θέση από αυτήν που δείχνει η γραμμή-Ι.
 */

import { layoutTable } from '../table-layout';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import { PLAIN_TABLE_RANGE_DRAG } from '../table-range-move-zone';
import { tableRangeDropRequest, type TableRangeGrab } from '../table-range-drop-target';
import type { TableCellRangeBounds } from '../table-cell-range';
import type { TableFramePoint } from '../../../types/table-entity';
import type { TableRangeDragIntent } from '../table-range-move-zone';
import type { TableStyle } from '../table-style';
import type { TableColumn, TableRow } from '../../../types/table';

const STANDARD = BUILTIN_TABLE_STYLES.find(
  (s): s is TableStyle => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD,
);
if (!STANDARD) throw new Error('missing preset: standard');

/** 4 στήλες × 20mm, 4 γραμμές × 10mm ⇒ σύνορα u: 0/20/40/60/80 · v: 0/10/20/30/40. */
const COLUMNS: TableColumn[] = ['c0', 'c1', 'c2', 'c3'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'text',
  align: 'left',
}));
const ROWS: TableRow[] = ['r0', 'r1', 'r2', 'r3'].map((id) => ({
  id,
  rowClass: 'data',
  heightMm: 10,
}));

const MODEL = toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS }));
const LAYOUT = layoutTable(createTableModel({ columns: COLUMNS, rows: ROWS }), STANDARD);

/** Η πηγή: r1..r2 × c1..c2 — περιοχή 2×2 στο κέντρο, ώστε να υπάρχει χώρος προς κάθε πλευρά. */
const SOURCE: TableCellRangeBounds = { firstRow: 1, lastRow: 2, firstCol: 1, lastCol: 2 };

/** Πιάστηκε από την **κάτω-δεξιά** γωνία της πηγής — η δύσκολη περίπτωση για τη μετατόπιση. */
const GRAB_BOTTOM_RIGHT: TableRangeGrab = { dRow: 1, dCol: 1 };
const GRAB_TOP_LEFT: TableRangeGrab = { dRow: 0, dCol: 0 };

const INSERT: TableRangeDragIntent = { copy: false, insert: true };

function ask(
  frame: TableFramePoint,
  grab: TableRangeGrab = GRAB_BOTTOM_RIGHT,
  intent: TableRangeDragIntent = PLAIN_TABLE_RANGE_DRAG,
) {
  return tableRangeDropRequest({ model: MODEL, layout: LAYOUT, frame, source: SOURCE, grab, intent });
}

describe('tableRangeDropRequest — η σχετική θέση σύλληψης διατηρείται', () => {
  it('🔴 πιασμένη από την ΚΑΤΩ-ΔΕΞΙΑ γωνία: το «to» είναι η ΠΑΝΩ-ΑΡΙΣΤΕΡΗ, μετατοπισμένη', () => {
    // Το χέρι στο κέντρο του (r3, c3)· κρατά τη γωνία (r2, c2) της πηγής ⇒ η περιοχή
    // προσγειώνεται με πάνω-αριστερή το (r2, c2). Χωρίς τη μετατόπιση, το σχήμα θα «πηδούσε»
    // κατά ένα ολόκληρο κελί σε κάθε άξονα τη στιγμή που ο χρήστης ζητά ακρίβεια.
    const outcome = ask({ u: 70, v: 35 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.request.to).toEqual({ rowId: 'r2', colId: 'c2' });
    expect(outcome.request.intent).toBe(PLAIN_TABLE_RANGE_DRAG);
  });

  it('πιασμένη από την ΠΑΝΩ-ΑΡΙΣΤΕΡΗ: το «to» είναι το κελί κάτω από το χέρι', () => {
    const outcome = ask({ u: 70, v: 35 }, GRAB_TOP_LEFT);
    expect(outcome.ok && outcome.request.to).toEqual({ rowId: 'r3', colId: 'c3' });
  });

  it('η γωνία που προκύπτει ΕΞΩ από το πλέγμα ⇒ άρνηση, ποτέ ψαλίδισμα στο 0', () => {
    // Χέρι στο (r0, c0) με σύλληψη από την κάτω-δεξιά ⇒ γωνία (-1, -1). Ένα `Math.max(0, …)`
    // εδώ θα προσγείωνε την περιοχή αλλού από εκεί που δείχνει το φάντασμα.
    expect(ask({ u: 10, v: 5 })).toEqual({ ok: false, reason: 'outside-grid' });
  });

  it('χέρι ΕΞΩ από το πλέγμα ⇒ άρνηση (ο πίνακας δεν μεγαλώνει μόνος του)', () => {
    expect(ask({ u: 70, v: -5 })).toEqual({ ok: false, reason: 'outside-grid' });
    expect(ask({ u: 200, v: 15 })).toEqual({ ok: false, reason: 'outside-grid' });
  });
});

describe('tableRangeDropRequest — με «Shift» το σημείο απόθεσης είναι ΣΥΝΟΡΟ', () => {
  it('🔴 οριζόντιο σύνορο ⇒ «down»: η ΓΡΑΜΜΗ από το σύνορο, η ΣΤΗΛΗ από τη σύλληψη', () => {
    // u = 70 ⇒ στήλη 3, μείον dCol = 1 ⇒ c2. v = 12 ⇒ πλησιέστερο σύνορο 10, δηλαδή γραμμή 1.
    const outcome = ask({ u: 70, v: 12 }, GRAB_BOTTOM_RIGHT, INSERT);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.request.shiftAxis).toBe('down');
    expect(outcome.request.to).toEqual({ rowId: 'r1', colId: 'c2' });
  });

  it('κατακόρυφο σύνορο ⇒ «right»: η ΣΤΗΛΗ από το σύνορο, η ΓΡΑΜΜΗ από τη σύλληψη', () => {
    // u = 39 ⇒ πλησιέστερο κατακόρυφο σύνορο 40 (στήλη 2)· v = 35 ⇒ γραμμή 3, μείον 1 ⇒ r2.
    const outcome = ask({ u: 39, v: 35 }, GRAB_BOTTOM_RIGHT, INSERT);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.request.shiftAxis).toBe('right');
    expect(outcome.request.to).toEqual({ rowId: 'r2', colId: 'c2' });
  });

  it('χωρίς «Shift» ο άξονας δεν διαβάζεται ΠΟΤΕ — καμία γραμμή-Ι, καμία κατεύθυνση', () => {
    // Το πεδίο υπάρχει γιατί ο τύπος το απαιτεί· η τιμή του είναι αδιάφορη όταν
    // `intent.insert === false`, και το τεκμηριώνει το ίδιο το `TableRangeTransferRequest`.
    const outcome = ask({ u: 70, v: 35 });
    expect(outcome.ok && outcome.request.intent.insert).toBe(false);
  });

  it('🔴 ΔΗΛΩΜΕΝΟ ΟΡΙΟ: εισαγωγή στο ΤΕΛΕΥΤΑΙΟ σύνορο ⇒ άρνηση με λόγο', () => {
    // v = 38 ⇒ σύνορο 4 = «μετά την τελευταία γραμμή». Το `to` της Φάσης 2 είναι **κελί**,
    // και εκεί δεν υπάρχει κελί. Η εναλλακτική —σιωπηλή διόρθωση σε ένα σύνορο πιο πάνω— θα
    // παρέδιδε άλλη θέση από αυτήν που δείχνει η γραμμή-Ι (§36.10).
    expect(ask({ u: 70, v: 38 }, GRAB_BOTTOM_RIGHT, INSERT)).toEqual({
      ok: false,
      reason: 'outside-grid',
    });
  });
});
