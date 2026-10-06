/**
 * @tests readLiveDocs — το όριο μετρά ΖΩΝΤΑΝΕΣ εγγραφές (ADR-281 · ADR-329 §3.9)
 */

jest.mock('server-only', () => ({}));

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { readLiveDocs } from '../live-docs';
import { isLifecycleCollection } from '../soft-delete-config';
import { COLLECTIONS } from '@/config/firestore-collections';

type Row = { name: string; status?: string };

async function seed(rows: readonly Row[]): Promise<FirebaseFirestore.Query> {
  const db = new FakeFirestore();
  for (const row of rows) {
    await db.collection('things').doc(`id_${row.name}`).set(row);
  }
  return db.collection('things').orderBy('name') as unknown as FirebaseFirestore.Query;
}

const namesOf = (docs: readonly FirebaseFirestore.QueryDocumentSnapshot[]): string[] =>
  docs.map((doc) => doc.data().name as string);

describe('readLiveDocs', () => {
  it('γεμίζει το όριο πάνω από τις αποσυρμένες, με τη σειρά του ερωτήματος', async () => {
    const query = await seed([
      { name: 'a', status: 'available' },
      { name: 'b', status: 'archived' },
      { name: 'c', status: 'deleted' },
      { name: 'd', status: 'sold' },
      { name: 'e', status: 'available' },
    ]);

    expect(namesOf(await readLiveDocs(query, 2))).toEqual(['a', 'd']);
  });

  it('κρατά έγγραφο ΧΩΡΙΣ status — δεν είναι αποσυρμένο', async () => {
    const query = await seed([{ name: 'a' }, { name: 'b', status: 'archived' }, { name: 'c' }]);

    expect(namesOf(await readLiveDocs(query, 5))).toEqual(['a', 'c']);
  });

  it('επιστρέφει όσα υπάρχουν όταν το ερώτημα εξαντλείται', async () => {
    const query = await seed([
      { name: 'a', status: 'deleted' },
      { name: 'b', status: 'available' },
    ]);

    expect(namesOf(await readLiveDocs(query, 10))).toEqual(['b']);
  });

  it('δεν επιστρέφει ποτέ περισσότερα από το όριο', async () => {
    const query = await seed([
      { name: 'a', status: 'available' },
      { name: 'b', status: 'available' },
      { name: 'c', status: 'available' },
    ]);

    expect(namesOf(await readLiveDocs(query, 2))).toEqual(['a', 'b']);
  });

  it('σταματά στο maxScan — συλλογή γεμάτη αποσυρμένα δεν σαρώνεται ολόκληρη', async () => {
    const query = await seed([
      { name: 'a', status: 'archived' },
      { name: 'b', status: 'archived' },
      { name: 'c', status: 'archived' },
      { name: 'd', status: 'archived' },
      { name: 'e', status: 'available' },
    ]);

    expect(namesOf(await readLiveDocs(query, 2, { maxScan: 4 }))).toEqual([]);
  });

  it('όριο μηδέν ⇒ καμία ανάγνωση', async () => {
    const query = await seed([{ name: 'a', status: 'available' }]);

    expect(await readLiveDocs(query, 0)).toEqual([]);
  });
});

describe('isLifecycleCollection', () => {
  it('αναγνωρίζει τις συλλογές του SOFT_DELETE_CONFIG', () => {
    expect(isLifecycleCollection(COLLECTIONS.PROPERTIES)).toBe(true);
    expect(isLifecycleCollection(COLLECTIONS.BUILDINGS)).toBe(true);
    expect(isLifecycleCollection(COLLECTIONS.CONTACTS)).toBe(true);
  });

  it('αρνείται συλλογή χωρίς κύκλο ζωής', () => {
    expect(isLifecycleCollection(COLLECTIONS.FLOORS)).toBe(false);
  });
});
