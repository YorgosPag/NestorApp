/**
 * Η απόφαση «ποια ενότητα είναι η τρέχουσα» (ADR-907 Φ2β-1) — καθαρή, άρα δοκιμάσιμη χωρίς διάταξη.
 */

import { activeSectionOf } from '../active-section';

describe('activeSectionOf', () => {
  it('καμία ενότητα ⇒ -1', () => {
    expect(activeSectionOf({ tops: [], line: 100, atEnd: false })).toBe(-1);
  });

  it('κορυφή σελίδας (καμία δεν πέρασε τη γραμμή) ⇒ η πρώτη· η μπάρα δεν μένει χωρίς τρέχουσα', () => {
    expect(activeSectionOf({ tops: [240, 900, 1600], line: 72, atEnd: false })).toBe(0);
  });

  it('η τελευταία που άρχισε πάνω από τη γραμμή', () => {
    expect(activeSectionOf({ tops: [-800, -40, 500], line: 72, atEnd: false })).toBe(1);
  });

  it('🔴 ενότητα που σταμάτησε ακριβώς στο `scroll-mt` (κάτω από τη μπάρα) μετρά ως τρέχουσα', () => {
    // Μετά από πάτημα συνδέσμου η κορυφή κάθεται στα 64px· η γραμμή είναι στα 68–72px.
    expect(activeSectionOf({ tops: [-900, 64, 700], line: 68, atEnd: false })).toBe(1);
  });

  it('🔴 άλμα που προσπερνά ενότητες (End, άγκυρα) δίνει τη σωστή, όχι την προηγούμενη', () => {
    expect(activeSectionOf({ tops: [-3000, -2200, -1400, -600, 30], line: 72, atEnd: false })).toBe(4);
  });

  it('🔴 τέλος εγγράφου ⇒ η τελευταία, ακόμη κι αν η κορυφή της δεν φτάνει ποτέ στη γραμμή', () => {
    expect(activeSectionOf({ tops: [-2000, -900, 420], line: 72, atEnd: true })).toBe(2);
  });
});
