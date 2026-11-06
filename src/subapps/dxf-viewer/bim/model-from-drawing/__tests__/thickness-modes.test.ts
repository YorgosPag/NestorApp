/**
 * ADR-929 Φ5.2ε — ομάδες πάχους από εικόνα = κορυφές πυκνότητας με βάρος μήκους + ελάχιστη στήριξη.
 *
 * Το περιστατικό (ζωντανή επαλήθευση 2026-11-06): 32 ομάδες 50 → 910 mm σε μία σάρωση, όλες «θέλει επιβεβαίωση».
 * Εδώ κρίνεται ο καθαρός αλγόριθμος· η ένταξή του στην πρόταση στο `wall-proposal.test.ts`.
 */

import { assignThicknessModes, type ThicknessModeOptions, type ThicknessSample } from '../thickness-modes';

const OPTIONS: ThicknessModeOptions = {
  bandwidthMm: 13,
  minShare: 0.05,
  captureBandwidths: 2,
  roundMm: 5,
};

const samples = (thicknesses: readonly number[], weightMm = 3000): ThicknessSample[] =>
  thicknesses.map((thicknessMm) => ({ thicknessMm, weightMm }));

const labels = (input: readonly ThicknessSample[], o: ThicknessModeOptions = OPTIONS) =>
  assignThicknessModes(input, o).map((a) => (a.kind === 'mode' ? a.labelMm : 'rare'));

describe('assignThicknessModes — λίγοι, διακριτοί τύποι', () => {
  it('δύο θορυβώδη πραγματικά πάχη ⇒ δύο ομάδες, ετικέτα στρογγυλή', () => {
    expect(labels(samples([98, 101, 103, 247, 250, 252, 254]))).toEqual([100, 100, 100, 250, 250, 250, 250]);
  });

  it('μεμονωμένο κοντό πάχος μακριά από κάθε τύπο ⇒ σπάνιο, όχι δική του απόφαση', () => {
    // 600 mm με 100 mm μήκος = 1,1 % του συνόλου < 5 %.
    expect(labels([...samples([100, 101, 102]), ...samples([600], 100)])).toEqual([100, 100, 100, 'rare']);
  });

  it('το βάρος είναι το ΜΗΚΟΣ: πολλά κοντά σκουπίδια δεν φτιάχνουν τύπο', () => {
    const walls = samples([200, 201, 199, 200], 8000);
    const junk = samples([400, 402, 398], 50); // αυτοκίνητο / διάσταση: 3 μέλη, 0,5 % του μήκους
    const result = labels([...walls, ...junk]);
    expect(result.slice(0, 4)).toEqual([200, 200, 200, 200]);
    expect(result.slice(4)).toEqual(['rare', 'rare', 'rare']);
  });

  it('τιμή μέσα στον θόρυβο ενός τύπου ανήκει σε αυτόν (όχι δεύτερη απόφαση)', () => {
    // 118 απέχει 18 mm < 2σ από τα 100 ⇒ ίδια κορυφή· ετικέτα = σταθμισμένος διάμεσος (100).
    expect(labels(samples([100, 100, 100, 118]))).toEqual([100, 100, 100, 100]);
  });

  it('συμμετρική πυκνότητα (οροπέδιο στην κορυφή) ⇒ ΜΙΑ ομάδα, όχι δύο μισές', () => {
    // Δύο ίσα ζεύγη στα 200 και 210: η πυκνότητα είναι συμμετρική γύρω από τα 205.
    expect(new Set(labels(samples([200, 200, 210, 210]))).size).toBe(1);
  });

  it('η ισχυρότερη κορυφή στηρίζεται πάντα: σκίτσο με δύο τοίχους βγάζει ομάδα', () => {
    expect(labels(samples([150, 152]))).toEqual([150, 150]);
  });

  it('ΕΝΑΣ μακρύς τοίχος ενός πάχους είναι τύπος (στήριξη = μήκος, όχι πλήθος)', () => {
    // Το σπίτι-δείγμα: 4 εξωτερικοί 250 mm + ένας εσωτερικός 100 mm (17 % του μήκους).
    const house = [...samples([250, 250], 6000), ...samples([250, 250], 4000), ...samples([100], 4000)];
    expect(labels(house)).toEqual([250, 250, 250, 250, 100]);
  });

  it('συνεχής σειρά: η ομάδα δεν απλώνεται πέρα από ±2 εύρη — τα άκρα μένουν σπάνια', () => {
    // Κενά 30 mm = σ ⇒ μία κορυφή στα 175· σύλληψη ±60 ⇒ 100 και 250 (απόσταση 75) δεν ενώνονται με τα 130…220.
    const o = { ...OPTIONS, bandwidthMm: 30 };
    expect(labels(samples([100, 130, 160, 190, 220, 250]), o)).toEqual(['rare', 175, 175, 175, 175, 'rare']);
  });

  it('ανεξάρτητο από τη σειρά των δειγμάτων', () => {
    const input = samples([98, 250, 101, 600, 247, 103, 252]);
    const reversed = [...input].reverse();
    expect(labels(reversed)).toEqual([...labels(input)].reverse());
  });

  it('κενή είσοδος ⇒ κενή έξοδος', () => {
    expect(assignThicknessModes([], OPTIONS)).toEqual([]);
  });
});
