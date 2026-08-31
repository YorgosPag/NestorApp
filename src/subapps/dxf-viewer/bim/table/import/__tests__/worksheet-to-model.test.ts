/**
 * ADR-833 §1.2 — άγκυρες του κρίκου «πλέγμα φύλλου → μοντέλο πίνακα».
 *
 * Τρία πράγματα πρέπει να είναι **αδύνατο** να σπάσουν σιωπηλά:
 *   1. Η **θεσιακή ταύτιση**: η γραμμή N του φύλλου κάθεται στη γραμμή N του πίνακα.
 *   2. Οι **κενές γραμμές** επιβιώνουν — αλλιώς κάθε επόμενη γραμμή μετακινείται προς τα πάνω.
 *   3. Το **κόψιμο αναφέρεται με αριθμό** — μερική εισαγωγή χωρίς μήνυμα είναι σφάλμα τιμής.
 */

import { worksheetGridToModel } from '../worksheet-to-model';
import {
  TABLE_FIXED_ROW_COUNT,
} from '../../build-table-entity';
import { resolveTableModel, cellKey } from '../../table-model-helpers';
import { MAX_TABLE_GRID_CELLS } from '../../table-capacity';
import { MAX_TABLE_COLUMN_COUNT } from '../../table-ooxml-limits';
import type { PersistedTableModel } from '../../../../types/table';

/** Η τιμή που βλέπει ο χρήστης στο κελί (r, c) — μέσω του ΠΡΑΓΜΑΤΙΚΟΥ αναγνώστη κελιών. */
function cellAt(model: PersistedTableModel, r: number, c: number): unknown {
  const runtime = resolveTableModel(model);
  const row = runtime.rows[r];
  const col = runtime.columns[c];
  if (!row || !col) return undefined;
  return runtime.cells.get(cellKey(row.id, col.id))?.value;
}

describe('worksheetGridToModel — θεσιακή ταύτιση 1:1', () => {
  it('η γραμμή 1 του φύλλου κάθεται στη ΓΡΑΜΜΗ 1 του πίνακα (όχι στη γραμμή δεδομένων)', () => {
    const { model } = worksheetGridToModel([
      ['ΤΙΤΛΟΣ', 'Β1', 'Γ1'],
      ['κεφαλίδα', 'Β2', 'Γ2'],
      ['δεδομένα', 'Β3', 'Γ3'],
    ]);
    // Αν κάποιος «βελτιώσει» την άγκυρα σε «πρώτη γραμμή δεδομένων», αυτό γίνεται undefined.
    expect(cellAt(model, 0, 0)).toBe('ΤΙΤΛΟΣ');
    expect(cellAt(model, 1, 0)).toBe('κεφαλίδα');
    expect(cellAt(model, 2, 0)).toBe('δεδομένα');
    expect(cellAt(model, 0, 2)).toBe('Γ1');
  });

  it('ο πίνακας γεννιέται στις ΑΚΡΙΒΕΙΣ διαστάσεις του φύλλου (τίποτα δεν κόβεται)', () => {
    const grid = Array.from({ length: 40 }, (_, r) =>
      Array.from({ length: 12 }, (_, c) => `r${r}c${c}`),
    );
    const result = worksheetGridToModel(grid);
    const runtime = resolveTableModel(result.model);
    expect(runtime.rows).toHaveLength(40);
    expect(runtime.columns).toHaveLength(12);
    expect(result.droppedRows).toBe(0);
    expect(result.droppedColumns).toBe(0);
    // Η τελευταία γωνία — αν το μέγεθος υπολογίστηκε λάθος, εδώ είναι undefined.
    expect(cellAt(result.model, 39, 11)).toBe('r39c11');
  });

  it('🔴 οι ΚΕΝΕΣ γραμμές επιβιώνουν — δεν συμπτύσσονται (η παγίδα του topo-excel-reader)', () => {
    const { model } = worksheetGridToModel([
      ['πρώτη'],
      [''],
      [''],
      ['τέταρτη'],
    ]);
    // Αν οι κενές πέφτονταν, το «τέταρτη» θα καθόταν στη γραμμή 1.
    expect(cellAt(model, 3, 0)).toBe('τέταρτη');
    expect(cellAt(model, 1, 0)).toBeUndefined();
  });

  it('οδοντωτό πλέγμα: το πλάτος είναι της ΠΛΑΤΥΤΕΡΗΣ γραμμής', () => {
    const result = worksheetGridToModel([['α'], ['β', 'γ', 'δ'], ['ε', 'ζ']]);
    expect(resolveTableModel(result.model).columns).toHaveLength(3);
    expect(cellAt(result.model, 1, 2)).toBe('δ');
  });
});

describe('worksheetGridToModel — τα όρια ΑΝΑΦΕΡΟΝΤΑΙ, δεν σιωπούν', () => {
  // 🔴 ADR-833 Φ5Β — το κόψιμο ρωτά πλέον το **ΠΥΚΝΟ ΓΙΝΟΜΕΝΟ**, όχι δύο άνω όρια ανά άξονα.
  // Τα πλέγματα εδώ είναι **αραιά επίτηδες** (μία γεμάτη γραμμή, οι υπόλοιπες κενές): το
  // ζητούμενο είναι οι **διαστάσεις** που προσφέρονται, και ένα γεμάτο πλέγμα 31.250 κελιών
  // θα έκανε τη σουίτα να τρέχει λεπτά χωρίς να προσθέτει τίποτα στην ερώτηση.
  const COLUMNS = 100;
  const FITTING_ROWS = MAX_TABLE_GRID_CELLS / COLUMNS; // 312,5 → 312 μετά το `Math.floor`

  it('φύλλο πάνω από το ΓΙΝΟΜΕΝΟ: κόβεται σε γραμμές ΚΑΙ το λέει με αριθμό', () => {
    const wide = Array.from({ length: COLUMNS }, (_, c) => `c${c}`);
    const offeredRows = Math.floor(FITTING_ROWS) + 37;
    const grid = [wide, ...Array.from({ length: offeredRows - 1 }, () => [] as string[])];

    const result = worksheetGridToModel(grid);
    expect(result.offeredRows).toBe(offeredRows);
    expect(result.droppedRows).toBe(37);
    // 🔑 Και το κόψιμο έγινε στις **γραμμές**: οι στήλες είναι το σχήμα των δεδομένων και
    // κρατιούνται (ADR-833 §5.8.3).
    expect(result.droppedColumns).toBe(0);
    expect(resolveTableModel(result.model).columns).toHaveLength(COLUMNS);
  });

  it('🔑 …και ο πίνακας που γεννιέται ΧΩΡΑΕΙ όντως στο όριο — όχι «περίπου»', () => {
    const wide = Array.from({ length: COLUMNS }, (_, c) => `c${c}`);
    const grid = [wide, ...Array.from({ length: 5_000 }, () => [] as string[])];
    const model = resolveTableModel(worksheetGridToModel(grid).model);
    expect(model.rows.length * model.columns.length).toBeLessThanOrEqual(MAX_TABLE_GRID_CELLS);
  });

  it('φύλλο πάνω από τη ΡΑΓΑ των στηλών: κόβεται ΚΑΙ το λέει με αριθμό', () => {
    // Οι στήλες κόβονται απέναντι στις **αναπόφευκτες** γραμμές (τίτλος + κεφαλίδα), άρα το
    // ταβάνι τους εδώ είναι το γινόμενο διά δύο — και είναι **κάτω** από τη ράγα του OOXML.
    const ceiling = MAX_TABLE_GRID_CELLS / TABLE_FIXED_ROW_COUNT;
    const row: string[] = [];
    row[0] = 'πρώτη';
    row[ceiling + 4] = 'τελευταία';
    row.length = ceiling + 5;

    const result = worksheetGridToModel([row]);
    expect(result.offeredColumns).toBe(ceiling + 5);
    expect(result.droppedColumns).toBe(5);
    expect(ceiling).toBeLessThan(MAX_TABLE_COLUMN_COUNT);
  });

  it('κενό φύλλο ⇒ κενός πίνακας, ΟΧΙ σφάλμα', () => {
    const result = worksheetGridToModel([]);
    expect(result.offeredRows).toBe(0);
    expect(result.droppedRows).toBe(0);
    expect(resolveTableModel(result.model).rows.length).toBeGreaterThanOrEqual(TABLE_FIXED_ROW_COUNT);
  });
});
