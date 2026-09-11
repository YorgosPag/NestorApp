/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΚΥΚΛΟΣ ΖΩΗΣ ΤΟΥ ΑΙΤΗΜΑΤΟΣ ΕΝΤΑΞΗΣ** (ADR-660 §6) — άγκυρες.
 * @related server/auth/workspace-access-request.ts
 *
 * - **Α** — άνοιγμα: μόνο αν λείπει · σφραγίδα ειδοποίησης μία φορά · αποφασισμένο **δεν** ξανανοίγει.
 * - **Π** — απόφαση: **μόνο `pending →`**, ιδεμποτική, ποτέ ανατροπή.
 * - **Λ** — λίστα: **μόνο** αυτού του χώρου, **μόνο** εκκρεμή.
 * - **Τ** — ταυτότητα: ντετερμινιστική **και** δεκτή από τον επικυρωτή του έργου (v4).
 */

jest.mock('server-only', () => ({}));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS' } }));

interface FakeDoc { data: Record<string, unknown> }
const store = new Map<string, FakeDoc>();
const writes: Array<{ op: string; id: string; data: Record<string, unknown> }> = [];
const whereCalls: unknown[][] = [];

function ref(id: string) {
  return {
    id,
    get: async () => ({ exists: store.has(id), id, data: () => store.get(id)?.data, get: (k: string) => store.get(id)?.data[k] }),
  };
}

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => {
      const query = {
        where: (...args: unknown[]) => { whereCalls.push(args); return query; },
        limit: () => query,
        get: async () => ({ docs: [...store.entries()].map(([id, doc]) => ({ id, data: () => doc.data })) }),
      };
      return { doc: (id: string) => ref(id), where: query.where };
    },
    runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => cb({
      get: async (r: { get: () => Promise<unknown> }) => r.get(),
      update: (r: { id: string }, data: Record<string, unknown>) => { writes.push({ op: 'update', id: r.id, data }); },
      create: (r: { id: string }, data: Record<string, unknown>) => { writes.push({ op: 'create', id: r.id, data }); },
    }),
  }),
}));

import { isValidEnterpriseId } from '@/services/enterprise-id-parse';
import { generateDeterministicWorkspaceAccessRequestId } from '@/services/enterprise-id.service';
import {
  decideAccessRequest,
  listPendingAccessRequests,
  openAccessRequestInTx,
  readAccessRequestInTx,
  readOwnAccessState,
} from '../workspace-access-request';

const COMPANY = 'comp_1';
const UID = 'uid_1';
const ID = generateDeterministicWorkspaceAccessRequestId(COMPANY, UID);
const OPENING = { companyId: COMPANY, uid: UID, email: 'a@example.com', displayName: 'Α', authProvider: 'password' };

/** Ένα transaction που γράφει στο ίδιο ημερολόγιο με τα παραπάνω. */
function tx() {
  return {
    get: async (r: { get: () => Promise<unknown> }) => r.get(),
    update: (r: { id: string }, data: Record<string, unknown>) => { writes.push({ op: 'update', id: r.id, data }); },
    create: (r: { id: string }, data: Record<string, unknown>) => { writes.push({ op: 'create', id: r.id, data }); },
  } as never;
}

beforeEach(() => {
  store.clear();
  writes.length = 0;
  whereCalls.length = 0;
});

describe('Τ — η ταυτότητα του αιτήματος', () => {
  it('🔴 Τ1 — ντετερμινιστική ΚΑΙ δεκτή από τον επικυρωτή (v4) — αλλιώς η διαδρομή θα απέρριπτε δική μας ταυτότητα', () => {
    expect(generateDeterministicWorkspaceAccessRequestId(COMPANY, UID)).toBe(ID);
    expect(generateDeterministicWorkspaceAccessRequestId('comp_2', UID)).not.toBe(ID);
    expect(ID.startsWith('wacr_')).toBe(true);
    expect(isValidEnterpriseId(ID)).toBe(true);
  });
});

describe('Α — άνοιγμα', () => {
  it('Α1 — λείπει ⇒ ανοίγει `pending` με σφραγίδα ειδοποίησης (η πρώτη ειδοποίηση)', async () => {
    const snapshot = await readAccessRequestInTx(tx(), COMPANY, UID);
    expect(openAccessRequestInTx(tx(), snapshot, OPENING)).toEqual({ status: 'pending', firstNotification: true });
    expect(writes).toEqual([{ op: 'create', id: ID, data: expect.objectContaining({ status: 'pending', requesterUid: UID, companyId: COMPANY, notifiedAt: 'TS' }) }]);
  });

  it('Α2 — εκκρεμές ΗΔΗ ειδοποιημένο ⇒ τίποτα (notify-once)', async () => {
    store.set(ID, { data: { status: 'pending', notifiedAt: 'TS_OLD', requesterUid: UID } });
    const snapshot = await readAccessRequestInTx(tx(), COMPANY, UID);
    expect(openAccessRequestInTx(tx(), snapshot, OPENING)).toEqual({ status: 'pending', firstNotification: false });
    expect(writes).toEqual([]);
  });

  it('🔑 Α3 — ΑΠΟΡΡΙΦΘΕΝ δεν ξανανοίγει μόνο του (Atlassian: «can\'t request again» χωρίς διαχειριστή)', async () => {
    store.set(ID, { data: { status: 'denied', notifiedAt: 'TS_OLD', requesterUid: UID } });
    const snapshot = await readAccessRequestInTx(tx(), COMPANY, UID);
    expect(openAccessRequestInTx(tx(), snapshot, OPENING)).toEqual({ status: 'denied', firstNotification: false });
    expect(writes).toEqual([]);
  });
});

describe('Π — απόφαση', () => {
  it('Π1 — εκκρεμές ⇒ αποφασίζεται, με ΠΟΙΟΣ και ΠΟΤΕ', async () => {
    store.set(ID, { data: { status: 'pending', requesterUid: UID, companyId: COMPANY, requesterEmail: 'a@example.com' } });
    const outcome = await decideAccessRequest({ companyId: COMPANY, uid: UID, decision: 'denied', decidedBy: 'admin_1' });
    expect(outcome).toMatchObject({ kind: 'decided', request: { status: 'denied', decidedBy: 'admin_1', requesterUid: UID } });
    expect(writes).toEqual([{ op: 'update', id: ID, data: { status: 'denied', decidedAt: 'TS', decidedBy: 'admin_1' } }]);
  });

  it('🔒 Π2 — ΗΔΗ αποφασισμένο ⇒ ΚΑΜΙΑ γραφή (ποτέ σιωπηλή ανατροπή απόφασης)', async () => {
    store.set(ID, { data: { status: 'approved', requesterUid: UID } });
    expect(await decideAccessRequest({ companyId: COMPANY, uid: UID, decision: 'denied', decidedBy: 'admin_1' }))
      .toEqual({ kind: 'already', status: 'approved' });
    expect(writes).toEqual([]);
  });

  it('🔒 Π3 — ΑΛΛΟΣ χώρος ⇒ `absent` (το αίτημα ενός χώρου δεν ονομάζεται καν από άλλον)', async () => {
    store.set(ID, { data: { status: 'pending', requesterUid: UID } });
    expect(await decideAccessRequest({ companyId: 'comp_OTHER', uid: UID, decision: 'denied', decidedBy: 'admin_2' }))
      .toEqual({ kind: 'absent' });
  });
});

describe('Λ — λίστα και ανάγνωση', () => {
  it('🔒 Λ1 — ρωτά ΜΟΝΟ τον δικό του χώρο και ΜΟΝΟ τα εκκρεμή', async () => {
    store.set(ID, { data: { status: 'pending', requesterUid: UID, companyId: COMPANY, requesterEmail: 'a@example.com' } });
    const list = await listPendingAccessRequests(COMPANY);
    expect(whereCalls).toEqual([['companyId', '==', COMPANY], ['status', '==', 'pending']]);
    expect(list.map((view) => view.requesterUid)).toEqual([UID]);
  });

  it('Λ2 — η κατάσταση του ΔΙΚΟΥ μου αιτήματος — `none` αν δεν ζήτησα ποτέ', async () => {
    expect(await readOwnAccessState(COMPANY, UID)).toBe('none');
    store.set(ID, { data: { status: 'denied', requesterUid: UID } });
    expect(await readOwnAccessState(COMPANY, UID)).toBe('denied');
  });
});
