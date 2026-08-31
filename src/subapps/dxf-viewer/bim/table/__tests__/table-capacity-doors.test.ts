/**
 * 🔴 ADR-833 Φάση 5Β — **ΟΙ ΕΞΙ ΠΟΡΤΕΣ, ΚΑΘΕ ΜΙΑ ΦΥΛΑΓΜΕΝΗ.**
 *
 * Η ερώτηση που φυλάει αυτή η σουίτα δεν είναι «σωστό είναι το όριο;» — εκείνη την απαντά το
 * `table-capacity.test.ts`. Είναι η **άλλη μισή** της φάσης, και είναι εκείνη που έλειπε
 * ολόκληρη: *«**ΤΗ ΡΩΤΑ ΚΑΝΕΙΣ**;»*
 *
 * Το grep της 31/08 μέτρησε **μηδέν** καταναλωτές του οργάνου κόστους στην παραγωγή: μετρούσε
 * σωστά και δεν σταματούσε τίποτα. Άρα ένα σωστό όριο **δεν αρκεί** — κάθε δρόμος από τον
 * οποίο μεγαλώνει το έγγραφο πρέπει να το ρωτά, και **αυτή** είναι η ιδιότητα που, αν σπάσει,
 * επιστρέφει σιωπηλά στην κατάσταση «όργανο σε συρτάρι».
 *
 * ```
 *   πόρτα                                    πριν τη Φ5Β        μετά
 *   1  δημιουργία από την κορδέλα            ✅ ανά διάσταση     ✅ ΓΙΝΟΜΕΝΟ
 *   2  εισαγωγή γραμμής/στήλης               ✅ ανά διάσταση     ✅ ΓΙΝΟΜΕΝΟ
 *   3  επικόλληση TSV                        ✅ έμμεσα           ✅ + μήκος κειμένου
 *   4  εισαγωγή .xlsx ανά φύλλο              ✅ ανά διάσταση     ✅ ΓΙΝΟΜΕΝΟ
 *   5  προσθήκη ΦΥΛΛΩΝ                       ❌ ΚΑΜΙΑ            ✅ μερίδιο εγγράφου
 *   6  μήκος κειμένου κελιού                 ❌ ΚΑΜΙΑ            ✅ ράγα OOXML
 * ```
 *
 * ⚠️ Οι πόρτες 2 και 4 έχουν τις δικές τους σουίτες (`table-row-column-ops`,
 * `worksheet-to-model`) και **δεν** ξαναγράφονται εδώ: αυτή η σουίτα καρφώνει τις τέσσερις
 * που άλλαξαν ιδιοκτήτη ή δεν φυλάσσονταν καθόλου.
 */

import { buildTableModel, TABLE_FIXED_ROW_COUNT } from '../build-table-entity';
import { MAX_TABLE_GRID_CELLS, fitsTableGrid } from '../table-capacity';
import { MAX_TABLE_CELL_CHARACTERS } from '../table-ooxml-limits';
import { writeCellInput } from '../formula/table-formula-engine';
import { pasteTsvIntoTable } from '../table-range-clipboard';
import { getPersistedCellText } from '../table-model-helpers';
import {
  buildWorksheets,
  newWorksheetModel,
  planWorksheetAdd,
  planWorksheetsAppend,
  planWorksheetsReplace,
} from '../table-worksheet-ops';
import { resolveWorksheets } from '../table-worksheet-resolve';
import { sanitizeMenuSize } from '../../../ui/ribbon/components/table/table-size-menu-model';
import { makeTableEntity, tableWorksheetsFields } from './make-table-entity';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import type { TableEntity } from '../../../types/table-entity';
import type { PersistedTableModel, TableCell, TableCellStyleOverride } from '../../../types/table';
import { bookOf } from './formula-book-fixture';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

const TYPICAL_FORMAT: TableCellStyleOverride = {
  numberFormat: { kind: 'decimal', decimals: 2, grouping: true },
  textHeightMm: 3.88,
  textColorHex: '#1E293B',
  bold: true,
  align: 'MR',
};

/** Μοντέλο με `cellCount` **γραμμένα**, μορφοποιημένα ελληνικά κελιά — βαρύ, όπως στην πράξη. */
function heavyModel(cellCount: number): PersistedTableModel {
  const values = ['Δοκός Δ1', 'Κ12', '4Ø20'];
  return toPersistedTableModel(createTableModel({
    columns: Array.from({ length: cellCount }, (_, i) => ({
      id: `c${i}`,
      sizing: { kind: 'fixed' as const, widthMm: 40 },
      valueType: 'text' as const,
      align: 'left' as const,
    })),
    rows: [{ id: 'r0', rowClass: 'data' as const }],
    cells: Array.from({ length: cellCount }, (_, i) => [
      'r0',
      `c${i}`,
      { kind: 'text', value: values[i % values.length], styleOverride: TYPICAL_FORMAT } as TableCell,
    ] as const),
    merges: [],
  }));
}

/** Πίνακας με `count` **βαριά** φύλλα — το βιβλίο που γεμίζει το μερίδιο. */
function heavyBook(count: number, cellsPerSheet = 30_000): TableEntity {
  const models = Array.from({ length: count }, () => heavyModel(cellsPerSheet));
  return { ...makeTableEntity(), ...tableWorksheetsFields(models, 0) };
}

/** Πίνακας με ένα μικρό φύλλο — άφθονο μερίδιο. */
function lightBook(): TableEntity {
  return { ...makeTableEntity(), ...tableWorksheetsFields([buildTableModel({})], 0) };
}

// ──────────────────────────────────────────────────────────────────────────────
// ΠΟΡΤΑ 1 — δημιουργία: το παράνομο ΔΕΝ ΠΡΟΣΦΕΡΕΤΑΙ (σχολή Excel)
// ──────────────────────────────────────────────────────────────────────────────

describe('ΠΟΡΤΑ 1 — δημιουργία: ο πίνακας που γεννιέται ΧΩΡΑΕΙ', () => {
  it('🔴 το εργοστάσιο δεν παράγει ΠΟΤΕ πλέγμα πάνω από το όριο, όσο κι αν του ζητηθεί', () => {
    for (const [columnCount, dataRowCount] of [[500_000, 999_999], [1, 10_000_000], [40_000, 0]]) {
      const model = buildTableModel({ columnCount, dataRowCount });
      expect(fitsTableGrid(model.rows.length, model.columns.length)).toBe(true);
    }
  }, 20_000);

  it('🔴 …και η ΚΟΡΔΕΛΑ δείχνει ΤΟ ΙΔΙΟ — UI που λέει άλλα από όσα κάνει είναι ψέμα', () => {
    // Οι δύο καθαριστές του μεγέθους βλέπουν **έναν άξονα ο καθένας**, άρα κανένας τους δεν
    // μπορεί να απαντήσει «χωρά το πλέγμα;». Χωρίς το γινόμενο και στο μενού, ο χρήστης θα
    // διάβαζε «10.000 × 10.000» και θα έπαιρνε άλλον πίνακα.
    const shown = sanitizeMenuSize({ columnCount: 10_000, totalRowCount: 10_000 });
    expect(fitsTableGrid(shown.totalRowCount, shown.columnCount)).toBe(true);

    const built = buildTableModel({
      columnCount: shown.columnCount,
      dataRowCount: shown.totalRowCount - TABLE_FIXED_ROW_COUNT,
    });
    expect(built.columns).toHaveLength(shown.columnCount);
    expect(built.rows).toHaveLength(shown.totalRowCount);
  }, 20_000);

  it('🔴 η κορδέλα ΔΕΝ πέφτει ποτέ κάτω από τις δύο σταθερές γραμμές, όσο φαρδύ κι αν ζητηθεί', () => {
    // Με πάρα πολλές στήλες, το γινόμενο σπρώχνει τις γραμμές προς τα κάτω — αλλά ο πίνακας
    // **δεν είναι εκφράσιμος** με λιγότερες από τίτλο + κεφαλίδα. Χωρίς το δάπεδο, το μενού
    // θα εμφάνιζε «×1» ή «×0» για πίνακα που γεννιέται με δύο γραμμές.
    expect(sanitizeMenuSize({ columnCount: 40_000, totalRowCount: 1 }).totalRowCount)
      .toBeGreaterThanOrEqual(TABLE_FIXED_ROW_COUNT);
  });

  it('συνηθισμένα μεγέθη περνούν ανέγγιχτα — το φράγμα δεν ενοχλεί κανέναν πραγματικό πίνακα', () => {
    expect(sanitizeMenuSize({ columnCount: 8, totalRowCount: 25 })).toEqual({
      columnCount: 8,
      totalRowCount: 25,
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ΠΟΡΤΑ 6 — το μήκος κειμένου κελιού: η ΜΙΑ διακλάδωση από την οποία περνούν όλοι
// ──────────────────────────────────────────────────────────────────────────────

describe('ΠΟΡΤΑ 6 — μήκος κειμένου: η ράγα ζει στη ΜΙΑ διακλάδωση', () => {
  const model = buildTableModel({ columnCount: 2, dataRowCount: 1 });
  const rowId = model.rows[2].id;
  const colId = model.columns[0].id;

  it('🔴 κείμενο πάνω από τη ράγα ΚΟΒΕΤΑΙ — αλλιώς παράγουμε `.xlsx` που το Excel δεν δέχεται', () => {
    const written = writeCellInput(bookOf(model),model, rowId, colId, 'x'.repeat(40_000));
    expect(getPersistedCellText(written.model, rowId, colId)).toHaveLength(MAX_TABLE_CELL_CHARACTERS);
  });

  it('κείμενο που χωρά περνά αυτούσιο — η ράγα δεν αγγίζει τη συνηθισμένη χρήση', () => {
    const written = writeCellInput(bookOf(model),model, rowId, colId, 'Δοκός Δ1');
    expect(getPersistedCellText(written.model, rowId, colId)).toBe('Δοκός Δ1');
  });

  it('🔑 η φραγή ΔΕΝ σπάει την ταυτότητα by-reference: ίδιο κείμενο ⇒ ίδιο μοντέλο', () => {
    // Η τέταρτη εγγύηση του γραφέα (ADR-739 Φ.Δ) τρέχει σε **κάθε** δέσμευση κελιού. Αν το
    // κόψιμο γεννούσε νέο string κάθε φορά, κάθε `Enter` σε αμετάβλητο κελί θα παρήγαγε βήμα
    // undo για το τίποτα.
    const first = writeCellInput(bookOf(model),model, rowId, colId, 'Κ12').model;
    expect(writeCellInput(bookOf(first),first, rowId, colId, 'Κ12').model).toBe(first);
  });

  it('🔴 και ο ΤΥΠΟΣ κόβεται κι αυτός — γράφεται κι εκείνος στο `.xlsx`', () => {
    const longFormula = `=SUM(${'A1,'.repeat(20_000)}A2)`;
    const written = writeCellInput(bookOf(model),model, rowId, colId, longFormula);
    // Ό,τι κι αν έγινε με την ανάλυση, τίποτα πάνω από τη ράγα δεν αποθηκεύτηκε.
    const stored = written.model.cells.find(([r, c]) => r === rowId && c === colId);
    expect(JSON.stringify(stored).length).toBeLessThan(longFormula.length);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ΠΟΡΤΑ 3 — επικόλληση: ό,τι κόπηκε ΛΕΓΕΤΑΙ, και ξεχωριστά ανά αιτία
// ──────────────────────────────────────────────────────────────────────────────

describe('ΠΟΡΤΑ 3 — επικόλληση: τρεις αιτίες απώλειας, τρεις αριθμοί', () => {
  const model = buildTableModel({ columnCount: 3, dataRowCount: 3 });
  const anchor = { rowId: model.rows[2].id, colId: model.columns[0].id };

  it('🔴 κελί με μακρύ κείμενο ΜΕΤΡΙΕΤΑΙ ξεχωριστά — δεν κρύβεται πίσω από τις γραμμές', () => {
    const result = pasteTsvIntoTable(bookOf(model),model, anchor, [['x'.repeat(40_000)], ['κοντό']]);
    expect(result.clippedTextCells).toBe(1);
    // …και δεν είναι «κόπηκε γραμμή»: όλες οι γραμμές χώρεσαν.
    expect(result.fittedRows).toBe(2);
    expect(result.offeredRows).toBe(2);
  });

  it('μπαγιάτικο ενεργό κελί ⇒ ΟΛΑ μηδέν, και το κόψιμο κειμένου μαζί — ποτέ σιωπηλή επιτυχία', () => {
    const stale = pasteTsvIntoTable(bookOf(model),model, { rowId: 'rΦΑΝΤΑΣΜΑ', colId: 'cΦΑΝΤΑΣΜΑ' }, [['α']]);
    expect(stale.fittedRows).toBe(0);
    expect(stale.clippedTextCells).toBe(0);
  });

  it('επικόλληση που χωρά ολόκληρη δεν αναφέρει κόψιμο κειμένου', () => {
    const result = pasteTsvIntoTable(bookOf(model),model, anchor, [['α', 'β'], ['γ', 'δ']]);
    expect(result.clippedTextCells).toBe(0);
  });

  it('🔑 …και το κομμένο κελί ΜΠΗΚΕ — κόψιμο, όχι άρνηση ολόκληρης της επικόλλησης', () => {
    const result = pasteTsvIntoTable(bookOf(model),model, anchor, [['x'.repeat(40_000)]]);
    expect(getPersistedCellText(result.model, anchor.rowId, anchor.colId)).toHaveLength(
      MAX_TABLE_CELL_CHARACTERS,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ΠΟΡΤΑ 5 — 🔴 Η ΜΕΓΑΛΗ ΤΡΥΠΑ: το άθροισμα των φύλλων
// ──────────────────────────────────────────────────────────────────────────────

describe('ΠΟΡΤΑ 5 — προσθήκη φύλλων: κάποιος ρωτά επιτέλους το ΑΘΡΟΙΣΜΑ', () => {
  it('σε πίνακα με άφθονο μερίδιο, η προσθήκη δουλεύει όπως πάντα', () => {
    const plan = planWorksheetAdd(lightBook(), newWorksheetModel(lightBook()));
    expect(plan?.worksheets).toHaveLength(2);
  });

  it('🔴 σε γεμάτο πίνακα η προσθήκη ΑΡΝΕΙΤΑΙ — «όλα ή τίποτα», δεν υπάρχει μισό φύλλο', () => {
    expect(planWorksheetAdd(heavyBook(6), buildTableModel({}))).toBeNull();
  }, 60_000);

  it('🔴 η ΠΟΛΥΦΥΛΛΙΚΗ εισαγωγή ΚΟΒΕΙ και το ΛΕΕΙ με αριθμό — εδώ υπάρχει δουλειά να σωθεί', () => {
    // Η ασυμμετρία με την προσθήκη είναι σκόπιμη (ADR-833 §5.8.3): μια ολική άρνηση θα
    // πετούσε ολόκληρο το βιβλίο του χρήστη επειδή δεν χώρεσε το τελευταίο φύλλο.
    const drafts = Array.from({ length: 8 }, () => ({ model: heavyModel(30_000) }));
    const plan = planWorksheetsAppend(lightBook(), drafts);
    expect(plan?.droppedWorksheets).toBeGreaterThan(0);
    expect(plan?.worksheets.length).toBeLessThan(1 + drafts.length);
  }, 60_000);

  it('🔴 …και η ΑΝΤΙΚΑΤΑΣΤΑΣΗ ρωτά το ΙΔΙΟ: δεν είναι άλλη ερώτηση, είναι η ίδια σε άδειο βιβλίο', () => {
    const drafts = Array.from({ length: 8 }, () => ({ model: heavyModel(30_000) }));
    const plan = planWorksheetsReplace(lightBook(), drafts);
    expect(plan?.droppedWorksheets).toBeGreaterThan(0);
  }, 60_000);

  it('🔑 τα ΥΠΑΡΧΟΝΤΑ φύλλα δεν κόβονται ποτέ — η εισαγωγή δεν καταστρέφει ό,τι βρήκε', () => {
    const entity = heavyBook(5);
    const existing = resolveWorksheets(entity);
    const plan = planWorksheetsAppend(entity, [{ model: heavyModel(30_000) }]);
    expect(plan?.worksheets.slice(0, existing.length)).toEqual(existing);
  }, 60_000);

  it('🔴 όταν ΚΑΝΕΝΑ εισαγόμενο φύλλο δεν χωρά, το ενεργό ΔΕΝ δείχνει σε φύλλο που δεν μπήκε', () => {
    // Χωρίς αυτό, το σχέδιο έγραφε `activeWorksheetId` μιας ταυτότητας που **δεν υπάρχει**
    // στον πίνακα φύλλων — και το `activeWorksheet()` πέφτει **σιωπηλά** στο πρώτο φύλλο,
    // δηλαδή ο χρήστης θα έβλεπε λάθος φύλλο χωρίς κανένα σημάδι (ADR-833 §5.4).
    const entity = heavyBook(6);
    const plan = planWorksheetsAppend(entity, [{ model: heavyModel(30_000) }]);
    if (plan?.activeWorksheetId !== undefined) {
      expect(plan.worksheets.some((sheet) => sheet.id === plan.activeWorksheetId)).toBe(true);
    }
    expect(plan?.droppedWorksheets).toBe(1);
  }, 90_000);

  it('🔴 ΑΝΤΙΚΑΤΑΣΤΑΣΗ με φύλλο που δεν χωρά: ΛΕΕΙ τον αριθμό αντί να αποτύχει σιωπηλά', () => {
    // Το ελάττωμα που βρήκε η μετάλλαξη M42: το `null` σήμαινε ταυτόχρονα «καμία εντολή»
    // **και** «κανένα μήνυμα», οπότε το πάτημα «Αντικατάσταση περιεχομένου» δεν έκανε
    // απολύτως τίποτα — χωρίς εξήγηση.
    const huge = { model: heavyModel(80_000) };
    const plan = planWorksheetsReplace(lightBook(), [huge]);
    expect(plan?.droppedWorksheets).toBe(1);
    // …και τα υπάρχοντα φύλλα μένουν εκεί που ήταν: τίποτα δεν καταστράφηκε.
    expect(plan?.worksheets).toEqual(resolveWorksheets(lightBook()));
  }, 120_000);

  it('βιβλίο που χωρά μπαίνει ΟΛΟΚΛΗΡΟ, με μηδενικό κόψιμο', () => {
    const drafts = Array.from({ length: 3 }, () => ({ model: buildTableModel({}) }));
    expect(planWorksheetsAppend(lightBook(), drafts)?.droppedWorksheets).toBe(0);
    expect(buildWorksheets(drafts)).toHaveLength(3);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Ό,τι υπάρχει ήδη ΔΕΝ σπάει
// ──────────────────────────────────────────────────────────────────────────────

describe('🔑 Ό,τι φτιάχτηκε με τα ΠΑΛΙΑ όρια εξακολουθεί να ανοίγει', () => {
  it('πίνακας 256 × 1000 (νόμιμος πριν τη Φ5Β) δεν προκαλεί ΚΑΜΙΑ εξαίρεση', () => {
    // Όλοι οι φύλακες ρωτούν «επιτρέπεται να **μεγαλώσει**;», ποτέ «είναι νόμιμος;». Ένα
    // όριο που καθιστά αποθηκευμένο έγγραφο μη ανοίξιμο δεν είναι όριο, είναι regression.
    const legacy = toPersistedTableModel(createTableModel({
      columns: Array.from({ length: 256 }, (_, i) => ({
        id: `c${i}`,
        sizing: { kind: 'fixed' as const, widthMm: 40 },
        valueType: 'text' as const,
        align: 'left' as const,
      })),
      rows: Array.from({ length: 1000 }, (_, i) => ({ id: `r${i}`, rowClass: 'data' as const })),
      cells: [['r0', 'c0', { kind: 'text', value: 'ΠΑΛΙΟΣ' } as TableCell]],
      merges: [],
    }));
    expect(legacy.rows.length * legacy.columns.length).toBeGreaterThan(MAX_TABLE_GRID_CELLS);
    expect(getPersistedCellText(legacy, 'r0', 'c0')).toBe('ΠΑΛΙΟΣ');
    // …και μπορεί να δεχτεί **περιεχόμενο**, απλώς όχι νέες γραμμές.
    const written = writeCellInput(bookOf(legacy),legacy, 'r5', 'c5', 'ΝΕΟ');
    expect(getPersistedCellText(written.model, 'r5', 'c5')).toBe('ΝΕΟ');
  });
});
