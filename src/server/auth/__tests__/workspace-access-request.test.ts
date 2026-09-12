/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΚΥΚΛΟΣ ΖΩΗΣ ΤΟΥ ΑΙΤΗΜΑΤΟΣ ΕΝΤΑΞΗΣ** (ADR-660 §6 · ADR-853 Α4) — άγκυρες.
 * @related server/auth/workspace-access-request.ts
 *
 * - **Τ** — ταυτότητα: ντετερμινιστική **και** δεκτή από τον επικυρωτή του έργου (v4).
 * - **Π** — απόφαση: **μόνο `pending →`**, ιδεμποτική, ποτέ ανατροπή.
 * - **Λ** — λίστα: **μόνο** αυτού του χώρου, **μόνο** εκκρεμή.
 * - **Ο** — η **ΔΙΚΗ ΜΟΥ** κατάσταση: χωρίς εταιρεία, με **γραμμένη** σειρά προτεραιότητας.
 * - **Φ** — 🔴 **ΤΟ ΠΑΓΩΜΑ** (ADR-853 Α4): κανένας δρόμος δεν **ανοίγει** πια αίτημα.
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
    get: async () => ({
      exists: store.has(id),
      id,
      data: () => store.get(id)?.data,
      get: (k: string) => store.get(id)?.data[k],
    }),
  };
}

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => {
      const query = {
        where: (...args: unknown[]) => { whereCalls.push(args); return query; },
        limit: () => query,
        get: async () => ({
          docs: [...store.entries()].map(([id, doc]) => ({
            id,
            data: () => doc.data,
            get: (k: string) => doc.data[k],
          })),
        }),
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
import { readRepoCode } from '@/test-utils/read-source';
import * as accessRequestModule from '../workspace-access-request';
import {
  collapseOwnAccessStates,
  decideAccessRequest,
  listPendingAccessRequests,
  readOwnAccessState,
} from '../workspace-access-request';

const COMPANY = 'comp_1';
const UID = 'uid_1';
const ID = generateDeterministicWorkspaceAccessRequestId(COMPANY, UID);

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

// =============================================================================
// Φ — ΤΟ ΠΑΓΩΜΑ (ADR-853 Α4)
// =============================================================================
//
// 🔴 ΤΙ ΣΥΝΕΒΗ (2026-09-11): κάθε σύνδεση χωρίς χώρο **άνοιγε** αίτημα προς τη
// σταθερή εταιρεία. Η θεραπεία δεν είναι «μην το καλείς» — είναι ότι **δεν
// υπάρχει τι να καλέσεις**. Μια εξαγόμενη συνάρτηση χωρίς καλούντα θα ήταν
// ταυτόχρονα νεκρός κώδικας (CHECK 3.22) **και** ανοιχτή πόρτα για τον επόμενο.

describe('Φ — το αίτημα πάγωσε: κανείς δεν το ανοίγει', () => {
  it('Φ1 — οι δρόμοι ανοίγματος ΔΕΝ εξάγονται πια', () => {
    expect(accessRequestModule).not.toHaveProperty('openAccessRequestInTx');
    expect(accessRequestModule).not.toHaveProperty('readAccessRequestInTx');
  });

  it('Φ1β — και δεν υπάρχουν ούτε ως κώδικας (η μετονομασία δεν είναι θεραπεία)', () => {
    const source = readRepoCode('src/server/auth/workspace-access-request.ts');
    // Παρονομαστής: αν η ανάγνωση αποτύχει, το «κανένα εύρημα» σημαίνει «δεν κοίταξα».
    expect(source).toContain('decideAccessRequest');
    expect(source).not.toContain('function openAccessRequestInTx');
    expect(source).not.toContain('tx.create(');
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

describe('Λ — η λίστα του διαχειριστή', () => {
  it('🔒 Λ1 — ρωτά ΜΟΝΟ τον δικό του χώρο και ΜΟΝΟ τα εκκρεμή', async () => {
    store.set(ID, { data: { status: 'pending', requesterUid: UID, companyId: COMPANY, requesterEmail: 'a@example.com' } });
    const list = await listPendingAccessRequests(COMPANY);
    expect(whereCalls).toEqual([['companyId', '==', COMPANY], ['status', '==', 'pending']]);
    expect(list.map((view) => view.requesterUid)).toEqual([UID]);
  });
});

// =============================================================================
// Ο — Η ΔΙΚΗ ΜΟΥ ΚΑΤΑΣΤΑΣΗ (ADR-853 Α4)
// =============================================================================

describe('Ο — τι απέγινε το ΔΙΚΟ μου αίτημα', () => {
  it('🔴 Ο1 — ρωτά με το `requesterUid`, ΠΟΤΕ με εταιρεία (η σταθερή εταιρεία έφυγε)', async () => {
    store.set(ID, { data: { status: 'denied', requesterUid: UID } });
    expect(await readOwnAccessState(UID)).toBe('denied');
    expect(whereCalls).toEqual([['requesterUid', '==', UID]]);
    // ⚠️ Άγκυρα ΑΠΟΥΣΙΑΣ: ένα `where('companyId')` θα επανέφερε ακριβώς τη διαρροή.
    expect(whereCalls.flat()).not.toContain('companyId');
  });

  it('Ο2 — κανένα αίτημα ⇒ `none` (ποτέ «εκκρεμεί» από μαντεψιά)', async () => {
    expect(await readOwnAccessState(UID)).toBe('none');
  });

  /**
   * 🔑 **Ο3 — Η ΣΕΙΡΑ ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΣΕΙΡΑ ΤΗΣ FIRESTORE.**
   *
   * Ένας άνθρωπος μπορεί να έχει αιτήματα σε πολλούς χώρους. Χωρίς γραμμένη
   * προτεραιότητα, η οθόνη θα έδειχνε ό,τι γύρισε **πρώτο** — απάντηση που
   * αλλάζει χωρίς να αλλάξει τίποτα.
   */
  it('Ο3 — προτεραιότητα: pending > approved > denied > withdrawn > none', () => {
    expect(collapseOwnAccessStates(['denied', 'pending'])).toBe('pending');
    expect(collapseOwnAccessStates(['withdrawn', 'approved'])).toBe('approved');
    expect(collapseOwnAccessStates(['withdrawn', 'denied'])).toBe('denied');
    expect(collapseOwnAccessStates(['withdrawn'])).toBe('withdrawn');
    expect(collapseOwnAccessStates([])).toBe('none');
  });

  it('Ο4 — άγνωστη τιμή αγνοείται (fail-closed: δεν γίνεται σιωπηλά «εκκρεμεί»)', () => {
    expect(collapseOwnAccessStates(['σκουπίδι', null, undefined, 42])).toBe('none');
    expect(collapseOwnAccessStates(['σκουπίδι', 'denied'])).toBe('denied');
  });
});
