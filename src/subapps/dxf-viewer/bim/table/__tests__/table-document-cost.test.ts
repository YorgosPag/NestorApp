/**
 * Άγκυρες για το `table-document-cost` — ADR-833 Φάση 5Α, **το όργανο**.
 *
 * Η ερώτηση που φυλάνε: **«μπορεί κάποιος να διαλέξει όριο ΜΕ ΑΡΙΘΜΟΥΣ αντί με λογική;»**
 * Η Φάση 5 είναι «μέτρηση πρώτα, όριο μετά»· αν το όργανο λέει ψέματα, το όριο που θα
 * βγει από αυτό θα είναι πάλι «αριθμός που κανείς δεν μέτρησε» — απλώς με άλλοθι.
 */

import {
  SCENE_DOCUMENT_LIMIT_BYTES,
  SCENE_DOCUMENT_WARN_BYTES,
  measureModelBytes,
  measureWorksheetCost,
  measureTableDocumentCost,
  checkTableFits,
  affordableCellCount,
  projectTableBytes,
} from '../table-document-cost';
import { ENTERPRISE_LIMITS } from '../../../security/DxfSecurityValidator';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import { tableWorksheetId, type TableWorksheet } from '../../../types/table-worksheet';
import type { PersistedTableModel } from '../../../types/table';

/** Μοντέλο με **γραμμένα** κελιά — μέτρηση σε άδειο μοντέλο δεν αποδεικνύει τίποτα. */
function modelWith(values: readonly string[]): PersistedTableModel {
  return toPersistedTableModel(createTableModel({
    columns: values.map((_, i) => ({
      id: `c${i}`,
      sizing: { kind: 'fixed' as const, widthMm: 40 },
      valueType: 'text' as const,
      align: 'left' as const,
    })),
    rows: [{ id: 'r0', rowClass: 'data' as const, heightMm: 8 }],
    cells: values.map((value, i) => ['r0', `c${i}`, { kind: 'text' as const, value }] as const),
  }));
}

/** Μοντέλο **χωρίς** κανένα γραμμένο κελί — ο αραιός χάρτης είναι άδειος. */
function emptyModel(): PersistedTableModel {
  return toPersistedTableModel(createTableModel({
    columns: [{ id: 'c0', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' }],
    rows: [{ id: 'r0', rowClass: 'data', heightMm: 8 }],
    cells: [],
  }));
}

function worksheet(model: PersistedTableModel, index = 0, name?: string): TableWorksheet {
  return name === undefined
    ? { id: tableWorksheetId(`ws${index}`), model }
    : { id: tableWorksheetId(`ws${index}`), model, name };
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Το ταβάνι — ΔΙΑΒΑΖΕΤΑΙ από τον ιδιοκτήτη του, δεν αντιγράφεται
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ΤΟ ΤΑΒΑΝΙ ΕΧΕΙ ΕΝΑΝ ΙΔΙΟΚΤΗΤΗ', () => {
  it('το όριο είναι ΤΟ ΙΔΙΟ αντικείμενο τιμής με του `DxfSecurityValidator` — όχι δεύτερη κατοικία', () => {
    expect(SCENE_DOCUMENT_LIMIT_BYTES).toBe(ENTERPRISE_LIMITS.MAX_FILE_SIZE_BYTES);
  });

  it('το κατώφλι προειδοποίησης παράγεται κι αυτό από τον ίδιο ιδιοκτήτη', () => {
    expect(SCENE_DOCUMENT_WARN_BYTES).toBe(ENTERPRISE_LIMITS.WARN_FILE_SIZE_MB * 1024 * 1024);
  });

  it('🔴 Η ΔΙΟΡΘΩΜΕΝΗ ΠΡΟΚΕΙΜΕΝΗ: το ταβάνι ΔΕΝ είναι το 1 MiB του Firestore', () => {
    // Το ADR-833 δήλωνε «σκληρό όριο 1 MiB/έγγραφο». Η σκηνή είναι αντικείμενο Cloud
    // Storage, όχι έγγραφο Firestore — και η διαφορά είναι ×25. Αν κάποιος «διορθώσει»
    // το ταβάνι πίσω στο 1 MiB, αυτή η γραμμή το ρωτά γιατί.
    expect(SCENE_DOCUMENT_LIMIT_BYTES).toBeGreaterThan(1024 * 1024);
    expect(SCENE_DOCUMENT_WARN_BYTES).toBeLessThan(SCENE_DOCUMENT_LIMIT_BYTES);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Η μέτρηση ενός φύλλου
// ──────────────────────────────────────────────────────────────────────────────

describe('Ένα φύλλο — τι κοστίζει, και τι εξηγεί το νούμερο', () => {
  it('τα μεγέθη διαβάζονται από το σχήμα ΠΟΥ ΤΑΞΙΔΕΥΕΙ', () => {
    const cost = measureWorksheetCost(worksheet(modelWith(['Α', 'Β', 'Γ'])));
    expect(cost.columnCount).toBe(3);
    expect(cost.rowCount).toBe(1);
    expect(cost.cellCount).toBe(3);
  });

  it('η ταυτότητα του φύλλου ταξιδεύει μαζί με το κόστος του', () => {
    expect(measureWorksheetCost(worksheet(modelWith(['x']), 7)).worksheetId).toBe(
      tableWorksheetId('ws7'),
    );
  });

  it('🔑 ΤΟ ΠΑΓΙΟ ΤΟΥ ΦΥΛΛΟΥ ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΟ: `bytes` > `modelBytes`', () => {
    // Η διαφορά είναι το κόστος του «υπάρχει φύλλο» — id, περιτύλιγμα, όνομα αν έχει.
    // Αν γίνει μηδέν, το όριο πλήθους φύλλων θα υπολογιστεί σαν να είναι δωρεάν.
    const cost = measureWorksheetCost(worksheet(modelWith(['x'])));
    expect(cost.bytes).toBeGreaterThan(cost.modelBytes);
  });

  it('το όνομα του φύλλου ΚΟΣΤΙΖΕΙ — και ένα ελληνικό όνομα κοστίζει περισσότερο', () => {
    const model = modelWith(['x']);
    const anonymous = measureWorksheetCost(worksheet(model));
    const named = measureWorksheetCost(worksheet(model, 0, 'Κάτοψη ισογείου'));
    expect(named.bytes).toBeGreaterThan(anonymous.bytes);
    // …ενώ το μοντέλο τους είναι το ΙΔΙΟ: το επιπλέον είναι όλο στο περιτύλιγμα.
    expect(named.modelBytes).toBe(anonymous.modelBytes);
  });

  it('`measureModelBytes` μετρά ΜΟΝΟ το μοντέλο, ταυτόσημα με το πεδίο του φύλλου', () => {
    const model = modelWith(['Δοκός']);
    expect(measureModelBytes(model)).toBe(measureWorksheetCost(worksheet(model)).modelBytes);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. 🔴 ΤΟ ΝΟΗΜΑ ΟΛΗΣ ΤΗΣ ΦΑΣΗΣ: τα ελληνικά κοστίζουν διπλά
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ΕΛΛΗΝΙΚΑ ΕΝΑΝΤΙ ΛΑΤΙΝΙΚΩΝ — γιατί το όργανο μετρά bytes και όχι χαρακτήρες', () => {
  it('ίδιο πλήθος χαρακτήρων, ΜΕΓΑΛΥΤΕΡΟ κόστος όταν είναι ελληνικά', () => {
    const latin = measureWorksheetCost(worksheet(modelWith(['abcde'])));
    const greek = measureWorksheetCost(worksheet(modelWith(['αβγδε'])));
    expect(greek.modelBytes).toBeGreaterThan(latin.modelBytes);
  });

  it('η διαφορά είναι ΑΚΡΙΒΩΣ ένα byte ανά ελληνικό γράμμα', () => {
    const latin = measureWorksheetCost(worksheet(modelWith(['abcde'])));
    const greek = measureWorksheetCost(worksheet(modelWith(['αβγδε'])));
    expect(greek.modelBytes - latin.modelBytes).toBe(5);
  });

  it('ένας πίνακας γεμάτος ελληνικά ΔΕΝ χωράει στο μισό του μεριδίου του λατινικού', () => {
    // Το πρακτικό αποτέλεσμα: ένα όριο υπολογισμένο σε λατινικό δείγμα υπόσχεται
    // χωρητικότητα που ο ΝΕΣΤΩΡ — που γράφει ελληνικά παντού — δεν έχει.
    const latin = measureTableDocumentCost([worksheet(modelWith(['abcde', 'fghij']))]);
    const greek = measureTableDocumentCost([worksheet(modelWith(['αβγδε', 'ζηθικ']))]);
    expect(affordableCellCount(greek, 100_000)!).toBeLessThan(
      affordableCellCount(latin, 100_000)!,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. Το βιβλίο
// ──────────────────────────────────────────────────────────────────────────────

describe('Το βιβλίο — το άθροισμα, και τι δεν είναι άθροισμα', () => {
  it('τα κελιά όλων των φύλλων αθροίζονται', () => {
    const cost = measureTableDocumentCost([
      worksheet(modelWith(['α', 'β']), 0),
      worksheet(modelWith(['γ']), 1),
    ]);
    expect(cost.worksheetCount).toBe(2);
    expect(cost.cellCount).toBe(3);
    expect(cost.worksheets).toHaveLength(2);
  });

  it('🔑 ΤΟ ΣΥΝΟΛΟ ΔΕΝ ΕΙΝΑΙ ΤΟ ΑΘΡΟΙΣΜΑ: η ακολουθία έχει δικά της bytes', () => {
    // Αγκύλες και κόμματα γράφονται κι αυτά. Ένα άθροισμα θα ήταν εκτίμηση — και αυτό
    // το αρχείο υπάρχει για να μη χρειάζεται κανείς να εκτιμά.
    const sheets = [worksheet(modelWith(['α']), 0), worksheet(modelWith(['β']), 1)];
    const cost = measureTableDocumentCost(sheets);
    const naiveSum = cost.worksheets.reduce((s, w) => s + w.bytes, 0);
    expect(cost.bytes).toBeGreaterThan(naiveSum);
  });

  it('δεύτερο φύλλο ΚΟΣΤΙΖΕΙ — το πάγιο ανά φύλλο δεν είναι μηδέν', () => {
    const one = measureTableDocumentCost([worksheet(modelWith(['α']), 0)]);
    const two = measureTableDocumentCost([
      worksheet(modelWith(['α']), 0),
      worksheet(modelWith(['α']), 1),
    ]);
    expect(two.bytes).toBeGreaterThan(one.bytes);
  });

  it('κενό βιβλίο ⇒ μηδέν κελιά, χωρίς εξαίρεση', () => {
    const cost = measureTableDocumentCost([]);
    expect(cost.worksheetCount).toBe(0);
    expect(cost.cellCount).toBe(0);
    expect(cost.worksheets).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. 🔴 «Δεν ξέρω» ΔΕΝ είναι «άπειρα»
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ΧΩΡΙΣ ΔΕΙΓΜΑ ΔΕΝ ΥΠΑΡΧΕΙ ΜΕΣΗ ΤΙΜΗ', () => {
  it('πίνακας χωρίς γραμμένο κελί ⇒ `bytesPerCell` μηδέν, ΟΧΙ NaN', () => {
    const cost = measureTableDocumentCost([worksheet(emptyModel())]);
    expect(cost.cellCount).toBe(0);
    expect(cost.bytesPerCell).toBe(0);
    expect(Number.isNaN(cost.bytesPerCell)).toBe(false);
  });

  it('…και το «πόσα χωράνε» απαντά `null`, ΠΟΤΕ `Infinity`', () => {
    const cost = measureTableDocumentCost([worksheet(emptyModel())]);
    // Ένα `Infinity` εδώ θα διάβαζε ως «χωράνε όσα θες» — δηλαδή ως άδεια.
    expect(affordableCellCount(cost, SCENE_DOCUMENT_LIMIT_BYTES)).toBeNull();
  });

  it('με δείγμα, το `bytesPerCell` προκύπτει από ΤΑ ΚΕΛΙΑ και μόνο', () => {
    const cost = measureTableDocumentCost([worksheet(modelWith(['α', 'β']))]);
    expect(cost.bytesPerCell).toBeGreaterThan(0);
    expect(cost.bytesPerCell).toBe(cost.worksheets[0].cellsBytes / 2);
  });

  it('χωρίς στήλες/γραμμές οι αντίστοιχες οριακές τιμές είναι κι αυτές `0`, όχι NaN', () => {
    const cost = measureTableDocumentCost([]);
    expect(cost.bytesPerColumn).toBe(0);
    expect(cost.bytesPerRow).toBe(0);
    expect(cost.bytesPerCell).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5β. 🔴 ΤΡΕΙΣ ΟΡΙΑΚΕΣ ΤΙΜΕΣ, ΟΧΙ ΕΝΑΣ ΜΕΣΟΣ ΟΡΟΣ
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ΤΟ ΚΟΣΤΟΣ ΚΕΛΙΟΥ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΕΞΑΡΤΑΤΑΙ ΑΠΟ ΤΟ ΣΧΗΜΑ ΤΟΥ ΔΕΙΓΜΑΤΟΣ', () => {
  it('ίδια κελιά σε ΔΙΑΦΟΡΕΤΙΚΟ σχήμα ⇒ ΙΔΙΟ `bytesPerCell`', () => {
    // Αυτή είναι η άγκυρα που έπιασε το ελάττωμα της πρώτης γραφής: εκεί το
    // `bytesPerCell` διαιρούσε ΟΛΟ το μοντέλο με τα κελιά, άρα ένα δείγμα με πολλές
    // στήλες έβγαζε «ακριβότερο» κελί — και το «μετρημένο» όριο άλλαζε με το δείγμα.
    const wide = measureTableDocumentCost([worksheet(modelWith(['αβγ', 'αβγ', 'αβγ', 'αβγ']))]);
    const narrow = measureTableDocumentCost([worksheet(modelWith(['αβγ', 'αβγ']))]);
    // Η υπόλοιπη διαφορά είναι **μόνο** οι δύο αγκύλες της ακολουθίας, μοιρασμένες σε
    // 4 κελιά αντί για 2 (0,50 έναντι 1,00 byte) — δηλαδή φθίνει όσο μεγαλώνει ο πίνακας.
    // Με τη σπασμένη πρώτη γραφή η ίδια σύγκριση απέκλινε κατά **δεκάδες** bytes.
    expect(Math.abs(wide.bytesPerCell - narrow.bytesPerCell)).toBeLessThan(1);
  });

  it('οι στήλες κοστίζουν ΧΩΡΙΣΤΑ από τα κελιά τους', () => {
    const cost = measureTableDocumentCost([worksheet(modelWith(['α', 'β']))]);
    expect(cost.bytesPerColumn).toBeGreaterThan(0);
    // Ένας ορισμός στήλης (id, sizing, valueType, align) είναι σαφώς βαρύτερος από ένα
    // μικρό κελί κειμένου — γι΄ αυτό η ανάμειξή τους σε έναν μέσο όρο παραμορφώνει.
    expect(cost.bytesPerColumn).toBeGreaterThan(cost.bytesPerCell);
  });

  it('τα τρία μέρη μαζί δίνουν σχεδόν όλο το μοντέλο — δεν λείπει κρυφό κόστος', () => {
    const w = measureWorksheetCost(worksheet(modelWith(['αβγ', 'δεζ'])));
    const parts = w.cellsBytes + w.columnsBytes + w.rowsBytes;
    // Η διαφορά είναι μόνο το περιτύλιγμα του αντικειμένου (`{"columns":…,"rows":…}`).
    expect(parts).toBeLessThan(w.modelBytes);
    expect(w.modelBytes - parts).toBeLessThan(60);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. Η ετυμηγορία και η αντιστροφή της
// ──────────────────────────────────────────────────────────────────────────────

describe('«Χωράει;» και «πόσο μεγάλο επιτρέπεται;»', () => {
  it('η ετυμηγορία κουβαλά τους αριθμούς — και το μερίδιο που της δόθηκε', () => {
    const cost = measureTableDocumentCost([worksheet(modelWith(['α']))]);
    const verdict = checkTableFits(cost, 1_000_000);
    expect(verdict.fits).toBe(true);
    expect(verdict.bytes).toBe(cost.bytes);
    expect(verdict.limit).toBe(1_000_000);
    expect(verdict.overBy).toBe(0);
  });

  it('μερίδιο μικρότερο από τον πίνακα ⇒ λέει ΠΟΣΟ πρέπει να κοπεί', () => {
    const cost = measureTableDocumentCost([worksheet(modelWith(['α']))]);
    const verdict = checkTableFits(cost, 10);
    expect(verdict.fits).toBe(false);
    expect(verdict.overBy).toBe(cost.bytes - 10);
  });

  it('🔑 ΔΙΠΛΑΣΙΟ ΜΕΡΙΔΙΟ ⇒ ΔΙΠΛΑΣΙΑ ΚΕΛΙΑ — η κλιμάκωση είναι γραμμική στα bytes', () => {
    const cost = measureTableDocumentCost([worksheet(modelWith(['αβγ', 'δεζ']))]);
    const single = affordableCellCount(cost, 100_000)!;
    const double = affordableCellCount(cost, 200_000)!;
    expect(double).toBeGreaterThanOrEqual(2 * single - 1);
    expect(double).toBeLessThanOrEqual(2 * single + 1);
  });

  it('🔴 ΤΟ «ΠΟΣΑ ΧΩΡΑΝΕ» ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΥΠΟΣΧΕΘΕΙ ΠΑΡΑΠΑΝΩ — ποτέ στρογγυλοποίηση προς τα πάνω', () => {
    // Η ιδιότητα, όχι ένα δείγμα: όσα κελιά υπόσχεται, τόσα ΠΡΕΠΕΙ να χωράνε. Ένα
    // `ceil` εδώ δίνει χωρητικότητα που δεν υπάρχει, και το λάθος εμφανίζεται στο
    // δίκτυο — όπου το μήνυμα δεν λέει τι να κόψεις.
    const cost = measureTableDocumentCost([worksheet(modelWith(['Δοκός Δ1', 'Κ12']))]);
    // Όριο επίτηδες ΜΗ πολλαπλάσιο του κόστους κελιού, ώστε floor και ceil να διαφέρουν.
    for (const limit of [1_000, 7_777, 123_457]) {
      const affordable = affordableCellCount(cost, limit)!;
      expect(affordable * cost.bytesPerCell).toBeLessThanOrEqual(limit);
      // …και δεν είναι υπερβολικά συντηρητικό: ένα κελί παραπάνω ΔΕΝ χωράει.
      expect((affordable + 1) * cost.bytesPerCell).toBeGreaterThan(limit);
    }
  });

  it('🔴 ΤΟ ΜΕΤΡΗΜΕΝΟ ΝΟΥΜΕΡΟ ΤΗΣ ΦΑΣΗΣ 5: το σημερινό 256×1000 ΓΕΜΑΤΟ ≈ 12 MB', () => {
    // Η πρόβλεψη με τις τρεις οριακές τιμές, σε δείγμα με ΕΛΛΗΝΙΚΟ περιεχόμενο μηχανικού
    // («Δοκός Δ1», «Κ12», «4Ø20») — δηλαδή το ρεαλιστικό, όχι το βολικό.
    //
    // Το εύρημα: ένας ΠΛΗΡΩΣ γεμάτος πίνακας στο σημερινό όριο **χωράει** στο ταβάνι των
    // 25 MB — αλλά μόνος του **ξεπερνά** το κατώφλι προειδοποίησης των 10 MB, πριν καν
    // μπει τοίχος, υποστύλωμα ή γεωμετρία DXF στο ίδιο έγγραφο. Άρα το σημερινό όριο δεν
    // είναι «άνετο»: είναι οριακό, και το ξέρουμε τώρα με αριθμό αντί με εντύπωση.
    const cost = measureTableDocumentCost([worksheet(modelWith(['Δοκός Δ1', 'Κ12', '4Ø20']))]);
    const full = projectTableBytes(cost, {
      columnCount: 256,
      rowCount: 1000,
      filledCellCount: 256 * 1000,
    });
    expect(full).toBeLessThan(SCENE_DOCUMENT_LIMIT_BYTES);
    expect(full).toBeGreaterThan(SCENE_DOCUMENT_WARN_BYTES);
  });

  it('🔑 …ενώ ο ΑΡΑΙΟΣ πίνακας ίδιων διαστάσεων χωράει άνετα — γι΄ αυτό το όριο είναι ΓΙΝΟΜΕΝΟ', () => {
    // Ίδιες διαστάσεις, 5% γεμάτο: το ίδιο «256×1000» άλλοτε χωράει και άλλοτε όχι.
    // Δηλαδή ένα ζεύγος ορίων διαστάσεων ΔΕΝ μπορεί να προστατεύσει το έγγραφο — μόνο
    // ένα όριο στα γραμμένα κελιά μπορεί. Είναι το σχήμα των Google Sheets.
    const cost = measureTableDocumentCost([worksheet(modelWith(['Δοκός Δ1', 'Κ12', '4Ø20']))]);
    const sparse = projectTableBytes(cost, {
      columnCount: 256,
      rowCount: 1000,
      filledCellCount: Math.round(0.05 * 256 * 1000),
    });
    expect(sparse).toBeLessThan(SCENE_DOCUMENT_LIMIT_BYTES);
  });

  it('η πρόβλεψη κλιμακώνεται με ΚΑΘΕ έναν από τους τρεις άξονες, χωριστά', () => {
    const cost = measureTableDocumentCost([worksheet(modelWith(['αβγ', 'δεζ']))]);
    const base = { columnCount: 10, rowCount: 10, filledCellCount: 10 };
    expect(projectTableBytes(cost, { ...base, columnCount: 20 })).toBeGreaterThan(
      projectTableBytes(cost, base),
    );
    expect(projectTableBytes(cost, { ...base, rowCount: 20 })).toBeGreaterThan(
      projectTableBytes(cost, base),
    );
    expect(projectTableBytes(cost, { ...base, filledCellCount: 20 })).toBeGreaterThan(
      projectTableBytes(cost, base),
    );
  });

  it('κενό σχήμα ⇒ μηδενικό προβλεπόμενο κόστος (το πάγιο δεν προσποιείται ότι μετριέται)', () => {
    const cost = measureTableDocumentCost([worksheet(modelWith(['α']))]);
    expect(projectTableBytes(cost, { columnCount: 0, rowCount: 0, filledCellCount: 0 })).toBe(0);
  });
});
