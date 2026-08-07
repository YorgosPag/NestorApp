/**
 * 🔴 ADR-739 §59 Δ2 — **Η ΕΣΟΧΗ**: τι σημαίνει το πάτημα, πόσο είναι ένα σκαλί, και ποιος
 * την τιμά μέσα στη διάταξη.
 *
 * ## 🔴 ΠΕΝΤΕ ΑΝΕΞΑΡΤΗΤΕΣ ΑΣΤΟΧΙΕΣ — καμία δεν πιάνεται από τις άλλες
 * 1. **Η εσοχή σπρώχνει προς την ίδια μεριά και στα δύο άκρα** ⇒ σε δεξιά στοίχιση το κείμενο
 *    βγαίνει **έξω** από το κελί. Ορατό μόνο σε στήλες ποσών — δηλαδή σε κάθε πίνακα ποσοτήτων.
 * 2. **Η εσοχή εφαρμόζεται σε κεντραρισμένο κελί** ⇒ ξεκεντράρισμα που κανείς δεν ζήτησε
 *    (ECMA-376: *«Only left, right, and distributed horizontal alignments are supported»*).
 * 3. **Η εσοχή δεν μπαίνει στο `hug` πλάτος** ⇒ το κείμενο αρχίζει να κόβεται μόλις μπει εσοχή,
 *    χωρίς καμία διέξοδο. Είναι το **γνωστό ελάττωμα του Excel**, και το κλείνουμε.
 * 4. **Η εσοχή δεν αφαιρείται από το ωφέλιμο πλάτος** ⇒ το κείμενο σπρώχνεται μέσα αλλά η
 *    περικοπή μετρά το παλιό πλάτος, άρα ξεχειλίζει από την **απέναντι** ακμή.
 * 5. **Το μηδέν γράφεται ως ρητό `0` αντί να σβήνει το πεδίο** ⇒ η «Μείωση» μέχρι τέρμα αφήνει
 *    πίσω της παράκαμψη που **νικά** τη γραμμή/στήλη, δηλαδή κατάσταση αόρατη και μόνιμη.
 *
 * 🔴 **Και μία ΜΗ-αστοχία που φυλάγεται ρητά**: τα `margins` **δεν** αγγίζονται. Η
 * προειδοποίηση του `resolveCellStyle` («η μέτρηση θα εξαρτιόταν από το περιεχόμενο δύο
 * φορές») ήταν σωστή — και ο λόγος που η εσοχή είναι *padding του κειμένου*, όχι *margin του
 * κελιού*. Χωρίς άγκυρα, η επόμενη φάση μπορεί να «απλοποιήσει» τα δύο σε ένα.
 *
 * @see ../table-indent-ops.ts · ../table-layout-align.ts · ../table-layout-measure.ts
 */

import {
  MAX_TABLE_INDENT_LEVEL,
  TABLE_INDENT_SPACES,
  nextTableIndentLevel,
  tableIndentOffsetMm,
} from '../table-indent-ops';
import { anchorXMm, resolveCellHAlign } from '../table-layout-align';
import { baseCellStyle, resolveCellStyle } from '../table-style';
import { layoutTable } from '../table-layout';
import { resolveTableModel } from '../table-model-helpers';
import { hierarchicalTableStyle } from './hierarchical-table-style-fixture';
import type { TableCellStyle, TableStyle } from '../table-style';
import type { TableTextMeasurer } from '../table-layout-types';
import type { PersistedTableModel, TableCellAlign } from '../../../types/table';

const STYLE: TableStyle = hierarchicalTableStyle();

/**
 * Ντετερμινιστικός μετρητής: **1 mm ανά χαρακτήρα ανά mm ύψους**, κενά συμπεριλαμβανομένα.
 *
 * Τα κενά μετρούν κανονικά **επίτηδες**: η μονάδα της εσοχής είναι κυριολεκτικά «τρία πλάτη
 * κενού» (ECMA-376), οπότε ένας μετρητής που τα αγνοούσε θα έκανε κάθε test της εσοχής να
 * περνά με μηδενική μετατόπιση — πράσινο που σημαίνει «δεν κοίταξα».
 */
const measure: TableTextMeasurer = (text, heightMm) => text.length * heightMm;

/** Το επιλυμένο στυλ ενός κελιού `data`, με ρητή εσοχή και ύψος κειμένου. */
function styleWith(indentLevel: number, textHeightMm = 2): TableCellStyle {
  return {
    ...baseCellStyle(STYLE.rowClasses.data),
    textHeightMm,
    indentLevel,
    margins: { hMm: 1, vMm: 1 },
  };
}

/** Ένα σκαλί με αυτόν τον μετρητή: `3 κενά × ύψος`. */
const stepMmAt = (textHeightMm: number): number => TABLE_INDENT_SPACES * textHeightMm;

const RECT = { x: 10, y: 0, w: 40, h: 8 } as const;

// ──────────────────────────────────────────────────────────────────────────────
// Το ΠΑΤΗΜΑ — τι γράφεται
// ──────────────────────────────────────────────────────────────────────────────

describe('nextTableIndentLevel — τι σημαίνει ένα σκαλί', () => {
  it('από το μηδέν, «αύξηση» δίνει 1', () => {
    expect(nextTableIndentLevel(0, 1)).toBe(1);
  });

  /**
   * 🔴 **ΑΣΤΟΧΙΑ 5.** Η επιστροφή στο μηδέν **σβήνει το πεδίο** (`undefined`) αντί να γράψει
   * ρητό `0`. Ένα ρητό `0` στο κελί **νικά** την εσοχή που δηλώνει η γραμμή ή η στήλη — δηλαδή
   * η «Μείωση» μέχρι τέρμα θα δημιουργούσε παράκαμψη που ο χρήστης δεν βλέπει πουθενά και που
   * ακυρώνει σιωπηλά την κληρονομιά. Ίδια σύμβαση με το `nextTableNumberFormat`.
   */
  it('🔴 από το 1, «μείωση» ΣΒΗΝΕΙ το πεδίο — δεν γράφει ρητό μηδέν', () => {
    expect(nextTableIndentLevel(1, -1)).toBeUndefined();
  });

  it('στο μηδέν, «μείωση» ⇒ ΚΑΜΙΑ εγγραφή (`null`), όχι σβήσιμο', () => {
    expect(nextTableIndentLevel(0, -1)).toBeNull();
    expect(nextTableIndentLevel(null, -1)).toBeNull();
  });

  it('στο ανώτατο σκαλί, «αύξηση» ⇒ ΚΑΜΙΑ εγγραφή', () => {
    expect(nextTableIndentLevel(MAX_TABLE_INDENT_LEVEL, 1)).toBeNull();
    expect(nextTableIndentLevel(MAX_TABLE_INDENT_LEVEL, -1)).toBe(MAX_TABLE_INDENT_LEVEL - 1);
  });

  /**
   * Ανάμεικτος στόχος ⇒ **εφαρμογή** από το μηδέν, ποτέ «μην κάνεις τίποτα»: ο χρήστης που
   * πατά «Αύξηση» πάνω σε ανάμεικτη επιλογή ζητά «βάλ' τα όλα ένα σκαλί μέσα». Ίδια αρχή με
   * το `nextBooleanFormat` και το `nextTableAlign`.
   */
  it('ανάμεικτος στόχος ⇒ ισοπέδωση προς την κατεύθυνση του κουμπιού', () => {
    expect(nextTableIndentLevel(null, 1)).toBe(1);
  });

  it('κλασματικό / αρνητικό σκαλί από παλιό αρχείο ⇒ κόβεται, δεν μολύνει', () => {
    expect(nextTableIndentLevel(2.7, 1)).toBe(3);
    expect(nextTableIndentLevel(-5, 1)).toBe(1);
    expect(nextTableIndentLevel(Number.NaN, 1)).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Η ΜΟΝΑΔΑ — πόσο είναι ένα σκαλί
// ──────────────────────────────────────────────────────────────────────────────

describe('tableIndentOffsetMm — τρία πλάτη κενού ανά σκαλί (ECMA-376 §18.8.1)', () => {
  it('ένα σκαλί = 3 κενά της γραμματοσειράς του κελιού', () => {
    expect(tableIndentOffsetMm(styleWith(1), 'left', measure)).toBe(stepMmAt(2));
  });

  it('τα σκαλιά είναι γραμμικά', () => {
    expect(tableIndentOffsetMm(styleWith(3), 'left', measure)).toBe(3 * stepMmAt(2));
  });

  /**
   * 🔑 Η μονάδα είναι **τυπογραφική**, όχι απόλυτο μήκος: κελί με διπλάσιο ύψος κειμένου
   * παίρνει διπλάσια εσοχή. Ένα σταθερό `1,5mm` θα «ξεκόλλαγε» από τα γράμματα σε κάθε
   * αλλαγή μεγέθους — δεύτερη τυπογραφική αυθεντία δίπλα στον μετρητή.
   */
  it('🔑 ακολουθεί το ύψος κειμένου του κελιού', () => {
    expect(tableIndentOffsetMm(styleWith(1, 4), 'left', measure)).toBe(stepMmAt(4));
  });

  /** 🔴 **ΑΣΤΟΧΙΑ 2** — και ο κανόνας ζει **εδώ**, ώστε κανένας καταναλωτής να μη τον θυμάται. */
  it('🔴 κεντραρισμένο κελί ⇒ ΜΗΔΕΝ, όσα σκαλιά κι αν δηλώνει', () => {
    expect(tableIndentOffsetMm(styleWith(5), 'center', measure)).toBe(0);
  });

  it('δεξιά στοίχιση ⇒ ισχύει κανονικά (ECMA-376: left, right, distributed)', () => {
    expect(tableIndentOffsetMm(styleWith(2), 'right', measure)).toBe(2 * stepMmAt(2));
  });

  it('μηδενικό σκαλί ⇒ ΜΗΔΕΝ, χωρίς να ρωτηθεί καν ο μετρητής', () => {
    let calls = 0;
    const counting: TableTextMeasurer = (t, h) => { calls += 1; return measure(t, h, {}); };
    expect(tableIndentOffsetMm(styleWith(0), 'left', counting)).toBe(0);
    expect(calls).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Η ΑΓΚΥΡΑ — προς τα πού
// ──────────────────────────────────────────────────────────────────────────────

describe('anchorXMm — η εσοχή σπρώχνει ΠΡΟΣ ΤΑ ΜΕΣΑ, όχι πάντα δεξιά', () => {
  const INDENT = 6;

  it('αριστερά ⇒ μακριά από την ΑΡΙΣΤΕΡΗ ακμή', () => {
    expect(anchorXMm(RECT, 'left', 1, INDENT)).toBe(RECT.x + 1 + INDENT);
  });

  /**
   * 🔴 **ΑΣΤΟΧΙΑ 1.** Ένα σκέτο `+` και στις δύο περιπτώσεις μεταγλωττίζεται μια χαρά και
   * βγάζει το δεξιά στοιχισμένο κείμενο **έξω** από το κελί.
   */
  it('🔴 δεξιά ⇒ μακριά από τη ΔΕΞΙΑ ακμή (αντίθετο πρόσημο)', () => {
    expect(anchorXMm(RECT, 'right', 1, INDENT)).toBe(RECT.x + RECT.w - 1 - INDENT);
  });

  it('κέντρο ⇒ ο άξονας του κελιού, ανεπηρέαστος', () => {
    expect(anchorXMm(RECT, 'center', 1, INDENT)).toBe(RECT.x + RECT.w / 2);
  });

  it('μηδενική εσοχή ⇒ **ταυτόσημο** με πριν τη φάση, σε κάθε στοίχιση', () => {
    expect(anchorXMm(RECT, 'left', 1, 0)).toBe(RECT.x + 1);
    expect(anchorXMm(RECT, 'right', 1, 0)).toBe(RECT.x + RECT.w - 1);
    expect(anchorXMm(RECT, 'center', 1, 0)).toBe(RECT.x + RECT.w / 2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Η ΚΛΗΡΟΝΟΜΙΑ και τα ΠΕΡΙΘΩΡΙΑ
// ──────────────────────────────────────────────────────────────────────────────

describe('resolveCellStyle — η εσοχή κληρονομείται, τα περιθώρια ΟΧΙ', () => {
  it('κελί ▸ γραμμή ▸ στήλη, με το κελί να νικά', () => {
    const resolved = resolveCellStyle(STYLE.rowClasses.data, {
      column: { indentLevel: 1 },
      row: { indentLevel: 2 },
      cell: { indentLevel: 3 },
    });
    expect(resolved.indentLevel).toBe(3);
  });

  it('η γραμμή νικά τη στήλη (απόφαση Α6), όπως κάθε άλλο πεδίο', () => {
    const resolved = resolveCellStyle(STYLE.rowClasses.data, {
      column: { indentLevel: 1 },
      row: { indentLevel: 2 },
    });
    expect(resolved.indentLevel).toBe(2);
  });

  it('κανείς δεν μιλά ⇒ μηδέν (η βάση δεν έρχεται από την κλάση γραμμής)', () => {
    expect(resolveCellStyle(STYLE.rowClasses.data).indentLevel).toBe(0);
    expect(baseCellStyle(STYLE.rowClasses.header).indentLevel).toBe(0);
  });

  /**
   * 🔴 **Η ΝΑΡΚΗ ΤΟΥ §59 Δ2, ΦΥΛΑΓΜΕΝΗ.** Η προειδοποίηση του `resolveCellStyle` έλεγε ότι
   * μια εσοχή γραμμένη ως `margins` ανά κελί θα έκανε τη μέτρηση να εξαρτάται από το
   * περιεχόμενο **δύο φορές**. Η λύση δεν ήταν να αγνοηθεί — ήταν να **μην** γίνει `margins`.
   * Χωρίς αυτή την άγκυρα, μια «απλοποίηση» που ενώνει τα δύο θα περνούσε πράσινη.
   */
  it('🔴 τα `margins` μένουν της ΚΛΑΣΗΣ ΓΡΑΜΜΗΣ — καμία εσοχή δεν τα αγγίζει', () => {
    const base = STYLE.rowClasses.data.margins;
    const resolved = resolveCellStyle(STYLE.rowClasses.data, { cell: { indentLevel: 9 } });
    expect(resolved.margins).toEqual(base);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Η ΔΙΑΤΑΞΗ — μέτρηση και τοποθέτηση συμφωνούν
// ──────────────────────────────────────────────────────────────────────────────

/** Ένα κελί `hug` με γνωστό κείμενο· η εσοχή δηλώνεται στη **στήλη** ή στο **κελί**. */
function modelWith(
  indent: number | undefined,
  align: 'left' | 'center',
  text = 'ΑΒΓΔΕ',
): PersistedTableModel {
  return {
    columns: [{
      id: 'c0',
      sizing: { kind: 'hug' },
      valueType: 'text',
      align,
      ...(indent === undefined ? {} : { styleOverride: { indentLevel: indent } }),
    }],
    rows: [{ id: 'r0', rowClass: 'data' }],
    cells: [['r0', 'c0', { kind: 'text', value: text }]],
    merges: [],
  };
}

const layoutOf = (m: PersistedTableModel) =>
  layoutTable(resolveTableModel(m), STYLE, { measureText: measure });

describe('🏆 η διάταξη ΤΙΜΑ την εσοχή — εκεί που το Excel δεν την τιμά', () => {
  /**
   * 🔴 **ΑΣΤΟΧΙΑ 3 — και είναι το σημείο όπου περνάμε το Excel.**
   *
   * Στο Excel το *AutoFit Column Width* **αγνοεί** την εσοχή: βάζοντας εσοχή σε στήλη που
   * «χωρούσε», το κείμενο αρχίζει να κόβεται και η μόνη διέξοδος είναι χειροκίνητο πλάτος.
   * Εδώ η στήλη μεγαλώνει **ακριβώς** κατά την εσοχή — και είναι αποδεδειγμένα ασφαλές, γιατί
   * η εσοχή είναι σταθερά του μοντέλου και δεν μπορεί να εξαρτηθεί από το πλάτος που ορίζει.
   */
  it('🏆 η `hug` στήλη μεγαλώνει ΑΚΡΙΒΩΣ κατά την εσοχή', () => {
    const plain = layoutOf(modelWith(undefined, 'left')).columns[0].widthMm;
    const indented = layoutOf(modelWith(2, 'left')).columns[0].widthMm;
    expect(indented - plain).toBeCloseTo(2 * stepMmAt(STYLE.rowClasses.data.textHeightMm), 9);
  });

  it('🔴 κεντραρισμένη στήλη ⇒ η `hug` ΔΕΝ μεγαλώνει (η εσοχή δεν ισχύει)', () => {
    const plain = layoutOf(modelWith(undefined, 'center')).columns[0].widthMm;
    const indented = layoutOf(modelWith(4, 'center')).columns[0].widthMm;
    expect(indented).toBeCloseTo(plain, 9);
  });

  it('η άγκυρα του κειμένου μετακινείται όσο και η στήλη — το κείμενο δεν κόβεται', () => {
    const cell = layoutOf(modelWith(2, 'left')).cells[0];
    const stepMm = stepMmAt(STYLE.rowClasses.data.textHeightMm);
    expect(cell.indentMm).toBeCloseTo(2 * stepMm, 9);
    expect(cell.texts[0].position.x).toBeCloseTo(
      cell.rect.x + cell.style.margins.hMm + 2 * stepMm, 9,
    );
    expect(cell.texts[0].clipped).toBeUndefined();
  });

  /**
   * 🔴 **ΑΣΤΟΧΙΑ 4.** Σε στήλη **σταθερού** πλάτους η εσοχή οφείλει να τρώει από το ωφέλιμο
   * πλάτος, αλλιώς το κείμενο σπρώχνεται μέσα και ξεχειλίζει από την απέναντι ακμή χωρίς
   * κανείς να το δηλώσει κομμένο.
   */
  it('🔴 σε σταθερή στήλη, η εσοχή ΚΟΒΕΙ το κείμενο (ωφέλιμο πλάτος, όχι μόνο άγκυρα)', () => {
    const TEXT = 'ΑΒΓΔ';
    const textMm = TEXT.length * STYLE.rowClasses.data.textHeightMm;
    // Πλάτος που χωρά το κείμενο **με ένα χιλιοστό περίσσευμα**: ένα σκαλί εσοχής (τρία κενά,
    // 8,4mm εδώ) το εξαντλεί με βεβαιότητα. Παραγόμενο από το στυλ και όχι καρφωμένο, ώστε το
    // test να μη γίνει όμηρος των περιθωρίων του preset.
    const widthMm = textMm + 2 * STYLE.rowClasses.data.margins.hMm + 1;
    const fixed = (indent: number): PersistedTableModel => ({
      columns: [{
        id: 'c0',
        sizing: { kind: 'fixed', widthMm },
        valueType: 'text',
        align: 'left',
        styleOverride: { indentLevel: indent },
      }],
      rows: [{ id: 'r0', rowClass: 'data' }],
      cells: [['r0', 'c0', { kind: 'text', value: TEXT }]],
      merges: [],
    });
    expect(layoutOf(fixed(0)).cells[0].texts[0].clipped).toBeUndefined();
    expect(layoutOf(fixed(1)).cells[0].texts[0].clipped).toBe(true);
  });

  /**
   * **ΜΗΔΕΝ ΟΠΙΣΘΟΔΡΟΜΗΣΗ.** Κανένας πίνακας στον δίσκο δεν δηλώνει `indentLevel`, οπότε κάθε
   * υπάρχουσα διάταξη οφείλει να βγαίνει **byte-ταυτόσημη** — ίδια εγγύηση με το §58.5.
   */
  it('χωρίς εσοχή ⇒ ταυτόσημη διάταξη με πριν τη φάση', () => {
    const cell = layoutOf(modelWith(undefined, 'left')).cells[0];
    expect(cell.indentMm).toBe(0);
    expect(cell.texts[0].position.x).toBe(cell.rect.x + cell.style.margins.hMm);
  });
});

describe('resolveCellHAlign — ο ΕΝΑΣ κανόνας που ρωτούν μέτρηση και τοποθέτηση', () => {
  it('ρητή παράκαμψη νικά τη σημασιολογική στήλη', () => {
    expect(resolveCellHAlign({ cell: { align: 'BR' as TableCellAlign } }, 'left')).toBe('right');
  });

  /**
   * 🔑 Το επίπεδο 4 είναι ο λόγος που η συνάρτηση δέχεται **ωμές παρακάμψεις** και όχι το
   * επιλυμένο στυλ: εκείνο θα έπεφτε στην κλάση γραμμής (`ML` ⇒ `left`) και θα έθαβε τη
   * σημασιολογική στοίχιση της στήλης — ακριβώς η περίπτωση που κανείς δεν δοκιμάζει.
   */
  it('🔑 καμία παράκαμψη ⇒ η ΣΗΜΑΣΙΟΛΟΓΙΚΗ στοίχιση της στήλης, όχι της κλάσης γραμμής', () => {
    expect(resolveCellHAlign({}, 'right')).toBe('right');
    expect(resolveCellStyle(STYLE.rowClasses.data).align).toBe('ML');
  });

  it('η γραμμή νικά τη στήλη, όπως παντού (Α6)', () => {
    expect(resolveCellHAlign(
      { row: { align: 'MC' as TableCellAlign }, column: { align: 'MR' as TableCellAlign } },
      'left',
    )).toBe('center');
  });
});
