/**
 * 🔴 ADR-739 §35 — **η ζώνη του περιγράμματος**: πού τελειώνει το «μέσα στο κελί» και πού
 * αρχίζει το «πάνω στη γραμμή».
 *
 * Το ουσιώδες test αυτής της σουίτας δεν είναι κανένα από τα αριθμητικά: είναι το
 * «**το εσωτερικό δεν εξαφανίζεται ποτέ**». Η ζώνη είναι σταθερή σε px οθόνης ενώ το
 * ορθογώνιο ζει σε sheet-mm, άρα σε zoom-out η ζώνη μεγαλώνει *σχετικά* — και χωρίς φράγμα
 * θα κατάπινε ολόκληρη την επιλογή, κάνοντας απλησίαστη ακριβώς τη μία από τις δύο
 * καταστάσεις που ζητήθηκαν. Ένα test που περνά μόνο στο 100% zoom δεν αποδεικνύει τίποτα.
 */

import {
  isOnTableRangeBorder,
  signedDistanceToRectOutlineMm,
  tableRangeBorderInsideReachMm,
  tableRangeDragIntentOf,
  MAX_INSIDE_REACH_FRACTION,
  PLAIN_TABLE_RANGE_DRAG,
} from '../table-range-move-zone';
import { tableIndicatorBandsMm, tableIndicatorCursorRoleAtFrame } from '../table-indicator-geometry';
import type { TableLayout, TableRectMm } from '../table-layout-types';

/** Ένα άνετο ορθογώνιο: 40×20 mm, ώστε το φράγμα του ¼ να μη δεσμεύει στις προεπιλογές. */
const RECT: TableRectMm = { x: 10, y: 10, w: 40, h: 20 };

describe('🔴 §35 signedDistanceToRectOutlineMm — αρνητική ΜΕΣΑ, μηδέν ΠΑΝΩ, θετική ΕΞΩ', () => {
  it('το κέντρο απέχει όσο το μισό της ΜΙΚΡΟΤΕΡΗΣ πλευράς, με αρνητικό πρόσημο', () => {
    // Η πλησιέστερη πλευρά είναι η οριζόντια (ύψος 20 ⇒ 10 mm), όχι η κατακόρυφη (20 mm).
    expect(signedDistanceToRectOutlineMm(RECT, 30, 20)).toBeCloseTo(-10);
  });

  it('πάνω ΑΚΡΙΒΩΣ στη γραμμή ⇒ μηδέν, και από τις τέσσερις πλευρές', () => {
    expect(signedDistanceToRectOutlineMm(RECT, 30, 10)).toBeCloseTo(0);
    expect(signedDistanceToRectOutlineMm(RECT, 30, 30)).toBeCloseTo(0);
    expect(signedDistanceToRectOutlineMm(RECT, 10, 20)).toBeCloseTo(0);
    expect(signedDistanceToRectOutlineMm(RECT, 50, 20)).toBeCloseTo(0);
  });

  it('🔴 έξω από ΓΩΝΙΑ μετρά ΕΥΚΛΕΙΔΕΙΑ — αλλιώς οι γωνίες θα είχαν τετράγωνη αύρα', () => {
    // 3-4-5: 3 mm αριστερά και 4 mm πάνω από την πάνω-αριστερή γωνία ⇒ 5 mm, όχι 4.
    expect(signedDistanceToRectOutlineMm(RECT, 7, 6)).toBeCloseTo(5);
    // Ο αντίποδας: μια μετρική Chebyshev θα έδινε 4 εδώ. Αν αυτό σπάσει, η ζώνη έγινε
    // τετράγωνη και οι γωνίες πιάνουν αισθητά μακρύτερα από τις πλευρές.
    expect(signedDistanceToRectOutlineMm(RECT, 7, 6)).not.toBeCloseTo(4);
  });

  it('έξω κατά ΕΝΑΝ άξονα ⇒ η απόσταση είναι η κάθετη στην πλευρά', () => {
    expect(signedDistanceToRectOutlineMm(RECT, 30, 6)).toBeCloseTo(4);
    expect(signedDistanceToRectOutlineMm(RECT, 55, 20)).toBeCloseTo(5);
  });
});

describe('🔴 §35 tableRangeBorderInsideReachMm — ΤΟ ΕΣΩΤΕΡΙΚΟ ΔΕΝ ΕΞΑΦΑΝΙΖΕΤΑΙ ΠΟΤΕ', () => {
  it('σε άνετο ορθογώνιο η εμβέλεια είναι ΟΛΗ η οπή — το φράγμα δεν δεσμεύει', () => {
    // Μικρότερη πλευρά 20 mm ⇒ φράγμα 5 mm· η οπή (2 mm) είναι μικρότερη, άρα περνά αυτούσια.
    expect(tableRangeBorderInsideReachMm(RECT, 2)).toBeCloseTo(2);
  });

  it('🔴 ΤΟ ΟΥΣΙΩΔΕΣ: σε στενό ορθογώνιο η οπή ΦΡΑΣΣΕΤΑΙ στο ¼ της μικρότερης πλευράς', () => {
    // Το σχήμα του zoom-out: κελί ύψους 4 mm με οπή 9 mm. Χωρίς φράγμα, η ζώνη θα έφτανε
    // 9 mm προς τα μέσα σε ορθογώνιο ύψους 4 — δηλαδή **ολόκληρο** το κελί θα ήταν
    // «περίγραμμα» και το `cell-select` δεν θα υπήρχε πουθενά.
    const narrow: TableRectMm = { x: 0, y: 0, w: 40, h: 4 };
    expect(tableRangeBorderInsideReachMm(narrow, 9)).toBeCloseTo(4 * MAX_INSIDE_REACH_FRACTION);
    // Και η συνέπεια που πράγματι μετρά: μένει συνεκτικό εσωτερικό στο μέσο.
    expect(isOnTableRangeBorder(narrow, { u: 20, v: 2 }, 9)).toBe(false);
  });

  it('εκφυλισμένο ορθογώνιο ή μη θετική οπή ⇒ καμία ζώνη, ποτέ υπόσχεση χωρίς αντίκρισμα', () => {
    expect(tableRangeBorderInsideReachMm({ x: 0, y: 0, w: 0, h: 0 }, 9)).toBe(0);
    expect(tableRangeBorderInsideReachMm(RECT, 0)).toBe(0);
    expect(isOnTableRangeBorder(RECT, { u: 30, v: 10 }, 0)).toBe(false);
  });
});

describe('🔴 §35 isOnTableRangeBorder — η ζώνη διαστέλλεται ΕΚΑΤΕΡΩΘΕΝ της γραμμής', () => {
  const APERTURE = 2;

  it('πιάνεται και από ΕΞΩ και από ΜΕΣΑ — το χέρι πλησιάζει και από τις δύο μεριές', () => {
    expect(isOnTableRangeBorder(RECT, { u: 30, v: 10 }, APERTURE)).toBe(true);
    expect(isOnTableRangeBorder(RECT, { u: 30, v: 10 - APERTURE }, APERTURE)).toBe(true);
    expect(isOnTableRangeBorder(RECT, { u: 30, v: 10 + APERTURE }, APERTURE)).toBe(true);
  });

  it('ένα χιλιοστό πιο πέρα ⇒ τέλος, και στις δύο κατευθύνσεις', () => {
    expect(isOnTableRangeBorder(RECT, { u: 30, v: 10 - APERTURE - 0.01 }, APERTURE)).toBe(false);
    expect(isOnTableRangeBorder(RECT, { u: 30, v: 10 + APERTURE + 0.01 }, APERTURE)).toBe(false);
  });

  it('το ΣΩΜΑ της επιλογής μένει σώμα — αλλιώς δεν θα μπορούσες ποτέ να διαλέξεις κελί', () => {
    expect(isOnTableRangeBorder(RECT, { u: 30, v: 20 }, APERTURE)).toBe(false);
  });

  it('🔴 ΟΙ ΔΥΟ ΕΜΒΕΛΕΙΕΣ ΕΙΝΑΙ ΑΣΥΜΜΕΤΡΕΣ ΟΤΑΝ ΤΟ ΦΡΑΓΜΑ ΔΕΣΜΕΥΕΙ — και είναι σκόπιμο', () => {
    // Προς τα έξω δεν υπάρχει τίποτα να καταπιεί (τα γειτονικά κελιά έχουν ολόκληρο το σώμα
    // τους)· προς τα μέσα υπάρχει. Ασύμμετρο πρόβλημα, ασύμμετρη θεραπεία.
    const narrow: TableRectMm = { x: 0, y: 0, w: 40, h: 4 };
    // Έξω: ολόκληρη η οπή των 9 mm.
    expect(isOnTableRangeBorder(narrow, { u: 20, v: -8 }, 9)).toBe(true);
    // Μέσα: μόνο 1 mm (= ¼ × 4).
    expect(isOnTableRangeBorder(narrow, { u: 20, v: 1.5 }, 9)).toBe(false);
  });
});

describe('🔴 §35 tableRangeDragIntentOf — ΔΥΟ ανεξάρτητες ερωτήσεις, όχι τέσσερις καταστάσεις', () => {
  it('χωρίς πλήκτρα ⇒ η ΣΤΑΘΕΡΗ αναφορά· καμία κατανομή ανά κίνηση ποντικιού', () => {
    expect(tableRangeDragIntentOf({ ctrlKey: false, shiftKey: false }))
      .toBe(PLAIN_TABLE_RANGE_DRAG);
  });

  it('Ctrl ⇒ αντιγραφή· Shift ⇒ εισαγωγή· ΚΑΙ ΤΑ ΔΥΟ ⇒ και τα δύο (υπαρκτή πράξη Excel)', () => {
    expect(tableRangeDragIntentOf({ ctrlKey: true, shiftKey: false }))
      .toEqual({ copy: true, insert: false });
    expect(tableRangeDragIntentOf({ ctrlKey: false, shiftKey: true }))
      .toEqual({ copy: false, insert: true });
    expect(tableRangeDragIntentOf({ ctrlKey: true, shiftKey: true }))
      .toEqual({ copy: true, insert: true });
  });

  it('🔴 το Cmd μετρά ως Ctrl — αλλιώς η αντιγραφή είναι ΑΔΥΝΑΤΗ σε macOS', () => {
    // Εκεί το `Ctrl+σύρσιμο` το καταναλώνει το λειτουργικό ως δευτερεύον κλικ και δεν φτάνει
    // ποτέ. Το σύμπτωμα θα ήταν «λείπει λειτουργία», όχι «σφάλμα» — δηλαδή δεν θα το έβρισκε
    // κανείς ψάχνοντας για bug.
    expect(tableRangeDragIntentOf({ ctrlKey: false, metaKey: true, shiftKey: false }))
      .toEqual({ copy: true, insert: false });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Η ένωση με τον δείκτη — §31 συνάντησε §35
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 §35 ο ρόλος δείκτη πάνω από επιλογή — Η ΣΕΙΡΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ', () => {
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
  const BANDS = tableIndicatorBandsMm(4);
  /** Η επιλογή `c1` × `r1..r2`, μακριά και από τις ζώνες και από τα όρια στηλών. */
  const SELECTION: TableRectMm = { x: 40, y: 12, w: 40, h: 16 };
  const role = (u: number, v: number, rect: TableRectMm | null = SELECTION, copy = false) =>
    tableIndicatorCursorRoleAtFrame(LAYOUT, { u, v }, BANDS, rect, { copy, insert: false });

  it('πάνω στο περίγραμμα της επιλογής ⇒ μετακίνηση', () => {
    expect(role(60, 12)).toBe('range-move');
    expect(role(60, 28)).toBe('range-move');
  });

  it('με Ctrl το ίδιο σημείο ⇒ αντιγραφή — η πρόθεση αλλάζει την υπόσχεση', () => {
    expect(role(60, 12, SELECTION, true)).toBe('range-copy');
  });

  it('στο σώμα της επιλογής ⇒ σταυρός κελιού, όχι μετακίνηση', () => {
    expect(role(60, 20)).toBe('cell-select');
  });

  it('χωρίς επιλογή δεν υπάρχει περίγραμμα να πιαστεί ⇒ παντού σταυρός κελιού', () => {
    expect(role(60, 12, null)).toBe('cell-select');
  });

  it('🔴 §27.11 Η ΖΩΝΗ ΔΕΝ ΔΙΑΡΡΕΕΙ ΣΕ ΑΡΝΗΤΙΚΑ mm — εκεί ζουν οι ΛΑΒΕΣ', () => {
    // Επιλογή που ακουμπά την πάνω γραμμή: η εξωτερική εμβέλεια θα ήθελε να βγει σε `v < 0`,
    // όπου κάθονται η λαβή `n` και η ζώνη των γραμμάτων. Αν αυτό σπάσει, ένα pixel απαντά
    // ξανά σε δύο ερωτήσεις — ακριβώς το σφάλμα που το κενό του §27.11 ήρθε να σβήσει.
    const touchingTop: TableRectMm = { x: 40, y: 0, w: 40, h: 12 };
    expect(role(60, -BANDS.gapMm / 2, touchingTop)).not.toBe('range-move');
    expect(role(60, -BANDS.gapMm / 2, touchingTop)).not.toBe('cell-select');
  });

  it('🔴 ΟΠΟΥ ΣΥΓΚΡΟΥΟΝΤΑΙ, το ΔΙΑΧΩΡΙΣΤΙΚΟ ΣΤΗΛΩΝ νικά — η πιο ειδική ερώτηση πρώτη', () => {
    // ⚠️ Η ΠΡΩΤΗ ΕΚΔΟΧΗ ΑΥΤΟΥ ΤΟΥ TEST ΕΠΕΣΕ, ΚΑΙ ΤΟ ΛΑΘΟΣ ΗΤΑΝ ΣΤΗΝ ΥΠΟΘΕΣΗ ΟΧΙ ΣΤΟΝ ΚΩΔΙΚΑ:
    // ρωτούσε στο `u = 40` αλλά **βαθιά** μέσα στο πλέγμα, νομίζοντας ότι το διαχωριστικό
    // πιάνεται σε όλο το ύψος. Δεν πιάνεται: το `tableColumnEdgeAtFrame` περιορίζεται ρητά σε
    // `v ≤ gapMm` (§31.9), δηλαδή ζει **μόνο** γύρω από την πάνω ακμή. Άρα η σύγκρουση
    // υπάρχει μόνο εκεί — και εκεί ακριβώς πρέπει να μετρηθεί.
    const touchingTop: TableRectMm = { x: 40, y: 0, w: 40, h: 12 };
    // Το αριστερό περίγραμμα της επιλογής πέφτει στο `u = 40`, που είναι **ταυτόχρονα** το
    // εσωτερικό όριο στηλών `c0|c1`. Δύο υποψήφιοι στο ίδιο pixel: νικά το σύρσιμο πλάτους,
    // γιατί είναι ο μόνος τρόπος να το φτάσεις — το περίγραμμα πιάνεται και από τις άλλες
    // τρεις πλευρές του, η λαβή πλάτους δεν έχει δεύτερο δρόμο (§31.8).
    expect(role(40, BANDS.gapMm / 2, touchingTop)).toBe('column-resize');
    // Και το συμπλήρωμα — **αυτό** είναι που κάνει τη σειρά ασφαλή αντί για απώλεια: ένα
    // χιλιοστό πιο κάτω, όπου το διαχωριστικό δεν διεκδικεί πια, το περίγραμμα επανέρχεται.
    expect(role(40, BANDS.gapMm * 2, touchingTop)).toBe('range-move');
  });
});
