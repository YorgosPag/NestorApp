/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΡΟΕΛΕΥΣΗ ΓΡΑΦΕΤΑΙ ΜΙΑ ΦΟΡΑ ΑΝΑ ΘΗΤΕΙΑ** — ADR-867 Β9(β) Ε1.
 * @related lib/workspace/grant-membership.ts
 *
 * Ερώτημα: διαχειριστής αλλάζει ρόλο στον ιδρυτή — λέει μετά το έγγραφο ακόμη **«ιδρυτής, από
 * τότε, από τον ίδιο»**, ή «μπήκε σήμερα, με έγκριση»; Ένας έλεγχος πρόσβασης (ISO 27001 A.5.18)
 * διαβάζει ακριβώς αυτό.
 */

jest.mock('server-only', () => ({}));

let stored: Record<string, unknown> | null = null;
let failWrites = false;
const writes: Array<{ data: Record<string, unknown>; merge: boolean }> = [];

jest.mock('@/lib/workspace/workspace-member-ref', () => ({
  workspaceMemberRef: () => ({ path: 'companies/comp_w/workspace_members/uid_x' }),
}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    runTransaction: async (body: (tx: unknown) => Promise<void>) =>
      body({
        get: async () => ({ exists: stored !== null, get: (field: string) => stored?.[field] }),
        set: (_ref: unknown, data: Record<string, unknown>, options: { merge: boolean }) => {
          if (failWrites) throw new Error('ABORTED');
          writes.push({ data, merge: options.merge });
        },
      }),
  }),
}));

jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => '<ts>' } }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn() } }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import type { WriteBatch } from 'firebase-admin/firestore';

import { grantWorkspaceMembership, grantWorkspaceMembershipInBatch } from '../grant-membership';

const INPUT = {
  uid: 'uid_x',
  companyId: 'comp_w',
  globalRole: 'company_admin',
  grantedByUid: 'uid_admin',
  enrollment: 'approval',
} as const;

beforeEach(() => {
  stored = null;
  failWrites = false;
  writes.length = 0;
});

describe('Θ — μία θητεία, μία προέλευση', () => {
  it('Θ1 — ΝΕΑ θητεία (καμία θέση) ⇒ πλήρες έγγραφο: ενεργό, με `enrollment` και `addedBy`', async () => {
    await expect(grantWorkspaceMembership(INPUT)).resolves.toBe(true);
    expect(writes).toEqual([{
      merge: true,
      data: expect.objectContaining({
        uid: 'uid_x', globalRole: 'company_admin', status: 'active',
        addedBy: 'uid_admin', enrollment: 'approval', joinedAt: '<ts>',
      }),
    }]);
  });

  it('🔴 Θ2 — ΕΝΕΡΓΗ θητεία ⇒ αλλάζει ΜΟΝΟ ο ρόλος· ο ιδρυτής μένει ιδρυτής', async () => {
    stored = { status: 'active', enrollment: 'founder', addedBy: 'uid_x' };
    await grantWorkspaceMembership(INPUT);

    const [{ data }] = writes;
    expect(data).toEqual({ uid: 'uid_x', globalRole: 'company_admin', updatedAt: '<ts>' });
    for (const provenance of ['enrollment', 'addedBy', 'joinedAt', 'status']) expect(data).not.toHaveProperty(provenance);
  });

  // 🔴 ADR-892 Φ2β — ΑΝΤΙΣΤΡΑΦΗΚΕ ΣΚΟΠΙΜΑ. Μέχρι 2026-09-27 το Θ3 κλείδωνε «`suspended` ⇒ νέα θητεία»:
  //    δηλαδή μια έγκριση/αλλαγή ρόλου **ήρε σιωπηλά** την παύση του γραφείου και έσβηνε την προέλευση.
  it('🔴 Θ3 — θέση σε ΠΑΥΣΗ ⇒ αλλάζει ΜΟΝΟ ο ρόλος· η παύση ΜΕΝΕΙ (αίρεται μόνο με «Επαναφορά πρόσβασης»)', async () => {
    stored = { status: 'suspended', enrollment: 'founder', addedBy: 'uid_x' };
    await grantWorkspaceMembership(INPUT);

    const [{ data }] = writes;
    expect(data).toEqual({ uid: 'uid_x', globalRole: 'company_admin', updatedAt: '<ts>' });
    for (const touched of ['status', 'enrollment', 'addedBy', 'joinedAt', 'accessPause']) expect(data).not.toHaveProperty(touched);
  });

  it('Θ3β — ΛΗΓΜΕΝΗ θητεία (`removed`) ⇒ νέα θητεία, που καθαρίζει ΚΑΙ `tenureEnd` ΚΑΙ `accessPause`', async () => {
    stored = { status: 'removed', enrollment: 'founder' };
    await grantWorkspaceMembership(INPUT);
    expect(writes[0].data).toEqual(expect.objectContaining({
      status: 'active', enrollment: 'approval', addedBy: 'uid_admin', tenureEnd: null, accessPause: null,
    }));
  });

  it('Θ4 — αποτυχία γραφής ⇒ `false`, ποτέ εξαίρεση (ο καλών ΣΤΑΜΑΤΑ πριν τα claims)', async () => {
    stored = { status: 'active' };
    failWrites = true;
    await expect(grantWorkspaceMembership(INPUT)).resolves.toBe(false);
  });
});

describe('Β — η παραλλαγή δέσμης (ιδρυτής) γράφει το ΙΔΙΟ σχήμα', () => {
  it('Β1 — ο ιδρυτής παίρνει `enrollment: founder` από τον ΕΝΑ γραφέα, όχι από αντίγραφο', () => {
    const set = jest.fn();
    grantWorkspaceMembershipInBatch({ set } as unknown as WriteBatch, { ...INPUT, grantedByUid: 'uid_x', enrollment: 'founder' });
    expect(set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'active', enrollment: 'founder', addedBy: 'uid_x' }),
      { merge: true },
    );
  });
});
