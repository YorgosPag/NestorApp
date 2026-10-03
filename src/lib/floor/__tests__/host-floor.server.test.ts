/**
 * ⚓ ADR-903 §6 — ο ΕΝΑΣ συγγραφέας του αντιγράφου: ο όροφος περνά από τον φύλακα του πόρου
 * (ξένος ≡ ανύπαρκτος ⇒ 404) και πρέπει να ανήκει στο **ίδιο** κτίριο (αλλιώς 400).
 */

jest.mock('server-only', () => ({}));

const FLOORS: Record<string, Record<string, unknown>> = {
  own: { companyId: 'c1', buildingId: 'b1', number: -1, kind: 'basement' },
  other_building: { companyId: 'c1', buildingId: 'b2', number: 0 },
  no_number: { companyId: 'c1', buildingId: 'b1' },
};

jest.mock('@/app/api/floors/_shared/floor-ownership', () => ({
  floorResource: {
    notFoundMessage: 'Floor not found',
    load: async ({ docId, caller, refusal }: { docId: string; caller: { companyId: string }; refusal: () => unknown }) => {
      const data = FLOORS[docId];
      // Ο αληθινός φύλακας: ανύπαρκτο ΚΑΙ ξένο ⇒ το ίδιο «όχι».
      if (!data || data.companyId !== caller.companyId) return { refusal: refusal() };
      return { doc: { id: docId, ref: {}, data } };
    },
  },
}));

import { loadHostFloor, resolveHostedFloorForCreate, resolveHostedFloorPatch, FLOOR_NOT_IN_BUILDING } from '../host-floor.server';
import type { AuthContext } from '@/lib/auth';
import type { Firestore } from 'firebase-admin/firestore';

const db = {} as Firestore;
const ctx = { uid: 'u', companyId: 'c1', globalRole: 'user' } as unknown as AuthContext;
const foreignCtx = { uid: 'u', companyId: 'c2', globalRole: 'user' } as unknown as AuthContext;

async function statusOf(promise: Promise<unknown>): Promise<number | undefined> {
  try { await promise; return undefined; } catch (e) { return (e as { statusCode?: number }).statusCode; }
}

describe('loadHostFloor', () => {
  it('δικός όροφος, ίδιο κτίριο ⇒ αντίγραφο από το έγγραφο', async () => {
    await expect(loadHostFloor(db, ctx, 'own', 'b1')).resolves.toEqual({ floorId: 'own', floor: -1, floorKind: 'basement' });
  });
  it('🔒 ξένος όροφος ⇒ 404 (ίδιο με ανύπαρκτο — κανένα μαντείο)', async () => {
    expect(await statusOf(loadHostFloor(db, foreignCtx, 'own', 'b1'))).toBe(404);
    expect(await statusOf(loadHostFloor(db, ctx, 'missing', 'b1'))).toBe(404);
  });
  it('όροφος ΑΛΛΟΥ κτιρίου ⇒ 400', async () => {
    await expect(loadHostFloor(db, ctx, 'other_building', 'b1')).rejects.toMatchObject({ statusCode: 400, message: FLOOR_NOT_IN_BUILDING });
  });
  it('χώρος χωρίς κτίριο δεν φιλοξενείται σε όροφο ⇒ 400', async () => {
    expect(await statusOf(loadHostFloor(db, ctx, 'own', null))).toBe(400);
  });
  it('όροφος χωρίς αριθμό ⇒ 400, ποτέ σιωπηλό 0', async () => {
    expect(await statusOf(loadHostFloor(db, ctx, 'no_number', 'b1'))).toBe(400);
  });
});

describe('resolveHostedFloorForCreate / Patch', () => {
  it('δημιουργία χωρίς `floorId` ⇒ τίποτα', async () => {
    await expect(resolveHostedFloorForCreate(db, ctx, undefined, 'b1')).resolves.toEqual({});
    await expect(resolveHostedFloorForCreate(db, ctx, '  ', 'b1')).resolves.toEqual({});
  });
  it('PATCH: αλλαγή κτιρίου χωρίς όροφο ⇒ καθαρίζουν και τα τρία', async () => {
    await expect(resolveHostedFloorPatch(db, ctx, { buildingId: 'b2' }, { buildingId: 'b1', floorId: 'own' }))
      .resolves.toEqual({ floorId: null, floor: null, floorKind: null });
  });
  it('PATCH: όροφος του ΠΑΛΙΟΥ κτιρίου μαζί με νέο κτίριο ⇒ 400', async () => {
    expect(await statusOf(resolveHostedFloorPatch(db, ctx, { buildingId: 'b2', floorId: 'own' }, { buildingId: 'b1' }))).toBe(400);
  });
  it('PATCH χωρίς σχετικά πεδία ⇒ τίποτα (το αποθηκευμένο μένει)', async () => {
    await expect(resolveHostedFloorPatch(db, ctx, { area: 3 }, { buildingId: 'b1', floorId: 'own' })).resolves.toEqual({});
  });
});
