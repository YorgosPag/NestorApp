/**
 * ADR-739 §42 — **το ⊖ της διαγραφής** (πάνω στο στοιχείο, όχι στο σύνορο).
 *
 * Τα anchors εδώ δεν ελέγχουν «τρέχει χωρίς να σκάσει». Ελέγχουν τις **πέντε αποφάσεις** που,
 * αν αλλάξουν σιωπηλά, δίνουν χειριστήριο που σβήνει λάθος πράγμα χωρίς να φαίνεται:
 *
 *  1. **Το ⊖ δείχνει ΣΤΟΙΧΕΙΟ** — επιστρέφει `TableIndicatorHit` (άξονας + ταυτότητα), όχι
 *     δείκτη συνόρου. Μια μετατόπιση κατά ένα εδώ σβήνει σταθερά τον **γείτονα**, και κανένα
 *     test που μετρά μόνο «μίκρυνε ο πίνακας» δεν το βλέπει.
 *  2. **Οι δύο φάσεις** — `nearby` φαίνεται, `armed` πατιέται. Αν καταρρεύσουν σε μία, το
 *     πάτημα στο γράμμα σβήνει τη στήλη αντί να την επιλέξει.
 *  3. **Η υποτέλεια στη ζώνη** — πάνω σε **διαχωριστικό** δεν υπάρχει ⊖, γιατί εκεί δεν
 *     υπάρχει υποδιαίρεση. Αν σπάσει, ο δίσκος διεκδικεί τα pixel της λαβής πλάτους.
 *  4. **Το κατώφλι πλάτους** — σε στενή υποδιαίρεση το ⊖ **δεν υπάρχει**, ώστε να μη σκεπάσει
 *     την ταυτότητα της στήλης ακριβώς τη στιγμή που ο χρήστης πάει να τη σβήσει.
 *  5. **Η προεπισκόπηση καλύπτει ΟΛΟΝ τον στόχο** — §27.17: με τρεις στήλες μαρκαρισμένες
 *     φεύγουν τρεις, άρα βάφονται τρεις.
 */

import {
  TABLE_DELETE_CONTROL_RADIUS_PX,
  tableDeleteControlAtFrame,
  tableDeleteControlMinTickMm,
  tableDeleteSpanRectMm,
  sameTableDeleteControl,
} from '../table-delete-control';
import {
  TABLE_INDICATOR_GRIP_CLEARANCE_PX,
  tableIndicatorBandsMm,
} from '../table-indicator-geometry';
import { TABLE_INDICATOR } from '../../../config/color-config';
import type { TableLayout } from '../table-layout-types';

const LAYOUT: TableLayout = {
  widthMm: 120,
  heightMm: 28,
  columns: [
    { id: 'c0', xMm: 0, widthMm: 40 },
    { id: 'c1', xMm: 40, widthMm: 40 },
    { id: 'c2', xMm: 80, widthMm: 40 },
  ],
  rows: [
    { id: 'r0', yMm: 0, heightMm: 12 },
    { id: 'r1', yMm: 12, heightMm: 8 },
    { id: 'r2', yMm: 20, heightMm: 8 },
  ],
  cells: [],
  borders: [],
};

/** 4 px ανά mm — οι στήλες βγαίνουν 160 px, άνετα πάνω από το κατώφλι πλάτους. */
const PX_PER_MM = 4;
/** 10 px ανά mm — **οι γραμμές** χρειάζονται μεγαλύτερη κλίμακα για να περάσουν το κατώφλι. */
const ROW_PX_PER_MM = 10;

const bandsAt = (pxPerMm: number) => tableIndicatorBandsMm(pxPerMm);

/** Το κέντρο του ⊖ μιας **στήλης**, όπως το ορίζει η κεφαλίδα: τέλος − κενό − ακτίνα. */
function columnDiscCenter(
  endMm: number,
  pxPerMm: number,
): { readonly u: number; readonly v: number } {
  const bands = bandsAt(pxPerMm);
  return {
    u: endMm - (TABLE_INDICATOR_GRIP_CLEARANCE_PX + TABLE_DELETE_CONTROL_RADIUS_PX) / pxPerMm,
    v: -(bands.gapMm + bands.columnBandMm / 2),
  };
}

describe('§42 — το ⊖ δείχνει ΣΤΟΙΧΕΙΟ, όχι σύνορο', () => {
  it('πάνω στον δίσκο της στήλης `c1` ⇒ `armed`, με ταυτότητα **στοιχείου**', () => {
    const center = columnDiscCenter(80, PX_PER_MM);
    const hit = tableDeleteControlAtFrame(LAYOUT, center, bandsAt(PX_PER_MM), PX_PER_MM);

    expect(hit).not.toBeNull();
    expect(hit?.phase).toBe('armed');
    // 🔑 Ταυτότητα, όχι δείκτης συνόρου: το `c1` **είναι** αυτό που θα φύγει.
    expect(hit?.hit).toEqual({ axis: 'column', colId: 'c1', index: 1 });
  });

  it('το κέντρο του δίσκου κάθεται μέσα στη ζώνη και στο **τέλος** της υποδιαίρεσης', () => {
    const center = columnDiscCenter(80, PX_PER_MM);
    const hit = tableDeleteControlAtFrame(LAYOUT, center, bandsAt(PX_PER_MM), PX_PER_MM);
    const bands = bandsAt(PX_PER_MM);

    // Κάθετα: στο **μέσο** της ζώνης — ούτε στη λωρίδα του κενού (λαβές), ούτε έξω από τη ζώνη.
    expect(hit?.centerMm.v).toBeCloseTo(-(bands.gapMm + bands.columnBandMm / 2), 6);
    // Κατά μήκος: **μέσα** στη στήλη `c1` (40…80), κοντά στο δεξί της άκρο.
    expect(hit?.centerMm.u).toBeGreaterThan(40);
    expect(hit?.centerMm.u).toBeLessThan(80);
  });

  it('το κάτοπτρο για **γραμμές**: κάτω άκρο του αριθμού, ίδια ταυτότητα στοιχείου', () => {
    const bands = bandsAt(ROW_PX_PER_MM);
    const inset =
      (TABLE_INDICATOR_GRIP_CLEARANCE_PX + TABLE_DELETE_CONTROL_RADIUS_PX) / ROW_PX_PER_MM;
    const point = { u: -(bands.gapMm + bands.rowBandMm / 2), v: 12 - inset };

    const hit = tableDeleteControlAtFrame(LAYOUT, point, bands, ROW_PX_PER_MM);

    expect(hit?.phase).toBe('armed');
    expect(hit?.hit).toEqual({ axis: 'row', rowId: 'r0', index: 0 });
  });
});

describe('§42 — οι δύο φάσεις: φαίνεται νωρίς, δρα ακριβώς', () => {
  it('αλλού μέσα στο ίδιο γράμμα ⇒ `nearby` (το πάτημα ανήκει στη ΖΩΝΗ, όχι στο ⊖)', () => {
    const bands = bandsAt(PX_PER_MM);
    const point = { u: 50, v: -(bands.gapMm + bands.columnBandMm / 2) };

    const hit = tableDeleteControlAtFrame(LAYOUT, point, bands, PX_PER_MM);

    expect(hit?.phase).toBe('nearby');
    // Ίδιο **στοιχείο** — δηλαδή το ⊖ ζωγραφίζεται ήδη, απλώς δεν πατιέται ακόμα.
    expect(hit?.hit).toEqual({ axis: 'column', colId: 'c1', index: 1 });
  });

  it('🔴 ο έλεγχος του δίσκου είναι **κυκλικός**: η γωνία του κουτιού ΔΕΝ οπλίζει', () => {
    const center = columnDiscCenter(80, PX_PER_MM);
    const radiusMm = TABLE_DELETE_CONTROL_RADIUS_PX / PX_PER_MM;
    // Γωνία τετραγώνου ακτίνας `r`: απέχει `r·√2` ≈ 1,41·r — έξω από τον κύκλο.
    const corner = { u: center.u + radiusMm * 0.9, v: center.v + radiusMm * 0.9 };

    // Με **κουτί** θα ήταν `armed` και θα έκλεβε pixel από την επιλογή στήλης (δες την κεφαλίδα).
    expect(tableDeleteControlAtFrame(LAYOUT, corner, bandsAt(PX_PER_MM), PX_PER_MM)?.phase).toBe(
      'nearby',
    );
  });
});

describe('§42 — η υποτέλεια στη ζώνη σβήνει ολόκληρη κλάση σφαλμάτων', () => {
  it('🔴 πάνω σε **διαχωριστικό στηλών** δεν υπάρχει ⊖ (εκεί νικά η λαβή πλάτους)', () => {
    const bands = bandsAt(PX_PER_MM);
    // Ακριβώς πάνω στο σύνορο `c1|c2` — η ζώνη παραιτείται εκεί (§31.9), άρα και το ⊖.
    const point = { u: 80, v: -(bands.gapMm + bands.columnBandMm / 2) };

    expect(tableDeleteControlAtFrame(LAYOUT, point, bands, PX_PER_MM)).toBeNull();
  });

  it('μέσα στο πλέγμα δεν υπάρχει ⊖ — το χειριστήριο ζει μόνο στη ζώνη', () => {
    const point = { u: 60, v: 10 };
    expect(tableDeleteControlAtFrame(LAYOUT, point, bandsAt(PX_PER_MM), PX_PER_MM)).toBeNull();
  });

  it('εκφυλισμένη κλίμακα ⇒ `null`, ποτέ NaN', () => {
    expect(tableDeleteControlAtFrame(LAYOUT, { u: 60, v: -5 }, bandsAt(PX_PER_MM), 0)).toBeNull();
  });
});

describe('§42 — το κατώφλι πλάτους: σε αμφισβήτηση κρύβουμε το ⊖, δεν σκεπάζουμε το γράμμα', () => {
  const NARROW: TableLayout = {
    ...LAYOUT,
    widthMm: 20,
    columns: [
      { id: 'c0', xMm: 0, widthMm: 10 },
      { id: 'c1', xMm: 10, widthMm: 10 },
    ],
  };

  it('στήλη 10 mm στα 4 px/mm (40 px) ⇒ κανένα ⊖', () => {
    const bands = bandsAt(PX_PER_MM);
    const point = { u: 5, v: -(bands.gapMm + bands.columnBandMm / 2) };

    expect(tableDeleteControlAtFrame(NARROW, point, bands, PX_PER_MM)).toBeNull();
  });

  it('🔴 ΤΟ ΣΥΜΒΟΛΑΙΟ: στο κατώφλι, ο δίσκος **δεν αγγίζει** τον χώρο της ετικέτας', () => {
    const bands = bandsAt(PX_PER_MM);
    const minTickMm = tableDeleteControlMinTickMm(bands.columnBandMm, PX_PER_MM);
    const insetMm = TABLE_INDICATOR_GRIP_CLEARANCE_PX / PX_PER_MM;
    const radiusMm = TABLE_DELETE_CONTROL_RADIUS_PX / PX_PER_MM;

    // Η ετικέτα είναι κεντραρισμένη και φράσσεται από το πάχος της ζώνης (δες την κεφαλίδα).
    const labelRightEdge = minTickMm / 2 + bands.columnBandMm / 2;
    const discLeftEdge = minTickMm - insetMm - 2 * radiusMm;

    expect(discLeftEdge).toBeGreaterThanOrEqual(labelRightEdge);
  });

  it('🔴 ΟΙ ΓΡΑΜΜΕΣ ΕΧΟΥΝ ΜΙΚΡΟΤΕΡΟ ΚΑΤΩΦΛΙ — η ετικέτα εκτείνεται κατά ΥΨΟΣ, όχι πλάτος', () => {
    // Ελάττωμα μετρημένο ζωντανά (Giorgio, 04/08): «στις στήλες εμφανίζεται, στις γραμμές
    // ήθελε zoom». Το φράγμα ήταν το **πάχος της ζώνης** (28 px) και στις γραμμές δεν
    // φρουρούσε τίποτα — ο αριθμός `12` πιάνει κατά μήκος του άξονα μόνο το **ύψος** του.
    const PX = 8;
    const bands = bandsAt(PX);
    const columnBound = tableDeleteControlMinTickMm(bands.columnBandMm, PX);
    const rowBound = tableDeleteControlMinTickMm(TABLE_INDICATOR.fontPx / PX, PX);

    expect(rowBound).toBeLessThan(columnBound);

    // Γραμμή 8 mm στα 8 px/mm = **64 px**: κάτω από το κατώφλι στηλών (74), πάνω από των
    // γραμμών (57). Με το παλιό, κοινό φράγμα το ⊖ **δεν υπήρχε** εδώ.
    const r1SizeMm = 8;
    expect(r1SizeMm).toBeLessThan(columnBound);
    expect(r1SizeMm).toBeGreaterThan(rowBound);

    const inset = (TABLE_INDICATOR_GRIP_CLEARANCE_PX + TABLE_DELETE_CONTROL_RADIUS_PX) / PX;
    const point = { u: -(bands.gapMm + bands.rowBandMm / 2), v: 20 - inset };
    const hit = tableDeleteControlAtFrame(LAYOUT, point, bands, PX);

    expect(hit?.phase).toBe('armed');
    expect(hit?.hit).toEqual({ axis: 'row', rowId: 'r1', index: 1 });
  });

  it('το κενό του δίσκου είναι **η οπή σύλληψης**, όχι νέος αριθμός', () => {
    // Αν κάποιος «στρογγυλέψει» το κενό, ο δίσκος ξαναμπαίνει στη ζώνη του διαχωριστικού.
    expect(TABLE_INDICATOR_GRIP_CLEARANCE_PX).toBeGreaterThanOrEqual(
      TABLE_INDICATOR.lineWidthPx,
    );
    expect(tableDeleteControlMinTickMm(bandsAt(1).columnBandMm, 1)).toBeCloseTo(
      2 * (TABLE_INDICATOR_GRIP_CLEARANCE_PX + 2 * TABLE_DELETE_CONTROL_RADIUS_PX) +
        TABLE_INDICATOR.columnBandPx,
      6,
    );
  });
});

describe('§42 — η προεπισκόπηση βάφει ΟΛΟΝ τον στόχο (§27.17)', () => {
  it('τρεις στήλες μαρκαρισμένες ⇒ ορθογώνιο που τις καλύπτει και τις τρεις', () => {
    const bands = bandsAt(PX_PER_MM);
    const rect = tableDeleteSpanRectMm(LAYOUT, 'column', 0, 2, bands);

    expect(rect?.x).toBeCloseTo(0, 6);
    expect(rect?.w).toBeCloseTo(120, 6);
    // Καλύπτει **και** τη ζώνη **και** το κενό **και** το πλέγμα — καμία τρύπα στη μέση.
    expect(rect?.y).toBeCloseTo(-(bands.gapMm + bands.columnBandMm), 6);
    expect(rect?.h).toBeCloseTo(bands.gapMm + bands.columnBandMm + LAYOUT.heightMm, 6);
  });

  it('μία στήλη ⇒ μόνο αυτή· ο γείτονας μένει άβαφος', () => {
    const rect = tableDeleteSpanRectMm(LAYOUT, 'column', 1, 1, bandsAt(PX_PER_MM));
    expect(rect?.x).toBeCloseTo(40, 6);
    expect(rect?.w).toBeCloseTo(40, 6);
  });

  it('γραμμές: το κάτοπτρο, με τη ζώνη αριθμών αριστερά', () => {
    const bands = bandsAt(ROW_PX_PER_MM);
    const rect = tableDeleteSpanRectMm(LAYOUT, 'row', 1, 2, bands);

    expect(rect?.y).toBeCloseTo(12, 6);
    expect(rect?.h).toBeCloseTo(16, 6);
    expect(rect?.x).toBeCloseTo(-(bands.gapMm + bands.rowBandMm), 6);
  });

  it('μπαγιάτικος δείκτης (undo) ⇒ `null`, ποτέ μαντεψιά', () => {
    expect(tableDeleteSpanRectMm(LAYOUT, 'column', 0, 9, bandsAt(PX_PER_MM))).toBeNull();
  });
});

describe('§42 — ο φύλακας ταυτότητας του καρέ', () => {
  const hitOf = (phase: 'nearby' | 'armed') =>
    ({
      hit: { axis: 'column', colId: 'c1', index: 1 },
      phase,
      centerMm: { u: 76, v: -5.75 },
    }) as const;

  it('ίδιο στοιχείο **και** ίδια φάση ⇒ ίδιο', () => {
    expect(sameTableDeleteControl(hitOf('armed'), hitOf('armed'))).toBe(true);
  });

  it('🔴 αλλαγή **φάσης** μετράει: αλλιώς το ⊖ δεν θα ξαναβαφόταν όταν οπλίζεται', () => {
    expect(sameTableDeleteControl(hitOf('nearby'), hitOf('armed'))).toBe(false);
  });

  it('άλλο στοιχείο ⇒ διαφορετικό', () => {
    const other = {
      hit: { axis: 'column', colId: 'c2', index: 2 },
      phase: 'armed',
      centerMm: { u: 116, v: -5.75 },
    } as const;
    expect(sameTableDeleteControl(hitOf('armed'), other)).toBe(false);
  });

  it('άλλος **άξονας** με ίδια θέση ⇒ διαφορετικό', () => {
    const row = {
      hit: { axis: 'row', rowId: 'r1', index: 1 },
      phase: 'armed',
      centerMm: { u: -5.75, v: 76 },
    } as const;
    expect(sameTableDeleteControl(hitOf('armed'), row)).toBe(false);
  });
});
