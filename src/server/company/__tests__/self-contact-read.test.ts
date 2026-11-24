/**
 * @jest-environment node
 *
 * ADR-951 — **η πρόταση από το ΑΦΜ** και **η όψη** της κάρτας «Η επαφή του χώρου», πάνω στο ψεύτικο Firestore.
 *
 * Τι κρίνεται: τα τέσσερα σχήματα της πρότασης (`suggested` · `ambiguous` · `none` · `no-tax-id`) · ότι μετρούν
 * ΜΟΝΟ ενεργές επαφές-εταιρείες του ΙΔΙΟΥ χώρου · κανονικοποίηση ΑΦΜ · η πρόταση υπάρχει μόνο χωρίς δεσμό · βλάβη
 * ανάγνωσης προφίλ ⇒ `unavailable`, ποτέ «δεν έχει ΑΦΜ».
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { normalizeVat } from '@/lib/validation/greek-vat-number';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { readSelfContactState } from '../self-contact-read.server';
import { suggestSelfContact } from '../self-contact-suggestion.server';

const fake = new FakeFirestore();
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));

const readTax = jest.fn();
jest.mock('@/services/company/company-legal-identity', () => ({
  readCompanyTaxDeclaration: (...a: unknown[]) => readTax(...a),
}));

const COMPANY = 'comp_a';
const RAW_VAT = ' 094 012 345 ';
const VAT = normalizeVat(RAW_VAT);

/**
 * 🔴 Ρεαλιστικό σχήμα: οι επαφές-εταιρείες κρατούν το όνομα στο `companyName` — **χωρίς** `displayName`. Το παλιό
 *    fixture είχε μόνο `displayName` και γι' αυτό δεν έπιασε το σφάλμα της κενής κάρτας (ζωντανός έλεγχος 2026-11-24).
 */
function seedContact(id: string, overrides: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.CONTACTS, id, {
    companyId: COMPANY, type: 'company', companyName: `Επαφή ${id}`, status: 'active', vatNumber: VAT, ...overrides,
  });
}

beforeEach(() => {
  fake.reset();
  fake.seed(COLLECTIONS.COMPANIES, COMPANY, { name: 'A' });
  readTax.mockReset();
});

describe('Π — πρόταση από το ΑΦΜ', () => {
  it('Π1 μία επαφή-εταιρεία με το ίδιο ΑΦΜ ⇒ suggested (το ΑΦΜ του προφίλ κανονικοποιείται)', async () => {
    seedContact('cont_a', { logoURL: ' https://x/img.png ' });
    expect(await suggestSelfContact(COMPANY, RAW_VAT)).toEqual({
      kind: 'suggested', candidate: { contactId: 'cont_a', displayName: 'Επαφή cont_a', hasOwnImage: true },
    });
  });

  it('Π2 περισσότερες ⇒ ambiguous, διαλέγει ο άνθρωπος', async () => {
    seedContact('cont_a');
    seedContact('cont_b');
    const suggestion = await suggestSelfContact(COMPANY, VAT);
    expect(suggestion.kind).toBe('ambiguous');
    expect(suggestion.kind === 'ambiguous' && suggestion.candidates.map((c) => c.contactId).sort()).toEqual(['cont_a', 'cont_b']);
  });

  it('Π3 μετρούν ΜΟΝΟ ενεργές επαφές-εταιρείες του ίδιου χώρου ⇒ none', async () => {
    seedContact('cont_other_ws', { companyId: 'comp_b' });
    seedContact('cont_person', { type: 'individual' });
    seedContact('cont_archived', { status: 'archived' });
    seedContact('cont_deleted', { status: 'deleted' });
    seedContact('cont_other_vat', { vatNumber: '999999999' });
    expect(await suggestSelfContact(COMPANY, VAT)).toEqual({ kind: 'none' });
  });

  it('Π4 μία ενεργή ανάμεσα σε ανενεργές ⇒ suggested (όχι ambiguous)', async () => {
    seedContact('cont_a');
    seedContact('cont_archived', { status: 'archived' });
    expect(await suggestSelfContact(COMPANY, VAT)).toMatchObject({ kind: 'suggested', candidate: { contactId: 'cont_a' } });
  });

  it.each([null, '', '12345', 'όχι-ΑΦΜ'])('Π5 χωρίς έγκυρο ΑΦΜ (%p) ⇒ no-tax-id, κανένα ερώτημα', async (taxId) => {
    seedContact('cont_a', { vatNumber: '' });
    expect(await suggestSelfContact(COMPANY, taxId)).toEqual({ kind: 'no-tax-id' });
  });

  it('Π6 όνομα από τον ΕΝΑ αναγνώστη: companyName → αλλιώς tradeName· ένα παλιό displayName ΔΕΝ είναι πηγή', async () => {
    fake.seed(COLLECTIONS.CONTACTS, 'cont_a', {
      companyId: COMPANY, type: 'company', status: 'active', vatNumber: VAT, tradeName: 'Διακριτικός', displayName: 'μπαγιάτικο',
    });
    expect(await suggestSelfContact(COMPANY, VAT)).toMatchObject({
      kind: 'suggested', candidate: { contactId: 'cont_a', displayName: 'Διακριτικός' },
    });
  });

  it('Π7 επαφή χωρίς κανένα όνομα ⇒ κενό (η οθόνη γράφει «χωρίς όνομα»), ποτέ "undefined"', async () => {
    fake.seed(COLLECTIONS.CONTACTS, 'cont_a', { companyId: COMPANY, type: 'company', status: 'active', vatNumber: VAT });
    expect(await suggestSelfContact(COMPANY, VAT)).toMatchObject({ kind: 'suggested', candidate: { displayName: '' } });
  });
});

describe('Ο — η όψη της κάρτας', () => {
  it('Ο1 με δεσμό ⇒ η συνδεδεμένη επαφή, ΚΑΜΙΑ πρόταση και κανένα ερώτημα ΑΦΜ', async () => {
    seedContact('cont_a');
    fake.seed(COLLECTIONS.COMPANIES, COMPANY, {
      name: 'A', selfContact: { contactId: 'cont_a', linkedAt: '2026-11-24T00:00:00.000Z', linkedBy: 'u_admin' },
    });
    expect(await readSelfContactState(COMPANY)).toEqual({
      kind: 'present',
      view: { linked: { contactId: 'cont_a', displayName: 'Επαφή cont_a', hasOwnImage: false }, suggestion: null },
    });
    expect(readTax).not.toHaveBeenCalled();
  });

  it('Ο2 μισός δεσμός (χωρίς linkedBy) ⇒ «χωρίς δεσμό», ποτέ μισή όψη', async () => {
    seedContact('cont_a');
    fake.seed(COLLECTIONS.COMPANIES, COMPANY, { name: 'A', selfContact: { contactId: 'cont_a', linkedAt: 'x' } });
    readTax.mockResolvedValue({ kind: 'present', declaration: {}, taxId: VAT });
    expect(await readSelfContactState(COMPANY)).toMatchObject({ kind: 'present', view: { linked: null, suggestion: { kind: 'suggested' } } });
  });

  it('Ο3 χωρίς δεσμό ⇒ η πρόταση από το ΑΦΜ του προφίλ', async () => {
    seedContact('cont_a');
    readTax.mockResolvedValue({ kind: 'present', declaration: {}, taxId: RAW_VAT });
    expect(await readSelfContactState(COMPANY)).toMatchObject({
      kind: 'present', view: { linked: null, suggestion: { kind: 'suggested', candidate: { contactId: 'cont_a' } } },
    });
  });

  it('Ο4 προφίλ που δεν υπάρχει ακόμη ⇒ no-tax-id (αληθινή απουσία, όχι βλάβη)', async () => {
    readTax.mockResolvedValue({ kind: 'absent' });
    expect(await readSelfContactState(COMPANY)).toEqual({ kind: 'present', view: { linked: null, suggestion: { kind: 'no-tax-id' } } });
  });

  it('Ο5 βλάβη ανάγνωσης προφίλ ⇒ unavailable, ΠΟΤΕ «δεν έχει ΑΦΜ»', async () => {
    readTax.mockResolvedValue({ kind: 'unavailable' });
    expect(await readSelfContactState(COMPANY)).toEqual({ kind: 'unavailable' });
  });

  it('Ο6 ο χώρος δεν υπάρχει ⇒ absent', async () => {
    expect(await readSelfContactState('comp_missing')).toEqual({ kind: 'absent' });
  });
});
