/**
 * @jest-environment node
 *
 * @fileoverview **ΠΑΥΣΗ / ΕΠΑΝΑΦΟΡΑ ΠΡΟΣΒΑΣΗΣ — ΕΝΟΡΧΗΣΤΡΩΣΗ** — ADR-892 Φ2β (§12).
 * @related server/workspace/member-exit.ts (`executeAccessPause`) · server/workspace/member-access-restore.ts
 *
 * Ερωτήματα: (1) η παύση κρατά τον άνθρωπο **μέλος** (καμία λήξη, προέλευση ανέγγιχτη) και κόβει τον οικείο
 * χώρο; (2) η μεταβίβαση γίνεται **μόνο** όταν τη ζητήσει ο διαχειριστής; (3) ο μόνος διαχειριστής δεν μπαίνει
 * σε παύση; (4) η επαναφορά γράφει **μόνο** `status` + σβήσιμο της παύσης — ποτέ νέα θητεία — και
 * ξαναδίνει τον οικείο χώρο (ο γραφέας κρίνει «λείπει;»); (5) δεύτερη κλήση = καμία δεύτερη γραφή/ίχνος,
 * αλλά **επισκευή** του οικείου χώρου;
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
const mockAdopt = jest.fn(async (_uid: string, companyId: string, _role: string) => {
  order.push('claims');
  return { kind: 'adopted' as const, companyId };
});
const mockTransfer = jest.fn(async () => {
  order.push('transfer');
  return { transferred: 2, orphaned: 0 };
});
const mockAccessAudit = jest.fn(async () => {
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
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => '<ts>', delete: () => '<delete>' } }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn() } }));
jest.mock('@/lib/workspace/membership-access', () => {
  const actual = jest.requireActual('@/lib/workspace/membership-access');
  return { ...actual, recordAccessChangeAudit: (input: unknown) => mockAccessAudit(input) };
});
jest.mock('../member-exit-notifier', () => ({ announceMemberExit: (notice: unknown) => mockAnnounce(notice) }));
jest.mock('../member-exit-claims', () => ({
  releaseHomeWorkspace: (uid: string, companyId: string) => mockRelease(uid, companyId),
  adoptHomeWorkspace: (uid: string, companyId: string, role: string) => mockAdopt(uid, companyId, role),
}));
jest.mock('@/lib/auth', () => ({ isValidGlobalRole: (role: string) => ['company_admin', 'external_user'].includes(role) }));
jest.mock('@/lib/workspace/grant-membership', () => ({ grantWorkspaceMembership: jest.fn(), grantWorkspaceMembershipInTx: jest.fn() }));
jest.mock('@/services/network-messaging/act-team-departure', () => ({
  resolveDepartureHeir: async () => 'uid_heir',
  transferActTeamsOnDeparture: () => mockTransfer(),
  countActTeamsHeldBy: async () => 2,
}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import type { Firestore } from 'firebase-admin/firestore';

import { grantWorkspaceMembership, grantWorkspaceMembershipInTx } from '@/lib/workspace/grant-membership';

import { executeAccessRestore, type AccessRestoreRequest } from '../member-access-restore';
import { executeAccessPause, type AccessPauseRequest } from '../member-exit';

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

const PROVENANCE = { joinedAt: '2026-01-01', enrollment: 'invitation', addedBy: 'uid_owner' };
const OWNER = { id: 'uid_owner', data: { status: 'active', globalRole: 'company_admin' } };
const STAFF = { id: 'uid_staff', data: { status: 'active', globalRole: 'external_user', ...PROVENANCE } };
const ACTOR = { uid: OWNER.id, role: 'company_admin', name: 'Υπεύθυνος', isMember: true } as const;

const PAUSE_STAFF: AccessPauseRequest = { kind: 'pause', companyId: 'comp_w', targetUid: STAFF.id, actor: ACTOR, reason: 'άδεια' };
const RESTORE_STAFF: AccessRestoreRequest = { companyId: 'comp_w', targetUid: STAFF.id, actor: ACTOR, reason: null };

const PROVENANCE_FIELDS = ['joinedAt', 'enrollment', 'addedBy', 'globalRole', 'tenureEnd'] as const;

beforeEach(() => {
  jest.clearAllMocks();
  txSets.length = 0;
  order.length = 0;
  seatInTx = STAFF.data;
  activeInTx = [OWNER, STAFF];
});

describe('Π — η παύση', () => {
  it('Π1 🔴 θέση → οικείος χώρος → ίχνος → ειδοποίηση· `suspended` + `accessPause`, προέλευση ΑΝΕΓΓΙΧΤΗ', async () => {
    const outcome = await executeAccessPause(db, PAUSE_STAFF, { transferActTeams: false });
    expect(order).toEqual(['commit', 'claims', 'audit', 'notice']);
    const [{ path, data }] = txSets;
    expect(path).toBe('comp_w/uid_staff');
    expect(data).toEqual(expect.objectContaining({
      status: 'suspended',
      accessPause: { pausedByUid: OWNER.id, reason: 'άδεια', pausedAt: '<ts>' },
    }));
    for (const field of PROVENANCE_FIELDS) expect(data).not.toHaveProperty(field);
    expect(mockRelease).toHaveBeenCalledWith(STAFF.id, 'comp_w');
    expect(mockAnnounce).toHaveBeenCalledWith(expect.objectContaining({ kind: 'pause', uid: STAFF.id }));
    expect(outcome).toEqual({
      kind: 'paused', alreadyPaused: false, home: { kind: 'personal' },
      heirUid: null, transferredActTeams: 0, orphanedActTeams: 0,
    });
  });

  it('Π2 — μεταβίβαση ΜΟΝΟ όταν τη ζητήσει ο διαχειριστής (Google Workspace: προαιρετική)', async () => {
    await executeAccessPause(db, PAUSE_STAFF, { transferActTeams: false });
    expect(mockTransfer).not.toHaveBeenCalled();

    const outcome = await executeAccessPause(db, PAUSE_STAFF, { transferActTeams: true });
    expect(mockTransfer).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual(expect.objectContaining({ heirUid: 'uid_heir', transferredActTeams: 2 }));
  });

  it('Π3 🔴 ο ΜΟΝΟΣ διαχειριστής ⇒ last-manager, ΚΑΜΙΑ γραφή, κανένα claim', async () => {
    seatInTx = OWNER.data;
    const outcome = await executeAccessPause(db, {
      ...PAUSE_STAFF, targetUid: OWNER.id, actor: { uid: 'uid_platform', role: 'super_admin', name: null, isMember: false },
    }, { transferActTeams: true });
    expect(outcome).toEqual({ kind: 'refused', verdict: { kind: 'last-manager' } });
    expect(txSets).toEqual([]);
    expect(mockRelease).not.toHaveBeenCalled();
    expect(mockAccessAudit).not.toHaveBeenCalled();
  });

  it('Π4 — ήδη σε παύση ⇒ επισκευή οικείου χώρου ΧΩΡΙΣ δεύτερη γραφή, ίχνος ή μεταβίβαση', async () => {
    seatInTx = { ...STAFF.data, status: 'suspended' };
    const outcome = await executeAccessPause(db, PAUSE_STAFF, { transferActTeams: true });
    expect(txSets).toEqual([]);
    expect(mockRelease).toHaveBeenCalledWith(STAFF.id, 'comp_w');
    expect(mockTransfer).not.toHaveBeenCalled();
    expect(mockAccessAudit).not.toHaveBeenCalled();
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(outcome).toEqual(expect.objectContaining({ kind: 'paused', alreadyPaused: true }));
  });
});

describe('Ε — η επαναφορά', () => {
  it('Ε1 🔴 θέση → οικείος χώρος → ίχνος → ειδοποίηση· `suspended → active`, ΚΑΝΕΝΑ πεδίο προέλευσης, ΚΑΜΙΑ νέα θητεία', async () => {
    seatInTx = { ...STAFF.data, status: 'suspended', accessPause: { pausedByUid: OWNER.id } };
    const outcome = await executeAccessRestore(db, RESTORE_STAFF);
    expect(outcome).toEqual({ kind: 'restored', alreadyActive: false, home: { kind: 'adopted', companyId: 'comp_w' } });
    expect(txSets).toEqual([{ path: 'comp_w/uid_staff', data: { status: 'active', accessPause: '<delete>', updatedAt: '<ts>' } }]);
    // 🔴 Ο οικείος χώρος με τον ρόλο της ΘΕΣΗΣ — ποτέ ανάκληση (`releaseHomeWorkspace`).
    expect(mockAdopt).toHaveBeenCalledWith(STAFF.id, 'comp_w', 'external_user');
    expect(mockRelease).not.toHaveBeenCalled();
    expect(grantWorkspaceMembership).not.toHaveBeenCalled();
    expect(grantWorkspaceMembershipInTx).not.toHaveBeenCalled();
    expect(order).toEqual(['commit', 'claims', 'audit', 'notice']);
    expect(mockAnnounce).toHaveBeenCalledWith(expect.objectContaining({ kind: 'restore', uid: STAFF.id }));
  });

  it('Ε2 — ήδη ενεργός ⇒ `alreadyActive`, καμία γραφή/ίχνος/ειδοποίηση — ΑΛΛΑ επισκευή οικείου χώρου (ιδεμποτία)', async () => {
    const outcome = await executeAccessRestore(db, RESTORE_STAFF);
    expect(outcome).toEqual({ kind: 'restored', alreadyActive: true, home: { kind: 'adopted', companyId: 'comp_w' } });
    expect(mockAdopt).toHaveBeenCalledWith(STAFF.id, 'comp_w', 'external_user');
    expect(txSets).toEqual([]);
    expect(mockAccessAudit).not.toHaveBeenCalled();
    expect(mockAnnounce).not.toHaveBeenCalled();
  });

  it('Ε3 — ληγμένη θητεία (`removed`) δεν «επαναφέρεται» ⇒ not-a-member (ξαναμπαίνει μόνο με πρόσκληση)', async () => {
    seatInTx = { ...STAFF.data, status: 'removed' };
    await expect(executeAccessRestore(db, RESTORE_STAFF)).resolves.toEqual({ kind: 'refused', verdict: { kind: 'not-a-member' } });
    expect(txSets).toEqual([]);
    expect(mockAdopt).not.toHaveBeenCalled();
  });

  it('Ε4 🔴 το claim αποτυγχάνει ⇒ το σφάλμα ΦΤΑΝΕΙ (503)· η επανάληψη βρίσκει `active` και ΟΛΟΚΛΗΡΩΝΕΙ', async () => {
    seatInTx = { ...STAFF.data, status: 'suspended' };
    mockAdopt.mockRejectedValueOnce(new Error('AUTH_DOWN'));
    await expect(executeAccessRestore(db, RESTORE_STAFF)).rejects.toThrow('AUTH_DOWN');
    expect(mockAnnounce).not.toHaveBeenCalled();

    seatInTx = STAFF.data;
    await expect(executeAccessRestore(db, RESTORE_STAFF)).resolves.toEqual(expect.objectContaining({ alreadyActive: true, home: { kind: 'adopted', companyId: 'comp_w' } }));
  });

  it('Ε5 — ρόλος θέσης εκτός λεξιλογίου ⇒ ΚΑΝΕΝΑ claim (δεν εφευρίσκουμε ρόλο)· η θέση ενεργή', async () => {
    seatInTx = { ...STAFF.data, status: 'suspended', globalRole: 'ghost_role' };
    await expect(executeAccessRestore(db, RESTORE_STAFF)).resolves.toEqual({ kind: 'restored', alreadyActive: false, home: { kind: 'untouched' } });
    expect(mockAdopt).not.toHaveBeenCalled();
  });
});
