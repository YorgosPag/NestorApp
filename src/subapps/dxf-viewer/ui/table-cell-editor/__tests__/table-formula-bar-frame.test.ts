/**
 * ADR-739 Φ.Δ βήμα 7 — το **κουτί** της γραμμής τύπων: πλάτος, ύψος, μετατοπίσεις.
 *
 * Οι μετατοπίσεις είναι ο λόγος που το κουτί δεν μπορεί να εκφραστεί ως σημείο κόσμου: οι
 * ζώνες δείκτη έχουν σταθερό πάχος σε **px οθόνης**, άρα η απόσταση της γραμμής από τη
 * γωνία του πίνακα αλλάζει σε κάθε zoom. Αυτό το test κλειδώνει ακριβώς αυτό.
 */

import { computeTableFormulaBarFrame } from '../table-formula-bar-frame';
import { TABLE_INDICATOR_OUTER_PX } from '../../../bim/table/table-indicator-geometry';
import { tableInsertControlOuterPx } from '../../../bim/table/table-insert-control';

describe('computeTableFormulaBarFrame', () => {
  it('η γραμμή απλώνεται όσο ο πίνακας ΣΥΝ τη ζώνη αριθμών', () => {
    // Ξεκινά από την αριστερή ακμή της ζώνης `1 2 3`, όπως το πλαίσιο ονόματος του Excel
    // κάθεται πάνω από τη στήλη των αριθμών γραμμής.
    const frame = computeTableFormulaBarFrame({ tableWidthMm: 100, tableHeightMm: 40, pxPerMm: 4, spaceAbovePx: 999 });
    expect(frame.widthPx).toBe(400 + TABLE_INDICATOR_OUTER_PX.left);
  });

  it('στενός πίνακας ⇒ ελάχιστο πλάτος, ΠΛΑΤΥΤΕΡΟ από τον πίνακα', () => {
    // Σωστά: η γραμμή υπάρχει για να δείχνει ό,τι στο κελί **δεν χωρά**.
    const narrow = computeTableFormulaBarFrame({ tableWidthMm: 10, tableHeightMm: 40, pxPerMm: 1, spaceAbovePx: 999 });
    const alsoNarrow = computeTableFormulaBarFrame({ tableWidthMm: 1, tableHeightMm: 40, pxPerMm: 1, spaceAbovePx: 999 });
    expect(narrow.widthPx).toBe(alsoNarrow.widthPx);
    expect(narrow.widthPx).toBeGreaterThan(10);
  });

  it('τεράστιος πίνακας σε zoom-in ΔΕΝ διασχίζει την οθόνη', () => {
    const huge = computeTableFormulaBarFrame({ tableWidthMm: 5000, tableHeightMm: 40, pxPerMm: 10, spaceAbovePx: 999 });
    expect(huge.widthPx).toBeLessThanOrEqual(720);
  });

  it('🔴 §27.13 Η ΚΑΤΩ ΑΚΜΗ της γραμμής μένει ΠΑΝΩ από τον δείκτη — όχι «κάπου πιο ψηλά»', () => {
    const frame = computeTableFormulaBarFrame({ tableWidthMm: 100, tableHeightMm: 40, pxPerMm: 4, spaceAbovePx: 999 });

    // ⚠️ Εδώ έγραφε `offsetYPx < -(columnBandPx + heightPx)` — **γνήσια ανισότητα σε λάθος
    // ποσότητα**. Έμενε αληθής όταν ο δείκτης απέκτησε κενό και η γραμμή δεν ακολούθησε,
    // δηλαδή ήταν πράσινη ενώ η γραμμή **σκέπαζε** τα γράμματα (ο Giorgio το είδε στην
    // οθόνη· κανένα test δεν το είπε). Η σωστή ερώτηση δεν είναι «πόσο ψηλά;» αλλά **«πού
    // τελειώνει η γραμμή σε σχέση με το πού αρχίζει ο δείκτης;»**.
    const barBottomPx = frame.offsetYPx + frame.heightPx;
    expect(barBottomPx).toBeLessThanOrEqual(-TABLE_INDICATOR_OUTER_PX.top);

    // Αριστερή ευθυγράμμιση: ακριβώς πάνω στην αριστερή ακμή της ζώνης αριθμών.
    expect(frame.offsetXPx).toBe(-TABLE_INDICATOR_OUTER_PX.left);
  });

  it('🔴 §40 ΤΟ ΙΔΙΟ, ΓΙΑ ΤΟΝ ΔΕΥΤΕΡΟ ΕΝΟΙΚΟ: η γραμμή δεν σκεπάζει το ⊕ της εισαγωγής', () => {
    // ⚠️ Ο έλεγχος από πάνω ήταν **πράσινος** τη στιγμή που γεννήθηκε το ⊕, και παρέμενε
    // πράσινος ενώ η γραμμή τύπων καθόταν ακριβώς πάνω του: ρωτά για τη **ζώνη**, και η ζώνη
    // δεν μετακινήθηκε. Δηλαδή το §27.13 θα επαναλαμβανόταν αυτούσιο — ίδιο σχήμα, άλλος
    // ένοικος, ίδιο τυφλό test. Αυτό εδώ είναι η ερώτηση που λείπει: **πού τελειώνει η γραμμή
    // σε σχέση με το πού αρχίζει ΟΤΙΔΗΠΟΤΕ κάθεται έξω από το πλέγμα;**
    const frame = computeTableFormulaBarFrame({ tableWidthMm: 100, tableHeightMm: 40, pxPerMm: 4, spaceAbovePx: 999 });
    const barBottomPx = frame.offsetYPx + frame.heightPx;
    expect(barBottomPx).toBeLessThanOrEqual(-tableInsertControlOuterPx('table-mode').top);
  });

  it('🔴 §40 το «χρειάζεται χώρο από πάνω» μετρά ΚΑΙ το ⊕ — αλλιώς δεν αναποδογυρίζει ποτέ', () => {
    // Ο χώρος αρκεί για γραμμή + ζώνη, αλλά **όχι** για το ⊕ από πάνω τους. Πριν το §40 η
    // γραμμή θα έμενε πάνω και θα κατάπινε το χειριστήριο σιωπηλά.
    const tight = TABLE_INDICATOR_OUTER_PX.top + 4 + 22;
    const frame = computeTableFormulaBarFrame({
      tableWidthMm: 100, tableHeightMm: 40, pxPerMm: 4, spaceAbovePx: tight,
    });
    expect(frame.flipped).toBe(true);
  });

  it('οι μετατοπίσεις ΔΕΝ εξαρτώνται από το zoom — οι ζώνες είναι σταθερές σε px', () => {
    const near = computeTableFormulaBarFrame({ tableWidthMm: 100, tableHeightMm: 40, pxPerMm: 0.5, spaceAbovePx: 999 });
    const far = computeTableFormulaBarFrame({ tableWidthMm: 100, tableHeightMm: 40, pxPerMm: 40, spaceAbovePx: 999 });
    expect(near.offsetYPx).toBe(far.offsetYPx);
    expect(near.offsetXPx).toBe(far.offsetXPx);
  });

  describe('🔴 αναποδογύρισμα — βρέθηκε ΖΩΝΤΑΝΑ, όχι σε test (2026-08-01)', () => {
    const near = (spaceAbovePx: number | null): ReturnType<typeof computeTableFormulaBarFrame> =>
      computeTableFormulaBarFrame({ tableWidthMm: 100, tableHeightMm: 40, pxPerMm: 4, spaceAbovePx });

    it('πίνακας κοντά στο πάνω χείλος ⇒ η γραμμή πάει ΚΑΤΩ από αυτόν', () => {
      // Χωρίς αυτό, η γραμμή καθόταν πάνω στην κορδέλα της εφαρμογής: το clamping του
      // `TextEditorAnchorLayer` περιορίζει στο **παράθυρο**, και η θέση ήταν έγκυρη εκεί —
      // απλώς όχι μέσα στην περιοχή σχεδίασης.
      const frame = near(10);
      expect(frame.flipped).toBe(true);
      expect(frame.offsetYPx).toBeGreaterThan(40 * 4);
    });

    it('με άπλετο χώρο μένει πάνω — το αναποδογύρισμα είναι έσχατη λύση, όχι προεπιλογή', () => {
      expect(near(400).flipped).toBe(false);
      expect(near(400).offsetYPx).toBeLessThan(0);
    });

    it('όταν ο χώρος ΔΕΝ μπορεί να μετρηθεί, καμία υπόθεση', () => {
      // `null` = ο container δεν έχει προσαρτηθεί. Ένα αναποδογύρισμα «για καλό και για
      // κακό» θα πετούσε τη γραμμή κάτω από τον πίνακα σε κάθε πρώτη απόδοση.
      expect(near(null).flipped).toBe(false);
    });
  });

  it.each([0, -1, NaN, Infinity])('εκφυλισμένη κλίμακα %p ⇒ ποτέ NaN σε CSS', (pxPerMm) => {
    const frame = computeTableFormulaBarFrame({ tableWidthMm: 100, tableHeightMm: 40, pxPerMm, spaceAbovePx: 999 });
    expect(Number.isFinite(frame.widthPx)).toBe(true);
    expect(frame.widthPx).toBeGreaterThan(0);
  });
});
