/**
 * 🔴 ADR-768 — **ΤΙ ΥΠΟΣΧΕΤΑΙ ΤΟ ΠΙΝΕΛΟ ΜΟΡΦΟΠΟΙΗΣΗΣ**, και η απόδειξη ότι το τηρεί.
 *
 * Οι άγκυρες εδώ **δεν** ελέγχουν «τρέχει χωρίς σφάλμα». Ελέγχουν τις τέσσερις υποσχέσεις που
 * κάνει το εργαλείο, και καθεμία μπορεί να σπάσει **μόνη της**:
 *
 * 1. **Ισοδυναμία με Excel** — μετά το βάψιμο, ο στόχος **βλέπεται** ακριβώς όπως η πηγή.
 * 2. **Ελάχιστη υλοποίηση** — καρφώνεται **μόνο** η διαφορά· ό,τι ήδη συμφωνεί μένει ζωντανό.
 * 3. **Η κληρονομιά επιβιώνει** — και αποδεικνύεται αλλάζοντας τη γραμμή **μετά** το βάψιμο.
 * 4. **Καθόλου περιεχόμενο** — κείμενο και τύποι δεν αγγίζονται ποτέ.
 *
 * ⚠️ Το δείγμα είναι το **ιεραρχικό** στυλ επίτηδες: με ομοιόμορφο στυλ κάθε άγκυρα εδώ θα
 * έμενε πράσινη **χωρίς να ρωτά τίποτα** — η χειρότερη κατάληξη για δίχτυ ασφαλείας. Το
 * `textColorHex` είναι το ίδιο (`#111111`) σε **όλες** τις κλάσεις, και ακριβώς γι' αυτό είναι
 * η καλύτερη άγκυρα της «ελάχιστης υλοποίησης»: το Excel θα το κάρφωνε· εμείς όχι.
 *
 * @see ../table-format-paint.ts
 */

import {
  captureTableFormatBrush,
  paintTableFormat,
  type TableRunsPaintPolicy,
} from '../table-format-paint';
import { readTableCellFormat } from '../table-format-read';
import { ALL_TABLE_FORMAT_FACETS } from '../table-format-payload';
import { hierarchicalTableStyle } from './hierarchical-table-style-fixture';
import type { TableCellRangeBounds } from '../table-cell-range';
import type {
  PersistedTableModel,
  TableCellStyleOverride,
  TableFormatFacet,
} from '../../../types/table';
import type { TableFormatFacetSet } from '../table-format-payload';

const STYLE = hierarchicalTableStyle();

/** r0 = κεφαλίδα (3mm, έντονη, γέμισμα) · r1…r6 = δεδομένα (2,8mm, κανονικά). */
function model(): PersistedTableModel {
  return {
    columns: [
      { id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
      { id: 'c1', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
    ],
    rows: [
      { id: 'r0', rowClass: 'header' },
      ...Array.from({ length: 6 }, (_, i) => ({ id: `r${i + 1}`, rowClass: 'data' as const })),
    ],
    cells: [],
    merges: [],
  };
}

const at = (row: number, col = 0): TableCellRangeBounds => ({
  firstRow: row,
  lastRow: row,
  firstCol: col,
  lastCol: col,
});

const rows = (from: number, to: number, col = 0): TableCellRangeBounds => ({
  firstRow: from,
  lastRow: to,
  firstCol: col,
  lastCol: col,
});

const ref = (row: number, col = 0) => ({ rowId: `r${row}`, colId: `c${col}` });

const facets = (...names: readonly TableFormatFacet[]): TableFormatFacetSet => new Set(names);

/** Η **ρητή** παράκαμψη ενός κελιού — ό,τι κάρφωσε πράγματι το βάψιμο. */
function overrideAt(
  m: PersistedTableModel,
  row: number,
  col = 0,
): TableCellStyleOverride | undefined {
  const entry = m.cells.find(([rowId, colId]) => rowId === `r${row}` && colId === `c${col}`);
  return entry?.[2].styleOverride;
}

/** Φορτώνει και βάφει σε ένα βήμα — η χειρονομία του χρήστη, όχι δύο κλήσεις. */
function paint(
  m: PersistedTableModel,
  source: TableCellRangeBounds,
  target: TableCellRangeBounds,
  which: TableFormatFacetSet = ALL_TABLE_FORMAT_FACETS,
  // 🔴 ADR-753 §29 — το **πινέλο** ισοπεδώνει· η προεπιλογή εδώ είναι η σημασιολογία που
  // ελέγχει αυτή η σουίτα. Η άλλη κατάσταση έχει δική της άγκυρα, παρακάτω.
  runsPolicy: TableRunsPaintPolicy = 'flatten',
): PersistedTableModel {
  const brush = captureTableFormatBrush(m, STYLE, source, which);
  if (!brush) throw new Error('το πινέλο δεν φόρτωσε');
  return paintTableFormat(m, STYLE, brush, target, runsPolicy);
}

// ──────────────────────────────────────────────────────────────────────────────

describe('ΥΠΟΣΧΕΣΗ 1 — ισοδυναμία με Excel: ο στόχος ΒΛΕΠΕΤΑΙ όπως η πηγή', () => {
  it('κεφαλίδα → δεδομένα: κάθε πεδίο της επιλυμένης μορφής ταυτίζεται', () => {
    const before = model();
    const after = paint(before, at(0), at(3));

    expect(readTableCellFormat(after, STYLE, ref(3))).toEqual(
      readTableCellFormat(before, STYLE, ref(0)),
    );
  });

  it('δεδομένα → κεφαλίδα: ταυτίζεται και προς την ΑΝΤΙΘΕΤΗ φορά', () => {
    const before = model();
    const after = paint(before, at(3), at(0));

    expect(readTableCellFormat(after, STYLE, ref(0))).toEqual(
      readTableCellFormat(before, STYLE, ref(3)),
    );
  });
});

describe('ΥΠΟΣΧΕΣΗ 2 — ελάχιστη υλοποίηση: καρφώνεται ΜΟΝΟ η διαφορά', () => {
  it('ίδια κλάση γραμμής ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference (κανένα βήμα undo)', () => {
    const before = model();
    expect(paint(before, at(2), at(4))).toBe(before);
  });

  it('κεφαλίδα → δεδομένα: γράφεται το `bold`, ΔΕΝ γράφεται το κοινό `textColorHex`', () => {
    const override = overrideAt(paint(model(), at(0), at(3)), 3);

    // Διαφέρουν ⇒ ρητά.
    expect(override?.bold).toBe(true);
    expect(override?.align).toBe('MC');
    // 🔴 Ταυτίζονται ⇒ ΚΑΜΙΑ παράκαμψη. Το Excel θα τα κάρφωνε και τα τρία.
    expect(override).not.toHaveProperty('textColorHex');
    expect(override).not.toHaveProperty('italic');
    expect(override).not.toHaveProperty('underline');
  });

  it('βάψιμο μόνο-γεμίσματος δεν αγγίζει τα έντονα που έβαλε ο χρήστης', () => {
    const withBold = paint(model(), at(0), at(3), facets('text'));
    const then = paint(withBold, at(0), at(3), facets('fill'));

    expect(overrideAt(then, 3)?.bold).toBe(true);
  });
});

describe('ΥΠΟΣΧΕΣΗ 3 — η κληρονομιά ΕΠΙΒΙΩΝΕΙ (εδώ το Excel αποτυγχάνει)', () => {
  it('αλλαγή της στήλης ΜΕΤΑ το βάψιμο αλλάζει το πεδίο που δεν καρφώθηκε', () => {
    const painted = paint(model(), at(0), at(3));

    // Ο χρήστης βάφει τη ΣΤΗΛΗ με άλλο μελάνι — πεδίο που το πινέλο άφησε ζωντανό.
    const recoloured: PersistedTableModel = {
      ...painted,
      columns: painted.columns.map((c) =>
        c.id === 'c0' ? { ...c, styleOverride: { textColorHex: '#C00000' } } : c,
      ),
    };

    expect(readTableCellFormat(recoloured, STYLE, ref(3))?.style.textColorHex).toBe('#C00000');
    // …ενώ το πεδίο που ΟΝΤΩΣ καρφώθηκε μένει ανεπηρέαστο, όπως πρέπει.
    expect(readTableCellFormat(recoloured, STYLE, ref(3))?.style.bold).toBe(true);
  });
});

describe('ΥΠΟΣΧΕΣΗ 4 — καθόλου περιεχόμενο', () => {
  it('κείμενο και τύπος του στόχου μένουν άθικτα', () => {
    const withText: PersistedTableModel = {
      ...model(),
      cells: [['r3', 'c0', { kind: 'text', value: 'ΣΥΝΟΛΟ' }]],
    };
    const after = paint(withText, at(0), at(3));
    const entry = after.cells.find(([r, c]) => r === 'r3' && c === 'c0');

    expect(entry?.[2].value).toBe('ΣΥΝΟΛΟ');
    expect(entry?.[2].formula).toBeUndefined();
  });
});

/**
 * 🔴 ADR-739 §58 Γ2 — **ΤΟ ΞΕΧΕΙΛΙΣΜΑ ΜΕΤΑΦΕΡΕΤΑΙ — ΑΠΟΔΕΙΞΗ, ΟΧΙ ΥΠΟΘΕΣΗ.**
 *
 * Το ADR-768 τοποθέτησε το `overflow` στην όψη `'alignment'` (`table-format-payload.ts`), οπότε
 * «το πινέλο θα δουλέψει δωρεάν όταν η αναδίπλωση αποκτήσει κουμπί» ήταν **εύλογο**. Μέχρι
 * σήμερα όμως **κανένα** test αυτού του αρχείου δεν ανέφερε τη λέξη `overflow` — δηλαδή η
 * υπόθεση δεν είχε ελεγχθεί ποτέ, ακριβώς το σχήμα «0 = κανείς δεν κοίταξε» που το έργο έχει
 * πληρώσει έξι φορές (N.11 / N.12).
 *
 * ⚠️ Οι τρεις έλεγχοι είναι **ανεξάρτητοι**: το «μεταφέρεται» δεν συνεπάγεται «μόνο με τη
 * σωστή όψη», και κανένα από τα δύο δεν συνεπάγεται «η ελάχιστη υλοποίηση ισχύει κι εδώ».
 */
describe('🔴 §58 Γ2 — το ΞΕΧΕΙΛΙΣΜΑ ταξιδεύει με την όψη «στοίχιση»', () => {
  /** Το ίδιο δείγμα, με το κελί-πηγή δηλωμένο ρητά αναδιπλούμενο. */
  function wrapped(): PersistedTableModel {
    return {
      ...model(),
      cells: [['r0', 'c0', { kind: 'text', value: '', styleOverride: { overflow: 'wrap' } }]],
    };
  }

  it('η όψη «στοίχιση» ΜΕΤΑΦΕΡΕΙ την αναδίπλωση στον στόχο', () => {
    const after = paint(wrapped(), at(0), at(3), facets('alignment'));
    expect(overrideAt(after, 3)?.overflow).toBe('wrap');
  });

  /**
   * 🔴 Η **επιλεκτικότητα** των όψεων: ένα βάψιμο μόνο-τυπογραφίας δεν επιτρέπεται να
   * κουβαλήσει μαζί του απόφαση **διάταξης**. Χωρίς αυτόν τον έλεγχο, το πρώτο σφάλμα στον
   * χάρτη `TABLE_FORMAT_FACET_OF` θα ήταν αόρατο — και τα δύο tests από πάνω θα ήταν πράσινα.
   */
  it('🔴 άλλη όψη (τυπογραφία) ΔΕΝ την αγγίζει', () => {
    const after = paint(wrapped(), at(0), at(3), facets('typography'));
    expect(overrideAt(after, 3)?.overflow).toBeUndefined();
  });

  /**
   * Η **ελάχιστη υλοποίηση** ισχύει και εδώ: πηγή που ξεχειλίζει όπως ήδη ξεχειλίζει ο στόχος
   * δεν καρφώνει τίποτα. Το `minimal()` το κάνει γενικά — αυτό το κλειδώνει για το `overflow`.
   */
  it('πηγή και στόχος με το ΙΔΙΟ ξεχείλισμα ⇒ καμία παράκαμψη', () => {
    const after = paint(model(), at(0), at(3), facets('alignment'));
    expect(overrideAt(after, 3)?.overflow).toBeUndefined();
  });
});

/**
 * 🔴 ADR-739 §59 Δ2 — **Η ΕΣΟΧΗ ταξιδεύει κι αυτή με την όψη «στοίχιση».**
 *
 * ⚠️ Γράφτηκε **πριν** θεωρηθεί δεδομένο ότι «θα δουλέψει δωρεάν». Στο §58 Γ2 η ίδια υπόθεση
 * ήταν **σωστή** για το ξεχείλισμα — και **ανέλεγκτη επί μήνες**: καμία άγκυρα δεν ανέφερε τη
 * λέξη. Εδώ η υπόθεση αποδείχθηκε **λανθασμένη**: το `styleSnapshotOf` απαριθμεί τα πεδία
 * ονομαστικά, και χωρίς το `indentLevel` το πινέλο έγραφε `indentLevel: null` σε **κάθε**
 * κελί — εγγραφή-φάντασμα με βήμα undo. Το έπιασε η άγκυρα «ίδια κλάση ⇒ ίδιο μοντέλο
 * by-reference», όχι ο μεταγλωττιστής (το jest δεν ελέγχει τύπους).
 */
describe('🔴 §59 Δ2 — η ΕΣΟΧΗ ταξιδεύει με την όψη «στοίχιση»', () => {
  /** Το ίδιο δείγμα, με το κελί-πηγή δηλωμένο ρητά σε δεύτερο σκαλί εσοχής. */
  function indented(): PersistedTableModel {
    return {
      ...model(),
      cells: [['r0', 'c0', { kind: 'text', value: '', styleOverride: { indentLevel: 2 } }]],
    };
  }

  it('η όψη «στοίχιση» ΜΕΤΑΦΕΡΕΙ την εσοχή στον στόχο', () => {
    const after = paint(indented(), at(0), at(3), facets('alignment'));
    expect(overrideAt(after, 3)?.indentLevel).toBe(2);
  });

  it('🔴 άλλη όψη (τυπογραφία) ΔΕΝ την αγγίζει', () => {
    const after = paint(indented(), at(0), at(3), facets('typography'));
    expect(overrideAt(after, 3)?.indentLevel).toBeUndefined();
  });

  /**
   * 🔴 **Η ρίζα του σφάλματος που βρέθηκε γράφοντας τη φάση.** Πηγή και στόχος χωρίς εσοχή
   * ⇒ **καμία** παράκαμψη. Πριν τη διόρθωση του `styleSnapshotOf`, εδώ γραφόταν
   * `indentLevel: null` — «ρητά καμία εσοχή», δηλαδή κατάσταση που νικά την κληρονομιά,
   * σε κάθε βάψιμο του έργου.
   */
  it('🔴 πηγή και στόχος ΧΩΡΙΣ εσοχή ⇒ καμία παράκαμψη (ούτε `null`)', () => {
    const after = paint(model(), at(0), at(3), facets('alignment'));
    expect(overrideAt(after, 3)).not.toHaveProperty('indentLevel');
  });
});

describe('ΑΠΛΩΜΑ ΜΟΤΙΒΟΥ — γραμμές 6/7/8 της προδιαγραφής', () => {
  it('πηγή ΕΝΑ κελί → στόχος εύρος: ίδια μορφή σε ΟΛΑ', () => {
    const after = paint(model(), at(0), rows(3, 5));

    for (const row of [3, 4, 5]) expect(overrideAt(after, row)?.bold).toBe(true);
  });

  it('πηγή ΔΥΟ γραμμών → στόχος τεσσάρων: το μοτίβο ΕΠΑΝΑΛΑΜΒΑΝΕΤΑΙ', () => {
    // Πηγή = κεφαλίδα (έντονη) + δεδομένα (όχι έντονα) ⇒ αναμενόμενο ΝΑΙ/ΟΧΙ/ΝΑΙ/ΟΧΙ.
    const after = paint(model(), rows(0, 1), rows(3, 6));

    expect([3, 4, 5, 6].map((row) => overrideAt(after, row)?.bold ?? false))
      .toEqual([true, false, true, false]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 **ADR-753 §29 — ΟΙ ΔΥΟ ΚΑΤΑΣΤΑΣΕΙΣ ΤΟΥ {@link TableRunsPaintPolicy}, ΚΑΘΕΜΙΑ ΜΟΝΗ ΤΗΣ.**
 *
 * Μέχρι το §29 η ισοπέδωση ήταν **τεκμηριωμένη αλλά αφύλακτη**: καμία άγκυρα αυτής της σουίτας
 * δεν ανέφερε τη λέξη `runs`. Δηλαδή και οι δύο κατευθύνσεις μπορούσαν να σπάσουν σιωπηλά — η
 * μία έσπασε πράγματι, και τη βρήκε ο **ιδιοκτήτης** στην οθόνη.
 *
 * ⚠️ Οι δύο άγκυρες είναι **αντικριστές επίτηδες**: μια πολιτική που ισοπεδώνει *πάντα* και μια
 * που διατηρεί *πάντα* περνούν και οι δύο ένα μονόπλευρο test. Μόνο το ζεύγος αποδεικνύει ότι η
 * παράμετρος **διαβάζεται**.
 */
describe('ADR-753 §29 — η πολιτική για τη μορφοποίηση ΧΑΡΑΚΤΗΡΩΝ', () => {
  const RED = '#ff0000';

  /** Κελί r3 με τους τρεις πρώτους χαρακτήρες κόκκινους. */
  function withRuns(): PersistedTableModel {
    const base = model();
    return {
      ...base,
      cells: [
        ['r3', 'c0', {
          kind: 'text',
          value: 'ΝΕΣΤΩΡ',
          runs: [{ start: 0, end: 3, style: { textColorHex: RED } }],
        }],
      ],
    } as PersistedTableModel;
  }

  const runColorAt = (m: PersistedTableModel, row: number): string | undefined =>
    m.cells.find(([rowId, colId]) => rowId === `r${row}` && colId === 'c0')?.[2]
      .runs?.[0]?.style.textColorHex;

  it("🔴 'flatten' (πινέλο): το βάψιμο ΣΒΗΝΕΙ το χρώμα των γραμμάτων — αλλιώς θα ήταν αόρατο", () => {
    const after = paint(withRuns(), at(0), at(3), facets('text'),'flatten');
    expect(runColorAt(after, 3)).toBeUndefined();
  });

  it("🔴 'preserve' (πλήρες Ctrl+V): τα ίδια γράμματα ΚΡΑΤΟΥΝ το χρώμα τους", () => {
    const after = paint(withRuns(), at(0), at(3), facets('text'),'preserve');
    expect(runColorAt(after, 3)).toBe(RED);
  });
});
