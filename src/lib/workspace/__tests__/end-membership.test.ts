/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ ΤΕΛΟΣ ΘΗΤΕΙΑΣ ΚΛΕΙΝΕΙ, ΔΕΝ ΣΒΗΝΕΙ** — ADR-892 §3.2 / §3.5 (Φ1).
 * @related lib/workspace/end-membership.ts · lib/auth/workspace-membership.ts (normalizeMembership)
 *
 * Ερώτημα: μετά την αφαίρεση, λέει το έγγραφο «αφαιρέθηκε από Χ, για Υ» **και** ακόμη «μπήκε τότε, με
 * πρόσκληση του Ζ»; Και ο κριτής το διαβάζει ως **ειπωμένη** άρνηση, όχι ως «δεν υπήρξε ποτέ»;
 */

jest.mock('server-only', () => ({}));

const sets: Array<{ data: Record<string, unknown>; merge: boolean }> = [];
const deletes: unknown[] = [];

jest.mock('@/lib/workspace/workspace-member-ref', () => ({
  workspaceMemberRef: () => ({ path: 'companies/comp_w/workspace_members/uid_x' }),
  workspaceMembersCollection: jest.fn(),
}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}), isFirebaseAdminAvailable: () => true }));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => '<ts>' } }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn(async () => undefined) } }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import type { Transaction } from 'firebase-admin/firestore';

import { EntityAuditService } from '@/services/entity-audit.service';
import { normalizeMembership } from '@/lib/auth/workspace-membership';
import { endWorkspaceMembershipInTx, recordMembershipEndAudit } from '../end-membership';

const tx = {
  set: (_ref: unknown, data: Record<string, unknown>, options: { merge: boolean }) => sets.push({ data, merge: options.merge }),
  delete: (ref: unknown) => deletes.push(ref),
} as unknown as Transaction;

const INPUT = { uid: 'uid_x', companyId: 'comp_w', ending: 'removed', endedByUid: 'uid_admin', reason: 'τέλος συνεργασίας' } as const;

beforeEach(() => {
  sets.length = 0;
  deletes.length = 0;
});

describe('Γ — ο γραφέας εξόδου', () => {
  it('Γ1 — merge-γραφή ΜΟΝΟ των πεδίων τέλους· καμία διαγραφή', () => {
    endWorkspaceMembershipInTx(tx, INPUT);
    expect(deletes).toEqual([]);
    expect(sets).toEqual([{
      merge: true,
      data: {
        status: 'removed',
        tenureEnd: { endedByUid: 'uid_admin', reason: 'τέλος συνεργασίας', endedAt: '<ts>' },
        updatedAt: '<ts>',
      },
    }]);
  });

  it('Γ2 — η προέλευση της θητείας ΔΕΝ ξαναγράφεται (ρόλος · joinedAt · addedBy · enrollment)', () => {
    endWorkspaceMembershipInTx(tx, INPUT);
    for (const field of ['globalRole', 'joinedAt', 'addedBy', 'enrollment', 'uid']) {
      expect(sets[0].data).not.toHaveProperty(field);
    }
  });

  it('Γ3 — στρογγυλή διαδρομή: το έγγραφο μετά τη merge διαβάζεται ως `removed` με το ίχνος του τέλους', () => {
    endWorkspaceMembershipInTx(tx, { ...INPUT, ending: 'left', endedByUid: 'uid_x', reason: null });
    const before = { uid: 'uid_x', globalRole: 'external_user', status: 'active', addedBy: 'uid_admin', enrollment: 'invitation' };
    const read = normalizeMembership('uid_x', { ...before, ...sets[0].data });
    expect(read.status).toBe('left');
    expect(read.tenureEnd).toEqual({ endedByUid: 'uid_x', reason: null, endedAt: '<ts>' });
    expect(read.globalRole).toBe('external_user');
    expect(read.addedBy).toBe('uid_admin');
  });

  it('Γ4 — ενεργό έγγραφο με ξεχασμένο `tenureEnd` ⇒ η μετάφραση το αγνοεί (πληροφορία μόνο σε ληγμένη θητεία)', () => {
    const read = normalizeMembership('uid_x', { status: 'active', tenureEnd: { endedByUid: 'uid_old' } });
    expect(read.tenureEnd).toBeNull();
  });
});

describe('Ι — το ίχνος', () => {
  it('Ι1 — κατοπτρικό της εισόδου: ο ΧΩΡΟΣ άλλαξε, `members: uid → null`, με τον δρώντα', async () => {
    await recordMembershipEndAudit({ ...INPUT, endedByName: 'Υπεύθυνος' });
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityId: 'comp_w',
      changes: [{ field: 'members', oldValue: 'uid_x', newValue: null }],
      performedBy: 'uid_admin',
      companyId: 'comp_w',
    }));
  });
});
