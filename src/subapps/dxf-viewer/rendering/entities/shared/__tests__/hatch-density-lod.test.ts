/**
 * ADR-667 Φ3.2 — **το ζευγάρι κατωφλιών density-LOD είναι ασύμμετρο ΕΠΙΤΗΔΕΣ.**
 *
 * Οθόνη = **AutoCAD parity** (ζωγράφισε κάθε γραμμή σε κάθε zoom· ο χρήστης πλησιάζει και διαβάζει).
 * Χαρτί = **ISO 128-2** (μία, τελική κλίμακα· κάτω από 0,8 mm το μοτίβο βγαίνει μαύρη μάζα).
 *
 * ## 🔴 Γιατί υπάρχει αυτό το αρχείο
 *
 * Ο πυρήνας (`isHatchDensityTooHigh`) είναι **κοινός** — αυτό είναι σωστό (ένα ερώτημα, δύο μέτρα).
 * Ο κίνδυνος είναι ότι κάποιος θα δει «δύο wrappers, ένας γυρίζει πάντα false» και θα «τακτοποιήσει»
 * τα κατώφλια πίσω σε ένα. Τότε **είτε** επιστρέφουν τα 44/49 αόρατα hatches του Giorgio (2026-07-28)
 * **είτε** επιστρέφει η μαύρη μάζα του PDF (ADR-667 Φ3.1). Η ασυμμετρία **είναι η προδιαγραφή** —
 * αυτά τα tests την κάνουν εκτελέσιμη αντί για σχόλιο.
 *
 * @see rendering/entities/shared/hatch-density-lod.ts
 * @see docs/centralized-systems/reference/adrs/ADR-667-pdf-native-tiling-patterns.md — Απόφαση 7
 */

import type { HatchEntity } from '../../../../types/entities';
import {
  HATCH_MIN_LINE_SPACING_PX,
  HATCH_MIN_LINE_SPACING_PAPER_MM,
  isHatchDensityTooHighOnScreen,
  isHatchDensityTooHighOnPaper,
} from '../hatch-density-lod';

/**
 * Γραμμοσκίαση με **ρητή** απόσταση γραμμών σε world units, μέσω user-defined `lineSpacing`
 * (το `hatchMinWorldSpacing` το επιστρέφει αυτούσιο — καμία εξάρτηση από catalog/PAT μαθηματικά).
 */
function hatchWithSpacing(spacingWorld: number): HatchEntity {
  return {
    fillType: 'user-defined',
    patternType: 'pattern',
    lineSpacing: spacingWorld,
  } as HatchEntity;
}

/** Solid = καμία γραμμή ⇒ τίποτα να καταρρεύσει, σε κανένα μέσο. */
function solidHatch(): HatchEntity {
  return { fillType: 'solid', patternType: 'solid' } as HatchEntity;
}

describe('ADR-667 Φ3.2 — density-LOD οθόνης: AutoCAD parity (ποτέ collapse)', () => {
  it('το κατώφλι οθόνης είναι 0 = ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ', () => {
    // Αν αυτό γίνει > 0, οι γραμμοσκιάσεις ξαναχάνονται σε zoom-out. Συνειδητή απόφαση Giorgio.
    expect(HATCH_MIN_LINE_SPACING_PX).toBe(0);
  });

  it('ΔΕΝ καταρρέει στο πραγματικό zoom του περιστατικού (0,29 px απόσταση)', () => {
    // Το μετρημένο σενάριο: ANSI31 spacing 140 mm world, «όλο το σχέδιο» ⇒ 0,00204 px/mm.
    // Με το παλιό κατώφλι (3 px) αυτό κατέρρεε ⇒ 44/49 γραμμοσκιάσεις αόρατες.
    expect(isHatchDensityTooHighOnScreen(hatchWithSpacing(140), 0.00204)).toBe(false);
  });

  it('ΔΕΝ καταρρέει ούτε σε ακραίο zoom-out (sub-milli-pixel)', () => {
    expect(isHatchDensityTooHighOnScreen(hatchWithSpacing(0.001), 1e-6)).toBe(false);
  });

  it('ΔΕΝ καταρρέει σε κανονικό zoom (η αναμενόμενη περίπτωση)', () => {
    expect(isHatchDensityTooHighOnScreen(hatchWithSpacing(100), 0.5)).toBe(false);
  });

  it('solid ⇒ false (καμία γραμμή να καταρρεύσει)', () => {
    expect(isHatchDensityTooHighOnScreen(solidHatch(), 0.00204)).toBe(false);
  });
});

describe('ADR-667 Φ3.1 — density-LOD χαρτιού: ΠΑΡΑΜΕΝΕΙ ενεργό (ISO 128-2)', () => {
  it('το κατώφλι χαρτιού ΔΕΝ ακολούθησε την οθόνη στο 0', () => {
    // Το δάπεδο του ISO 128-2 είναι 0,7 mm· το 0,8 το σέβεται. ΔΕΝ είναι προτίμηση — είναι πρότυπο.
    expect(HATCH_MIN_LINE_SPACING_PAPER_MM).toBe(0.8);
    expect(HATCH_MIN_LINE_SPACING_PAPER_MM).toBeGreaterThan(0);
  });

  it('καταρρέει στο μετρημένο περιστατικό του PDF (0,089 mm ⇒ ~200% κάλυψη μελανιού)', () => {
    // 89 mm world × 0,001 mm/world = 0,089 mm στο χαρτί — 8× κάτω από το όριο του ISO.
    expect(isHatchDensityTooHighOnPaper(hatchWithSpacing(89), 0.001)).toBe(true);
  });

  it('ΔΕΝ καταρρέει όταν το μοτίβο είναι αναγνώσιμο στο χαρτί (2 mm)', () => {
    expect(isHatchDensityTooHighOnPaper(hatchWithSpacing(2000), 0.001)).toBe(false);
  });

  it('solid ⇒ false και στο χαρτί', () => {
    expect(isHatchDensityTooHighOnPaper(solidHatch(), 0.001)).toBe(false);
  });
});

describe('η ασυμμετρία οθόνη↔χαρτί είναι η προδιαγραφή, όχι παράβλεψη', () => {
  it('ΙΔΙΑ γραμμοσκίαση, ΙΔΙΑ πυκνότητα: το χαρτί την κόβει, η οθόνη όχι', () => {
    const hatch = hatchWithSpacing(89);
    // Η ίδια φυσική πυκνότητα, μετρημένη με τα δύο μέτρα του κάθε μέσου.
    expect(isHatchDensityTooHighOnPaper(hatch, 0.001)).toBe(true);   // 0,089 mm στο χαρτί
    expect(isHatchDensityTooHighOnScreen(hatch, 0.001)).toBe(false); // 0,089 px στην οθόνη
  });
});
