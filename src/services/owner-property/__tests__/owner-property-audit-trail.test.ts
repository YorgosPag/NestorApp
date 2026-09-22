/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ Β2 · Β2β του ADR-864 Φ1β** — κάθε πράξη στην αγγελία γράφει **ακριβώς
 * ένα** ίχνος, με σωστή διαφορά, στο βιβλίο της **θεματοφυλακής** — όχι του δρώντος.
 * @related ADR-864 Φ1β · ADR-195 §«Προσωπικό βιβλίο» · services/owner-property/owner-property-audit.ts
 *
 * Εκτελεί τις **πραγματικές** πράξεις (`create` · `update` · `setLifecycle` · `setAudience`) πάνω σε
 * ψεύτικη Firestore, με τον **πραγματικό** υπολογισμό διαφοράς (`EntityAuditService.diffFields` +
 * `OWNER_PROPERTY_TRACKED_FIELDS`). Μοκάρεται **μόνο** η γραφή του ίχνους (`recordChange`), για να
 * μετρηθεί τι της ζητήθηκε, και τα κεφάλια των ραφιών (αλλιώς GCS).
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | το `persist` δεν καλεί το ίχνος | Β2 ⇒ 🔴 |
 * | ίχνος **πριν** τη γραφή | «αποτυχημένη γραφή ⇒ μηδέν» ⇒ 🔴 |
 * | εμβέλεια από τον **δρώντα** αντί θεματοφυλακής | Β2β ⇒ 🔴 |
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
jest.mock('@/services/mandate/showcase-presence.service', () => ({
  refreshShowcasePresence: async () => undefined,
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { COLLECTIONS } = require('@/config/firestore-collections') as
  typeof import('@/config/firestore-collections');
const { FakeFirestore } = require('@/services/places/__tests__/fake-firestore') as
  typeof import('@/services/places/__tests__/fake-firestore');
const { validDraft, validOwnerProperty, offerOf } = require('@/lib/owner-property/__tests__/owner-property-fixtures') as
  typeof import('@/lib/owner-property/__tests__/owner-property-fixtures');
const write = require('../owner-property-write.service') as
  typeof import('../owner-property-write.service');
/* eslint-enable @typescript-eslint/no-require-imports */

const CITIZEN = { uid: 'user-1', companyId: null };

function seeded(overrides: Parameters<typeof validOwnerProperty>[0] = {}) {
  const property = validOwnerProperty(overrides);
  const db = new FakeFirestore();
  db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);
  return { property, db, adminDb: db as unknown as AdminFirestore };
}

/** Η **μία** κλήση ίχνους — αποτυγχάνει αν έγιναν μηδέν ή δύο. */
function onlyRecord(): RecordCall {
  expect(recordChange).toHaveBeenCalledTimes(1);
  return recordChange.mock.calls[0][0];
}

function changedFields(call: RecordCall): string[] {
  return (call.changes as ReadonlyArray<{ field: string }>).map((c) => c.field).sort();
}

beforeEach(() => {
  recordChange.mockReset();
  recordChange.mockResolvedValue('eaud_test');
});

describe('🏆 Β2 — κάθε πράξη ⇒ ΑΚΡΙΒΩΣ ΕΝΑ ίχνος, με σωστή διαφορά και ενέργεια', () => {
  it('απόσυρση ⇒ `status_changed`, μόνο `lifecycle`, προσωπικό βιβλίο', async () => {
    const { property, adminDb } = seeded();

    const result = await write.setOwnerPropertyLifecycle(adminDb, property.id, 'withdrawn', CITIZEN);

    expect(result.kind).toBe('saved');
    const call = onlyRecord();
    expect(call).toMatchObject({
      entityType: 'owner_property',
      entityId: property.id,
      action: 'status_changed',
      performedBy: 'user-1',
      userId: 'user-1',
    });
    expect(call).not.toHaveProperty('companyId');
    expect(call.changes).toEqual([
      expect.objectContaining({ field: 'lifecycle', oldValue: 'listed', newValue: 'withdrawn' }),
    ]);
  });

  it('αλλαγή κοινού ⇒ `updated`, μόνο `marketingAudience`', async () => {
    const { property, adminDb } = seeded();

    await write.setOwnerPropertyAudience(adminDb, property.id, 'custodians', CITIZEN);

    const call = onlyRecord();
    expect(call.action).toBe('updated');
    expect(call.changes).toEqual([
      expect.objectContaining({ field: 'marketingAudience', oldValue: 'public', newValue: 'custodians' }),
    ]);
  });

  it('αλλαγή τιμής διάθεσης ⇒ `updated` στη συλλογή `offers` (ιστορικό τιμής)', async () => {
    const { property, adminDb } = seeded();
    const draft = validDraft({ offers: [offerOf('sell', 195_000)] });

    const result = await write.updateOwnerProperty(adminDb, property.id, draft, CITIZEN);

    expect(result.kind).toBe('saved');
    const call = onlyRecord();
    expect(call.action).toBe('updated');
    expect(changedFields(call)).toEqual(['offers']);
  });

  it('γέννηση ⇒ `created` με τις αρχικές τιμές', async () => {
    const db = new FakeFirestore();
    const authorship = { id: 'ownp_new', authorUserId: 'user-1', authorCompanyId: null, mandates: [], dossierId: null };

    const result = await write.createOwnerProperty(db as unknown as AdminFirestore, authorship, validDraft());

    expect(result.kind).toBe('saved');
    const call = onlyRecord();
    expect(call).toMatchObject({ action: 'created', entityId: 'ownp_new', userId: 'user-1' });
    expect(changedFields(call)).toEqual(expect.arrayContaining(['title', 'offers', 'lifecycle']));
  });

  it('🔑 ιδεμπότητα: «απόσυρε» σε ήδη αποσυρμένη ⇒ ΜΗΔΕΝ εγγραφές', async () => {
    const { property, adminDb } = seeded({ lifecycle: 'withdrawn' });

    await write.setOwnerPropertyLifecycle(adminDb, property.id, 'withdrawn', CITIZEN);

    expect(recordChange).not.toHaveBeenCalled();
  });

  it('🔴 αποτυχημένη γραφή ⇒ ΜΗΔΕΝ εγγραφές (ίχνος για πράξη που δεν έγινε = ψέμα)', async () => {
    const { property, adminDb } = seeded();
    const authorship = { id: property.id, authorUserId: 'user-1', authorCompanyId: null, mandates: [], dossierId: null };

    const result = await write.createOwnerProperty(adminDb, authorship, validDraft());

    expect(result.kind).toBe('failed');
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('ξένος ⇒ `absent` και ΜΗΔΕΝ εγγραφές', async () => {
    const { property, adminDb } = seeded();

    await write.setOwnerPropertyLifecycle(adminDb, property.id, 'withdrawn', { uid: 'intruder', companyId: null });

    expect(recordChange).not.toHaveBeenCalled();
  });
});

describe('🏆 Β2β — το βιβλίο το αποφασίζει η ΘΕΜΑΤΟΦΥΛΑΚΗ, όχι ο δρων', () => {
  it('🔴 μέλος εταιρείας σε ΠΡΟΣΩΠΙΚΗ αγγελία του ⇒ προσωπικό βιβλίο, ΚΑΝΕΝΑ `companyId`', async () => {
    const { property, adminDb } = seeded();
    const brokerAsCitizen = { uid: 'user-1', companyId: 'comp_agency' };

    await write.setOwnerPropertyLifecycle(adminDb, property.id, 'withdrawn', brokerAsCitizen);

    const call = onlyRecord();
    expect(call.userId).toBe('user-1');
    expect(call).not.toHaveProperty('companyId');
  });

  it('αγγελία ΓΡΑΦΕΙΟΥ ⇒ εταιρικό βιβλίο· δράστης ο υπάλληλος', async () => {
    const { property, adminDb } = seeded({ authorUserId: 'agent-7', authorCompanyId: 'comp_agency' });
    const colleague = { uid: 'agent-9', companyId: 'comp_agency' };

    await write.setOwnerPropertyAudience(adminDb, property.id, 'custodians', colleague);

    const call = onlyRecord();
    expect(call).toMatchObject({ companyId: 'comp_agency', performedBy: 'agent-9' });
    expect(call).not.toHaveProperty('userId');
  });
});
