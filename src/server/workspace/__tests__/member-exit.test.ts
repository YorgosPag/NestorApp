/**
 * @jest-environment node
 *
 * @fileoverview **Η ΕΞΟΔΟΣ ΜΕΛΟΥΣ — ΕΝΟΡΧΗΣΤΡΩΣΗ** — ADR-892 §3.2 (Φ1).
 * @related server/workspace/member-exit.ts
 *
 * Ερωτήματα: (1) μια άρνηση γράφει **τίποτα**; (2) μια επιτρεπτή έξοδος κλείνει θητεία, πειράζει τον
 * οικείο χώρο, μεταβιβάζει και γράφει ίχνος — με αυτή τη σειρά; (3) η κρίση γίνεται **μέσα** στη
 * συναλλαγή, με ό,τι ισχύει **τότε**, όχι με ό,τι έδειξε η προεπισκόπηση; (4) δεύτερη κλήση = επισκευή,
 * χωρίς δεύτερο ίχνος;
 */

jest.mock('server-only', () => ({}));

const txSets: Array<{ path: string; data: Record<string, unknown> }> = [];
let seatInTx: Record<string, unknown> | null = null;
let activeInTx: Array<{ id: string; data: Record<string, unknown> }> = [];
const order: string[] = [];

const mockRelease = jest.fn(async () => {
  order.push('claims');
  return { kind: 'personal' as const };
});
const mockTransfer = jest.fn(async () => {
  order.push('transfer');
  return { transferred: 2, orphaned: 0 };
});
const mockAudit = jest.fn(async () => {
  order.push('audit');
});
const mockAnnounce = jest.fn(async () => {
  order.push('notice');
});

jest.mock('@/lib/workspace/workspace-member-ref', () => ({
  workspaceMemberRef: (_db: unknown, companyId: string, uid: string) => ({ kind: 'doc', path: `${companyId}/${uid}` }),
  workspaceMembersCollection: () => ({ where: () => ({ kind: 'query' }) }),
}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}), getAdminAuth: () => ({}) }));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => '<ts>' } }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn() } }));
jest.mock('@/lib/workspace/end-membership', () => {
  const actual = jest.requireActual('@/lib/workspace/end-membership');
  return { endWorkspaceMembershipInTx: actual.endWorkspaceMembershipInTx, recordMembershipEndAudit: () => mockAudit() };
});
jest.mock('../member-exit-notifier', () => ({ announceMemberExit: (notice: unknown) => mockAnnounce(notice) }));
jest.mock('../member-exit-claims', () => ({ releaseHomeWorkspace: (uid: string, companyId: string) => mockRelease(uid, companyId) }));
jest.mock('@/services/network-messaging/act-team-departure', () => ({
  resolveDepartureHeir: async () => 'uid_heir',
  transferActTeamsOnDeparture: () => mockTransfer(),
  countActTeamsHeldBy: async () => 2,
}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import type { Firestore } from 'firebase-admin/firestore';

import { executeMemberExit, type EndingExitRequest } from '../member-exit';

const db = {
  runTransaction: async <T>(body: (tx: unknown) => Promise<T>) =>
    body({
      get: async (ref: { kind: string }) =>
        ref.kind === 'doc'
          ? { exists: seatInTx !== null, data: () => seatInTx }
          : { docs: activeInTx.map((m) => ({ id: m.id, data: () => m.data })) },
      set: (ref: { path: string }, data: Record<string, unknown>) => {
        order.push('commit');
        txSets.push({ path: ref.path, data });
      },
    }),
} as unknown as Firestore;

const OWNER = { id: 'uid_owner', data: { status: 'active', globalRole: 'company_admin' } };
const STAFF = { id: 'uid_staff', data: { status: 'active', globalRole: 'external_user' } };

const REMOVE_STAFF: EndingExitRequest = {
  kind: 'removal',
  companyId: 'comp_w',
  targetUid: STAFF.id,
  actor: { uid: OWNER.id, role: 'company_admin', name: 'Υπεύθυνος', isMember: true },
  reason: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  txSets.length = 0;
  order.length = 0;
  seatInTx = STAFF.data;
  activeInTx = [OWNER, STAFF];
});

describe('Ε — η επιτρεπτή έξοδος', () => {
  it('Ε1 — θητεία → claims → μεταβίβαση → ίχνος, με αυτή τη σειρά (το έγγραφο ΠΡΙΝ από το claim)', async () => {
    const outcome = await executeMemberExit(db, REMOVE_STAFF);
    expect(order).toEqual(['commit', 'claims', 'transfer', 'audit', 'notice']);
    expect(mockAnnounce).toHaveBeenCalledWith(expect.objectContaining({ kind: 'removal', uid: STAFF.id, companyId: 'comp_w' }));
    expect(txSets[0]).toEqual({ path: 'comp_w/uid_staff', data: expect.objectContaining({ status: 'removed' }) });
    expect(outcome).toEqual({
      kind: 'ended', alreadyEnded: false, home: { kind: 'personal' },
      heirUid: 'uid_heir', transferredActTeams: 2, orphanedActTeams: 0,
    });
  });

  it('Ε2 — αποχώρηση γράφει `left`, όχι `removed`', async () => {
    await executeMemberExit(db, { ...REMOVE_STAFF, kind: 'departure', actor: { ...REMOVE_STAFF.actor, uid: STAFF.id, role: 'external_user' } });
    expect(txSets[0].data.status).toBe('left');
  });

  it('Ε3 — η μεταβίβαση αποτυγχάνει ⇒ η έξοδος ΕΓΙΝΕ (μη μπλοκάρον), με μηδενικά', async () => {
    mockTransfer.mockRejectedValueOnce(new Error('boom'));
    await expect(executeMemberExit(db, REMOVE_STAFF)).resolves.toEqual(expect.objectContaining({
      kind: 'ended', heirUid: null, transferredActTeams: 0,
    }));
  });
});

describe('Α — η άρνηση', () => {
  it('Α1 🔴 κρίση ΜΕΣΑ στη συναλλαγή: ο συνδιαχειριστής έφυγε στο μεταξύ ⇒ last-manager, ΚΑΜΙΑ γραφή', async () => {
    seatInTx = OWNER.data;
    activeInTx = [OWNER, STAFF];
    const outcome = await executeMemberExit(db, {
      ...REMOVE_STAFF, targetUid: OWNER.id,
      actor: { uid: 'uid_platform', role: 'super_admin', name: null, isMember: false },
    });
    expect(outcome).toEqual({ kind: 'refused', verdict: { kind: 'last-manager' } });
    expect(txSets).toEqual([]);
    expect(mockRelease).not.toHaveBeenCalled();
    expect(mockTransfer).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
    expect(mockAnnounce).not.toHaveBeenCalled();
  });
});

describe('Ι — ιδεμποτία', () => {
  it('Ι1 — ήδη κλειστή θητεία ⇒ επισκευή claims/μεταβίβασης, ΧΩΡΙΣ δεύτερη γραφή ή δεύτερο ίχνος', async () => {
    seatInTx = { status: 'removed', globalRole: 'external_user' };
    const outcome = await executeMemberExit(db, REMOVE_STAFF);
    expect(txSets).toEqual([]);
    expect(mockRelease).toHaveBeenCalledWith(STAFF.id, 'comp_w');
    expect(mockAudit).not.toHaveBeenCalled();
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(outcome).toEqual(expect.objectContaining({ kind: 'ended', alreadyEnded: true }));
  });
});
