/**
 * Άγκυρες για το `table-capacity` — ADR-833 Φάση 5Β, **τα όρια με αριθμό**.
 *
 * Η ερώτηση που φυλάνε: **«υπάρχει όριο που κάποιος ΔΙΑΛΕΞΕ αντί να το ΜΕΤΡΗΣΕΙ;»**
 *
 * Η Φάση 5Α έφτιαξε όργανο με **μηδέν** καταναλωτές — μετρούσε σωστά και δεν σταματούσε
 * τίποτα. Οι άγκυρες εδώ φυλάνε το αντίστροφο: ότι κάθε όριο **παράγεται** από δηλωμένο
 * προϋπολογισμό διά μετρημένου ρυθμού, και ότι το ρωτά κάποιος **πριν** από την πράξη.
 */

import {
  MAX_TABLE_GRID_CELLS,
  TABLE_ENTITY_SHARE_BYTES,
  TABLE_LAYOUT_BUDGET_MS,
  TABLE_LAYOUT_US_PER_GRID_CELL,
  canGrowTableGrid,
  checkWorksheetsFitShare,
  fitTableGrid,
  fitWorksheetsToShare,
  fitsTableGrid,
  gridCellCount,
  modelGridCellCount,
} from '../table-capacity';
import { SCENE_DOCUMENT_WARN_BYTES } from '../table-document-cost';
import { MAX_TABLE_COLUMN_COUNT, MAX_TABLE_TOTAL_ROW_COUNT } from '../table-ooxml-limits';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import { tableWorksheetId, type TableWorksheet } from '../../../types/table-worksheet';
import type { PersistedTableModel, TableCell, TableCellStyleOverride } from '../../../types/table';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

/** Μοντέλο σχήματος `rows × columns`, **αραιό**: το πλέγμα μετριέται, δεν γεμίζει. */
function shaped(rowCount: number, columnCount: number): PersistedTableModel {
  return toPersistedTableModel(createTableModel({
    columns: Array.from({ length: columnCount }, (_, i) => ({
      id: `c${i}`,
      sizing: { kind: 'fixed' as const, widthMm: 40 },
      valueType: 'text' as const,
      align: 'left' as const,
    })),
    rows: Array.from({ length: rowCount }, (_, i) => ({
      id: `r${i}`,
      rowClass: (i === 0 ? 'title' : i === 1 ? 'header' : 'data') as 'title' | 'header' | 'data',
    })),
    cells: [],
    merges: [],
  }));
}

/** Η μορφοποίηση που φέρνει ένα **τυπικό** κελί μετά τη Φάση 6 (§5.7.7). */
const TYPICAL_FORMAT: TableCellStyleOverride = {
  numberFormat: { kind: 'decimal', decimals: 2, grouping: true },
  textHeightMm: 3.88,
  textColorHex: '#1E293B',
  bold: true,
  align: 'MR',
};

/** Φύλλο με **γραμμένο** ελληνικό περιεχόμενο μηχανικού — μέτρηση σε κενό δεν αποδεικνύει τίποτα. */
function worksheet(index: number, cellCount: number): TableWorksheet {
  const values = ['Δοκός Δ1', 'Κ12', '4Ø20'];
  return {
    id: tableWorksheetId(`ws${index}`),
    model: toPersistedTableModel(createTableModel({
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
    })),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. 🔴 ΚΑΘΕ ΟΡΙΟ ΕΙΝΑΙ ΠΗΛΙΚΟ — όχι αριθμός που κάποιος έγραψε
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ΤΟ ΟΡΙΟ ΠΑΡΑΓΕΤΑΙ ΑΠΟ ΔΙΑΙΡΕΣΗ, ΔΕΝ ΓΡΑΦΕΤΑΙ', () => {
  it('το ΟΡΙΟ 1 είναι ακριβώς «προϋπολογισμός διά ρυθμού» — αλλιώς κάποιος το διάλεξε', () => {
    // Αν κάποιος γράψει χειρόγραφα ένα «στρογγυλό» 30.000, αυτή η γραμμή τον ρωτά από ποια
    // διαίρεση προέκυψε. Είναι ο λόγος που το νούμερο βγαίνει επίτηδες μη στρογγυλό.
    expect(MAX_TABLE_GRID_CELLS).toBe(
      Math.floor((TABLE_LAYOUT_BUDGET_MS * 1000) / TABLE_LAYOUT_US_PER_GRID_CELL),
    );
  });

  it('…και η τιμή του είναι 31.250 — το πηλίκο 1.000 ms / 32 µs, γραμμένο αυτούσιο', () => {
    expect(MAX_TABLE_GRID_CELLS).toBe(31250);
  });

  it('🔴 το ΣΗΜΕΡΙΝΟ ΜΕΓΙΣΤΟ ΤΗΣ Φ5Α (256 × 1000) ΔΕΝ χωρά πια — η μέτρηση το απέρριψε', () => {
    // 256.000 πυκνά κελιά × 32 µs = **8 δευτερόλεπτα** ανά δεσμευμένη αλλαγή (§5.8.1). Το
    // παλιό όριο δεν ήταν μικρό· ήταν πολύ μεγάλο για να δουλέψει.
    expect(fitsTableGrid(1000, 256)).toBe(false);
  });

  it('🔑 …ενώ ο ΣΤΕΝΟΣ-ΨΗΛΟΣ και ο ΦΑΡΔΥΣ-ΧΑΜΗΛΟΣ ΜΕΓΑΛΩΣΑΝ πέρα από το παλιό ορθογώνιο', () => {
    // Και οι δύο ήταν **παράνομοι** πριν τη Φ5Β (>1000 γραμμές· >256 στήλες). Η αλλαγή δεν
    // είναι μόνο σφίξιμο: οι άξονες ελευθερώθηκαν, το γινόμενο μπήκε.
    expect(fitsTableGrid(1500, 20)).toBe(true);
    expect(fitsTableGrid(60, 500)).toBe(true);
  });

  it('το ΟΡΙΟ 2 είναι ΤΟ ΙΔΙΟ αντικείμενο τιμής με το κατώφλι της σκηνής — καμία νέα κατοικία', () => {
    // Ένα κλάσμα γραμμένο εδώ (`0,4 × ταβάνι`) θα ήταν ο αυθαίρετος αριθμός που η Φάση 5
    // υπάρχει για να εξαλείψει, ντυμένος μέτρηση.
    expect(TABLE_ENTITY_SHARE_BYTES).toBe(SCENE_DOCUMENT_WARN_BYTES);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Το πυκνό γινόμενο — η ερώτηση που κοστίζει τρεις `.length`
// ──────────────────────────────────────────────────────────────────────────────

describe('gridCellCount / modelGridCellCount — ΠΥΚΝΟ, όχι γραμμένο', () => {
  it('είναι γινόμενο, όχι άθροισμα', () => {
    expect(gridCellCount(7, 9)).toBe(63);
  });

  it('🔴 μετρά ΚΑΙ ΤΑ ΚΕΝΑ κελιά — εκείνα πληρώνουν κι αυτά τον βρόχο της διάταξης', () => {
    // Το μοντέλο εδώ δεν έχει **κανένα** γραμμένο κελί. Ένας μετρητής που ρωτούσε
    // `cells.length` θα έλεγε `0` για πλέγμα 20.000 κελιών — ακριβώς το λάθος που κάνει το
    // όριο να μην προστατεύει τίποτα.
    const model = shaped(100, 200);
    expect(model.cells).toHaveLength(0);
    expect(modelGridCellCount(model)).toBe(20000);
  });
});

describe('canGrowTableGrid — η ερώτηση μπαίνει ΠΡΙΝ την πράξη', () => {
  it('επιτρέπει όσο το ΠΡΟΒΛΕΠΟΜΕΝΟ γινόμενο χωρά', () => {
    expect(canGrowTableGrid(shaped(100, 100), { rows: 10 })).toBe(true);
  });

  it('🔴 αρνείται ΠΡΙΝ κατασκευαστεί οτιδήποτε — η σημασιολογία των Google Sheets', () => {
    const model = shaped(312, 100); // 31.200 πυκνά κελιά
    expect(canGrowTableGrid(model, { rows: 1 })).toBe(false);
    expect(canGrowTableGrid(model, { columns: 1 })).toBe(false);
  });

  it('🔑 το ΠΛΗΘΟΣ της πράξης μετρά: τρεις στήλες μαζί μπορεί να μη χωρούν ενώ η μία χωρά', () => {
    const model = shaped(2, MAX_TABLE_GRID_CELLS / 2 - 1);
    expect(canGrowTableGrid(model, { columns: 1 })).toBe(true);
    expect(canGrowTableGrid(model, { columns: 3 })).toBe(false);
  });

  it('🔴 «πρόσθεσε ΓΡΑΜΜΗ» δεν προσθέτει και στήλη — το απόν σκέλος είναι ΜΗΔΕΝ, όχι ένα', () => {
    // 310 × 100 = 31.000. Μία γραμμή παραπάνω χωρά (31.100)· μία γραμμή **και** μία στήλη
    // δεν χωρά (31.411). Χωρίς αυτή τη διάκριση, ο φύλακας θα αρνιόταν πράξεις που
    // επιτρέπονται — και ο χρήστης δεν θα είχε τρόπο να καταλάβει γιατί.
    const model = shaped(310, 100);
    expect(canGrowTableGrid(model, { rows: 1 })).toBe(true);
    expect(canGrowTableGrid(model, { rows: 1, columns: 1 })).toBe(false);
  });

  it('χωρίς όρισμα ανάπτυξης ρωτά αν χωρά ΟΠΩΣ ΕΙΝΑΙ — και ο υπερμεγέθης ΔΕΝ σκάει', () => {
    // Ό,τι υπάρχει ήδη δεν σπάει: η συνάρτηση απαντά «όχι» και ο πίνακας εξακολουθεί να
    // ανοίγει και να ζωγραφίζεται. Ένα `throw` εδώ θα καθιστούσε αποθηκευμένο έγγραφο
    // μη ανοίξιμο — regression, όχι όριο.
    expect(canGrowTableGrid(shaped(1000, 256), {})).toBe(false);
  });
});

describe('fitsTableGrid — οι ράγες του προτύπου δεσμεύουν ΧΩΡΙΣΤΑ από το γινόμενο', () => {
  it('ο ΕΚΦΥΛΙΣΜΕΝΟΣ πίνακας (μία γραμμή, πάρα πολλές στήλες) περνά το γινόμενο και κόβεται στη ράγα', () => {
    // 20.000 × 1 = 20.000 ≤ 31.250 (το γινόμενο λέει ναι) — αλλά το `.xlsx` σταματά στη
    // στήλη XFD. Χωρίς τον ξεχωριστό έλεγχο, το κόψιμο θα ήταν σωστό για την οθόνη και
    // λάθος για το αρχείο.
    expect(gridCellCount(1, 20000)).toBeLessThan(MAX_TABLE_GRID_CELLS);
    expect(fitsTableGrid(1, 20000)).toBe(false);
    expect(20000).toBeGreaterThan(MAX_TABLE_COLUMN_COUNT);
  });

  it('🔑 η ράγα των ΓΡΑΜΜΩΝ φτάνεται ΜΟΝΟ στο εκφυλισμένο σχήμα — και η μετάλλαξη το απέδειξε', () => {
    // ⚠️ Η πρώτη γραφή αυτής της άγκυρας ήταν `fitsTableGrid(MAX + 1, 1)` και **δεν μπορούσε
    // να κοκκινίσει**: με μία στήλη, το γινόμενο κόβει ήδη στις 31.250 γραμμές, δηλαδή
    // **πολύ πριν** από τη ράγα του 1.048.576. Η μετάλλαξη «σβήσε τη ράγα γραμμών» έμεινε
    // πράσινη και το αποκάλυψε (§5.7.6, τρίτο μάθημα: εξέτασε και τις τρεις πιθανότητες —
    // εδώ ήταν **κενό αγκύρωσης**, όχι ισοδύναμη μετάλλαξη).
    //
    // Η **μόνη** είσοδος που φτάνει τη ράγα είναι μηδέν στήλες: τότε το γινόμενο είναι `0`
    // και δεν λέει τίποτα, ενώ το πλήθος γραμμών εξακολουθεί να ξεπερνά ό,τι γράφεται σε
    // `.xlsx`. Η ράγα **μένει** — δηλώνει το συμβόλαιο της μορφής — αλλά καταγράφεται εδώ
    // ότι στην πράξη το γινόμενο τη δεσμεύει πάντα πρώτο.
    expect(gridCellCount(MAX_TABLE_TOTAL_ROW_COUNT + 1, 0)).toBeLessThanOrEqual(MAX_TABLE_GRID_CELLS);
    expect(fitsTableGrid(MAX_TABLE_TOTAL_ROW_COUNT + 1, 0)).toBe(false);
    // …και με έστω μία στήλη, εκείνος που αρνείται είναι το **γινόμενο**.
    expect(fitsTableGrid(MAX_TABLE_TOTAL_ROW_COUNT + 1, 1)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Το κόψιμο της εισαγωγής
// ──────────────────────────────────────────────────────────────────────────────

describe('fitTableGrid — τι χωράει από ό,τι προσφέρεται', () => {
  it('ό,τι χωρά περνά αυτούσιο', () => {
    expect(fitTableGrid(50, 10)).toEqual({ rowCount: 50, columnCount: 10 });
  });

  it('🔑 ΟΙ ΣΤΗΛΕΣ ΚΡΑΤΙΟΥΝΤΑΙ, ΟΙ ΓΡΑΜΜΕΣ ΚΟΒΟΝΤΑΙ — το σχήμα των δεδομένων επιβιώνει', () => {
    const fitted = fitTableGrid(10_000, 100);
    expect(fitted.columnCount).toBe(100);
    // Ακέραιο πλήθος γραμμών: το `Math.floor` είναι μέρος της απάντησης, όχι λεπτομέρεια —
    // «312,5 γραμμές» δεν υπάρχουν, και το μισό παραπάνω θα ξεπερνούσε το όριο.
    expect(fitted.rowCount).toBe(Math.floor(MAX_TABLE_GRID_CELLS / 100));
  });

  it('όταν ούτε οι στήλες χωράνε, κόβονται κι εκείνες — προτίμηση, όχι υπόσχεση', () => {
    expect(fitTableGrid(1, 50_000).columnCount).toBeLessThan(50_000);
  });

  it('🔴 ΤΟ ΑΠΟΤΕΛΕΣΜΑ ΧΩΡΑΕΙ ΠΑΝΤΑ — η συνάρτηση δεν παραβιάζει το όριο που επιβάλλει', () => {
    for (const [rows, columns] of [[1, 1], [10_000, 100], [1, 500_000], [5, 999_999], [0, 10]]) {
      const fitted = fitTableGrid(rows, columns);
      expect(fitsTableGrid(fitted.rowCount, fitted.columnCount)).toBe(true);
    }
  });

  it('🔴 …ΚΑΙ ΜΕ ΤΙΣ ΑΝΑΠΟΦΕΥΚΤΕΣ ΓΡΑΜΜΕΣ ΜΕΣΑ — το ελάττωμα που έπιασε άγκυρα', () => {
    // Χωρίς το `minRowCount`, ένα αίτημα «500.000 στήλες» έδινε `columnCount = 16.384` και
    // `rowCount = 1`· ο εργοστασιάρχης όμως γεννά **πάντα** τίτλο + κεφαλίδα, άρα ο πίνακας
    // έβγαινε 16.384 × 2 = **32.768** πυκνά κελιά. Το όριο παραβιαζόταν από τη συνάρτηση που
    // υποτίθεται ότι το επιβάλλει (ίδιο σχήμα με το `bytesPerCell` του §5.6.3).
    for (const columns of [500_000, 20_000, 16_384, 15_626]) {
      const fitted = fitTableGrid(1, columns, 2);
      expect(fitted.rowCount).toBeGreaterThanOrEqual(2);
      expect(fitsTableGrid(fitted.rowCount, fitted.columnCount)).toBe(true);
    }
  });

  it('μηδέν στήλες ⇒ μηδέν πλέγμα, όχι διαίρεση με το μηδέν', () => {
    expect(fitTableGrid(100, 0)).toEqual({ rowCount: 0, columnCount: 0 });
  });

  it('αρνητικό δάπεδο γραμμών διαβάζεται ως μηδέν — όχι ως διαίρεση με αρνητικό', () => {
    // Χωρίς το `Math.max(0, …)` το `columnCeiling` γίνεται **αρνητικό** και οι στήλες
    // καταρρέουν στο μηδέν: ένας πίνακας εξαφανίζεται επειδή κάποιος πέρασε λάθος πρόσημο.
    // (Η μετάλλαξη M37 έμενε πράσινη μέχρι να γραφτεί αυτή η γραμμή — κενό αγκύρωσης.)
    expect(fitTableGrid(10, 5, -3)).toEqual({ rowCount: 10, columnCount: 5 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. 🔴 Η ΠΟΡΤΑ ΠΟΥ ΔΕΝ ΦΥΛΑΣΣΟΤΑΝ ΚΑΘΟΛΟΥ: το άθροισμα των φύλλων
// ──────────────────────────────────────────────────────────────────────────────

describe('checkWorksheetsFitShare / fitWorksheetsToShare — το ΑΘΡΟΙΣΜΑ, όχι το κάθε φύλλο μόνο του', () => {
  it('η ετυμηγορία έχει ΑΡΙΘΜΟΥΣ, ποτέ σκέτο boolean — αλλιώς το μήνυμα δεν λέει τι να κόψεις', () => {
    const verdict = checkWorksheetsFitShare([worksheet(0, 10)]);
    expect(verdict.fits).toBe(true);
    expect(verdict.limit).toBe(TABLE_ENTITY_SHARE_BYTES);
    expect(verdict.bytes).toBeGreaterThan(0);
    expect(verdict.overBy).toBe(0);
  });

  it('βιβλίο που χωρά περνά ΟΛΟΚΛΗΡΟ', () => {
    const book = [worksheet(0, 5), worksheet(1, 5), worksheet(2, 5)];
    expect(fitWorksheetsToShare(book)).toEqual({ worksheets: book, droppedWorksheets: 0 });
  });

  it('🔴 ΚΑΘΕ ΦΥΛΛΟ ΜΟΝΟ ΤΟΥ ΧΩΡΑΕΙ — και ΜΑΖΙ δεν χωράνε. Αυτή ήταν η τρύπα.', () => {
    // Μέχρι τη Φ5Β το κάθε φύλλο ελεγχόταν **μόνο του** και κανείς δεν ρωτούσε το άθροισμα:
    // ένα βιβλίο Excel 12 φύλλων έμπαινε με μία εντολή. Το δείγμα εδώ το αναπαράγει σε
    // μικρογραφία — φύλλα που το καθένα περνά, ενώ η ακολουθία τους δεν περνά.
    const heavy = worksheet(0, 30_000);
    expect(checkWorksheetsFitShare([heavy]).fits).toBe(true);

    const book = Array.from({ length: 6 }, (_, i) => worksheet(i, 30_000));
    expect(checkWorksheetsFitShare(book).fits).toBe(false);
  }, 30_000);

  it('🔑 …και κόβονται από το ΤΕΛΟΣ: η σειρά του βιβλίου του χρήστη μένει ακέραιη', () => {
    const book = Array.from({ length: 6 }, (_, i) => worksheet(i, 30_000));
    const fitted = fitWorksheetsToShare(book);
    expect(fitted.droppedWorksheets).toBeGreaterThan(0);
    // Πρόθεμα: ό,τι επιβίωσε είναι τα **πρώτα** φύλλα, στη σειρά τους.
    expect(fitted.worksheets).toEqual(book.slice(0, fitted.worksheets.length));
  }, 30_000);

  it('🔴 …και ΤΟ ΑΠΟΤΕΛΕΣΜΑ ΧΩΡΑΕΙ — δεν επιστρέφει «σχεδόν»', () => {
    const book = Array.from({ length: 6 }, (_, i) => worksheet(i, 30_000));
    expect(checkWorksheetsFitShare(fitWorksheetsToShare(book).worksheets).fits).toBe(true);
  }, 30_000);

  it('κενό βιβλίο δεν είναι ειδική περίπτωση', () => {
    expect(fitWorksheetsToShare([])).toEqual({ worksheets: [], droppedWorksheets: 0 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. 🔑 Η ΣΧΕΣΗ ΤΩΝ ΔΥΟ ΟΡΙΩΝ — ένα φύλλο δεν εξαντλεί μόνο του το μερίδιο
// ──────────────────────────────────────────────────────────────────────────────

describe('🔑 Τα δύο όρια είναι ΣΥΜΒΑΤΑ, και το ξέρουμε επειδή το μετρήσαμε', () => {
  it('ένα ΓΕΜΑΤΟ φύλλο στο ΟΡΙΟ 1, με τυπικά μορφοποιημένα κελιά, χωρά στο ΟΡΙΟ 2', () => {
    // Η ιδιότητα που κάνει τα δύο όρια να συνεργάζονται αντί να αλληλοαναιρούνται: ένας
    // πίνακας **ενός** φύλλου στο μέγιστο επιτρεπτό πλέγμα δεν μπορεί να εξαντλήσει μόνος
    // του το μερίδιο του εγγράφου — άρα η προσθήκη δεύτερου φύλλου είναι πάντα δυνατή για
    // ρεαλιστικό περιεχόμενο. Με 198 bytes/κελί (§5.7.7): 31.250 × 198 ≈ 5,9 MB < 10 MB.
    //
    // ⚠️ Ισχύει για **τυπικό** κελί. Ένα κελί με 32.767 χαρακτήρες σπάει την αναλογία — γι'
    // αυτό η ράγα μήκους υπάρχει, και γι' αυτό το ΟΡΙΟ 2 μετρά **αληθινά bytes** αντί να
    // εμπιστεύεται αυτή τη σχέση.
    const measuredBytesPerCell = 198;
    expect(MAX_TABLE_GRID_CELLS * measuredBytesPerCell).toBeLessThan(TABLE_ENTITY_SHARE_BYTES);
  });
});
