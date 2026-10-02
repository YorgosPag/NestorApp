/**
 * ADR-898 Φ3β-3 — **οι δηλώσεις της αντικειμενικής σε ακίνητο γραφείου**: ο κλάδος του `PATCH /api/properties/[id]`.
 *
 * Τι αποδεικνύει: (1) **μερική** διόρθωση — οι υπόλοιπες απαντήσεις επιβιώνουν (ένα σκέτο `update(body)` θα αντικαθιστούσε
 * όλο το αντικείμενο) · (2) η διόρθωση εφαρμόζεται στο **φρέσκο** έγγραφο της συναλλαγής, όχι στο `existing` που
 * διαβάστηκε πριν · (3) σχήμα · μοναξιά του κλειδιού · κλείδωμα (πριν ΚΑΙ μέσα) · κανόνες με ρολόι · μέτωπο (422/503) ·
 * (4) `_v` ανεβαίνει, ένα ίχνος, μία επαναπροβολή.
 */

import { ApiError } from '@/lib/api/ApiErrorHandler';
import type { AuthContext } from '@/lib/auth';
import type { AdminFirestore } from '@/lib/api/guarded-route';

jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'SERVER_TS' } }));

const recordChange = jest.fn(() => Promise.resolve());
jest.mock('@/services/entity-audit.service', () => {
  const real = jest.requireActual('@/lib/audit/audit-diff');
  return {
    EntityAuditService: {
      diffFieldsWithResolution: async (before: Record<string, unknown>, after: Record<string, unknown>, tracked: Record<string, unknown>) =>
        real.diffTrackedFields(before, after, tracked),
      recordChange: (...args: unknown[]) => recordChange(...(args as [])),
    },
  };
});

const republish = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('../property-publish-projection', () => ({
  republishPublicProjection: (...args: unknown[]) => republish(...args),
}));

jest.mock('@/services/listings/publish-public-listing', () => ({
  collectPlaceKnowledge: async () => ({ candidates: [], ref: null, buildingConstructionYear: null }),
}));

let zoneVerdict: { kind: string; [key: string]: unknown } = { kind: 'unavailable' };
jest.mock('@/services/market/zone-front-verdict', () => ({
  zoneFrontVerdict: async (patch: { zoneFront?: { kind: string } | null }) =>
    patch.zoneFront?.kind === 'street' ? zoneVerdict.kind : 'accepted',
}));

import { patchPropertyObjectiveValue } from '../property-objective-value-patch';

/** Ψεύτικη βάση: ένα έγγραφο, συναλλαγές σειριακές (όπως εγγυάται το Firestore για το ίδιο έγγραφο). */
function fakeDb(initial: Record<string, unknown>) {
  const doc = { data: { ...initial } as Record<string, unknown> };
  const ref = {};
  const db = {
    collection: () => ({ doc: () => ref }),
    runTransaction: async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
      fn({
        get: async () => ({ exists: true, data: () => ({ ...doc.data }) }),
        update: (_ref: unknown, updates: Record<string, unknown>) => {
          doc.data = { ...doc.data, ...updates };
        },
      }),
  };
  return { db: db as unknown as AdminFirestore, doc };
}

const ctx = { uid: 'u1', email: 'a@b.gr', companyId: 'co1' } as unknown as AuthContext;

async function run(db: AdminFirestore, existing: Record<string, unknown>, body: Record<string, unknown>) {
  return patchPropertyObjectiveValue({ adminDb: db, id: 'prop_1', existing, body, ctx });
}

beforeEach(() => {
  recordChange.mockClear();
  republish.mockClear();
  zoneVerdict = { kind: 'unavailable' };
});

describe('patchPropertyObjectiveValue — μερική διόρθωση σε συναλλαγή', () => {
  it('🔴 οι υπόλοιπες απαντήσεις ΕΠΙΒΙΩΝΟΥΝ — και εκείνη που γράφτηκε ΜΕΤΑ την ανάγνωση του `existing`', async () => {
    const stale = { name: 'Δ1', _v: 3, objectiveValueDeclarations: { frontage: 'single' } };
    // Στο μεταξύ άλλη απάντηση έφτασε στη βάση (ανελκυστήρας) — το `existing` δεν την ξέρει.
    const { db, doc } = fakeDb({ ...stale, _v: 4, objectiveValueDeclarations: { frontage: 'single', hasElevator: true } });
    const response = await run(db, stale, { objectiveValueDeclarations: { permitDate: '2001-05-01' } });
    expect(response.status).toBe(200);
    expect(doc.data.objectiveValueDeclarations).toEqual(
      expect.objectContaining({ frontage: 'single', hasElevator: true, permitDate: '2001-05-01', display: 'shown' }),
    );
    expect(doc.data._v).toBe(5);
    expect(doc.data.updatedBy).toBe('u1');
  });

  it('ένα ίχνος με ΜΟΝΟ το πεδίο που άλλαξε · μία επαναπροβολή με το νέο έγγραφο', async () => {
    const existing = { name: 'Δ1', objectiveValueDeclarations: { frontage: 'single' } };
    const { db } = fakeDb(existing);
    await run(db, existing, { objectiveValueDeclarations: { display: 'hidden' } });
    expect(recordChange).toHaveBeenCalledTimes(1);
    const [entry] = recordChange.mock.calls[0] as unknown as [{ changes: { field: string }[] }];
    expect(entry.changes.map((change) => change.field)).toEqual(['objectiveValueDeclarations.display']);
    expect(republish).toHaveBeenCalledTimes(1);
    const projected = republish.mock.calls[0]?.[2] as { objectiveValueDeclarations: { display: string } };
    expect(projected.objectiveValueDeclarations.display).toBe('hidden');
  });
});

describe('patchPropertyObjectiveValue — αρνήσεις', () => {
  const existing = { name: 'Δ1' };

  it('μαζί με άλλο πεδίο ⇒ 400 (μισή εφαρμογή δύο πράξεων = σιωπηλή ασυνέπεια)', async () => {
    const { db, doc } = fakeDb(existing);
    await expect(run(db, existing, { objectiveValueDeclarations: { hasElevator: true }, name: 'Χ' })).rejects.toMatchObject({ statusCode: 400 });
    expect(doc.data.objectiveValueDeclarations).toBeUndefined();
  });

  it('άκυρο σχήμα (άγνωστο κλειδί · κενό) ⇒ 400', async () => {
    const { db } = fakeDb(existing);
    await expect(run(db, existing, { objectiveValueDeclarations: { amount: 1 } })).rejects.toBeInstanceOf(ApiError);
    await expect(run(db, existing, { objectiveValueDeclarations: {} })).rejects.toBeInstanceOf(ApiError);
  });

  it('πουλημένο ⇒ 403 πριν από κάθε εγγραφή', async () => {
    const sold = { ...existing, commercialStatus: 'sold' };
    const { db, doc } = fakeDb(sold);
    await expect(run(db, sold, { objectiveValueDeclarations: { hasElevator: true } })).rejects.toMatchObject({ statusCode: 403 });
    expect(doc.data.objectiveValueDeclarations).toBeUndefined();
  });

  it('🔴 πουλήθηκε ΣΤΟ ΜΕΤΑΞΥ (το `existing` λέει ελεύθερο) ⇒ 403 μέσα στη συναλλαγή, τίποτα δεν γράφεται', async () => {
    const { db, doc } = fakeDb({ ...existing, commercialStatus: 'sold' });
    await expect(run(db, existing, { objectiveValueDeclarations: { hasElevator: true } })).rejects.toMatchObject({ statusCode: 403 });
    expect(doc.data.objectiveValueDeclarations).toBeUndefined();
  });

  it('μελλοντική άδεια ⇒ 422 με τον κωδικό', async () => {
    const { db } = fakeDb(existing);
    const response = await run(db, existing, { objectiveValueDeclarations: { permitDate: '2999-01-01' } });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'INVALID_DECLARATIONS', violations: ['permitDateInFuture'] });
  });

  it('μέτωπο: ζώνες που δεν διαβάστηκαν ⇒ 503 (ποτέ «άκυρο») · δρόμος που δεν είναι μέτωπο ⇒ 422', async () => {
    const { db, doc } = fakeDb(existing);
    const street = { objectiveValueDeclarations: { zoneFront: { kind: 'street', street: 'Εγνατία' } } };
    zoneVerdict = { kind: 'zone-unverified' };
    expect((await run(db, existing, street)).status).toBe(503);
    zoneVerdict = { kind: 'not-candidate' };
    const refused = await run(db, existing, street);
    expect(refused.status).toBe(422);
    expect(await refused.json()).toEqual({ error: 'INVALID_DECLARATIONS', violations: ['zoneFrontNotCandidate'] });
    expect(doc.data.objectiveValueDeclarations).toBeUndefined();
  });
});
