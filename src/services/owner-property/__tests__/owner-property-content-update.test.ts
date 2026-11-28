/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ ADR-953 §3.4** — η αποθήκευση περιεχομένου γράφει μόνο ό,τι άλλαξε ο άνθρωπος, πάνω
 * στο φρέσκο έγγραφο, και ρωτά μόνο στο ίδιο πεδίο.
 * @related services/owner-property/owner-property-content-update.ts · lib/owner-property/owner-property-edit.ts
 *
 * Εκτελεί την **πραγματική** `updateOwnerProperty` πάνω σε ψεύτικη Firestore. Μοκάρονται μόνο η γραφή του ίχνους
 * και τα κεφάλια των ραφιών (αλλιώς GCS) — ίδια διάταξη με το `owner-property-audit-trail.test.ts`.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | `{ ...existing, ...draft }` αντί για συγχώνευση | «παλιά καρτέλα» ⇒ 🔴 |
 * | η σύγκρουση γράφει παρ' όλα αυτά | «τίποτα δεν γράφτηκε» ⇒ 🔴 |
 * | η έκδοση περιεχομένου δεν ανεβαίνει | «η δεύτερη καρτέλα ρωτιέται» ⇒ 🔴 |
 */

import '@/test-utils/public-shelf-double';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('@/services/entity-audit.service', () => {
  const actual = jest.requireActual('@/services/entity-audit.service');
  class SilentAuditService extends actual.EntityAuditService {
    static override recordChange(): Promise<string | null> {
      return Promise.resolve('eaud_test');
    }
  }
  return { ...actual, EntityAuditService: SilentAuditService, resolveUserDisplayName: async () => 'Μαρία Παππά' };
});
jest.mock('@/services/mandate/showcase-presence.service', () => ({
  refreshShowcasePresence: async () => undefined,
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { COLLECTIONS } = require('@/config/firestore-collections') as
  typeof import('@/config/firestore-collections');
const { FakeFirestore } = require('@/test-utils/fake-firestore/fake-firestore') as
  typeof import('@/test-utils/fake-firestore/fake-firestore');
const { validDraft, validOwnerProperty } = require('@/lib/owner-property/__tests__/owner-property-fixtures') as
  typeof import('@/lib/owner-property/__tests__/owner-property-fixtures');
const { ownerPropertyEditOf } = require('@/lib/owner-property/owner-property-edit') as
  typeof import('@/lib/owner-property/owner-property-edit');
const write = require('../owner-property-write.service') as
  typeof import('../owner-property-write.service');
/* eslint-enable @typescript-eslint/no-require-imports */

const CITIZEN = { uid: 'user-1', companyId: null };
const V1 = '2026-11-28T09:00:00.000Z';

function seeded(overrides: Parameters<typeof validOwnerProperty>[0] = {}) {
  const property = validOwnerProperty({ contentEdit: { at: V1, by: 'user-1' }, ...overrides });
  const db = new FakeFirestore();
  db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);
  const stored = () =>
    db.all<Record<string, unknown>>(COLLECTIONS.OWNER_PROPERTIES).find((doc) => doc.id === property.id);
  return { property, stored, adminDb: db as unknown as AdminFirestore };
}

describe('🏆 ADR-953 — αποθήκευση περιεχομένου σε συναλλαγή', () => {
  it('🔴 παλιά καρτέλα ΔΕΝ σβήνει ό,τι άλλαξε άλλος σε διαφορετικό πεδίο', async () => {
    // Η φόρμα άνοιξε με 2 υπνοδωμάτια· στο μεταξύ κάποιος έγραψε 4. Εγώ αλλάζω μόνο τον τίτλο.
    const { property, stored, adminDb } = seeded({ bedrooms: 4, contentEdit: { at: '2026-11-28T09:05:00.000Z', by: 'user-2' } });
    const mine = validDraft({ title: 'Νέος τίτλος' });

    const result = await write.updateOwnerProperty(adminDb, property.id, mine, CITIZEN, ownerPropertyEditOf(validDraft(), mine, V1));

    expect(result.kind).toBe('saved');
    expect(stored()).toMatchObject({ title: 'Νέος τίτλος', bedrooms: 4 });
  });

  it('🔴 ίδιο πεδίο, άλλη τιμή ⇒ `conflict` με «ποιος · πότε», και ΤΙΠΟΤΑ δεν γράφεται', async () => {
    const at = '2026-11-28T09:05:00.000Z';
    const { property, stored, adminDb } = seeded({ title: 'Τίτλος του άλλου', contentEdit: { at, by: 'user-2' } });
    const mine = validDraft({ title: 'Δικός μου τίτλος' });

    const result = await write.updateOwnerProperty(adminDb, property.id, mine, CITIZEN, ownerPropertyEditOf(validDraft(), mine, V1));

    expect(result).toEqual({ kind: 'conflict', fields: ['title'], at, bySelf: false, byName: 'Μαρία Παππά' });
    expect(stored()).toMatchObject({ title: 'Τίτλος του άλλου', updatedAt: property.updatedAt });
  });

  it('«κράτα τις δικές μου» ⇒ γράφεται, και η έκδοση περιεχομένου περνά σε μένα', async () => {
    const { property, stored, adminDb } = seeded({ title: 'Τίτλος του άλλου', contentEdit: { at: '2026-11-28T09:05:00.000Z', by: 'user-2' } });
    const mine = validDraft({ title: 'Δικός μου τίτλος' });

    const result = await write.updateOwnerProperty(adminDb, property.id, mine, CITIZEN, ownerPropertyEditOf(validDraft(), mine, V1, ['title']));

    expect(result.kind).toBe('saved');
    expect(stored()).toMatchObject({ title: 'Δικός μου τίτλος', contentEdit: { by: 'user-1' } });
  });

  it('αποθήκευση που δεν άλλαξε τίποτα ΔΕΝ ανεβάζει την έκδοση περιεχομένου', async () => {
    const { property, stored, adminDb } = seeded();
    const same = validDraft();

    await write.updateOwnerProperty(adminDb, property.id, same, CITIZEN, ownerPropertyEditOf(validDraft(), same, V1));

    expect(stored()).toMatchObject({ contentEdit: { at: V1, by: 'user-1' } });
  });

  it('χωρίς `_edit` (καρτέλα πριν το ADR-953) ⇒ γράφονται όλα τα πεδία, όπως πριν', async () => {
    const { property, stored, adminDb } = seeded({ bedrooms: 4 });

    const result = await write.updateOwnerProperty(adminDb, property.id, validDraft({ title: 'Παλιά καρτέλα' }), CITIZEN);

    expect(result.kind).toBe('saved');
    expect(stored()).toMatchObject({ title: 'Παλιά καρτέλα', bedrooms: 2 });
  });

  it('ξένος αιτών ⇒ `absent`', async () => {
    const { property, adminDb } = seeded();
    const result = await write.updateOwnerProperty(adminDb, property.id, validDraft(), { uid: 'intruder', companyId: null });
    expect(result).toEqual({ kind: 'absent' });
  });
});
