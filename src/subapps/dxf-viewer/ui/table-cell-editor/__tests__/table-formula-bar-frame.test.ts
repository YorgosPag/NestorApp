/**
 * ADR-739 Φ.Δ βήμα 7 — το **κουτί** της γραμμής τύπων: πλάτος, ύψος, μετατοπίσεις.
 *
 * Οι μετατοπίσεις είναι ο λόγος που το κουτί δεν μπορεί να εκφραστεί ως σημείο κόσμου: οι
 * ζώνες δείκτη έχουν σταθερό πάχος σε **px οθόνης**, άρα η απόσταση της γραμμής από τη
 * γωνία του πίνακα αλλάζει σε κάθε zoom. Αυτό το test κλειδώνει ακριβώς αυτό.
 */

import { computeTableFormulaBarFrame } from '../table-formula-bar-frame';
import { TABLE_INDICATOR } from '../../../config/color-config';

describe('computeTableFormulaBarFrame', () => {
  it('η γραμμή απλώνεται όσο ο πίνακας ΣΥΝ τη ζώνη αριθμών', () => {
    // Ξεκινά από την αριστερή ακμή της ζώνης `1 2 3`, όπως το πλαίσιο ονόματος του Excel
    // κάθεται πάνω από τη στήλη των αριθμών γραμμής.
    const frame = computeTableFormulaBarFrame({ tableWidthMm: 100, tableHeightMm: 40, pxPerMm: 4, spaceAbovePx: 999 });
    expect(frame.widthPx).toBe(400 + TABLE_INDICATOR.rowBandPx);
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

  it('🔴 η μετατόπιση ανεβάζει τη γραμμή ΠΑΝΩ από τη ζώνη γραμμάτων', () => {
    const frame = computeTableFormulaBarFrame({ tableWidthMm: 100, tableHeightMm: 40, pxPerMm: 4, spaceAbovePx: 999 });
    // Αρνητικό y = προς τα πάνω· το μέτρο πρέπει να ξεπερνά τη ζώνη ΚΑΙ το ύψος της ίδιας
    // της γραμμής, αλλιώς η γραμμή θα καθόταν πάνω στα γράμματα.
    expect(frame.offsetYPx).toBeLessThan(-(TABLE_INDICATOR.columnBandPx + frame.heightPx));
    expect(frame.offsetXPx).toBe(-TABLE_INDICATOR.rowBandPx);
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
