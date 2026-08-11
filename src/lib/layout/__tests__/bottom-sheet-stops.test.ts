/**
 * Άγκυρες του λεξιλογίου των στάσεων — **ονόματα και σειρά**, που είναι όλο του το
 * περιεχόμενο (ADR-777 Α3 · SPEC-777D §26.3 κανόνας 1).
 *
 * 🔑 Δεν υπάρχει test «η ματιά είναι 30%» και **δεν πρέπει να γραφτεί**: το ποσοστό ζει
 * στο `ResultsSheet.module.css` και ένα test εδώ θα το αντέγραφε, δηλαδή θα γεννούσε
 * ακριβώς τη δεύτερη αλήθεια που ο σχεδιασμός απέφυγε.
 */

import {
  BOTTOM_SHEET_DISMISS_STOP,
  BOTTOM_SHEET_RESTING_STOP,
  BOTTOM_SHEET_STOPS,
  BOTTOM_SHEET_STOP_ATTRIBUTE,
  stepStop,
  stopAnchorSelector,
} from '../bottom-sheet-stops';

describe('bottom-sheet-stops — το λεξιλόγιο των τριών στάσεων', () => {
  it('Κ1: είναι ΤΡΕΙΣ, όχι δύο — ο κανόνας 1 του §26.3 σε κώδικα', () => {
    expect(BOTTOM_SHEET_STOPS).toEqual(['peek', 'half', 'full']);
  });

  it('Κ2: η στάση ηρεμίας είναι η ΠΡΩΤΗ — δηλαδή το `scrollTop = 0` του δοχείου', () => {
    // Αν η ηρεμία δεν ήταν η πρώτη, το φύλλο θα χρειαζόταν αρχική κύλιση στο πρώτο καρέ:
    // μετατόπιση διάταξης που η Α19 (CLS < 0,1) απαγορεύει.
    expect(BOTTOM_SHEET_STOPS[0]).toBe(BOTTOM_SHEET_RESTING_STOP);
  });

  it('Κ3: «κλείσιμο» ΕΙΝΑΙ η ηρεμία — η λίστα δεν εξαφανίζεται ποτέ (Α5, κανόνας 27)', () => {
    expect(BOTTOM_SHEET_DISMISS_STOP).toBe(BOTTOM_SHEET_RESTING_STOP);
  });

  it('Κ4: το βήμα σέβεται τη σειρά και ΔΕΝ είναι κυκλικό', () => {
    expect(stepStop('peek', 1)).toBe('half');
    expect(stepStop('half', 1)).toBe('full');
    expect(stepStop('full', -1)).toBe('half');
    expect(stepStop('half', -1)).toBe('peek');
  });

  it('Κ5: στα άκρα απαντά `null` — το κουμπί απενεργοποιείται αντί να πει ψέματα', () => {
    expect(stepStop('full', 1)).toBeNull();
    expect(stepStop('peek', -1)).toBeNull();
  });

  it('Κ6: ο επιλογέας άγκυρας χτίζεται από ΤΟ ΙΔΙΟ γνώρισμα που γράφει το component', () => {
    // Ένα δεύτερο κυριολεκτικό `data-…` σε ένα από τα δύο σημεία θα έκανε τον ελεγκτή να
    // μη βρίσκει καμία άγκυρα — και το φύλλο θα είχε μία στάση, φαινομενικά σωστό.
    expect(stopAnchorSelector('half')).toBe(`[${BOTTOM_SHEET_STOP_ATTRIBUTE}="half"]`);
  });
});
