/**
 * 🔴 ADR-739 §59 Δ1 — **Ο ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΣ ΚΕΙΜΕΝΟΥ ΚΕΛΙΟΥ**: η οριοθέτηση, ο βρόχος ανάδρασης
 * με τη διάταξη, και η γωνία που φτάνει **ακέραιη** στα τέσσερα backends.
 *
 * ## 🔴 ΕΞΙ ΑΝΕΞΑΡΤΗΤΕΣ ΑΣΤΟΧΙΕΣ
 * 1. **Η `hug` στήλη μετρά το αδιάσπαστο μήκος ΟΡΙΖΟΝΤΙΑ** ⇒ κάθετη κεφαλίδα βγάζει στήλη
 *    **τεράστια** αντί για στενή. Το handoff το ονομάτισε ως «το ακριβές σημείο όπου η φάση θα
 *    χαλάσει σιωπηλά» — και σιωπηλά είναι: ο πίνακας ζωγραφίζεται μια χαρά, απλώς απλώνεται.
 * 2. **Το ύψος γραμμής αγνοεί τη στροφή** ⇒ το κάθετο κείμενο βγαίνει **έξω** από τη γραμμή του.
 * 3. **Η πρόωρη έξοδος του §58 μένει μόνο στο `wrap`** ⇒ η στροφή δεν φτάνει ποτέ στη μέτρηση
 *    ύψους, δηλαδή η αστοχία 2 με άλλο δρόμο.
 * 4. **Οι γραμμές πολυγραμμικού κελιού απλώνονται κατακόρυφα** ενώ τα γράμματα τρέχουν πλάγια
 *    ⇒ γραμμές που **τέμνονται** μεταξύ τους.
 * 5. **Η γωνία δεν φτάνει στο run / στο primitive** ⇒ οθόνη γερμένη, χαρτί και DXF ίσια (ή το
 *    αντίστροφο) — η ακριβής ασυμφωνία που έκλεισε το βήμα 8 του Φ.Δ.
 * 6. **Το ξεπάτωμα γράφει ρητό `0`** ⇒ παράκαμψη που νικά τη γραμμή/στήλη και δεν φαίνεται.
 *
 * 🔴 **Και μία εγγύηση ΜΗΔΕΝ ΟΠΙΣΘΟΔΡΟΜΗΣΗΣ**: κανένας πίνακας στον δίσκο δεν δηλώνει γωνία,
 * οπότε κάθε υπάρχουσα διάταξη οφείλει να είναι **byte-ταυτόσημη** — ίδια εγγύηση με το §58.5.
 *
 * @see ../table-rotation-ops.ts · ../table-layout-measure.ts · ../table-layout-align.ts
 */

import {
  MAX_TABLE_TEXT_ROTATION_DEG,
  isTableTextRotationActive,
  maxLineLengthMm,
  nextTableTextRotation,
  rotatedTextExtentMm,
  tableTextRotationDeg,
} from '../table-rotation-ops';
import { cellTextPositionMm, fittingLineCount } from '../table-layout-align';
import { baseCellStyle, resolveCellStyle } from '../table-style';
import { layoutTable } from '../table-layout';
import { tableLayoutToPrimitives } from '../table-layout-to-primitives';
import { resolveTableModel } from '../table-model-helpers';
import { hierarchicalTableStyle } from './hierarchical-table-style-fixture';
import type { TableCellStyle, TableStyle } from '../table-style';
import type { TableTextMeasurer } from '../table-layout-types';
import type { PersistedTableModel, TableCellAlign } from '../../../types/table';

const STYLE: TableStyle = hierarchicalTableStyle();
const measure: TableTextMeasurer = (text, heightMm) => text.length * heightMm;

function styleWith(textRotationDeg: number, textHeightMm = 2): TableCellStyle {
  return {
    ...baseCellStyle(STYLE.rowClasses.data),
    textHeightMm,
    textRotationDeg,
    margins: { hMm: 1, vMm: 1 },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Η ΟΡΙΟΘΕΤΗΣΗ — η αριθμητική καρδιά της φάσης
// ──────────────────────────────────────────────────────────────────────────────

describe('rotatedTextExtentMm — η οριοθέτηση ενός γερμένου μπλοκ', () => {
  it('🔴 μηδενική γωνία ⇒ οι είσοδοι ΑΥΤΟΥΣΙΕΣ (καμία εξαίρεση στον κώδικα)', () => {
    expect(rotatedTextExtentMm(30, 4, 0)).toEqual({ widthMm: 30, heightMm: 4 });
  });

  /**
   * 🔴 **ΑΣΤΟΧΙΑ 1, στην πηγή της.** Στις 90° μήκος και πάχος **ανταλλάσσονται**: γι' αυτό μια
   * `hug` στήλη με κάθετο κείμενο βγαίνει στενή. Μια υλοποίηση που επέστρεφε το μήκος ως πλάτος
   * θα έδινε στήλη 30mm εκεί που χρειάζονται 4.
   */
  it('🔴 στις 90° μήκος και πάχος ΑΝΤΑΛΛΑΣΣΟΝΤΑΙ', () => {
    const e = rotatedTextExtentMm(30, 4, 90);
    expect(e.widthMm).toBeCloseTo(4, 9);
    expect(e.heightMm).toBeCloseTo(30, 9);
  });

  it('το πρόσημο δεν αλλάζει την οριοθέτηση — μόνο η φορά της στροφής', () => {
    expect(rotatedTextExtentMm(30, 4, -90)).toEqual(rotatedTextExtentMm(30, 4, 90));
    expect(rotatedTextExtentMm(30, 4, -45)).toEqual(rotatedTextExtentMm(30, 4, 45));
  });

  it('στις 45° και οι δύο διαστάσεις μεγαλώνουν (η γνωστή διαγώνιος)', () => {
    const half = Math.SQRT1_2;
    const e = rotatedTextExtentMm(30, 4, 45);
    expect(e.widthMm).toBeCloseTo((30 + 4) * half, 9);
    expect(e.heightMm).toBeCloseTo((30 + 4) * half, 9);
  });

  it('γωνία εκτός εμβέλειας από παλιό αρχείο ⇒ κόβεται, δεν μολύνει', () => {
    expect(rotatedTextExtentMm(30, 4, 500)).toEqual(rotatedTextExtentMm(30, 4, 90));
    expect(rotatedTextExtentMm(30, 4, Number.NaN)).toEqual({ widthMm: 30, heightMm: 4 });
  });
});

describe('maxLineLengthMm — το μήκος που επιτρέπει το πλάτος της στήλης', () => {
  it('μηδενική γωνία ⇒ **ακριβώς** το ωφέλιμο πλάτος', () => {
    expect(maxLineLengthMm(40, 0)).toBe(40);
  });

  it('σε γωνία, το ίδιο ορθογώνιο επιτρέπει ΜΕΓΑΛΥΤΕΡΟ μήκος', () => {
    expect(maxLineLengthMm(40, 60)).toBeCloseTo(80, 6);
  });

  /**
   * 🔑 **Το άπειρο είναι ΔΗΛΩΣΗ, όχι διαρροή.** Στις 90° το κείμενο δεν καταναλώνει καθόλου
   * οριζόντιο μήκος· ο μόνος περιορισμός θα ήταν το **ύψος της γραμμής**, που η μέτρηση
   * **παράγει** από αυτό ακριβώς το αποτέλεσμα. Χρησιμοποιώντας το, ο κύκλος θα ξανάκλεινε.
   */
  it('🔑 στις 90° ⇒ ΑΠΕΙΡΟ (ο κύκλος με το ύψος γραμμής δεν κλείνει)', () => {
    expect(maxLineLengthMm(40, 90)).toBe(Number.POSITIVE_INFINITY);
    expect(maxLineLengthMm(40, -90)).toBe(Number.POSITIVE_INFINITY);
  });

  /**
   * ⚠️ Το κατώφλι είναι **γωνιακό**, όχι `=== 90`: το μοντέλο δέχεται `number`, και ένα
   * `89,9999°` θα έδινε μήκος γραμμής μερικών **χιλιομέτρων** — αριθμός που θα ταξίδευε ως
   * πλάτος στήλης χωρίς κανένα σφάλμα.
   */
  it('⚠️ «σχεδόν 90» ⇒ κι αυτό άπειρο, όχι αστρονομικός αριθμός', () => {
    expect(maxLineLengthMm(40, 89.9999)).toBe(Number.POSITIVE_INFINITY);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΑΤΗΜΑ
// ──────────────────────────────────────────────────────────────────────────────

describe('nextTableTextRotation — δύο κουμπιά, ένας αριθμός', () => {
  it('από οριζόντιο, «προς τα πάνω» ⇒ +90', () => {
    expect(nextTableTextRotation(0, 'up')).toBe(90);
    expect(nextTableTextRotation(null, 'down')).toBe(-90);
  });

  /** 🔴 **ΑΣΤΟΧΙΑ 6** — το ξεπάτωμα σβήνει το πεδίο, δεν γράφει ρητό μηδέν. */
  it('🔴 ξαναπάτημα ⇒ `undefined` = ΣΒΗΣΙΜΟ, ποτέ ρητό `0`', () => {
    expect(nextTableTextRotation(90, 'up')).toBeUndefined();
    expect(nextTableTextRotation(-90, 'down')).toBeUndefined();
  });

  /**
   * 🔑 Η **αμοιβαία αποκλειστικότητα** δεν γράφεται πουθενά: το πεδίο είναι ένας αριθμός, οπότε
   * «πάνω» πάνω σε «κάτω» απλώς γράφει `+90`. Ίδια αρχή με το `nextTableOverflow`.
   */
  it('🔑 «πάνω» πάνω σε «κάτω» ⇒ +90 — καμία ρητή αποκλειστικότητα', () => {
    expect(nextTableTextRotation(-90, 'up')).toBe(90);
  });

  it('ανάμεικτος στόχος ⇒ εφαρμογή, ποτέ ξεπάτωμα', () => {
    expect(nextTableTextRotation(null, 'up')).toBe(90);
  });

  it('πατημένο μόνο εκείνο που ισχύει· ανάμεικτο ⇒ κανένα', () => {
    expect(isTableTextRotationActive(90, 'up')).toBe(true);
    expect(isTableTextRotationActive(90, 'down')).toBe(false);
    expect(isTableTextRotationActive(45, 'up')).toBe(false);
    expect(isTableTextRotationActive(null, 'up')).toBe(false);
  });

  it('ο ΕΝΑΣ κριτής κόβει τη γωνία στα όρια, για όλους τους καταναλωτές', () => {
    expect(tableTextRotationDeg(styleWith(500))).toBe(MAX_TABLE_TEXT_ROTATION_DEG);
    expect(tableTextRotationDeg(styleWith(Number.NaN))).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Η ΚΛΗΡΟΝΟΜΙΑ και η ΘΕΣΗ
// ──────────────────────────────────────────────────────────────────────────────

describe('resolveCellStyle + cellTextPositionMm — κληρονομιά και γεωμετρία', () => {
  it('κελί ▸ γραμμή ▸ στήλη, με το κελί να νικά· κανείς ⇒ οριζόντιο', () => {
    expect(resolveCellStyle(STYLE.rowClasses.data, {
      column: { textRotationDeg: 30 },
      row: { textRotationDeg: 60 },
      cell: { textRotationDeg: 90 },
    }).textRotationDeg).toBe(90);
    expect(resolveCellStyle(STYLE.rowClasses.data).textRotationDeg).toBe(0);
  });

  const RECT = { x: 10, y: 0, w: 40, h: 20 } as const;
  const positionAt = (rotationDeg: number, index: number, lineCount: number) => cellTextPositionMm({
    rect: RECT,
    hAlign: 'left',
    align: 'TL' as TableCellAlign,
    style: styleWith(rotationDeg),
    indentMm: 0,
    rotationDeg,
    lineCount,
    index,
  });

  it('μία γραμμή, μηδενική γωνία ⇒ **ταυτόσημη** θέση με πριν τη φάση', () => {
    const p = positionAt(0, 0, 1);
    expect(p.x).toBe(RECT.x + 1);
    expect(p.y).toBe(RECT.y + 1 + 2);
  });

  /**
   * 🔴 **ΑΣΤΟΧΙΑ 4.** Στις 90° οι διαδοχικές γραμμές οφείλουν να απλώνονται **οριζόντια** (η
   * κάθετη του γερμένου κειμένου είναι ο άξονας x), όχι κατακόρυφα. Μια υλοποίηση που πρόσθετε
   * την απόσταση στο `y` θα ζωγράφιζε **όλες τις γραμμές τη μία πάνω στην άλλη**.
   */
  it('🔴 στις 90° οι γραμμές απλώνονται ΟΡΙΖΟΝΤΙΑ, όχι κατακόρυφα', () => {
    const first = positionAt(90, 0, 2);
    const second = positionAt(90, 1, 2);
    expect(second.x - first.x).toBeGreaterThan(0.5);
    expect(second.y).toBeCloseTo(first.y, 9);
  });

  it('χωρίς στροφή, οι γραμμές απλώνονται κατακόρυφα — όπως πάντα', () => {
    const first = positionAt(0, 0, 2);
    const second = positionAt(0, 1, 2);
    expect(second.x).toBeCloseTo(first.x, 9);
    expect(second.y - first.y).toBeGreaterThan(0.5);
  });
});

describe('fittingLineCount — το φράγμα περικοπής ακολουθεί τη γωνία', () => {
  const RECT = { x: 0, y: 0, w: 60, h: 12 } as const;

  it('μηδενική γωνία ⇒ το ωφέλιμο ΥΨΟΣ κρίνει (η σημερινή έκφραση)', () => {
    expect(fittingLineCount(RECT, styleWith(0), 0)).toBe(fittingLineCount(RECT, styleWith(0)));
  });

  /**
   * 🔴 Στις 90° το πάχος του μπλοκ μεγαλώνει κατά μήκος του **πλάτους**. Σε κελί πολύ πιο
   * πλατύ από ψηλό, ένα φράγμα που κοιτούσε το ύψος θα έκοβε γραμμές που **χωρούν άνετα**.
   */
  it('🔴 στις 90° κρίνει το ωφέλιμο ΠΛΑΤΟΣ — πολύ περισσότερες γραμμές', () => {
    expect(fittingLineCount(RECT, styleWith(90), 90))
      .toBeGreaterThan(fittingLineCount(RECT, styleWith(0), 0));
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Ο ΒΡΟΧΟΣ ΑΝΑΔΡΑΣΗΣ — μέτρηση ⇄ γεωμετρία οντότητας
// ──────────────────────────────────────────────────────────────────────────────

function modelWith(rotationDeg: number | undefined, text = 'ΑΒΓΔΕΖΗΘ'): PersistedTableModel {
  return {
    columns: [{
      id: 'c0',
      sizing: { kind: 'hug' },
      valueType: 'text',
      align: 'left',
      ...(rotationDeg === undefined ? {} : { styleOverride: { textRotationDeg: rotationDeg } }),
    }],
    rows: [{ id: 'r0', rowClass: 'data' }],
    cells: [['r0', 'c0', { kind: 'text', value: text }]],
    merges: [],
  };
}

const layoutOf = (m: PersistedTableModel) =>
  layoutTable(resolveTableModel(m), STYLE, { measureText: measure });

describe('🏆 η διάταξη ΤΙΜΑ τη γωνία — και στους δύο άξονες', () => {
  /**
   * 🔴 **ΑΣΤΟΧΙΑ 1 — το ακριβές σημείο όπου η φάση θα χαλούσε σιωπηλά.**
   *
   * Το `hug` μετρά το κείμενο **αδιάσπαστο** (§58.7). Χωρίς την οριοθέτηση, οι οκτώ χαρακτήρες
   * θα ζητούσαν το πλήρες μήκος τους **οριζόντια** και η κάθετη κεφαλίδα θα γεννούσε στήλη
   * τεράστια — ενώ ο χρήστης έγειρε το κείμενο **ακριβώς για να στενέψει** η στήλη.
   */
  it('🔴 στις 90° η `hug` στήλη ΣΤΕΝΕΥΕΙ — δεν φουσκώνει', () => {
    const flat = layoutOf(modelWith(undefined)).columns[0].widthMm;
    const vertical = layoutOf(modelWith(90)).columns[0].widthMm;
    expect(vertical).toBeLessThan(flat);
  });

  /** 🔴 **ΑΣΤΟΧΙΕΣ 2+3.** Το ύψος της γραμμής ακολουθεί το **μήκος** του γερμένου κειμένου. */
  it('🔴 στις 90° η γραμμή ΨΗΛΩΝΕΙ όσο το μήκος του κειμένου', () => {
    const flat = layoutOf(modelWith(undefined)).rows[0].heightMm;
    const vertical = layoutOf(modelWith(90)).rows[0].heightMm;
    expect(vertical).toBeGreaterThan(flat);
    // 8 χαρακτήρες × 2,8mm = 22,4mm μήκος + δύο κατακόρυφα περιθώρια.
    const margins = STYLE.rowClasses.data.margins.vMm * 2;
    expect(vertical).toBeCloseTo(8 * STYLE.rowClasses.data.textHeightMm + margins, 6);
  });

  /**
   * **ΜΗΔΕΝ ΟΠΙΣΘΟΔΡΟΜΗΣΗ.** Χωρίς γωνία, η πρόωρη έξοδος βγάζει τον βρόχο ύψους στην πρώτη
   * γραμμή και ο πίνακας είναι byte-ταυτόσημος με πριν τη φάση — και το run **δεν** κουβαλά
   * καθόλου το πεδίο.
   */
  it('χωρίς γωνία ⇒ ταυτόσημη διάταξη, και ΚΑΝΕΝΑ `rotationDeg` στο run', () => {
    const cell = layoutOf(modelWith(undefined)).cells[0];
    expect(cell.texts[0].rotationDeg).toBeUndefined();
    expect(layoutOf(modelWith(undefined)).rows[0].heightMm).toBe(STYLE.defaultRowHeightMm);
  });

  it('η γωνία φτάνει στο run — κανονικοποιημένη', () => {
    expect(layoutOf(modelWith(90)).cells[0].texts[0].rotationDeg).toBe(90);
    expect(layoutOf(modelWith(400)).cells[0].texts[0].rotationDeg).toBe(90);
  });

  /**
   * 🔴 **ΑΣΤΟΧΙΑ 5 — η γωνία ταξιδεύει στα backends.** Το `DetailPrimitive` είναι το κοινό
   * λεξιλόγιο PDF / DXF / σκηνής / ΤΕΚ: αν σταματούσε εδώ, η οθόνη θα ήταν γερμένη και το
   * τυπωμένο σχέδιο ίσιο, δηλαδή η ασυμφωνία που έκλεισε το βήμα 8 ξαναγεννημένη.
   */
  it('🔴 η γωνία φτάνει στο `DetailPrimitive` — και ΛΕΙΠΕΙ όταν είναι μηδέν', () => {
    const origin = { xMm: 0, yMm: 0 };
    const rotated = tableLayoutToPrimitives(layoutOf(modelWith(90)), origin)
      .filter((p) => p.kind === 'text');
    expect(rotated.length).toBeGreaterThan(0);
    expect(rotated.every((p) => p.kind === 'text' && p.rotationDeg === 90)).toBe(true);

    const flat = tableLayoutToPrimitives(layoutOf(modelWith(undefined)), origin)
      .filter((p) => p.kind === 'text');
    expect(flat.every((p) => p.kind === 'text' && p.rotationDeg === undefined)).toBe(true);
  });
});
