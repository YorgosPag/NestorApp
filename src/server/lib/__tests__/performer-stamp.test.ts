/**
 * 🔒 ΑΓΚΥΡΑ — ο **φορέας** μιας εγγραφής και η σφραγίδα του (ADR-195, 2026-10-29).
 *
 * Δύο μορφές, καμία τρίτη (`lib/audit/audit-performer.ts`)· ΕΝΑΣ δρόμος προς τη σφραγίδα
 * (`server/lib/performer-stamp.ts`)· και η ρίζα της υπηρεσίας Ιστορικού δεν δέχεται πια uid ως όνομα.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | η σφραγίδα γράφει `lastModifiedBy` αντί `_lastModifiedBy` | Φ2 ⇒ 🔴 |
 * | η διεργασία χάνει το «εκ μέρους» | Φ3 ⇒ 🔴 |
 * | `userPerformer('')` γίνεται δεκτό | Φ1 ⇒ 🔴 |
 * | ο βοηθός AI γράφει την ταυτότητα καναλιού ως δράστη | Φ5 ⇒ 🔴 |
 * | `resolvePerformerDisplayName` κρατά όνομα === uid | Φ6 ⇒ 🔴 |
 *
 * @module server/lib/__tests__/performer-stamp
 */

/* global describe, it, expect, jest, beforeEach */

jest.mock('server-only', () => ({}));

jest.mock('@/lib/firebaseAdmin', () => {
  const setMock = jest.fn().mockResolvedValue(undefined);
  const users: Record<string, { displayName?: string; email?: string }> = {
    uid_maria: { displayName: 'Μαρία Π.', email: 'maria@example.com' },
  };
  const collectionMock = jest.fn((name: string) => ({
    doc: (id: string) => ({
      set: setMock,
      get: async () => (name === 'users' && users[id]
        ? { exists: true, data: () => users[id] }
        : { exists: false, data: () => undefined }),
    }),
  }));
  return {
    getAdminFirestore: () => ({ collection: collectionMock }),
    FieldValue: { serverTimestamp: () => 'ts' },
    __setMock: setMock,
  };
});

jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'ts' } }));

import { SYSTEM_IDENTITY } from '@/config/domain-constants';
import { performerFromActorId, processPerformer, userPerformer } from '@/lib/audit/audit-performer';
import { EntityAuditService } from '@/services/entity-audit.service';
import { adminCommandPerformer, aiAgentAuditActor, aiAgentStamp } from '@/services/ai-pipeline/shared/ai-performer';
import { performerStamp, resolvePerformer, stampPerformer } from '../performer-stamp';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const firebaseAdminMock = require('@/lib/firebaseAdmin') as { __setMock: jest.Mock };

beforeEach(() => firebaseAdminMock.__setMock.mockClear());

describe('Φ — ο φορέας και η σφραγίδα του', () => {
  it('Φ1 🔴 «χωρίς φορέα» δεν εκφράζεται: κενό uid ή ταυτότητα μηχανής ως άνθρωπος = σφάλμα', () => {
    expect(() => userPerformer('')).toThrow();
    expect(() => userPerformer('   ')).toThrow();
    expect(() => userPerformer(SYSTEM_IDENTITY.AI_AGENT_ID)).toThrow();
    expect(performerFromActorId('system:floor-stack').kind).toBe('process');
    expect(performerFromActorId('uid_maria').kind).toBe('user');
  });

  it('Φ2 🔴 η σφραγίδα έχει ΑΚΡΙΒΩΣ τα κλειδιά που διαβάζει ο CDC', async () => {
    const stamp = await stampPerformer(userPerformer('uid_maria', 'maria@example.com'));
    expect(Object.keys(stamp).sort()).toEqual(['_lastModifiedAt', '_lastModifiedBy', '_lastModifiedByName']);
    expect(stamp._lastModifiedBy).toBe('uid_maria');
    expect(stamp._lastModifiedByName).toBe('Μαρία Π.');
  });

  it('Φ3 🔴 διεργασία: ταυτότητα μηχανής + όνομα του ανθρώπου «εκ μέρους» (αλλιώς το στιγμιότυπο)', async () => {
    expect(await resolvePerformer(processPerformer(SYSTEM_IDENTITY.AI_AGENT_ID, 'Γιώργος')))
      .toEqual({ id: SYSTEM_IDENTITY.AI_AGENT_ID, name: 'Γιώργος' });
    expect(performerStamp(await resolvePerformer(processPerformer())))
      .toMatchObject({ _lastModifiedBy: SYSTEM_IDENTITY.ID, _lastModifiedByName: SYSTEM_IDENTITY.DISPLAY_NAME });
  });

  it('Φ4 άνθρωπος χωρίς προφίλ ⇒ η πτώση της συνεδρίας, ποτέ το uid', async () => {
    expect(await resolvePerformer(userPerformer('uid_ghost', 'ghost@example.com')))
      .toEqual({ id: 'uid_ghost', name: 'ghost@example.com' });
  });

  it('Φ5 🔴 ο βοηθός AI: διεργασία `system:ai-agent` εκ μέρους του συνομιλητή — ΠΟΤΕ ταυτότητα καναλιού', () => {
    const ctx = { contactMeta: { displayName: 'Νίκος Κ.' } } as Parameters<typeof aiAgentStamp>[0];
    expect(aiAgentAuditActor(ctx)).toEqual({ performedBy: SYSTEM_IDENTITY.AI_AGENT_ID, performedByName: 'Νίκος Κ.' });
    expect(aiAgentStamp(ctx)._lastModifiedBy).toBe(SYSTEM_IDENTITY.AI_AGENT_ID);
    expect(adminCommandPerformer({ adminIdentity: { displayName: 'Admin', firebaseUid: 'uid_maria' } } as Parameters<typeof adminCommandPerformer>[0]))
      .toEqual({ kind: 'user', uid: 'uid_maria', fallbackName: 'Admin' });
    expect(adminCommandPerformer(null)).toMatchObject({ kind: 'process', processId: SYSTEM_IDENTITY.AI_AGENT_ID });
  });

  it('Φ6 🔴 η ρίζα της υπηρεσίας Ιστορικού: όνομα ΙΣΟ με το uid ⇒ αναζήτηση, όχι αποθήκευση του uid', async () => {
    await EntityAuditService.recordChange({
      entityType: 'contact', entityId: 'cont_1', entityName: 'MACON', action: 'updated',
      changes: [], performedBy: 'uid_maria', performedByName: 'uid_maria', companyId: 'comp_1',
    });
    const entry = firebaseAdminMock.__setMock.mock.calls[0][0] as Record<string, unknown>;
    expect(entry.performedByName).toBe('Μαρία Π. (maria@example.com)');
  });
});
