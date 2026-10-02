/**
 * ADR-898 §21 — **η τοποθέτηση γράφεται στην ΙΔΙΑ συναλλαγή με τη μονάδα**: ο συνοδός διαβάζει τους συνδεδεμένους χώρους
 * ΠΡΙΝ από κάθε εγγραφή, το `withVersionCheck` γράφει μονάδα + χώρους μαζί, και οι συνέπειες (cascade + ίχνος) περνούν
 * από τον ΕΝΑ `linkEntity`.
 */

jest.mock('@/lib/firestore/entity-linking.service', () => ({ linkEntity: jest.fn(() => Promise.resolve()) }));

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth';
import { linkEntity } from '@/lib/firestore/entity-linking.service';
import { withVersionCheck } from '@/lib/firestore/version-check';

import { announceSpacePlacements, spacePlacementCompanion, type PlacedSpace } from '../space-placement.server';

type Doc = Record<string, unknown>;

interface FakeRef {
  readonly path: string;
}

/** Ψεύτικη βάση: έγγραφα ανά διαδρομή · καταγράφει τη ΣΕΙΡΑ αναγνώσεων/εγγραφών μέσα στη συναλλαγή. */
function fakeDb(docs: Record<string, Doc>) {
  const log: string[] = [];
  const writes: { path: string; data: Doc }[] = [];
  const ref = (path: string): FakeRef => ({ path });
  const transaction = {
    get: async (r: FakeRef) => {
      log.push(`read ${r.path}`);
      return { exists: r.path in docs, data: () => docs[r.path] };
    },
    getAll: async (...refs: FakeRef[]) => {
      refs.forEach((r) => log.push(`read ${r.path}`));
      return refs.map((r) => ({ exists: r.path in docs, data: () => docs[r.path] }));
    },
    update: (r: FakeRef, data: Doc) => {
      log.push(`write ${r.path}`);
      writes.push({ path: r.path, data });
    },
  };
  const db = {
    collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
    runTransaction: async <T>(fn: (tx: typeof transaction) => Promise<T>) => fn(transaction),
  };
  return { db: db as unknown as AdminFirestore, log, writes };
}

const DOCS: Record<string, Doc> = {
  'properties/a3': { _v: 4, buildingId: 'A' },
  'parking_spots/free': { number: 'Π-1' },
  'parking_spots/other': { number: 'Π-5', buildingId: 'B' },
  'storage_units/s1': { name: 'Α-1' },
};
const LINKS = [
  { spaceId: 'free', spaceType: 'parking' },
  { spaceId: 'other', spaceType: 'parking' },
  { spaceId: 's1', spaceType: 'storage' },
  { spaceId: 'ghost', spaceType: 'parking' },
  { spaceId: 'odd', spaceType: 'boat' },
];

describe('spacePlacementCompanion μέσα στο withVersionCheck', () => {
  it('διαβάζει ΠΡΙΝ γράψει · γράφει μονάδα ΚΑΙ μόνο τους χώρους χωρίς κτίριο · χώρος σε άλλο κτίριο ανέγγιχτος', async () => {
    const { db, log, writes } = fakeDb(DOCS);
    let placed: readonly PlacedSpace[] = [];
    const unit = { id: 'a3', name: 'Α3', buildingId: 'A', linkedSpaces: LINKS };
    await withVersionCheck({
      db, collection: 'properties', docId: 'a3', expectedVersion: 4, updates: { linkedSpaces: LINKS }, userId: 'u1',
      companion: spacePlacementCompanion(db, unit, 'u1', (p) => { placed = p; }),
    });
    const firstWrite = log.findIndex((entry) => entry.startsWith('write'));
    expect(log.slice(firstWrite).every((entry) => entry.startsWith('write'))).toBe(true);
    expect(writes.map((w) => w.path)).toEqual(['properties/a3', 'parking_spots/free', 'storage_units/s1']);
    expect(writes[1].data).toMatchObject({ buildingId: 'A', updatedBy: 'u1' });
    expect(placed.map((p) => [p.placement.spaceId, p.placement.buildingId])).toEqual([['free', 'A'], ['s1', 'A']]);
  });

  it('μονάδα χωρίς κτίριο ⇒ καμία τοποθέτηση, μόνο η μονάδα', async () => {
    const { db, writes } = fakeDb(DOCS);
    const unit = { id: 'a3', name: 'Α3', buildingId: null, linkedSpaces: LINKS };
    await withVersionCheck({
      db, collection: 'properties', docId: 'a3', updates: {}, userId: 'u1',
      companion: spacePlacementCompanion(db, unit, 'u1', () => undefined),
    });
    expect(writes.map((w) => w.path)).toEqual(['properties/a3']);
  });

  it('χωρίς συνοδό: η συμπεριφορά του withVersionCheck δεν αλλάζει', async () => {
    const { db, writes } = fakeDb(DOCS);
    await withVersionCheck({ db, collection: 'properties', docId: 'a3', updates: { name: 'x' }, userId: 'u1' });
    expect(writes.map((w) => w.path)).toEqual(['properties/a3']);
  });
});

describe('announceSpacePlacements', () => {
  it('ΕΝΑΣ linkEntity ανά τοποθέτηση, με κλειδί είδους και το έγγραφο ΠΡΙΝ (παλιά τιμή = κενό)', () => {
    const ctx = { uid: 'u1', companyId: 'c1' } as AuthContext;
    announceSpacePlacements(ctx, [
      { placement: { spaceId: 'free', kind: 'parking', name: 'Π-1', buildingId: 'A', unitId: 'a3' }, before: { number: 'Π-1' } },
      { placement: { spaceId: 's1', kind: 'storage', name: 'Α-1', buildingId: 'A', unitId: 'a3' }, before: { name: 'Α-1' } },
    ], '/api/properties/[id] (PATCH)');
    expect(linkEntity).toHaveBeenCalledWith('parking:buildingId', expect.objectContaining({
      entityId: 'free', newLinkValue: 'A', existingDoc: { number: 'Π-1' },
    }));
    expect(linkEntity).toHaveBeenCalledWith('storage:buildingId', expect.objectContaining({ entityId: 's1', newLinkValue: 'A' }));
  });
});
