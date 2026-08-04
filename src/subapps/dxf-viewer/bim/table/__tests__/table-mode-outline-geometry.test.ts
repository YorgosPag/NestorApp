/**
 * 🔴 ADR-739 §37 — **ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΛΕΙΤΟΥΡΓΙΑΣ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΚΡΥΨΕΙ ΤΟΝ ΠΙΝΑΚΑ.**
 *
 * Μέχρι τις 04/08 ο δείκτης δεν είχε **κανένα** test — και ήταν ακριβώς αυτός που κάλυπτε
 * την περίμετρο (μετρημένο: 2 px δείκτη πάνω σε 1,3 px γραμμής στα 10 px/mm). Το κενό ήταν
 * η κλασική μορφή του «0 = κανείς δεν κοίταξε».
 *
 * Το ουσιώδες test της σουίτας δεν είναι η θέση ανάπαυσης: είναι το
 * «**παχύτερο μολύβι ⇒ ο δείκτης βγαίνει πιο έξω**». Αυτό είναι που κάνει τη λύση απάντηση
 * στην **κλάση** και όχι στο δείγμα των 0,13 mm — χωρίς αυτό, η πρώτη παχιά περίμετρος
 * (μολύβι ανά ακμή, ADR-750 Φ5) θα ξαναγεννούσε το ίδιο ελάττωμα σιωπηλά.
 */

import {
  tableModeOutlineOffsetPx,
  tableModeOutlineRectMm,
  TABLE_INDICATOR_GRIP_CLEARANCE_PX,
} from '../table-indicator-geometry';
import { tableBorderScreenPx, MIN_TABLE_BORDER_SCREEN_PX } from '../table-border-pen';
import { tableRenderIndex } from '../table-render-index';
import { TABLE_MODE_OUTLINE } from '../../../config/color-config';
import type {
  TableBorderSegment,
  TableLayout,
  TableRectMm,
} from '../table-layout-types';

/** Το πλέγμα ενός προεπιλεγμένου πίνακα: 3 στήλες × 40 mm, 4 γραμμές × 8 mm. */
const GRID: TableRectMm = { x: 0, y: 0, w: 120, h: 32 };

/** Η λεπτότερη πένα ISO 128 — ό,τι ζωγραφίζει σήμερα κάθε ακμή (`STANDARD_GRID_MM`). */
const THIN_PEN_MM = 0.13;

/** Ανοχή διπλής ακρίβειας για συγκρίσεις px — δες το σχόλιο στην αναλλοίωτη παρακάτω. */
const FLOAT_EPS = 1e-9;

/**
 * Η **εσωτερική** ακμή του δείκτη, σε px οθόνης από τη διαδρομή του πλέγματος. Αρνητικό
 * σημαίνει «μπήκε μέσα στον πίνακα», δηλαδή ακριβώς το ελάττωμα που λύθηκε.
 */
function innerEdgePx(pxPerMm: number, penMm: number): number {
  return tableModeOutlineOffsetPx(pxPerMm, penMm) - TABLE_MODE_OUTLINE.lineWidthPx / 2;
}

/** Η **εξωτερική** ακμή του μολυβιού της περιμέτρου, σε px οθόνης από την ίδια διαδρομή. */
function penOuterEdgePx(pxPerMm: number, penMm: number): number {
  return tableBorderScreenPx(penMm, pxPerMm) / 2;
}

describe('tableBorderScreenPx — ο ΕΝΑΣ κανόνας πάχους (§37)', () => {
  it('μεταφράζει sheet-mm σε px οθόνης', () => {
    expect(tableBorderScreenPx(0.13, 10)).toBeCloseTo(1.3);
    expect(tableBorderScreenPx(0.5, 20)).toBeCloseTo(10);
  });

  it('έχει δάπεδο hairline — μια γραμμή δεν εξαφανίζεται ποτέ σε σμίκρυνση', () => {
    expect(tableBorderScreenPx(0.13, 1)).toBe(MIN_TABLE_BORDER_SCREEN_PX);
    expect(tableBorderScreenPx(0, 1000)).toBe(MIN_TABLE_BORDER_SCREEN_PX);
  });
});

describe('tableModeOutlineOffsetPx — η μετατόπιση προς τα έξω', () => {
  it('🔴 στις προεπιλογές αναπαύεται στη ΜΕΣΗ του δακτυλίου λαβών', () => {
    // Ο δακτύλιος έχει δύο ενοίκους (γεωμετρία μέσα, ζώνη έξω)· η μέση είναι η μοναδική
    // θέση που μεγιστοποιεί την απόσταση και από τους δύο. Κανένας νέος αριθμός.
    expect(tableModeOutlineOffsetPx(10, THIN_PEN_MM)).toBeCloseTo(
      TABLE_INDICATOR_GRIP_CLEARANCE_PX / 2,
    );
  });

  it('🔴 η θέση ανάπαυσης είναι ΣΤΑΘΕΡΗ σε px οθόνης — δείκτης διεπαφής, όχι γεωμετρία', () => {
    // Σε sheet-mm η μετατόπιση θα κατέρρεε πάνω στο πλαίσιο σε σμίκρυνση, δηλαδή θα
    // επέστρεφε το ελάττωμα ακριβώς εκεί όπου είναι πιο έντονο.
    const zooms = [1, 4, 10, 15];
    const offsets = zooms.map((pxPerMm) => tableModeOutlineOffsetPx(pxPerMm, THIN_PEN_MM));
    for (const offset of offsets) expect(offset).toBeCloseTo(offsets[0]);
  });

  it('🔴 Η ΚΛΑΣΗ: παχύτερο μολύβι περιμέτρου ⇒ ο δείκτης βγαίνει πιο έξω', () => {
    // Το μολύβι ανά ακμή (ADR-750 Φ5) επιτρέπει να ξαναπαχύνει η περίμετρος. Χωρίς αυτόν
    // τον όρο θα είχαμε διορθώσει το δείγμα (0,13 mm), όχι την κλάση.
    const thin = tableModeOutlineOffsetPx(10, THIN_PEN_MM);
    const thick = tableModeOutlineOffsetPx(10, 1);
    expect(thick).toBeGreaterThan(thin);
    // 1 mm × 10 px/mm = 10 px μολύβι ⇒ μισό 5 + μισός δείκτης 1 + 1 px διαχωρισμού
    expect(thick).toBeCloseTo(7);
  });

  it('⚠️ ΚΑΝΕΝΑ ΤΑΒΑΝΙ — σε ακραίο μολύβι ο δείκτης περνά και έξω από τη ζώνη', () => {
    // Ταβάνι θα ξαναγεννούσε το bug. Όταν η περίμετρος φουσκώσει τόσο, είναι εκείνη που
    // έχει μπει στη ζώνη — όχι ο δείκτης που ξέφυγε.
    expect(tableModeOutlineOffsetPx(10, 4)).toBeGreaterThan(TABLE_INDICATOR_GRIP_CLEARANCE_PX);
  });
});

describe('🔴 Η ΑΝΑΛΛΟΙΩΤΗ — ο δείκτης δεν ακουμπά ΠΟΤΕ την περίμετρο', () => {
  // Το ελάττωμα του Giorgio, ως πίνακας: κάθε συνδυασμός πένας × zoom οφείλει να αφήνει
  // τουλάχιστον ένα ορατό pixel ανάμεσα στις δύο γραμμές.
  const PENS_MM = [0, THIN_PEN_MM, 0.25, 0.5, 1, 2];
  const ZOOMS = [0.5, 2, 10, 15.4, 40, 200];

  for (const penMm of PENS_MM) {
    for (const pxPerMm of ZOOMS) {
      it(`πένα ${penMm} mm στα ${pxPerMm} px/mm ⇒ καθαρή απόσταση ≥ 1 px`, () => {
        const gapPx = innerEdgePx(pxPerMm, penMm) - penOuterEdgePx(pxPerMm, penMm);
        // ⚠️ Το `1 - FLOAT_EPS` δεν είναι χαλάρωση του κανόνα: ο τύπος δίνει **ακριβώς** 1
        // (τα μισά πάχη αλληλοαναιρούνται), αλλά σε παχύ μολύβι × μεγάλο zoom το IEEE754
        // επιστρέφει 0,999999999999998. Το κατώφλι μετρά τη γεωμετρία, όχι τη διπλή ακρίβεια.
        expect(gapPx).toBeGreaterThanOrEqual(1 - FLOAT_EPS);
      });
    }
  }

  it('🔑 ΤΟ ΕΛΑΤΤΩΜΑ ΤΗΣ 04/08, ως regression: στα 10 px/mm ο δείκτης ΗΤΑΝ πάνω στη γραμμή', () => {
    // Η μέτρηση που γέννησε το §37: περίμετρος 1,3 px, δείκτης 2 px, ΙΔΙΑ διαδρομή.
    expect(tableBorderScreenPx(THIN_PEN_MM, 10)).toBeCloseTo(1.3);
    expect(TABLE_MODE_OUTLINE.lineWidthPx).toBe(2);
    // Με μηδενική μετατόπιση (η παλιά συμπεριφορά) η εσωτερική ακμή του δείκτη έπεφτε
    // 1 px **μέσα** στον πίνακα, δηλαδή κάλυπτε ολόκληρη τη γραμμή.
    expect(0 - TABLE_MODE_OUTLINE.lineWidthPx / 2).toBeLessThan(-penOuterEdgePx(10, THIN_PEN_MM));
    // Τώρα είναι έξω, με περιθώριο.
    expect(innerEdgePx(10, THIN_PEN_MM)).toBeGreaterThan(penOuterEdgePx(10, THIN_PEN_MM));
  });
});

describe('tableModeOutlineRectMm — το ορθογώνιο', () => {
  it('φουσκώνει ΣΥΜΜΕΤΡΙΚΑ — το κέντρο του πίνακα δεν μετακινείται', () => {
    const rect = tableModeOutlineRectMm(GRID, 10, THIN_PEN_MM);
    expect(rect.x + rect.w / 2).toBeCloseTo(GRID.x + GRID.w / 2);
    expect(rect.y + rect.h / 2).toBeCloseTo(GRID.y + GRID.h / 2);
  });

  it('περικλείει το πλέγμα — ποτέ μέσα του', () => {
    const rect = tableModeOutlineRectMm(GRID, 10, THIN_PEN_MM);
    expect(rect.x).toBeLessThan(GRID.x);
    expect(rect.y).toBeLessThan(GRID.y);
    expect(rect.x + rect.w).toBeGreaterThan(GRID.x + GRID.w);
    expect(rect.y + rect.h).toBeGreaterThan(GRID.y + GRID.h);
  });

  it('η μετατόπιση σε mm ισοδυναμεί με τη μετατόπιση σε px στην τρέχουσα κλίμακα', () => {
    const pxPerMm = 8;
    const rect = tableModeOutlineRectMm(GRID, pxPerMm, THIN_PEN_MM);
    expect((GRID.x - rect.x) * pxPerMm).toBeCloseTo(
      tableModeOutlineOffsetPx(pxPerMm, THIN_PEN_MM),
    );
  });

  it('⚠️ εκφυλισμένη προβολή ⇒ ΤΟ ΙΔΙΟ ορθογώνιο, ποτέ Infinity/NaN', () => {
    // Μια διαίρεση με το μηδέν θα έδινε άπειρες συντεταγμένες και ο καμβάς θα σταματούσε
    // να ζωγραφίζει ολόκληρη τη διαδρομή — δηλαδή θα εξαφάνιζε τον δείκτη σιωπηλά.
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(tableModeOutlineRectMm(GRID, bad, THIN_PEN_MM)).toEqual(GRID);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Η ΤΡΟΦΟΔΟΣΙΑ: ποιο μολύβι πρέπει να αποφύγει ο δείκτης (TableRenderIndex)
// ──────────────────────────────────────────────────────────────────────────────

function segment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  widthMm: number,
  visible = true,
): TableBorderSegment {
  return { a, b, spec: { visible, colorHex: '#ffffff', widthMm } };
}

/** Πλέγμα 120 × 32 mm με μία εσωτερική οριζόντια και μία εσωτερική κατακόρυφη. */
function layoutWith(borders: readonly TableBorderSegment[]): TableLayout {
  return {
    widthMm: 120,
    heightMm: 32,
    columns: [
      { id: 'c0', xMm: 0, widthMm: 60 },
      { id: 'c1', xMm: 60, widthMm: 60 },
    ],
    rows: [
      { id: 'r0', yMm: 0, heightMm: 16 },
      { id: 'r1', yMm: 16, heightMm: 16 },
    ],
    cells: [],
    borders,
  };
}

const PERIMETER = [
  segment({ x: 0, y: 0 }, { x: 120, y: 0 }, THIN_PEN_MM), // πάνω
  segment({ x: 0, y: 32 }, { x: 120, y: 32 }, THIN_PEN_MM), // κάτω
  segment({ x: 0, y: 0 }, { x: 0, y: 32 }, THIN_PEN_MM), // αριστερά
  segment({ x: 120, y: 0 }, { x: 120, y: 32 }, THIN_PEN_MM), // δεξιά
];

describe('TableRenderIndex.perimeterMaxWidthMm (§37)', () => {
  it('βρίσκει το ομοιόμορφο μολύβι της περιμέτρου', () => {
    expect(tableRenderIndex(layoutWith(PERIMETER)).perimeterMaxWidthMm).toBeCloseTo(THIN_PEN_MM);
  });

  it('🔴 ΑΓΝΟΕΙ τα εσωτερικά όρια — ο δείκτης δεν καλύπτει ποτέ εσωτερική γραμμή', () => {
    // Μια χοντρή εσωτερική γραμμή δεν αφορά τον δείκτη· αν την μετρούσαμε, ο δείκτης θα
    // απομακρυνόταν χωρίς λόγο και θα έμπαινε στη ζώνη γραμμάτων.
    const index = tableRenderIndex(
      layoutWith([
        ...PERIMETER,
        segment({ x: 0, y: 16 }, { x: 120, y: 16 }, 2), // εσωτερική οριζόντια, παχιά
        segment({ x: 60, y: 0 }, { x: 60, y: 32 }, 2), // εσωτερική κατακόρυφη, παχιά
      ]),
    );
    expect(index.perimeterMaxWidthMm).toBeCloseTo(THIN_PEN_MM);
  });

  it('🔴 κρατά το ΠΑΧΥΤΕΡΟ όταν οι ακμές διαφέρουν — η μία που κρύβεται αρκεί', () => {
    const index = tableRenderIndex(
      layoutWith([...PERIMETER.slice(1), segment({ x: 0, y: 0 }, { x: 120, y: 0 }, 0.5)]),
    );
    expect(index.perimeterMaxWidthMm).toBeCloseTo(0.5);
  });

  it('🔴 ΑΓΝΟΕΙ τα αόρατα — μολύβι που δεν βάφει δεν έχει τι να κρυφτεί', () => {
    const index = tableRenderIndex(
      layoutWith(PERIMETER.map((s) => segment(s.a, s.b, 1, false))),
    );
    expect(index.perimeterMaxWidthMm).toBe(0);
  });

  it('πίνακας χωρίς περιγράμματα ⇒ 0, και ο δείκτης μένει στη θέση ανάπαυσης', () => {
    const index = tableRenderIndex(layoutWith([]));
    expect(index.perimeterMaxWidthMm).toBe(0);
    expect(tableModeOutlineOffsetPx(10, index.perimeterMaxWidthMm)).toBeCloseTo(
      TABLE_INDICATOR_GRIP_CLEARANCE_PX / 2,
    );
  });
});
