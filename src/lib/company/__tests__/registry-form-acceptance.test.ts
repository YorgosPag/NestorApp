/**
 * @fileoverview Άγκυρες της **φόρμας ⇄ ΓΕΜΗ** — ζωντανή σύγκριση, «Αποδοχή» ανά πεδίο, πρόταση έδρας (ADR-948 §8 Βήμα 7).
 *
 * 🔴 Τα σενάρια που φυλάνε: σύγκριση πάνω σε απάντηση που **δεν** περνά πια τον φράχτη (φυσικό πρόσωπο) · παλιός
 * κωδικός νομικής μορφής στη φόρμα (`AE`) που βγαίνει ψευδής «διαφορά» · «Αποδοχή» που αγγίζει **άλλο** πεδίο ή
 * γράφει χωρίς λόγο · πρόταση έδρας που **σβήνει** μέρος που το ΓΕΜΗ δεν ξέρει.
 */

import { registryCheck } from '@/lib/company/__fixtures__/registry-record-fixture';
import {
  acceptRegistryField,
  canAcceptRegistryField,
  canProposeRegistrySeat,
  formRegistryFieldsOf,
  liveRegistryComparison,
  registrySeatAsAddressFields,
} from '@/lib/company/registry-form-acceptance';
import { initialFormData, type CompanyAddress, type ContactFormData } from '@/types/ContactFormTypes';
import type { RegistryCheck } from '@/types/company-registry';

/** Παλιά τιμή όπως τη γράφει ακόμη η βάση (πριν τη μετάπτωση) — εκτός λεξιλογίου, άρα μόνο από έξω. */
const LEGACY_AE: string = 'AE';

const AE_CHECK: RegistryCheck = registryCheck({ legalForm: { id: '1', label: 'ΑΕ' } });

const HQ: CompanyAddress = {
  type: 'headquarters',
  street: 'Σαμοθράκης',
  number: '16',
  postalCode: '542 48',
  city: 'Θεσσαλονίκη',
};

const form = (overrides: Partial<ContactFormData> = {}): ContactFormData => ({
  ...initialFormData,
  type: 'company',
  companyName: 'ΠΑΓΩΝΗΣ Α.Ε.',
  tradeName: 'Παγώνης Κατασκευαστική',
  gemiNumber: '123456789000',
  legalForm: 'ae',
  companyAddresses: [HQ],
  ...overrides,
});

function comparisonOf(formData: ContactFormData, check: RegistryCheck = AE_CHECK) {
  const comparison = liveRegistryComparison(formData, check);
  if (comparison === null) throw new Error('fixture: η απάντηση έπρεπε να περνά τον φράχτη');
  return comparison;
}

describe('Α — ζωντανή σύγκριση πάνω στη φόρμα', () => {
  it('Α1 — καμία αποθηκευμένη απάντηση ⇒ null', () => {
    expect(liveRegistryComparison(form(), null)).toBeNull();
  });

  it('Α2 — η απάντηση λέει φυσικό πρόσωπο ⇒ null (ίδια κρίση με τον server)', () => {
    const sole = registryCheck({ legalForm: { id: '16', label: 'ΑΤΟΜΙΚΗ' } });
    expect(liveRegistryComparison(form(), sole)).toBeNull();
  });

  it('Α3 — παλιός κωδικός `AE` στη φόρμα ⇒ match, όχι ψευδής διαφορά', () => {
    expect(formRegistryFieldsOf(form({ legalForm: LEGACY_AE as ContactFormData['legalForm'] })).legalForm).toBe('ae');
    expect(comparisonOf(form({ legalForm: LEGACY_AE as ContactFormData['legalForm'] })).legalForm.state).toBe('match');
  });

  it('Α4 — έδρα = θέση 0 της λίστας· χωρίς διεύθυνση ⇒ null', () => {
    expect(formRegistryFieldsOf(form()).headquarters).toEqual({ street: 'Σαμοθράκης', number: '16', postalCode: '542 48', city: 'Θεσσαλονίκη' });
    expect(formRegistryFieldsOf(form({ companyAddresses: [] })).headquarters).toBeNull();
  });
});

describe('Β — «Αποδοχή» ανά πεδίο', () => {
  it('Β1 — κενή επωνυμία ⇒ γράφεται ΜΟΝΟ η επωνυμία', () => {
    const before = form({ companyName: '' });
    const comparison = comparisonOf(before);
    expect(canAcceptRegistryField(comparison, 'legalName')).toBe(true);
    const after = acceptRegistryField(before, comparison, 'legalName');
    expect(after.companyName).toBe('ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ');
    expect({ ...after, companyName: before.companyName }).toEqual(before);
  });

  it('Β2 — ίδια τιμή ⇒ καμία πρόταση, η φόρμα επιστρέφει αυτούσια', () => {
    const before = form();
    const comparison = comparisonOf(before);
    expect(canAcceptRegistryField(comparison, 'gemiNumber')).toBe(false);
    expect(acceptRegistryField(before, comparison, 'gemiNumber')).toBe(before);
  });

  it('Β3 — νομική μορφή ⇒ γράφεται ο κωδικός της επαφής (`ae`), όχι η περιγραφή του ΓΕΜΗ', () => {
    const before = form({ legalForm: '' });
    expect(acceptRegistryField(before, comparisonOf(before), 'legalForm').legalForm).toBe('ae');
  });

  it('Β4 — κατάσταση ⇒ γράφεται στο `gemiStatus` η τιμή που πρότεινε η σύγκριση', () => {
    const before = form({ gemiStatus: '' });
    const comparison = comparisonOf(before);
    expect(acceptRegistryField(before, comparison, 'status').gemiStatus).toBe(comparison.status.registry);
  });
});

describe('Γ — έδρα: πρόταση, ποτέ εγγραφή', () => {
  it('Γ1 — ίδια έδρα σε άλλη γραφή ⇒ καμία πρόταση', () => {
    expect(canProposeRegistrySeat(comparisonOf(form()))).toBe(false);
  });

  it('Γ2 — χωρίς έδρα ⇒ πρόταση', () => {
    expect(canProposeRegistrySeat(comparisonOf(form({ companyAddresses: [] })))).toBe(true);
  });

  it('Γ3 — μέρος που το ΓΕΜΗ δεν ξέρει ⇒ ΑΠΟΝ (ο γραφέας κρατά της φόρμας), όχι κενό', () => {
    expect(registrySeatAsAddressFields({ street: 'ΣΑΜΟΘΡΑΚΗΣ', number: null, postalCode: '54248', city: null })).toEqual({
      street: 'ΣΑΜΟΘΡΑΚΗΣ',
      postalCode: '54248',
    });
  });
});
