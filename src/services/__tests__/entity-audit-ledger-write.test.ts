/**
 * 🔒 ΑΓΚΥΡΑ Β1 — ADR-864 Φ1β · **ΣΕ ΠΟΙΟ ΒΙΒΛΙΟ ΓΡΑΦΕΤΑΙ Η ΕΓΓΡΑΦΗ**
 *
 * Το `EntityAuditService.recordChange` δέχεται εμβέλεια `companyId` **ή** `userId`
 * (`lib/audit/audit-ledger.ts`). Αυτή η άγκυρα κοιτά **το payload και τη συλλογή που φτάνουν στο
 * Firestore** (πρότυπο `entity-audit-write-shallow.test.ts`):
 *
 *   · εταιρεία ⇒ `entity_audit_trail`, **μόνο** `companyId`
 *   · προσωπικό ⇒ `entity_audit_trail_personal`, **μόνο** `userId`
 *   · κενός κάτοχος ⇒ **καμία** γραφή (εγγραφή που κανείς δεν μπορεί να διαβάσει)
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | γράφονται **και τα δύο** πεδία | Β1.β ⇒ 🔴 |
 * | το διαμέρισμα αγνοεί το βιβλίο (πάντα `ENTITY_AUDIT_TRAIL`) | Β1.β ⇒ 🔴 |
 * | φρουρός κενού κατόχου αφαιρείται | Β1.γ ⇒ 🔴 |
 *
 * @module services/__tests__/entity-audit-ledger-write
 */

jest.mock('@/lib/firebaseAdmin', () => {
  const setMock = jest.fn().mockResolvedValue(undefined);
  const docMock = jest.fn(() => ({ set: setMock }));
  const collectionMock = jest.fn(() => ({ doc: docMock }));
  class ServerTimestampSentinel {}
  const sentinel = new ServerTimestampSentinel();
  return {
    getAdminFirestore: () => ({ collection: collectionMock }),
    FieldValue: { serverTimestamp: () => sentinel },
    __setMock: setMock,
    __collectionMock: collectionMock,
  };
});

import { EntityAuditService } from '@/services/entity-audit.service';
import { COLLECTIONS } from '@/config/firestore-collections';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const firebaseAdminMock = require('@/lib/firebaseAdmin') as {
  __setMock: jest.Mock;
  __collectionMock: jest.Mock;
};

const BASE = {
  entityType: 'owner_property' as const,
  entityId: 'ownp_a',
  entityName: 'Διαμέρισμα',
  action: 'status_changed' as const,
  changes: [{ field: 'lifecycle', oldValue: 'listed', newValue: 'withdrawn', label: 'lifecycle' }],
  performedBy: 'user-1',
  // Χωρίς '@' ⇒ το όνομα κρατιέται ως έχει, χωρίς ανάγνωση βάσης.
  performedByName: 'Μαρία',
};

function written(): { collection: string; entry: Record<string, unknown> } {
  expect(firebaseAdminMock.__setMock).toHaveBeenCalledTimes(1);
  return {
    collection: firebaseAdminMock.__collectionMock.mock.calls[0][0] as string,
    entry: firebaseAdminMock.__setMock.mock.calls[0][0] as Record<string, unknown>,
  };
}

beforeEach(() => {
  firebaseAdminMock.__setMock.mockClear();
  firebaseAdminMock.__collectionMock.mockClear();
});

describe('Β1 — το βιβλίο διαλέγει διαμέρισμα ΚΑΙ πεδίο, αποκλειστικά', () => {
  it('Β1.α ΠΑΡΟΝΟΜΑΣΤΗΣ — εταιρεία ⇒ `entity_audit_trail`, μόνο `companyId` (ό,τι ίσχυε πάντα)', async () => {
    await EntityAuditService.recordChange({ ...BASE, companyId: 'comp_1' });

    const { collection, entry } = written();
    expect(collection).toBe(COLLECTIONS.ENTITY_AUDIT_TRAIL);
    expect(entry.companyId).toBe('comp_1');
    expect(Object.keys(entry)).not.toContain('userId');
  });

  it('Β1.β 🔴 προσωπικό ⇒ `entity_audit_trail_personal`, μόνο `userId`, ΚΑΝΕΝΑ κλειδί `companyId`', async () => {
    await EntityAuditService.recordChange({ ...BASE, userId: 'user-1' });

    const { collection, entry } = written();
    expect(collection).toBe(COLLECTIONS.ENTITY_AUDIT_TRAIL_PERSONAL);
    expect(collection).not.toBe(COLLECTIONS.ENTITY_AUDIT_TRAIL);
    expect(entry.userId).toBe('user-1');
    expect(Object.keys(entry)).not.toContain('companyId');
  });

  it('Β1.γ 🔴 κενός κάτοχος ⇒ ΚΑΜΙΑ γραφή και `null`', async () => {
    const auditId = await EntityAuditService.recordChange({ ...BASE, userId: '' });

    expect(auditId).toBeNull();
    expect(firebaseAdminMock.__setMock).not.toHaveBeenCalled();
  });
});
