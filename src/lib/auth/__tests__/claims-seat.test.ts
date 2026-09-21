/**
 * @jest-environment node
 *
 * @fileoverview **ΚΑΝΕΝΑ CLAIM ΧΩΡΟΥ ΧΩΡΙΣ ΘΕΣΗ** — ADR-867 Β9(β) Ε1.
 * @related lib/auth/claims-seat.ts · lib/auth/set-claims-with-mirror.ts
 *
 * Τρία επίπεδα, από το καθαρό προς το σύνορο:
 *   Κ — η καθαρή κρίση (`judgeClaimsSeat`), κάθε κλάδος του κλειστού συνόλου
 *   Φ — ο φύλακας (`assertClaimsHaveSeat`): διαβάζει ΜΟΝΟ όταν χρειάζεται, πετά με όνομα
 *   Σ — 🔴 το στένωμα (`setClaimsWithMirror`): η άρνηση συμβαίνει **ΠΡΙΝ** το Auth
 */

jest.mock('server-only', () => ({}));

const seatGet = jest.fn();
jest.mock('@/lib/workspace/workspace-member-ref', () => ({
  workspaceMemberRef: (_db: unknown, companyId: string, uid: string) => ({
    path: `companies/${companyId}/workspace_members/${uid}`,
    get: () => seatGet(companyId, uid),
  }),
}));

const setCustomUserClaims = jest.fn().mockResolvedValue(undefined);
const mirrorSet = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ collection: () => ({ doc: () => ({ set: mirrorSet }) }) }),
  getAdminAuth: () => ({ setCustomUserClaims }),
  isFirebaseAdminAvailable: () => true,
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { assertClaimsHaveSeat, ClaimsSeatViolation, judgeClaimsSeat } from '../claims-seat';
import { setClaimsWithMirror } from '../set-claims-with-mirror';
import type { WorkspaceMembership } from '@/types/workspace-membership';

const W = 'comp_pagonis';
const UID = 'uid_giorgos';

function seat(overrides: Partial<WorkspaceMembership> = {}): WorkspaceMembership {
  return {
    uid: UID,
    globalRole: 'super_admin',
    status: 'active',
    permissionSetIds: [],
    addedBy: UID,
    enrollment: 'backfill',
    ...overrides,
  };
}

function snapshotOf(data: Record<string, unknown> | null) {
  return { exists: data !== null, data: () => data ?? undefined };
}

beforeEach(() => {
  seatGet.mockReset();
  setCustomUserClaims.mockClear();
  mirrorSet.mockClear();
});

describe('Κ — η καθαρή κρίση', () => {
  it('Κ0 — ο παρονομαστής: claim + ενεργή θέση με ίδιο ρόλο ⇒ `seated`', () => {
    expect(judgeClaimsSeat({ companyId: W, globalRole: 'super_admin' }, seat())).toEqual({ kind: 'seated' });
  });

  it.each([[{}], [{ companyId: null }], [{ companyId: '' }], [{ companyId: 42 }]])(
    'Κ1 — claims χωρίς χώρο (%j) ⇒ `no-workspace` — ο πολίτης δεν χρειάζεται θέση',
    (claims) => {
      expect(judgeClaimsSeat(claims, null)).toEqual({ kind: 'no-workspace' });
    },
  );

  it('🔴 Κ2 — το εύρημα: claim ΧΩΡΙΣ έγγραφο ⇒ `seat-missing`', () => {
    expect(judgeClaimsSeat({ companyId: W, globalRole: 'super_admin' }, null)).toEqual({ kind: 'seat-missing', companyId: W });
  });

  it('Κ3 — ανασταλμένη θέση ⇒ `seat-inactive` (η ανάκληση δεν ακυρώνεται από γραφή claims)', () => {
    expect(judgeClaimsSeat({ companyId: W }, seat({ status: 'suspended' }))).toEqual({ kind: 'seat-inactive', companyId: W });
  });

  it('Κ4 — ρόλος claim ≠ ρόλος θέσης ⇒ `role-mismatch`, με τις δύο τιμές', () => {
    expect(judgeClaimsSeat({ companyId: W, globalRole: 'company_admin' }, seat())).toEqual({
      kind: 'role-mismatch', companyId: W, claimRole: 'company_admin', seatRole: 'super_admin',
    });
  });

  it('Κ5 — ΑΠΩΝ ρόλος στο claim (ADR-853 §14) δεν είναι ασυμφωνία — δεν δίνει τίποτα', () => {
    expect(judgeClaimsSeat({ companyId: W }, seat())).toEqual({ kind: 'seated' });
  });
});

describe('Φ — ο φύλακας', () => {
  it('Φ1 — claims χωρίς χώρο ⇒ ΚΑΜΙΑ ανάγνωση', async () => {
    await expect(assertClaimsHaveSeat(UID, { globalRole: 'external_user' })).resolves.toBeUndefined();
    expect(seatGet).not.toHaveBeenCalled();
  });

  it('Φ2 — ο παρονομαστής: θέση υπάρχει ⇒ περνά, και ρώτησε ΑΥΤΟΝ τον χώρο γι\' ΑΥΤΟΝ τον άνθρωπο', async () => {
    seatGet.mockResolvedValue(snapshotOf({ uid: UID, globalRole: 'super_admin', status: 'active' }));
    await expect(assertClaimsHaveSeat(UID, { companyId: W, globalRole: 'super_admin' })).resolves.toBeUndefined();
    expect(seatGet).toHaveBeenCalledWith(W, UID);
  });

  it('🔴 Φ3 — θέση λείπει ⇒ `ClaimsSeatViolation` με όνομα', async () => {
    seatGet.mockResolvedValue(snapshotOf(null));
    const failure = assertClaimsHaveSeat(UID, { companyId: W, globalRole: 'super_admin' });
    await expect(failure).rejects.toBeInstanceOf(ClaimsSeatViolation);
    await expect(failure).rejects.toMatchObject({ verdict: { kind: 'seat-missing', companyId: W } });
  });

  it('Φ4 — αποτυχία ΑΝΑΓΝΩΣΗΣ πετά αυτούσια — ΔΕΝ γίνεται «λείπει» (N.12: άγνωστο ≠ κενό)', async () => {
    seatGet.mockRejectedValue(new Error('UNAVAILABLE'));
    const failure = assertClaimsHaveSeat(UID, { companyId: W });
    await expect(failure).rejects.toThrow('UNAVAILABLE');
    await expect(failure).rejects.not.toBeInstanceOf(ClaimsSeatViolation);
  });
});

describe('Σ — 🔴 το στένωμα: ΚΑΝΕΝΑ claim φτάνει στο Auth χωρίς θέση', () => {
  it('Σ0 — ο παρονομαστής: με θέση, το claim γράφεται', async () => {
    seatGet.mockResolvedValue(snapshotOf({ uid: UID, globalRole: 'super_admin', status: 'active' }));
    await setClaimsWithMirror(UID, { companyId: W, globalRole: 'super_admin' });
    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
  });

  it('🔴 Σ1 — χωρίς θέση: άρνηση ΠΡΙΝ το Auth — ούτε claim, ούτε καθρέφτης', async () => {
    seatGet.mockResolvedValue(snapshotOf(null));
    await expect(setClaimsWithMirror(UID, { companyId: W, globalRole: 'super_admin' })).rejects.toBeInstanceOf(ClaimsSeatViolation);
    expect(setCustomUserClaims).not.toHaveBeenCalled();
    expect(mirrorSet).not.toHaveBeenCalled();
  });

  it('Σ2 — ο πολίτης (χωρίς `companyId`) γράφει claims χωρίς καμία ανάγνωση θέσης', async () => {
    await setClaimsWithMirror(UID, { companyId: null, globalRole: 'external_user' });
    expect(seatGet).not.toHaveBeenCalled();
    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
  });
});
