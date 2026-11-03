/**
 * @jest-environment node
 *
 * **Επαφή προμηθευτή πλατφόρμας** (ADR-923 §5.13 Ε6γ): αληθινός builder και αληθινός γεννήτορας πάνω στο ψεύτικο
 * Firestore. Η ταυτότητα του ζεύγους είναι ο έλεγχος διπλοτύπου, άρα κάθε άγκυρα ρωτά «ποιο έγγραφο;», όχι «πόσα;».
 */

jest.mock('server-only', () => ({}));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι μονάδες */
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { generateDeterministicPlatformCompanyContactId } from '@/services/enterprise-id-convenience-catalog';
import {
  platformCompanyOfContact,
  resolvePlatformCompanyContact,
  type PlatformCompanyContactInput,
  type PlatformCompanyContactResolution,
} from '../platform-company-contact-resolver';
/* eslint-enable import/first */

const BUYER = 'comp_buyer';
const SUPPLIER = 'comp_supplier';
const PERFORMER = { id: 'uid_buyer', name: 'Αγοραστής' };
const INPUT: PlatformCompanyContactInput = { buyerCompanyId: BUYER, supplierCompanyId: SUPPLIER, legalName: ' ARIES ΑΕ ', performer: PERFORMER };
const PAIR_ID = generateDeterministicPlatformCompanyContactId(BUYER, SUPPLIER);

let fake: FakeFirestore;
beforeEach(() => { fake = new FakeFirestore(); });

const resolve = (input: PlatformCompanyContactInput = INPUT): Promise<PlatformCompanyContactResolution> =>
  fake.runTransaction((tx) => resolvePlatformCompanyContact(tx as unknown as Transaction, fake as unknown as Firestore, input));

const linked = (over: Record<string, unknown> = {}) =>
  ({ type: 'company', companyId: BUYER, platformCompanyId: SUPPLIER, status: 'active', displayName: 'ARIES ΑΕ', ...over });

describe('resolvePlatformCompanyContact', () => {
  it('births one company contact, at the pair id, as a supplier, without any email', async () => {
    const result = await resolve();
    if (result.kind !== 'new') throw new Error(`expected new, got ${result.kind}`);
    expect(result.contactId).toBe(PAIR_ID);
    expect(result.contactId.startsWith('cont_')).toBe(true);
    expect(result.displayName).toBe('ARIES ΑΕ');
    expect(result.doc).toMatchObject({
      type: 'company', companyId: BUYER, companyName: 'ARIES ΑΕ', platformCompanyId: SUPPLIER,
      emails: [], personaTypes: ['supplier'],
    });
    expect(result.doc.personas).toEqual([expect.objectContaining({ personaType: 'supplier', status: 'active' })]);
  });

  it('the pair is ordered: the same two workspaces the other way round are a different contact', () => {
    expect(generateDeterministicPlatformCompanyContactId(SUPPLIER, BUYER)).not.toBe(PAIR_ID);
  });

  it('a second request finds the same contact and writes nothing', async () => {
    fake.seed('contacts', PAIR_ID, linked());
    await expect(resolve()).resolves.toEqual({ kind: 'existing', contactId: PAIR_ID, displayName: 'ARIES ΑΕ' });
  });

  it('a workspace never becomes its own supplier', async () => {
    await expect(resolve({ ...INPUT, supplierCompanyId: BUYER })).resolves.toEqual({ kind: 'refused', reason: 'self' });
  });

  it('a storefront without a legal name is refused, never written as an empty card', async () => {
    await expect(resolve({ ...INPUT, legalName: '   ' })).resolves.toEqual({ kind: 'refused', reason: 'nameless' });
  });

  it.each(['archived', 'deleted'])('a %s card is not silently revived', async (status) => {
    fake.seed('contacts', PAIR_ID, linked({ status }));
    await expect(resolve()).resolves.toEqual({ kind: 'refused', reason: 'inactive' });
  });

  it.each([
    ['another workspace', { companyId: 'comp_other' }],
    ['another supplier', { platformCompanyId: 'comp_other' }],
    ['no platform link', { platformCompanyId: undefined }],
    ['a person, not a company', { type: 'individual' }],
  ])('an occupied id that is not this contact (%s) is refused, never overwritten', async (_label, over) => {
    fake.seed('contacts', PAIR_ID, linked(over));
    await expect(resolve()).resolves.toEqual({ kind: 'refused', reason: 'foreign' });
  });
});

describe('platformCompanyOfContact', () => {
  it('answers the supplier only for the pair id of this buyer', () => {
    expect(platformCompanyOfContact(PAIR_ID, BUYER, linked())).toBe(SUPPLIER);
  });

  it('the field alone proves nothing: the same data on a hand-made card is not a platform contact', () => {
    expect(platformCompanyOfContact('cont_hand-made', BUYER, linked())).toBeNull();
  });

  it('another buyer reading the same card gets nothing', () => {
    expect(platformCompanyOfContact(PAIR_ID, 'comp_other', linked())).toBeNull();
  });

  it('an absent document is not a platform contact', () => {
    expect(platformCompanyOfContact(PAIR_ID, BUYER, undefined)).toBeNull();
  });
});
