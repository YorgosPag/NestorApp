/**
 * @fileoverview Άγκυρες της **επαφής ως υποκείμενο ελέγχου ΓΕΜΗ** — ADR-948 §8 Βήμα 4.
 *
 * 🔴 Τα σενάρια που φυλάνε: έδρα από διεύθυνση που ΔΕΝ είναι η θέση 0 · `gemiStatus` διαβασμένο από τη ρίζα αντί
 * για τα `customFields` · παλιό έγγραφο με μόνο `registrationNumber` που φαίνεται «χωρίς αριθμό» · ΑΦΜ που
 * προηγείται του Αρ. ΓΕΜΗ · άκυρο ΑΦΜ που στέλνεται στο μητρώο.
 */

import {
  contactRegistryFieldsOf,
  contactRegistryQueryOf,
  isCompanyContact,
  sameRegistryQuery,
} from '@/lib/contacts/contact-registry-subject';

const doc = (overrides: Record<string, unknown> = {}) => ({
  type: 'company',
  companyName: '  ΠΑΓΩΝΗΣ Α.Ε. ',
  tradeName: '',
  legalForm: 'ae',
  vatNumber: '123456783',
  gemiNumber: '123 456 789 000',
  customFields: {
    gemiStatus: 'active',
    companyAddresses: [
      { type: 'headquarters', street: 'Σαμοθράκης', number: '16', postalCode: '54248', city: 'Θεσσαλονίκη' },
      { type: 'branch', street: 'Εγνατίας', number: '1', postalCode: '54630', city: 'Θεσσαλονίκη' },
    ],
  },
  ...overrides,
});

describe('Α — τα πεδία της επαφής', () => {
  it('Α1 — κενά ⇒ null, κείμενο κομμένο, κατάσταση από τα customFields, έδρα = θέση 0', () => {
    expect(contactRegistryFieldsOf(doc())).toEqual({
      companyName: 'ΠΑΓΩΝΗΣ Α.Ε.',
      tradeName: null,
      gemiNumber: '123 456 789 000',
      legalForm: 'ae',
      gemiStatus: 'active',
      headquarters: { street: 'Σαμοθράκης', number: '16', postalCode: '54248', city: 'Θεσσαλονίκη' },
    });
  });

  it('Α2 — χωρίς διεύθυνση ⇒ headquarters null', () => {
    expect(contactRegistryFieldsOf(doc({ customFields: { gemiStatus: '' } })).headquarters).toBeNull();
  });

  it('Α3 — παλιό έγγραφο με μόνο registrationNumber ⇒ διαβάζεται ως Αρ. ΓΕΜΗ', () => {
    expect(contactRegistryFieldsOf(doc({ gemiNumber: '', registrationNumber: '987654321000' })).gemiNumber).toBe('987654321000');
  });
});

describe('Β — με τι ρωτάμε', () => {
  it('Β1 — ο Αρ. ΓΕΜΗ προηγείται του ΑΦΜ, σε κανονική μορφή', () => {
    expect(contactRegistryQueryOf(doc())).toEqual({ kind: 'gemi-number', registrationNumber: '123456789000' });
  });

  it('Β2 — χωρίς αριθμό ⇒ ΑΦΜ', () => {
    expect(contactRegistryQueryOf(doc({ gemiNumber: '' }))).toEqual({ kind: 'tax-id', taxId: '123456783' });
  });

  it('Β3 — άκυρος αριθμός και άκυρο ΑΦΜ ⇒ none', () => {
    expect(contactRegistryQueryOf(doc({ gemiNumber: 'abc', vatNumber: '123456789' }))).toEqual({ kind: 'none' });
  });

  it('Β4 — ίδιο ερώτημα μόνο με ίδιο είδος και ίδια τιμή', () => {
    const byNumber = { kind: 'gemi-number', registrationNumber: '1' } as const;
    expect(sameRegistryQuery(byNumber, { kind: 'gemi-number', registrationNumber: '1' })).toBe(true);
    expect(sameRegistryQuery(byNumber, { kind: 'gemi-number', registrationNumber: '2' })).toBe(false);
    expect(sameRegistryQuery(byNumber, { kind: 'tax-id', taxId: '1' })).toBe(false);
    expect(sameRegistryQuery({ kind: 'none' }, { kind: 'none' })).toBe(true);
  });
});

describe('Γ — μόνο εταιρεία', () => {
  it('Γ1 — type company ⇒ ναι · individual ⇒ όχι', () => {
    expect(isCompanyContact(doc())).toBe(true);
    expect(isCompanyContact(doc({ type: 'individual' }))).toBe(false);
  });
});
