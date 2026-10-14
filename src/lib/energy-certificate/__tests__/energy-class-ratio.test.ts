/**
 * ⚓ ADR-777 §8.96 — η κλάση από τον λόγο Τ = EP / RR, πίνακας 1.3 της ΤΟΤΕΕ 20701-1/2017 (ΦΕΚ Β΄ 4003/17.11.2017).
 *
 * Τα όρια γράφτηκαν από το ίδιο το ΦΕΚ (σελ. 48617–48618)· εδώ καρφώνονται ξανά, ανεξάρτητα από τη σταθερά, ώστε μια
 * «διόρθωση» της σταθεράς να κοκκινίσει.
 */

import { ENERGY_CLASSES } from '@/constants/energy-classes';

import { ENERGY_CLASS_RATIO_UPPER_BOUNDS, energyClassOfRatio } from '../energy-class-ratio';

describe('Κ1 — ο πίνακας 1.3, όπως στο ΦΕΚ', () => {
  it('τα άνω όρια, σε σειρά κλίμακας', () => {
    expect(ENERGY_CLASSES.map((energyClass) => ENERGY_CLASS_RATIO_UPPER_BOUNDS[energyClass])).toEqual([
      33, 50, 75, 100, 141, 182, 227, 273, null,
    ]);
  });

  it('το κτήριο αναφοράς (Τ = 1,00) είναι το άνω όριο της Β: λίγο κάτω ⇒ Β, ακριβώς πάνω του ⇒ Β ή Γ', () => {
    expect(energyClassOfRatio(450, 500)).toMatchObject({ kind: 'exact', class: 'B' });
    expect(energyClassOfRatio(500, 500)).toMatchObject({ kind: 'ambiguous', candidates: ['B', 'C'] });
  });
});

describe('Κ2 — τα δύο πραγματικά δείγματα του handoff (μόνο οι αριθμοί τους)', () => {
  it('Β ΠΕΑ: 79,3 / 113,5 = 0,699 ⇒ Β+, χωρίς αμφισημία', () => {
    const result = energyClassOfRatio(79.3, 113.5);
    expect(result).toMatchObject({ kind: 'exact', class: 'B+' });
  });

  it('Α ΠΕΑ: 484,0 / 162,0 = 2,988 ⇒ Η', () => {
    expect(energyClassOfRatio(484, 162)).toMatchObject({ kind: 'exact', class: 'G' });
  });
});

describe('Κ3 — κάθε κλάση, μακριά από τα όρια', () => {
  it.each([
    [20, 100, 'A+'],
    [40, 100, 'A'],
    [60, 100, 'B+'],
    [90, 100, 'B'],
    [120, 100, 'C'],
    [160, 100, 'D'],
    [200, 100, 'E'],
    [250, 100, 'F'],
    [300, 100, 'G'],
  ] as const)('%s / %s ⇒ %s', (ep, rr, expected) => {
    expect(energyClassOfRatio(ep, rr)).toMatchObject({ kind: 'exact', class: expected });
  });
});

describe('Κ4 — η στρογγύλευση πάνω σε όριο: ο άνθρωπος αποφασίζει, ποτέ σιωπηλή επιλογή', () => {
  it('🔴 Τ ακριβώς 0,50 στους τυπωμένους αριθμούς ⇒ αμφίσημο Α / Β+ (οι ακριβείς τιμές μπορεί να είναι και από τις δύο πλευρές)', () => {
    expect(energyClassOfRatio(50, 100)).toEqual({ kind: 'ambiguous', candidates: ['A', 'B+'], ratio: 0.5 });
  });

  it('Τ δίπλα στο 1,41 μέσα στο περιθώριο στρογγύλευσης ⇒ αμφίσημο Γ / Δ', () => {
    const result = energyClassOfRatio(141.0, 100.0);
    expect(result).toMatchObject({ kind: 'ambiguous', candidates: ['C', 'D'] });
  });

  it('μικροί αριθμοί = μεγάλο σχετικό περιθώριο ⇒ οι υποψήφιες μπορεί να είναι πάνω από δύο', () => {
    const result = energyClassOfRatio(0.2, 0.2);
    expect(result.kind).toBe('ambiguous');
    expect(result.kind === 'ambiguous' && result.candidates.length).toBeGreaterThan(2);
  });
});

describe('Κ5 — άκυρη είσοδος ⇒ `invalid`, ποτέ εικασία', () => {
  it.each([
    [0, 100],
    [100, 0],
    [-5, 100],
    [12.34, 100],
    [Number.NaN, 100],
    [100, 0.05],
  ])('%s / %s', (ep, rr) => {
    expect(energyClassOfRatio(ep, rr)).toEqual({ kind: 'invalid' });
  });
});
