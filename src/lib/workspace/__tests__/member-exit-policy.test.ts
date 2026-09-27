/**
 * @jest-environment node
 *
 * @fileoverview **Η ΚΡΙΣΗ ΤΗΣ ΕΞΟΔΟΥ** — ADR-892 §3.3 (Φ1).
 * @related lib/workspace/member-exit-policy.ts
 *
 * Ερώτημα: «μπορεί ΑΥΤΗ η θητεία να κλείσει ΤΩΡΑ, από ΑΥΤΟΝ;» — τέσσερις αναλλοίωτες που κανένα
 * permission δεν απαντά: υπάρχει θητεία · εαυτός · ανώτερος · τελευταίος διαχειριστής.
 * Οι ρόλοι έρχονται από τον **πραγματικό** κατάλογο (`role-catalogue`) — καμία πλαστή ιεραρχία.
 */

import {
  judgeAccessRestore,
  judgeMemberExit,
  managesMembers,
  type AccessRestoreQuery,
  type MemberExitQuery,
} from '../member-exit-policy';
import type { WorkspaceMembership, WorkspaceMembershipStatus } from '@/types/workspace-membership';

function seat(uid: string, globalRole: string, status: WorkspaceMembershipStatus = 'active'): WorkspaceMembership {
  return { uid, globalRole, status, permissionSetIds: [], addedBy: null, enrollment: 'invitation', tenureEnd: null };
}

const OWNER = seat('uid_owner', 'company_admin');
const CO_OWNER = seat('uid_co', 'company_admin');
const STAFF = seat('uid_staff', 'external_user');

function query(overrides: Partial<MemberExitQuery>): MemberExitQuery {
  return {
    kind: 'removal',
    actorUid: OWNER.uid,
    actorRole: OWNER.globalRole,
    targetUid: STAFF.uid,
    target: STAFF,
    activeMembers: [OWNER, STAFF],
    ...overrides,
  };
}

describe('Α — η ικανότητα διαχειριστή κρίνεται από τον ΕΝΑ κριτή', () => {
  it('Α1 — company_admin διαχειρίζεται μέλη· external_user όχι· απών ρόλος όχι', () => {
    expect(managesMembers('company_admin')).toBe(true);
    expect(managesMembers('external_user')).toBe(false);
    expect(managesMembers('')).toBe(false);
  });
});

describe('Ε — αφαίρεση', () => {
  it('Ε1 — διαχειριστής βγάζει συνεργάτη ⇒ allowed', () => {
    expect(judgeMemberExit(query({}))).toEqual({ kind: 'allowed' });
  });

  it('Ε2 — αφαίρεση του εαυτού ⇒ self-removal (είναι αποχώρηση, άλλη πράξη)', () => {
    expect(judgeMemberExit(query({ targetUid: OWNER.uid, target: OWNER, activeMembers: [OWNER, CO_OWNER] })))
      .toEqual({ kind: 'self-removal' });
  });

  it('Ε3 — ανώτερος: external_user δεν βγάζει company_admin', () => {
    expect(judgeMemberExit(query({
      actorUid: STAFF.uid, actorRole: STAFF.globalRole, targetUid: CO_OWNER.uid, target: CO_OWNER,
      activeMembers: [OWNER, CO_OWNER, STAFF],
    }))).toEqual({ kind: 'outranks-actor' });
  });

  it('Ε4 — ισότιμος επιτρέπεται: owner βγάζει co-owner όταν μένει άλλος διαχειριστής (GitHub)', () => {
    expect(judgeMemberExit(query({ targetUid: CO_OWNER.uid, target: CO_OWNER, activeMembers: [OWNER, CO_OWNER] })))
      .toEqual({ kind: 'allowed' });
  });

  it('Ε5 — δρων χωρίς ρόλο δεν βγάζει κανέναν (fail-closed)', () => {
    expect(judgeMemberExit(query({ actorRole: null }))).toEqual({ kind: 'outranks-actor' });
  });

  it('Ε6 — πλατφόρμα (παράκαμψη) δεν υπερέχεται ποτέ', () => {
    expect(judgeMemberExit(query({ actorUid: 'uid_platform', actorRole: 'super_admin', targetUid: CO_OWNER.uid,
      target: CO_OWNER, activeMembers: [OWNER, CO_OWNER] }))).toEqual({ kind: 'allowed' });
  });
});

describe('Τ — ο τελευταίος διαχειριστής (Figma: πρώτα μεταβίβαση)', () => {
  it('Τ1 — η πλατφόρμα δεν αφαιρεί τον ΜΟΝΟ διαχειριστή ⇒ last-manager', () => {
    expect(judgeMemberExit(query({ actorUid: 'uid_platform', actorRole: 'super_admin', targetUid: OWNER.uid,
      target: OWNER, activeMembers: [OWNER, STAFF] }))).toEqual({ kind: 'last-manager' });
  });

  it('Τ2 — ο μόνος διαχειριστής δεν αποχωρεί ⇒ last-manager', () => {
    expect(judgeMemberExit(query({ kind: 'departure', actorUid: OWNER.uid, targetUid: OWNER.uid, target: OWNER })))
      .toEqual({ kind: 'last-manager' });
  });

  it('Τ3 — ανασταλμένος συνδιαχειριστής ΔΕΝ μετρά ως «μένει διαχειριστής»', () => {
    const suspendedCo = seat(CO_OWNER.uid, 'company_admin', 'suspended');
    expect(judgeMemberExit(query({ kind: 'departure', actorUid: OWNER.uid, targetUid: OWNER.uid, target: OWNER,
      activeMembers: [OWNER, suspendedCo] }))).toEqual({ kind: 'last-manager' });
  });

  it('Τ4 — ανασταλμένος στόχος-διαχειριστής βγαίνει ελεύθερα (δεν κρατά το γραφείο ανοιχτό)', () => {
    const suspendedOwner = seat('uid_old', 'company_admin', 'suspended');
    expect(judgeMemberExit(query({ actorUid: 'uid_platform', actorRole: 'super_admin', targetUid: suspendedOwner.uid,
      target: suspendedOwner, activeMembers: [STAFF] }))).toEqual({ kind: 'allowed' });
  });
});

describe('Α — αποχώρηση', () => {
  it('Α2 — συνεργάτης αποχωρεί μόνος του ⇒ allowed', () => {
    expect(judgeMemberExit(query({ kind: 'departure', actorUid: STAFF.uid, actorRole: STAFF.globalRole })))
      .toEqual({ kind: 'allowed' });
  });

  it('Α3 — «αποχώρηση» για λογαριασμό άλλου ⇒ not-self-departure', () => {
    expect(judgeMemberExit(query({ kind: 'departure' }))).toEqual({ kind: 'not-self-departure' });
  });
});

describe('Θ — θητεία', () => {
  it('Θ1 — χωρίς έγγραφο ⇒ not-a-member', () => {
    expect(judgeMemberExit(query({ target: null }))).toEqual({ kind: 'not-a-member' });
  });

  it.each(['removed', 'left'] as const)('Θ2 — ληγμένη θητεία (%s) ⇒ not-a-member (ιδεμποτικό)', (status) => {
    expect(judgeMemberExit(query({ target: seat(STAFF.uid, 'external_user', status) })))
      .toEqual({ kind: 'not-a-member' });
  });
});

describe('Π — παύση πρόσβασης (ADR-892 Φ2β): ίδιες αναλλοίωτες με την αφαίρεση', () => {
  it('Π1 — διαχειριστής βάζει σε παύση συνεργάτη ⇒ allowed', () => {
    expect(judgeMemberExit(query({ kind: 'pause' }))).toEqual({ kind: 'allowed' });
  });

  it('Π2 — παύση του εαυτού ⇒ self-pause', () => {
    expect(judgeMemberExit(query({ kind: 'pause', targetUid: OWNER.uid, target: OWNER, activeMembers: [OWNER, CO_OWNER] })))
      .toEqual({ kind: 'self-pause' });
  });

  it('Π3 — ανώτερος: external_user δεν βάζει σε παύση company_admin', () => {
    expect(judgeMemberExit(query({
      kind: 'pause', actorUid: STAFF.uid, actorRole: STAFF.globalRole, targetUid: CO_OWNER.uid, target: CO_OWNER,
      activeMembers: [OWNER, CO_OWNER, STAFF],
    }))).toEqual({ kind: 'outranks-actor' });
  });

  it('Π4 🔴 ο ΜΟΝΟΣ διαχειριστής δεν μπαίνει σε παύση ⇒ last-manager (γραφείο κλειδωμένο για πάντα)', () => {
    expect(judgeMemberExit(query({ kind: 'pause', actorUid: 'uid_platform', actorRole: 'super_admin',
      targetUid: OWNER.uid, target: OWNER, activeMembers: [OWNER, STAFF] }))).toEqual({ kind: 'last-manager' });
  });

  it.each(['suspended', 'pending', 'removed'] as const)('Π5 — μη ενεργή θέση (%s) ⇒ not-a-member', (status) => {
    expect(judgeMemberExit(query({ kind: 'pause', target: seat(STAFF.uid, 'external_user', status) })))
      .toEqual({ kind: 'not-a-member' });
  });
});

describe('Ε — επαναφορά πρόσβασης (ADR-892 Φ2β)', () => {
  const PAUSED = seat(STAFF.uid, 'external_user', 'suspended');
  const restore = (overrides: Partial<AccessRestoreQuery>): AccessRestoreQuery => ({
    actorUid: OWNER.uid, actorRole: OWNER.globalRole, targetUid: PAUSED.uid, target: PAUSED, ...overrides,
  });

  it('Ε7 — σε παύση ⇒ allowed', () => {
    expect(judgeAccessRestore(restore({}))).toEqual({ kind: 'allowed' });
  });

  it('Ε8 — ήδη ενεργός ⇒ not-paused (ιδεμποτία, όχι σφάλμα)', () => {
    expect(judgeAccessRestore(restore({ target: STAFF }))).toEqual({ kind: 'not-paused' });
  });

  it.each([null, 'removed', 'pending'] as const)('Ε9 — χωρίς θέση / ληγμένη / εκκρεμής (%s) ⇒ not-a-member', (status) => {
    const target = status === null ? null : seat(STAFF.uid, 'external_user', status);
    expect(judgeAccessRestore(restore({ target }))).toEqual({ kind: 'not-a-member' });
  });

  it('Ε10 — ο εαυτός δεν επαναφέρει τον εαυτό του ⇒ self-restore', () => {
    const pausedOwner = seat(OWNER.uid, 'company_admin', 'suspended');
    expect(judgeAccessRestore(restore({ targetUid: OWNER.uid, target: pausedOwner }))).toEqual({ kind: 'self-restore' });
  });

  it('Ε11 — ανώτερος: external_user δεν επαναφέρει company_admin', () => {
    const pausedCo = seat(CO_OWNER.uid, 'company_admin', 'suspended');
    expect(judgeAccessRestore(restore({
      actorUid: 'uid_x', actorRole: 'external_user', targetUid: pausedCo.uid, target: pausedCo,
    }))).toEqual({ kind: 'outranks-actor' });
  });
});
