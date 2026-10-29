/**
 * ΑΓΚΥΡΑ — κάθε κλειδί σφάλματος του validator επαφών **λύνεται**, σε ΟΠΟΙΟΝ renderer κι αν φτάσει
 * (ADR-327 §8.5.4, 2026-10-29).
 *
 * Μετρημένο ζωντανά: η φόρμα ΕΤΑΙΡΕΙΑΣ έδειχνε το ωμό `validation.company.nameAndVatRequired` κάτω από το ΑΦΜ —
 * ο `GenericFormRenderer` μεταφράζει στο `forms`, ενώ το κλειδί ζει στο `contacts-form`. Εδώ ελέγχεται ότι η πηγή
 * δίνει πλήρες `ns:key` και ότι αυτό υπάρχει και στις δύο γλώσσες.
 */

/* global describe, it, expect */

import elContactsForm from '@/i18n/locales/el/contacts-form.json';
import enContactsForm from '@/i18n/locales/en/contacts-form.json';
import {
  CONTACT_VALIDATION_NAMESPACE, validateCompanyContact, validateContactField, validateIndividualContact,
  validateServiceContact,
} from '../contact-validation';
import type { ContactFormData } from '@/types/ContactFormTypes';

const LOCALES: Record<string, unknown> = { el: elContactsForm, en: enContactsForm };

function resolves(locale: unknown, path: string): boolean {
  const value = path.split('.').reduce<unknown>(
    (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
    locale,
  );
  return typeof value === 'string' && value.length > 0;
}

function expectResolvable(qualifiedKey: string | undefined): void {
  expect(qualifiedKey).toBeDefined();
  const [ns, key] = String(qualifiedKey).split(':');
  expect(ns).toBe(CONTACT_VALIDATION_NAMESPACE);
  for (const [lang, locale] of Object.entries(LOCALES)) {
    expect({ lang, key, resolves: resolves(locale, key) }).toEqual({ lang, key, resolves: true });
  }
}

const EMPTY = {
  firstName: '', lastName: '', companyName: '', serviceName: '', vatNumber: '', companyVatNumber: '',
  phones: [], emails: [], websites: [],
} as unknown as ContactFormData;

describe('contact-validation — κλειδιά με ιδιοκτήτη', () => {
  it('Κ1 — εταιρεία χωρίς επωνυμία/ΑΦΜ: κάθε σφάλμα είναι `contacts-form:…` και λύνεται σε el ΚΑΙ en', () => {
    const result = validateCompanyContact({ ...EMPTY, type: 'company' } as ContactFormData);
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.companyVatNumber).toBe('contacts-form:validation.company.nameAndVatRequired');
    for (const key of Object.values(result.fieldErrors)) expectResolvable(key);
  });

  it('Κ2 — πρόσωπο και υπηρεσία: ίδιο συμβόλαιο', () => {
    const individual = validateIndividualContact({ ...EMPTY, type: 'individual' } as ContactFormData);
    const service = validateServiceContact({ ...EMPTY, type: 'service' } as ContactFormData);
    for (const key of [...Object.values(individual.fieldErrors), ...Object.values(service.fieldErrors)]) {
      expectResolvable(key);
    }
  });

  it('Κ4 — σφάλμα πινάκων επικοινωνίας: στο πεδίο του (`phones`), πλήρες κλειδί, σε ΚΑΘΕ τύπο επαφής', () => {
    const phones = [{ number: 'όχι αριθμός', type: 'main', isPrimary: true }];
    for (const validate of [validateIndividualContact, validateCompanyContact, validateServiceContact]) {
      const result = validate({ ...EMPTY, phones } as unknown as ContactFormData);
      expect(result.fieldErrors.phones).toMatch(/^contacts-form:validation\.arrayValidation\./);
      expectResolvable(result.fieldErrors.phones);
    }
  });

  it('Κ3 — ο έλεγχος ανά πεδίο (blur) δίνει το ΙΔΙΟ πλήρες κλειδί με τον έλεγχο φόρμας', () => {
    const form = { ...EMPTY, type: 'company' } as ContactFormData;
    expect(validateContactField(form, 'companyVatNumber')).toBe(validateCompanyContact(form).fieldErrors.companyVatNumber);
    expect(validateContactField({ ...form, companyVatNumber: '094063140' } as ContactFormData, 'companyVatNumber')).toBeUndefined();
  });
});
