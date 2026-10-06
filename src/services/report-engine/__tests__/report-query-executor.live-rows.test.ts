/**
 * @tests Report Query Executor — αποσυρμένες εγγραφές δεν είναι γραμμές αναφοράς
 * (ADR-268 · ADR-281 · ADR-329 §3.9)
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { executeBuilderQuery } from '../report-query-executor';

const COMPANY = 'comp_test';

async function seedProperties(
  rows: ReadonlyArray<{ name: string; status: string; type?: string }>,
): Promise<void> {
  const db = new FakeFirestore();
  for (const row of rows) {
    await db.collection(COLLECTIONS.PROPERTIES).doc(`prop_${row.name}`).set({ companyId: COMPANY, ...row });
  }
  (getAdminFirestore as jest.Mock).mockReturnValue(db);
}

const names = (rows: ReadonlyArray<Record<string, unknown>>): unknown[] => rows.map((row) => row.name);

describe('executeBuilderQuery — κύκλος ζωής', () => {
  it('το όριο μετρά ζωντανά ακίνητα: κάδος και αρχείο δεν πιάνουν θέση', async () => {
    await seedProperties([
      { name: 'A', status: 'available' },
      { name: 'B', status: 'archived' },
      { name: 'C', status: 'deleted' },
      { name: 'D', status: 'sold' },
      { name: 'E', status: 'available' },
    ]);

    const response = await executeBuilderQuery(COMPANY, {
      domain: 'properties',
      filters: [],
      columns: ['name'],
      limit: 2,
    });

    expect(names(response.rows)).toEqual(['A', 'D']);
  });

  it('και στο τεμαχισμένο `in` μονοπάτι', async () => {
    await seedProperties([
      { name: 'A', status: 'archived', type: 'apartment' },
      { name: 'B', status: 'available', type: 'apartment' },
      { name: 'C', status: 'available', type: 'studio' },
    ]);

    const response = await executeBuilderQuery(COMPANY, {
      domain: 'properties',
      filters: [{ id: '1', fieldKey: 'type', operator: 'in', value: ['apartment', 'studio'] }],
      columns: ['name'],
      limit: 10,
    });

    expect(names(response.rows)).toEqual(['B', 'C']);
  });
});
