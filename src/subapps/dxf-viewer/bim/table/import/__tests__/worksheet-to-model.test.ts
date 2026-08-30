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
  MAX_TABLE_COLUMN_COUNT,
  MAX_TABLE_DATA_ROW_COUNT,
  TABLE_FIXED_ROW_COUNT,
} from '../../build-table-entity';
import { resolveTableModel, cellKey } from '../../table-model-helpers';
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
  it('φύλλο πάνω από το όριο γραμμών: κόβεται ΚΑΙ το λέει με αριθμό', () => {
    const total = TABLE_FIXED_ROW_COUNT + MAX_TABLE_DATA_ROW_COUNT;
    const grid = Array.from({ length: total + 37 }, (_, r) => [`r${r}`]);
    const result = worksheetGridToModel(grid);
    expect(result.offeredRows).toBe(total + 37);
    expect(result.droppedRows).toBe(37);
    expect(resolveTableModel(result.model).rows).toHaveLength(total);
  });

  it('φύλλο πάνω από το όριο στηλών: κόβεται ΚΑΙ το λέει με αριθμό', () => {
    const grid = [Array.from({ length: MAX_TABLE_COLUMN_COUNT + 5 }, (_, c) => `c${c}`)];
    const result = worksheetGridToModel(grid);
    expect(result.offeredColumns).toBe(MAX_TABLE_COLUMN_COUNT + 5);
    expect(result.droppedColumns).toBe(5);
  });

  it('κενό φύλλο ⇒ κενός πίνακας, ΟΧΙ σφάλμα', () => {
    const result = worksheetGridToModel([]);
    expect(result.offeredRows).toBe(0);
    expect(result.droppedRows).toBe(0);
    expect(resolveTableModel(result.model).rows.length).toBeGreaterThanOrEqual(TABLE_FIXED_ROW_COUNT);
  });
});
