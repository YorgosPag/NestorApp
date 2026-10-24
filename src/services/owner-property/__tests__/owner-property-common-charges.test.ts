/**
 * @jest-environment node
 *
 * @fileoverview ADR-777 §8.93 — **ο γραφέας των κοινοχρήστων του ιδιώτη**: θεματοφυλακή από τη μία αρχή, μερική
 * διόρθωση μέσα στην **κοινή** συναλλαγή (`owner-property-amendment.ts`), ίχνος, και η δήλωση στη δημόσια αγγελία.
 * @related services/owner-property/owner-property-common-charges.service.ts · lib/common-charges/common-charges.ts
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

type RecordCall = Record<string, unknown>;

const recordChange = jest.fn<Promise<string | null>, [RecordCall]>();

jest.mock('@/services/entity-audit.service', () => {
  const actual = jest.requireActual('@/services/entity-audit.service');
  class RecordingAuditService extends actual.EntityAuditService {
    static override recordChange(params: RecordCall): Promise<string | null> {
      return recordChange(params);
    }
  }
  return { ...actual, EntityAuditService: RecordingAuditService };
});
jest.mock('@/services/listings/public-shelf.service', () => ({
  reconcilePublicShelf: async () => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 }),
}));
jest.mock('@/services/listings/public-shelf-model.service', () => ({
  reconcilePublicModelShelf: async () => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 }),
}));
jest.mock('@/services/listings/public-shelf-video.service', () => ({
  reconcilePublicVideoShelf: async () => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 }),
}));
// ADR-920 Β3β — το κεφάλι του εδάφους: αλλιώς το αληθινό θα ζητούσε κάδο.
jest.mock('@/services/listings/public-shelf-terrain.service', () => ({
  reconcilePublicTerrainShelf: async () => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 }),
}));
jest.mock('@/services/mandate/showcase-presence.service', () => ({
  refreshShowcasePresence: async () => undefined,
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { COLLECTIONS } = require('@/config/firestore-collections') as typeof import('@/config/firestore-collections');
const { FakeFirestore } = require('@/test-utils/fake-firestore/fake-firestore') as
  typeof import('@/test-utils/fake-firestore/fake-firestore');
const { validOwnerProperty } = require('@/lib/owner-property/__tests__/owner-property-fixtures') as
  typeof import('@/lib/owner-property/__tests__/owner-property-fixtures');
const { setOwnerPropertyCommonCharges: setCharges } = require('../owner-property-common-charges.service') as
  typeof import('../owner-property-common-charges.service');
/* eslint-enable @typescript-eslint/no-require-imports */

const OWNER = { uid: 'user-1', companyId: null };
const STRANGER = { uid: 'user-2', companyId: null };

function seeded() {
  const property = validOwnerProperty();
  const db = new FakeFirestore();
  db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);
  return { property, db, adminDb: db as unknown as AdminFirestore };
}

function docOf(db: InstanceType<typeof FakeFirestore>, collection: string, id: string): Record<string, unknown> | undefined {
  return db.all<Record<string, unknown>>(collection).find((doc) => doc.id === id);
}

beforeEach(() => {
  recordChange.mockReset();
  recordChange.mockResolvedValue('eaud_test');
});

describe('Κ1 — θεματοφυλακή και εγγραφή', () => {
  it('ο κάτοχος γράφει · η δήλωση φτάνει στο έγγραφο ΚΑΙ στη δημόσια αγγελία', async () => {
    const { property, db, adminDb } = seeded();

    const result = await setCharges(adminDb, property.id, { monthlyAmount: 120 }, OWNER);

    expect(result.kind).toBe('saved');
    expect(docOf(db, COLLECTIONS.OWNER_PROPERTIES, property.id)?.commonCharges).toEqual({ monthlyAmount: 120, includes: null });
    expect(docOf(db, COLLECTIONS.PUBLIC_LISTINGS, property.id)?.commonCharges).toEqual({ monthlyAmount: 120, includes: null });
  });

  it('ξένος ή ανύπαρκτη αγγελία ⇒ `absent` — και τίποτα δεν γράφεται', async () => {
    const { property, db, adminDb } = seeded();

    expect(await setCharges(adminDb, property.id, { monthlyAmount: 120 }, STRANGER)).toEqual({ kind: 'absent' });
    expect(await setCharges(adminDb, 'ownp_missing', { monthlyAmount: 120 }, OWNER)).toEqual({ kind: 'absent' });

    expect(docOf(db, COLLECTIONS.OWNER_PROPERTIES, property.id)?.commonCharges).toEqual({ monthlyAmount: null, includes: null });
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('🔴 το `0` ταξιδεύει ως απάντηση («χωρίς κοινόχρηστα»), όχι ως απουσία', async () => {
    const { property, db, adminDb } = seeded();

    await setCharges(adminDb, property.id, { monthlyAmount: 0 }, OWNER);

    expect(docOf(db, COLLECTIONS.PUBLIC_LISTINGS, property.id)?.commonCharges).toEqual({ monthlyAmount: 0, includes: null });
  });
});

describe('Κ2 — 🔴 μερική διόρθωση: καμία απάντηση δεν σβήνει την άλλη', () => {
  it('ποσό και «τι περιλαμβάνουν» σε δύο χωριστές απαντήσεις επιβιώνουν και τα δύο', async () => {
    const { property, db, adminDb } = seeded();

    await setCharges(adminDb, property.id, { monthlyAmount: 120 }, OWNER);
    await setCharges(adminDb, property.id, { includes: ['elevator', 'heating'] }, OWNER);

    expect(docOf(db, COLLECTIONS.OWNER_PROPERTIES, property.id)?.commonCharges).toEqual({
      monthlyAmount: 120,
      includes: ['heating', 'elevator'],
    });
  });

  it('δύο απαντήσεις ΤΑΥΤΟΧΡΟΝΑ ⇒ και οι δύο στο έγγραφο (συναλλαγή πάνω στο φρέσκο έγγραφο)', async () => {
    const { property, db, adminDb } = seeded();
    await setCharges(adminDb, property.id, { monthlyAmount: 120 }, OWNER);

    await Promise.all([
      setCharges(adminDb, property.id, { monthlyAmount: 150 }, OWNER),
      setCharges(adminDb, property.id, { includes: ['water'] }, OWNER),
    ]);

    expect(docOf(db, COLLECTIONS.OWNER_PROPERTIES, property.id)?.commonCharges).toEqual({ monthlyAmount: 150, includes: ['water'] });
  });

  it('το ποσό σβήνεται ⇒ ο προσδιοριστής φεύγει μαζί του (ποτέ ορφανός)', async () => {
    const { property, db, adminDb } = seeded();
    await setCharges(adminDb, property.id, { monthlyAmount: 120, includes: ['heating'] }, OWNER);

    await setCharges(adminDb, property.id, { monthlyAmount: null }, OWNER);

    expect(docOf(db, COLLECTIONS.OWNER_PROPERTIES, property.id)?.commonCharges).toEqual({ monthlyAmount: null, includes: null });
  });

  it('τα υπόλοιπα πεδία της αγγελίας μένουν ανέγγιχτα', async () => {
    const { property, db, adminDb } = seeded();

    await setCharges(adminDb, property.id, { monthlyAmount: 120 }, OWNER);

    const stored = docOf(db, COLLECTIONS.OWNER_PROPERTIES, property.id);
    expect(stored?.title).toBe(property.title);
    expect(stored?.objectiveValueDeclarations).toEqual(property.objectiveValueDeclarations);
    expect(stored?.offers).toEqual(property.offers);
  });
});

describe('Κ3 — το ίχνος', () => {
  it('ΕΝΑ ίχνος, με το πεδίο που άλλαξε', async () => {
    const { property, adminDb } = seeded();

    await setCharges(adminDb, property.id, { monthlyAmount: 120 }, OWNER);

    expect(recordChange).toHaveBeenCalledTimes(1);
    const changes = recordChange.mock.calls[0][0].changes as ReadonlyArray<{ readonly field: string }>;
    expect(changes.map((change) => change.field)).toEqual(['commonCharges.monthlyAmount']);
  });

  it('ίδια τιμή ξανά ⇒ κανένα νέο ίχνος αλλαγής πεδίου', async () => {
    const { property, adminDb } = seeded();
    await setCharges(adminDb, property.id, { monthlyAmount: 120 }, OWNER);
    recordChange.mockClear();

    await setCharges(adminDb, property.id, { monthlyAmount: 120 }, OWNER);

    const fields = recordChange.mock.calls.flatMap(
      (call) => (call[0].changes as ReadonlyArray<{ readonly field: string }>).map((change) => change.field),
    );
    expect(fields).not.toContain('commonCharges.monthlyAmount');
  });
});
