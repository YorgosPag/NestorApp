/**
 * 🔴 UC-003 — η αναζήτηση ακινήτων βλέπει ΜΟΝΟ την εταιρεία του αιτήματος (ADR-281 changelog 2026-10-06).
 *
 * Η `queryAvailableUnits(companyId, …)` δεχόταν `companyId` και δεν το έβαζε στο ερώτημα:
 * ο πράκτορας πρότεινε σε πελάτη ακίνητα κάθε εταιρείας.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { queryAvailableUnits } from '../property-search-query';

describe('queryAvailableUnits — tenant scope', () => {
  it('ξένο ακίνητο δεν προτείνεται ούτε μετριέται', async () => {
    const db = new FakeFirestore();
    const units = db.collection(COLLECTIONS.PROPERTIES);
    await units.doc('p_mine').set({ companyId: 'co-1', name: 'Δικό μου', status: 'available' });
    await units.doc('p_foreign').set({ companyId: 'co-2', name: 'Ξένο', status: 'available' });
    await units.doc('p_archived').set({ companyId: 'co-1', name: 'Αρχείο', status: 'archived' });
    (getAdminFirestore as jest.Mock).mockReturnValue(db);

    const { matching, totalAvailable } = await queryAvailableUnits('co-1', {});

    expect(matching.map((unit) => unit.name)).toEqual(['Δικό μου']);
    expect(totalAvailable).toBe(1);
  });
});
