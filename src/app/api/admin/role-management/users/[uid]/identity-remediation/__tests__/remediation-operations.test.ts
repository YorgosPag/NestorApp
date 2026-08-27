/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΟΥ ΕΚΤΕΛΕΣΤΗ — COMPARE-AND-SWAP ΚΑΙ ΑΡΝΗΣΗ ΔΗΜΙΟΥΡΓΙΑΣ (ADR-822 §7.2)
 * =============================================================================
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΣΗ**: ο πρώτος κύκλος
 * μεταλλάξεων του ADR-822 έδειξε **10/12 κόκκινες**. Οι **δύο** που επέζησαν
 * *(σβήσιμο του ελέγχου CAS · μετατροπή της άρνησης δημιουργίας σε `tx.set`)*
 * μετάλλασσαν το `remediation-operations.ts` — **που δεν είχε καμία άγκυρα**.
 *
 * 🔑 Δηλαδή η **καθαρή αυθεντία** ήταν πλήρως φυλαγμένη, και η **γραφή** —
 * το μόνο μέρος που αγγίζει ζωντανά δεδομένα — **καθόλου**. *Πράσινα tests που
 * δεν αποδεικνύουν εγγραφή.* Οι δύο μεταλλάξεις είναι πλέον `Ε2` και `Ε5`.
 *
 * ⚠️ **Χωρίς emulator**: ψεύτικο Firestore in-memory. Η συναλλαγή είναι το
 * **συμβόλαιο** που δοκιμάζουμε, όχι η υλοποίηση της Google.
 *
 * @see ADR-822 §4.5 · §7.2
 */

import { describe, it, expect, jest } from '@jest/globals';

jest.mock('@/lib/firebaseAdmin', () => ({
  FieldValue: { serverTimestamp: () => '<<server-timestamp>>' },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import type { Firestore } from 'firebase-admin/firestore';

import { applyRemediation, materialiseDocument } from '../remediation-operations';
import type { MaterialisationPlan, RemediationPlan } from '@/lib/auth/identity-remediation';

// ============================================================================
// ΤΟ ΨΕΥΤΙΚΟ FIRESTORE — όσο ακριβώς χρειάζεται, ούτε γραμμή παραπάνω
// ============================================================================

interface FakeDoc {
  data: Record<string, unknown> | null;
}

function fakeDb(initial: Record<string, unknown> | null): {
  db: Firestore;
  doc: FakeDoc;
  writes: Record<string, unknown>[];
  creates: Record<string, unknown>[];
} {
  const doc: FakeDoc = { data: initial };
  const writes: Record<string, unknown>[] = [];
  const creates: Record<string, unknown>[] = [];
  const ref = { id: 'target' };

  const db = {
    collection: () => ({ doc: () => ref }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: async () => ({ exists: doc.data !== null, data: () => doc.data }),
        update: (_ref: unknown, patch: Record<string, unknown>) => {
          writes.push(patch);
          doc.data = { ...(doc.data ?? {}), ...patch };
        },
        set: (_ref: unknown, patch: Record<string, unknown>) => {
          creates.push(patch);
          doc.data = { ...patch };
        },
      }),
  } as unknown as Firestore;

  return { db, doc, writes, creates };
}

/** Σχέδιο που περιμένει `updatedAt === 1000`. */
const PLAN: RemediationPlan = {
  verdict: 'document-without-account',
  forward: {
    uid: 'dev-admin',
    patch: { globalRole: 'external_user', status: 'suspended' },
    expectedUpdatedAtMs: 1000,
    summary: 'δοκιμή',
  },
  inverse: { uid: 'dev-admin', patch: { globalRole: 'super_admin', status: 'active' }, summary: 'αναίρεση' },
};

const LIVE = { globalRole: 'super_admin', status: 'active', updatedAt: 1000 };

// ============================================================================

describe('Ε — ο εκτελεστής: καμία τυφλή γραφή, καμία δημιουργία', () => {
  it('Ε0 — ο παρονομαστής: όταν ΟΛΑ συμφωνούν, ΓΡΑΦΕΙ', () => {
    // ⚠️ Χωρίς αυτό, ένας εκτελεστής που αρνείται τα πάντα θα έκανε κάθε
    //    επόμενη άγκυρα πράσινη — «ασφαλής» επειδή δεν κάνει τίποτα.
    return fakeDbApply(LIVE).then(({ result, writes }) => {
      expect(result.ok).toBe(true);
      expect(writes).toHaveLength(1);
      expect(writes[0]).toMatchObject({ globalRole: 'external_user', status: 'suspended' });
    });
  });

  it('Ε1 — γράφει ΜΟΝΟ τα πεδία του patch, συν updatedAt/updatedBy', async () => {
    const { writes } = await fakeDbApply(LIVE);
    expect(Object.keys(writes[0]).sort()).toEqual(['globalRole', 'status', 'updatedAt', 'updatedBy']);
    expect(writes[0].updatedBy).toBe('actor-uid');
  });

  it('Ε2 — 🔴 CAS: το έγγραφο ΑΛΛΑΞΕ στο μεταξύ ⇒ ΑΡΝΗΣΗ, όχι υπεργραφή', async () => {
    // 🔑 Αυτή είναι η μετάλλαξη T11 που ΕΠΕΖΗΣΕ όταν δεν υπήρχε άγκυρα.
    const { result, writes } = await fakeDbApply({ ...LIVE, updatedAt: 2000 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).toMatch(/changed since it was read/);
    expect(writes).toHaveLength(0);
  });

  it('Ε3 — CAS και για το ΑΝΤΙΣΤΡΟΦΟ: απέκτησε updatedAt ενώ δεν είχε', async () => {
    // Σχέδιο που είδε έγγραφο ΧΩΡΙΣ updatedAt· τώρα έχει ⇒ κάποιος το έγραψε.
    const plan: RemediationPlan = { ...PLAN, forward: { ...PLAN.forward, expectedUpdatedAtMs: null } };
    const { db, writes } = fakeDb({ globalRole: 'super_admin', status: 'active', updatedAt: 5 });
    const result = await applyRemediation(db, plan, 'actor-uid');
    expect(result.ok).toBe(false);
    expect(writes).toHaveLength(0);
  });

  it('Ε4 — ΙΔΕΜΠΟΤΕΝΤΙΚΟ: δεύτερη κλήση με το ΙΔΙΟ σχέδιο αρνείται', async () => {
    const { db, writes } = fakeDb({ ...LIVE });
    const first = await applyRemediation(db, PLAN, 'actor-uid');
    expect(first.ok).toBe(true);
    // Η πρώτη γραφή άλλαξε το updatedAt σε sentinel ⇒ το CAS δεν ταιριάζει πια.
    const second = await applyRemediation(db, PLAN, 'actor-uid');
    expect(second.ok).toBe(false);
    expect(writes).toHaveLength(1);
  });

  it('Ε5 — ⛔ έγγραφο που ΔΕΝ ΥΠΑΡΧΕΙ: ΑΡΝΗΣΗ, ΠΟΤΕ δημιουργία', async () => {
    // 🔑 Αυτή είναι η μετάλλαξη T12 που ΕΠΕΖΗΣΕ. Δημιουργία εγγράφου εδώ θα
    //    ΕΠΙΝΟΟΥΣΕ ταυτότητα — η βλάβη του ADR-821, με άλλο όνομα.
    const { db, writes, creates } = fakeDb(null);
    const result = await applyRemediation(db, PLAN, 'actor-uid');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).toMatch(/refusing to create/);
    expect(writes).toHaveLength(0);
    expect(creates).toHaveLength(0);
  });

  it('Ε6 — το before/after είναι ΑΠΟΔΕΙΞΗ: μόνο τα πεδία που αγγίχθηκαν', async () => {
    const { result } = await fakeDbApply({ ...LIVE, email: 'x@y.gr', companyId: 'comp_1' });
    if (!result.ok) throw new Error('unreachable');
    // ⚠️ Ένα «before» με 20 πεδία δεν είναι απόδειξη — είναι αντίγραφο.
    expect(result.before).toEqual({ globalRole: 'super_admin', status: 'active' });
    expect(result.after).toEqual({ globalRole: 'external_user', status: 'suspended' });
  });
});

/** Βοηθός: εκτελεί το `PLAN` πάνω σε δοσμένη ζωντανή κατάσταση. */
async function fakeDbApply(live: Record<string, unknown>) {
  const { db, writes, creates } = fakeDb(live);
  const result = await applyRemediation(db, PLAN, 'actor-uid');
  return { result, writes, creates };
}

// =============================================================================
// Μ — Η ΥΛΟΠΟΙΗΣΗ: Η ΜΟΝΗ ΔΗΜΙΟΥΡΓΙΑ, ΚΑΙ ΜΟΝΟ ΣΤΟ ΚΕΝΟ
// =============================================================================

const MAT_PLAN: MaterialisationPlan = {
  uid: '6hWZ',
  document: { uid: '6hWZ', email: 'g@example.gr', globalRole: 'super_admin', status: 'active' },
  omitted: { loginCount: 'το γράφει η ροή σύνδεσης' },
  summary: 'δοκιμή',
  inverse: null,
  inverseNote: 'ΜΗ ΑΝΑΣΤΡΕΨΙΜΗ',
};

describe('Μ — η υλοποίηση γράφει ΜΟΝΟ όπου δεν υπάρχει τίποτα', () => {
  it('Μ0 — ο παρονομαστής: στο κενό, ΔΗΜΙΟΥΡΓΕΙ', async () => {
    const { db, creates } = fakeDb(null);
    const result = await materialiseDocument(db, MAT_PLAN, 'actor-uid');
    expect(result.ok).toBe(true);
    expect(creates).toHaveLength(1);
    expect(creates[0]).toMatchObject({ globalRole: 'super_admin', updatedBy: 'actor-uid' });
  });

  it('Μ1 — 🔴 έγγραφο ΥΠΑΡΧΕΙ ⇒ ΑΡΝΗΣΗ, ποτέ υπεργραφή ξένης δουλειάς', async () => {
    const { db, creates, writes } = fakeDb({ globalRole: 'internal_user' });
    const result = await materialiseDocument(db, MAT_PLAN, 'actor-uid');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).toMatch(/already exists/);
    expect(creates).toHaveLength(0);
    expect(writes).toHaveLength(0);
  });

  it('Μ2 — ΙΔΕΜΠΟΤΕΝΤΙΚΟ: δεύτερη κλήση αρνείται, δεν διπλογράφει', async () => {
    const { db, creates } = fakeDb(null);
    expect((await materialiseDocument(db, MAT_PLAN, 'a')).ok).toBe(true);
    expect((await materialiseDocument(db, MAT_PLAN, 'a')).ok).toBe(false);
    expect(creates).toHaveLength(1);
  });
});
