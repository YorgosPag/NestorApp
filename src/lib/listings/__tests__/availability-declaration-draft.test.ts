/**
 * ΑΓΚΥΡΕΣ — το προσχέδιο της δήλωσης στην οθόνη (ADR-919 §11).
 */

import {
  initialDraft,
  isSameDeclaration,
  periodOfDraft,
  selectableYears,
  withPeriod,
  withPrecision,
  withYear,
} from '../availability-declaration-draft';

describe('Π — η αλλαγή ακρίβειας κρατά την περίοδο', () => {
  it('Π1 — μήνας Σεπτέμβριος → τρίμηνο Γ΄ (άγκυρα = 1η Ιουλίου)', () => {
    expect(withPrecision({ precision: 'month', anchor: '2027-09-01' }, 'quarter')).toEqual({ precision: 'quarter', anchor: '2027-07-01' });
  });

  it('Π2 — τρίμηνο Γ΄ → μήνας Ιούλιος (η αρχή του), ποτέ άσχετη ημερομηνία', () => {
    expect(withPrecision({ precision: 'quarter', anchor: '2027-07-01' }, 'month')).toEqual({ precision: 'month', anchor: '2027-07-01' });
  });
});

describe('Ε — έτος και περίοδος', () => {
  it('Ε1 — τρίμηνο Δ΄ ⇒ άγκυρα 1η Οκτωβρίου, και η περίοδος διαβάζεται πίσω ίδια', () => {
    const draft = withPeriod({ precision: 'quarter', anchor: '2027-01-01' }, 4);
    expect(draft.anchor).toBe('2027-10-01');
    expect(periodOfDraft(draft)).toBe(4);
  });

  it('Ε2 — αλλαγή έτους κρατά τον μήνα', () => {
    expect(withYear({ precision: 'month', anchor: '2027-09-01' }, 2029)).toEqual({ precision: 'month', anchor: '2029-09-01' });
  });

  it('Ε3 — τα έτη ξεκινούν από παλαιότερη δήλωση αν υπάρχει (ληγμένη υπόσχεση παραμένει επιλέξιμη)', () => {
    expect(selectableYears('2026-10-23', { precision: 'quarter', anchor: '2025-04-01' })[0]).toBe(2025);
  });
});

describe('Α — αρχικό προσχέδιο και ταυτότητα', () => {
  it('Α1 — υπάρχουσα δήλωση νικά την πρόταση· η άγκυρα κανονικοποιείται στην αρχή της περιόδου', () => {
    expect(initialDraft({ precision: 'quarter', anchor: '2027-08-17' }, { precision: 'quarter', anchor: '2028-01-01' }, '2026-10-23'))
      .toEqual({ precision: 'quarter', anchor: '2027-07-01' });
  });

  it('Α2 — δύο άγκυρες του ίδιου τριμήνου είναι η ΙΔΙΑ δήλωση', () => {
    expect(isSameDeclaration({ precision: 'quarter', anchor: '2027-08-17' }, { precision: 'quarter', anchor: '2027-07-01' })).toBe(true);
    expect(isSameDeclaration({ precision: 'month', anchor: '2027-07-01' }, { precision: 'quarter', anchor: '2027-07-01' })).toBe(false);
  });
});
