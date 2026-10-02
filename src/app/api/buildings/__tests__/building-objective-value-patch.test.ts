/**
 * ADR-898 Φ4 — **τα γεγονότα της αντικειμενικής στο κτίριο**: ο κλάδος του `PATCH /api/buildings`.
 *
 * Τι αποδεικνύει: (1) **μερική** διόρθωση πάνω στο **φρέσκο** έγγραφο — ένα σκέτο `update(body)` θα έσβηνε τα αδέλφια ·
 * (2) σχήμα · μοναξιά του κλειδιού · άδεια στο μέλλον (422) · (3) `_v` ανεβαίνει, ένα ίχνος με μόνο ό,τι άλλαξε.
 */

import { ApiError } from '@/lib/api/ApiErrorHandler';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import type { AuthContext } from '@/lib/auth';

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

import { patchBuildingObjectiveValue } from '../building-objective-value-patch';

/** Ψεύτικη βάση: ένα έγγραφο, συναλλαγές σειριακές (όπως εγγυάται το Firestore για το ίδιο έγγραφο). */
function fakeDb(initial: Record<string, unknown>) {
  const doc = { data: { ...initial } as Record<string, unknown> };
  const db = {
    collection: () => ({ doc: () => ({}) }),
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

const run = (db: AdminFirestore, body: Record<string, unknown>) =>
  patchBuildingObjectiveValue({ adminDb: db, buildingId: 'bld_1', body: { buildingId: 'bld_1', ...body }, ctx });

beforeEach(() => recordChange.mockClear());

describe('patchBuildingObjectiveValue — μερική διόρθωση σε συναλλαγή', () => {
  it('🔴 τα αδέλφια ΕΠΙΒΙΩΝΟΥΝ — η διόρθωση πάνω στο φρέσκο έγγραφο', async () => {
    const { db, doc } = fakeDb({ name: 'Κ1', _v: 2, objectiveValueFacts: { plotUtilisation: 0.8, declaredStage: 'frame' } });
    const response = await run(db, { objectiveValueFacts: { permitDate: '2024-05-01' }, _v: 1 });
    expect(response.status).toBe(200);
    expect(doc.data.objectiveValueFacts).toEqual({ permitDate: '2024-05-01', plotUtilisation: 0.8, declaredStage: 'frame', hasElevator: null, hasCentralHeating: null });
    expect(doc.data._v).toBe(3);
  });

  it('ρητό `null` σβήνει ΜΟΝΟ αυτό το γεγονός · ένα ίχνος με ΜΟΝΟ το πεδίο που άλλαξε', async () => {
    const { db, doc } = fakeDb({ name: 'Κ1', objectiveValueFacts: { plotUtilisation: 0.8, declaredStage: 'frame' } });
    await run(db, { objectiveValueFacts: { declaredStage: null } });
    expect(doc.data.objectiveValueFacts).toEqual({ permitDate: null, plotUtilisation: 0.8, declaredStage: null, hasElevator: null, hasCentralHeating: null });
    expect(recordChange).toHaveBeenCalledTimes(1);
    const [entry] = recordChange.mock.calls[0] as unknown as [{ entityType: string; changes: { field: string }[] }];
    expect(entry.entityType).toBe('building');
    expect(entry.changes.map((change) => change.field)).toEqual(['objectiveValueFacts.declaredStage']);
  });
});

describe('patchBuildingObjectiveValue — αρνήσεις', () => {
  it('μαζί με άλλο πεδίο ⇒ 400, καμία εγγραφή', async () => {
    const { db, doc } = fakeDb({ name: 'Κ1' });
    await expect(run(db, { objectiveValueFacts: { plotUtilisation: 1 }, name: 'Χ' })).rejects.toMatchObject({ statusCode: 400 });
    expect(doc.data.objectiveValueFacts).toBeUndefined();
  });

  it('άκυρο σχήμα (άγνωστο κλειδί · κενό · ΣΑΟ ≤ 0 · άγνωστο στάδιο · ποσό) ⇒ 400', async () => {
    const { db } = fakeDb({});
    for (const facts of [{ amount: 1 }, {}, { plotUtilisation: 0 }, { declaredStage: 'roof' }, { value: 120000 }]) {
      await expect(run(db, { objectiveValueFacts: facts })).rejects.toBeInstanceOf(ApiError);
    }
  });

  it('άδεια στο μέλλον ⇒ 422 με τον ΙΔΙΟ κωδικό με τις δηλώσεις της αγγελίας', async () => {
    const { db, doc } = fakeDb({});
    const response = await run(db, { objectiveValueFacts: { permitDate: '2999-01-01' } });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'INVALID_FACTS', violations: ['permitDateInFuture'] });
    expect(doc.data.objectiveValueFacts).toBeUndefined();
  });
});
