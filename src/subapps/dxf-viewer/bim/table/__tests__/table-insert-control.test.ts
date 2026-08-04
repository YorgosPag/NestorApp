/**
 * ADR-739 §40 — **το ⊕ της εισαγωγής** (full parity με το Word).
 *
 * Τα anchors εδώ δεν ελέγχουν «τρέχει χωρίς να σκάσει». Ελέγχουν τις **τέσσερις αποφάσεις**
 * που, αν αλλάξουν σιωπηλά, δίνουν χειριστήριο που δουλεύει λάθος χωρίς να φαίνεται:
 *
 *  1. **Οι δύο φάσεις** — `nearby` φαίνεται, `armed` πατιέται. Αν καταρρεύσουν σε μία, είτε
 *     χάνεται η ανακάλυψη (§31.8) είτε το κλικ δρα 40 px μακριά από τον δίσκο.
 *  2. **Η θέση ανά κατάσταση** — σε λειτουργία πίνακα το ⊕ οφείλει να είναι **πιο έξω** από
 *     τη ζώνη γραμμάτων· διαφορετικά κάθεται πάνω της.
 *  3. **Το `line` είναι δείκτης ΣΥΝΟΡΟΥ** — μια μετατόπιση κατά ένα εισάγει σταθερά στη λάθος
 *     μεριά, και κανένα test που μετρά μόνο «μεγάλωσε ο πίνακας» δεν το βλέπει.
 *  4. **Η γραμμή τύπων δεν το σκεπάζει** — το §27.13, δεύτερη φορά (δες το τελευταίο describe).
 */

import {
  TABLE_INSERT_CONTROL_RADIUS_PX,
  tableInsertControlAtFrame,
  tableInsertControlOuterPx,
  sameTableInsertControl,
} from '../table-insert-control';
import { TABLE_INDICATOR_OUTER_PX } from '../table-indicator-geometry';
import {
  nearestTableAxisBoundary,
  tableColumnBoundaryView,
  tableRowBoundaryView,
} from '../table-axis-boundary';
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

/** 4 px ανά mm — ο πίνακας είναι 480×112 px, άνετα πάνω από το κατώφλι LOD. */
const PX_PER_MM = 4;
const px = (value: number): number => value / PX_PER_MM;

/** Το `v` του κέντρου των ⊕ στηλών, σε mm, για την κατάσταση που ζητείται. */
const columnCenterV = (mode: 'selection' | 'table-mode'): number =>
  -px(tableInsertControlOuterPx(mode).top - TABLE_INSERT_CONTROL_RADIUS_PX);

describe('§40 — οι δύο φάσεις', () => {
  it('πάνω στον δίσκο του συνόρου ⇒ `armed` (και άρα πατιέται)', () => {
    const hit = tableInsertControlAtFrame(
      LAYOUT,
      { u: 40, v: columnCenterV('selection') },
      PX_PER_MM,
      'selection',
    );
    expect(hit).not.toBeNull();
    expect(hit?.phase).toBe('armed');
    expect(hit?.target).toEqual({ axis: 'column', line: 1 });
  });

  it('μέσα στη λωρίδα αλλά μακριά από το σύνορο ⇒ `nearby` (φαίνεται, δεν δρα)', () => {
    const hit = tableInsertControlAtFrame(
      LAYOUT,
      { u: 20, v: columnCenterV('selection') },
      PX_PER_MM,
      'selection',
    );
    expect(hit?.phase).toBe('nearby');
  });

  it('🔴 το `nearby` δείχνει ΤΟ ΠΛΗΣΙΕΣΤΕΡΟ σύνορο, όχι το επόμενο', () => {
    // Στο u = 30 τα σύνορα είναι 0 και 40· πιο κοντά το 40 ⇒ γραμμή 1.
    const hit = tableInsertControlAtFrame(
      LAYOUT,
      { u: 30, v: columnCenterV('selection') },
      PX_PER_MM,
      'selection',
    );
    expect(hit?.target.line).toBe(1);
    expect(hit?.boundaryMm).toBe(40);
  });

  it('έξω από τη λωρίδα ⇒ κανένα χειριστήριο', () => {
    expect(
      tableInsertControlAtFrame(LAYOUT, { u: 40, v: 5 }, PX_PER_MM, 'selection'),
    ).toBeNull();
  });
});

describe('§40 — το `line` είναι δείκτης ΣΥΝΟΡΟΥ, όχι υποδιαίρεσης', () => {
  it('το πρώτο σύνορο είναι 0 («πριν από την πρώτη στήλη»)', () => {
    const hit = tableInsertControlAtFrame(
      LAYOUT,
      { u: 0, v: columnCenterV('selection') },
      PX_PER_MM,
      'selection',
    );
    expect(hit?.target).toEqual({ axis: 'column', line: 0 });
    expect(hit?.phase).toBe('armed');
  });

  it('🔴 υπάρχει σύνορο ΜΕΤΑ την τελευταία στήλη — `line === πλήθος`', () => {
    const hit = tableInsertControlAtFrame(
      LAYOUT,
      { u: 120, v: columnCenterV('selection') },
      PX_PER_MM,
      'selection',
    );
    // Τρεις στήλες ⇒ τέσσερα σύνορα ⇒ το τελευταίο είναι το 3. Χωρίς αυτό, δεν θα υπήρχε
    // κανένας τρόπος να προστεθεί στήλη στο δεξί άκρο με το ⊕.
    expect(hit?.target).toEqual({ axis: 'column', line: 3 });
    expect(hit?.boundaryMm).toBe(120);
  });

  it('οι γραμμές απαντούν συμμετρικά, στη δική τους λωρίδα', () => {
    const centerU = -px(tableInsertControlOuterPx('selection').left - TABLE_INSERT_CONTROL_RADIUS_PX);
    const hit = tableInsertControlAtFrame(LAYOUT, { u: centerU, v: 12 }, PX_PER_MM, 'selection');
    expect(hit?.target).toEqual({ axis: 'row', line: 1 });
    expect(hit?.phase).toBe('armed');
  });
});

describe('§40 — οι δύο καταστάσεις κάθονται σε ΔΙΑΦΟΡΕΤΙΚΟ ύψος', () => {
  it('🔴 σε λειτουργία πίνακα το ⊕ είναι ΕΞΩ από τη ζώνη γραμμάτων', () => {
    // Αλλιώς ο δίσκος κάθεται πάνω στα `A B C` — δηλαδή το χειριστήριο σκεπάζει ακριβώς την
    // ένδειξη που εξηγεί ποια στήλη είναι ποια.
    expect(tableInsertControlOuterPx('table-mode').top).toBeGreaterThan(
      TABLE_INDICATOR_OUTER_PX.top,
    );
    expect(tableInsertControlOuterPx('table-mode').left).toBeGreaterThan(
      TABLE_INDICATOR_OUTER_PX.left,
    );
  });

  it('σε απλή επιλογή το ⊕ είναι πιο κοντά — εκεί δεν υπάρχει ζώνη να αποφύγει', () => {
    expect(tableInsertControlOuterPx('selection').top).toBeLessThan(
      tableInsertControlOuterPx('table-mode').top,
    );
  });

  it('🔴 το ⊕ της επιλογής δεν ακουμπά την οπή σύλληψης της λαβής', () => {
    // §27.11 — «ένα pixel, μία ερώτηση». Η εσωτερική ακμή του δίσκου πρέπει να μένει έξω από
    // την οπή, αλλιώς όποιος στοχεύει πλάτος στήλης εισάγει στήλη.
    const innerEdgePx =
      tableInsertControlOuterPx('selection').top - 2 * TABLE_INSERT_CONTROL_RADIUS_PX;
    expect(innerEdgePx).toBeGreaterThanOrEqual(0);
  });

  it('το ίδιο σημείο δίνει ΑΛΛΗ απάντηση στις δύο καταστάσεις', () => {
    const point = { u: 40, v: columnCenterV('table-mode') };
    expect(tableInsertControlAtFrame(LAYOUT, point, PX_PER_MM, 'table-mode')?.phase).toBe('armed');
    // Στην επιλογή, το ίδιο `v` είναι πολύ πιο έξω από τη λωρίδα ⇒ τίποτα.
    expect(tableInsertControlAtFrame(LAYOUT, point, PX_PER_MM, 'selection')).toBeNull();
  });
});

describe('§40 — LOD και εκφυλισμένες εισόδους', () => {
  it('κάτω από το κατώφλι ορατότητας δεν υπάρχει χειριστήριο', () => {
    // Ίδιο κατώφλι με τον δείκτη: ό,τι δεν ζωγραφίζεται δεν πιάνεται.
    const tiny = 0.1;
    expect(
      tableInsertControlAtFrame(LAYOUT, { u: 40, v: columnCenterV('selection') }, tiny, 'selection'),
    ).toBeNull();
  });

  it('μη πεπερασμένη κλίμακα ⇒ `null`, ποτέ NaN συντεταγμένες', () => {
    expect(
      tableInsertControlAtFrame(LAYOUT, { u: 40, v: -4 }, Number.NaN, 'selection'),
    ).toBeNull();
    expect(tableInsertControlAtFrame(LAYOUT, { u: 40, v: -4 }, 0, 'selection')).toBeNull();
  });

  it('πίνακας χωρίς γραμμές ή στήλες ⇒ κανένα σύνορο να προσφέρει', () => {
    const empty: TableLayout = { ...LAYOUT, columns: [], rows: [] };
    expect(
      tableInsertControlAtFrame(empty, { u: 40, v: columnCenterV('selection') }, PX_PER_MM, 'selection'),
    ).toBeNull();
  });
});

describe('§40 — ο φύλακας του καρέ', () => {
  const at = (u: number) =>
    tableInsertControlAtFrame(LAYOUT, { u, v: columnCenterV('selection') }, PX_PER_MM, 'selection');

  it('δύο σαρώσεις του ίδιου σημείου είναι «ίδιο» παρότι διαφορετικά αντικείμενα', () => {
    // Χωρίς σύγκριση κατά ταυτότητα, ο φύλακας θα ζητούσε καρέ σε κάθε pixel.
    expect(at(40)).not.toBe(at(40));
    expect(sameTableInsertControl(at(40), at(40))).toBe(true);
  });

  it('🔴 η αλλαγή ΦΑΣΗΣ μετρά ως αλλαγή — ίδιο σύνορο, άλλη όψη', () => {
    const armed = at(40);
    const nearby = at(30);
    expect(armed?.target.line).toBe(nearby?.target.line);
    expect(armed?.phase).not.toBe(nearby?.phase);
    // Αν ο φύλακας κοίταζε μόνο το σύνορο, θα κατάπινε ακριβώς την ανάδραση για την οποία
    // υπάρχουν οι δύο φάσεις.
    expect(sameTableInsertControl(armed, nearby)).toBe(false);
  });
});

describe('§40 — το SSoT των συνόρων εξυπηρετεί ΚΑΙ τους δύο καταναλωτές', () => {
  it('σπάει την ισοπαλία υπέρ του ΕΠΟΜΕΝΟΥ συνόρου, σταθερά', () => {
    // Στο ακριβές μέσο της γραμμής 1 (12→20, μέσο 16) τα δύο σύνορα απέχουν εξίσου.
    const nearest = nearestTableAxisBoundary(tableRowBoundaryView(LAYOUT), 16);
    expect(nearest.line).toBe(2);
    expect(nearest.atMm).toBe(20);
  });

  it('δίνει τη ΘΕΣΗ του συνόρου, ώστε ο ζωγράφος να μην ξαναψάξει', () => {
    const nearest = nearestTableAxisBoundary(tableColumnBoundaryView(LAYOUT), 79);
    expect(nearest.line).toBe(2);
    expect(nearest.atMm).toBe(80);
    expect(nearest.distanceMm).toBeCloseTo(1);
  });

  it('🔴 το ⊕ και η σύρση περιοχής διαλέγουν ΤΟ ΙΔΙΟ σύνορο στο ίδιο σημείο', () => {
    // Αυτός είναι ο λόγος που η αριθμητική εξήχθη σε κοινό module. Δύο αντίγραφα που σπάνε
    // αλλιώς την ισοπαλία θα ζωγράφιζαν σε άλλο σύνορο από εκείνο όπου προσγειώνεται η σύρση.
    const control = tableInsertControlAtFrame(
      LAYOUT,
      { u: 61, v: columnCenterV('selection') },
      PX_PER_MM,
      'selection',
    );
    const shared = nearestTableAxisBoundary(tableColumnBoundaryView(LAYOUT), 61);
    expect(control?.target.line).toBe(shared.line);
    expect(control?.boundaryMm).toBe(shared.atMm);
  });
});
