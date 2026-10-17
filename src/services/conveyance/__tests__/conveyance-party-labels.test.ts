/**
 * @jest-environment node
 *
 * ⚓ ADR-915 §23.10 — τα ονόματα των προσώπων διαβάζονται ΖΩΝΤΑΝΑ από τις επαφές του μισθωτή (fake Firestore):
 * ξένη ≡ ανύπαρκτη ⇒ κενό · μετονομασία ⇒ το νέο όνομα στην επόμενη όψη · αποτυχία ⇒ κενά, η όψη ζει ·
 * ≤ 1 πρόσωπο ⇒ **καμία** ανάγνωση. Συνθετικά ονόματα — κανένα πραγματικό.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { sellerParty } from '@/lib/conveyance/case-parties';
import { readCasePartyLabels } from '../conveyance-party-labels.server';

const co = sellerParty('cont_co', 'legal_entity', 'principal');
const lo = sellerParty('cont_lo', 'person', 'landowner');
const foreign = sellerParty('cont_foreign', 'person', 'other');
const unidentified = sellerParty(null, 'legal_entity', 'principal');

let fake: FakeFirestore;
const db = () => fake as unknown as Firestore;

beforeEach(() => {
  fake = new FakeFirestore();
  fake.seed(COLLECTIONS.CONTACTS, 'cont_co', { companyId: 'comp_a', type: 'company', companyName: 'Test Builder SA' });
  fake.seed(COLLECTIONS.CONTACTS, 'cont_lo', { companyId: 'comp_a', type: 'individual', firstName: 'Test', lastName: 'Landowner' });
  fake.seed(COLLECTIONS.CONTACTS, 'cont_foreign', { companyId: 'comp_b', type: 'individual', firstName: 'Other', lastName: 'Tenant' });
});

describe('readCasePartyLabels', () => {
  it('όνομα από τον τύπο της επαφής (εταιρεία · φυσικό πρόσωπο), με τη σειρά της υπόθεσης', async () => {
    expect(await readCasePartyLabels(db(), 'comp_a', [co, lo])).toEqual([
      { key: 'cont_co', ordinal: 1, name: 'Test Builder SA' },
      { key: 'cont_lo', ordinal: 2, name: 'Test Landowner' },
    ]);
  });

  it('επαφή ΑΛΛΟΥ μισθωτή ⇒ κενό όνομα (ξένη ≡ ανύπαρκτη) · πρόσωπο χωρίς επαφή ⇒ κενό', async () => {
    const labels = await readCasePartyLabels(db(), 'comp_a', [unidentified, foreign]);
    expect(labels.map((label) => label.name)).toEqual(['', '']);
  });

  it('ζωντανό, όχι αντίγραφο: μετονομασία της επαφής ⇒ το νέο όνομα στην επόμενη ανάγνωση', async () => {
    await readCasePartyLabels(db(), 'comp_a', [co, lo]);
    fake.seed(COLLECTIONS.CONTACTS, 'cont_lo', { companyId: 'comp_a', type: 'individual', firstName: 'Renamed', lastName: 'Landowner' });
    expect((await readCasePartyLabels(db(), 'comp_a', [co, lo]))[1].name).toBe('Renamed Landowner');
  });

  it('ένα πρόσωπο ⇒ [] ΧΩΡΙΣ ανάγνωση: ό,τι δεν δείχνεται δεν διαβάζεται', async () => {
    const getAll = jest.spyOn(fake, 'getAll');
    expect(await readCasePartyLabels(db(), 'comp_a', [co])).toEqual([]);
    expect(getAll).not.toHaveBeenCalled();
  });

  it('αποτυχία ανάγνωσης ⇒ κενά ονόματα («Πωλητής N»), η όψη ΔΕΝ πέφτει', async () => {
    jest.spyOn(fake, 'getAll').mockRejectedValueOnce(new Error('unavailable'));
    expect(await readCasePartyLabels(db(), 'comp_a', [co, lo])).toEqual([
      { key: 'cont_co', ordinal: 1, name: '' },
      { key: 'cont_lo', ordinal: 2, name: '' },
    ]);
  });
});
