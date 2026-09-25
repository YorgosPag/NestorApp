/**
 * ADR-886 — καθαρισμός και όρια του ονόματος ζήτησης: **ένα** SSoT για φόρμα, πύλη γραφής και κανόνες.
 */

import {
  DEMAND_PLACE_LABEL_MAX_LENGTH,
  DEMAND_TITLE_MAX_LENGTH,
  isDemandLabelTooLong,
  normalizeDemandLabel,
} from '../demand-title';

describe('normalizeDemandLabel', () => {
  it.each([
    ['  Για   τη Μαρία  ', 'Για τη Μαρία'],
    ['Γραμμή\nδεύτερη\tτρίτη', 'Γραμμή δεύτερη τρίτη'],
    ['καμπανάκι\u0007μέσα', 'καμπανάκι μέσα'],
  ])('%p → %p', (raw, expected) => {
    expect(normalizeDemandLabel(raw)).toBe(expected);
  });

  it.each([null, undefined, '', '   ', '\u0000\u0007', 42, {}])('κενό ή μη-κείμενο (%p) ⇒ null', (raw) => {
    expect(normalizeDemandLabel(raw)).toBeNull();
  });

  it('🔴 ΔΕΝ κόβει σιωπηλά — το υπερβολικό μήκος είναι παραβίαση, όχι διόρθωση', () => {
    const long = 'α'.repeat(DEMAND_TITLE_MAX_LENGTH + 5);
    expect(normalizeDemandLabel(long)).toBe(long);
  });
});

describe('isDemandLabelTooLong', () => {
  it('ακριβώς στο όριο ⇒ επιτρέπεται', () => {
    expect(isDemandLabelTooLong({ title: 'α'.repeat(DEMAND_TITLE_MAX_LENGTH) })).toBe(false);
    expect(isDemandLabelTooLong({ placeLabel: 'α'.repeat(DEMAND_PLACE_LABEL_MAX_LENGTH) })).toBe(false);
  });

  it('ένα πάνω από το όριο ⇒ παραβίαση', () => {
    expect(isDemandLabelTooLong({ title: 'α'.repeat(DEMAND_TITLE_MAX_LENGTH + 1) })).toBe(true);
    expect(isDemandLabelTooLong({ placeLabel: 'α'.repeat(DEMAND_PLACE_LABEL_MAX_LENGTH + 1) })).toBe(true);
  });

  it('απουσία ή `null` ⇒ έγκυρο (έγγραφα πριν το ADR-886)', () => {
    expect(isDemandLabelTooLong({})).toBe(false);
    expect(isDemandLabelTooLong({ title: null, placeLabel: null })).toBe(false);
  });
});
