/**
 * @fileoverview Άγκυρες της **φόρμας ⇄ ΓΕΜΗ** — ζωντανή σύγκριση, «Αποδοχή» ανά πεδίο, πρόταση έδρας (ADR-948 §8 Βήμα 7).
 *
 * 🔴 Τα σενάρια που φυλάνε: σύγκριση πάνω σε απάντηση που **δεν** περνά πια τον φράχτη (φυσικό πρόσωπο) · παλιός
 * κωδικός νομικής μορφής στη φόρμα (`AE`) που βγαίνει ψευδής «διαφορά» · «Αποδοχή» που αγγίζει **άλλο** πεδίο ή
 * γράφει χωρίς λόγο · πρόταση έδρας που **σβήνει** μέρος της **ίδιας** διεύθυνσης που το ΓΕΜΗ δεν ξέρει — ή που
 * **κρατά** μέρος **άλλης** διεύθυνσης και φτιάχνει υβρίδιο («Κάλβου 10» με το 10 της Ερμού, ADR-948 §8.7.4).
 */

import { registryCheck } from '@/lib/company/__fixtures__/registry-record-fixture';
import {
  acceptRegistryField,
  canAcceptRegistryField,
  canProposeRegistrySeat,
  formRegistryFieldsOf,
  liveRegistryComparison,
  registrySeatApplicationOf,
  registrySeatAsAddressFields,
} from '@/lib/company/registry-form-acceptance';
import { applyResolvedToContactAddress } from '@/components/contacts/dynamic/addresses-section-form-mapping';
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

  it('Γ3 — συμπλήρωση της ΙΔΙΑΣ διεύθυνσης: μέρος που το ΓΕΜΗ δεν ξέρει ⇒ ΑΠΟΝ (ο γραφέας κρατά της φόρμας)', () => {
    const fields = registrySeatAsAddressFields({ street: 'ΣΑΜΟΘΡΑΚΗΣ', number: null, postalCode: '54248', city: null }, 'complete');
    expect(fields).toEqual({ street: 'ΣΑΜΟΘΡΑΚΗΣ', postalCode: '54248' });
    expect(applyResolvedToContactAddress(fields, HQ)).toMatchObject({ number: '16', city: 'Θεσσαλονίκη' });
  });

  it('Γ4 — αντικατάσταση από ΑΛΛΗ διεύθυνση: ό,τι δεν ξέρει το ΓΕΜΗ ΑΔΕΙΑΖΕΙ — κανένα υβρίδιο (ADR-948 §8.7.4)', () => {
    // Το περιστατικό: «Ερμού 10» ⇒ «Διόρθωση έδρας» ⇒ «ΚΑΛΒΟΥ ΚΑΙ ΙΠΠΟΔΡΟΜΙΟΥ 10» — ο αριθμός της ΠΑΛΙΑΣ οδού.
    const before: CompanyAddress = { ...HQ, street: 'Ερμού', number: '10', postalCode: '105 63', city: 'Αθήναι', neighborhood: 'Σύνταγμα' };
    const seat = { street: 'ΚΑΛΒΟΥ ΚΑΙ ΙΠΠΟΔΡΟΜΙΟΥ', number: null, postalCode: '57013', city: 'ΘΕΣΣΑΛΟΝΙΚΗ' };
    expect(applyResolvedToContactAddress(registrySeatAsAddressFields(seat, 'replace'), before)).toMatchObject({
      street: 'ΚΑΛΒΟΥ ΚΑΙ ΙΠΠΟΔΡΟΜΙΟΥ',
      number: '',
      postalCode: '57013',
      city: 'ΘΕΣΣΑΛΟΝΙΚΗ',
      neighborhood: '',
    });
  });

  it('Γ5 — «ίδια ή άλλη» = η κρίση της σύγκρισης: διαφορά ⇒ replace · μόνο κενά ⇒ complete', () => {
    const other: CompanyAddress = { ...HQ, street: 'Ερμού', postalCode: '105 63', city: 'Αθήναι' };
    expect(registrySeatApplicationOf(comparisonOf(form({ companyAddresses: [other] })))).toBe('replace');
    expect(registrySeatApplicationOf(comparisonOf(form({ companyAddresses: [] })))).toBe('complete');
    const sameWithGap: CompanyAddress = { ...HQ, postalCode: '' };
    expect(registrySeatApplicationOf(comparisonOf(form({ companyAddresses: [sameWithGap] })))).toBe('complete');
  });
});
