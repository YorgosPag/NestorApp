/**
 * ⚓ ADR-742 §7undecies — **η δήλωση πόρου**: ένα συμβόλαιο για έξι πόρους
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΕΝΑ TEST ΚΑΙ ΟΧΙ ΕΞΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Οι Ομάδες 3–5 έγραψαν **ένα test ανά πόρο**, γιατί κάθε πόρος είχε **δικό
 * του** module με δικό του σώμα. Η Ομάδα 6 βρήκε έξι πόρους ταυτόχρονα και τους
 * έκανε **δηλώσεις** πάνω σε μία υλοποίηση — οπότε έξι tests θα ήταν έξι
 * αντίγραφα που δοκιμάζουν **την ίδια συνάρτηση** με άλλα ονόματα. Ακριβώς ο
 * κλώνος που το `jscpd` δεν βλέπει (μάθημα #4), απλώς σε σουίτα.
 *
 * ⇒ Το συμβόλαιο δοκιμάζεται **εδώ, μία φορά**. Ότι κάθε πόρος όντως περνά από
 * εδώ το φυλάει το `resource-concealment-anchor` (καθολική απογραφή, ισότητα).
 *
 * 🔴 Δοκιμάζεται **τι ΤΡΕΧΕΙ**, όχι μόνο **τι ΑΠΑΝΤΑ** (μάθημα #13): ότι ο
 * φύλακας δεν καλείται καν σε ανύπαρκτο έγγραφο, ότι το «όχι» βγαίνει από το
 * **ίδιο** εργοστάσιο και στους δύο κλάδους, και ότι το κενό `companyId` δεν
 * περνά ποτέ για tenant.
 *
 * @module lib/api/__tests__/owned-resource-http
 * @see ADR-742 §3.3, §4, §7.1, §7undecies
 */

/**
 * 🔴 Το `next/server` **δεν** φορτώνεται αυτούσιο σε περιβάλλον δοκιμών: σπάει
 * ολόκληρη τη σουίτα με `ReferenceError: Request is not defined` — μετρημένα,
 * και είναι ο λόγος που το `contact-not-found-response.ts` κρατιέται χωριστά
 * από τον καθαρό φύλακα (§7octies.4). Ίδιο πλαστό με τα route tests του
 * ADR-603: κρατά **κωδικό και σώμα**, δηλαδή ακριβώς ό,τι κρίνει η μεταμφίεση.
 */
jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

const loggerCalls: Array<{ level: string; message: string }> = [];
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: (message: string) => loggerCalls.push({ level: 'info', message }),
    warn: (message: string) => loggerCalls.push({ level: 'warn', message }),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Ελεγχόμενη «βάση»: κλειδί `${collection}/${id}`· απόν κλειδί ⇒ ανύπαρκτο έγγραφο.
const store = new Map<string, Record<string, unknown>>();
const reads: string[] = [];

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: (collection: string) => ({
      doc: (id: string) => ({
        id,
        get: async () => {
          reads.push(`${collection}/${id}`);
          const data = store.get(`${collection}/${id}`);
          return { exists: data !== undefined, id, data: () => data };
        },
      }),
    }),
  }),
}));

import { defineOwnedResource } from '../owned-resource-http';
import type { ResourceAccessCaller } from '@/lib/auth/resource-ownership-guard';

const COLLECTION = 'δοκιμαστικά_στυλ';
const NOT_FOUND_MESSAGE = 'DXF dimension style not found';

const resource = defineOwnedResource({
  collection: COLLECTION,
  resourceLabel: 'DimStyle',
  idLogField: 'styleId',
  notFoundMessage: NOT_FOUND_MESSAGE,
});

const OWNER: ResourceAccessCaller = {
  companyId: 'comp_1',
  globalRole: 'company_admin',
  uid: 'user_1',
  email: 'user@example.com',
};
const BYPASS: ResourceAccessCaller = { ...OWNER, globalRole: 'super_admin', uid: 'root_1' };
/** Χαλασμένο token: το κενό **δεν** είναι tenant, είναι απουσία tenant (§4). */
const BROKEN_TOKEN: ResourceAccessCaller = { ...OWNER, companyId: '' };

const DOC_ID = 'style_1';
const KEY = `${COLLECTION}/${DOC_ID}`;

beforeEach(() => {
  store.clear();
  reads.length = 0;
  loggerCalls.length = 0;
});

/**
 * Κωδικός **και** σώμα ως **ένα** ζεύγος (μάθημα #7): ξεχωριστά `expect`
 * αφήνουν το ένα να αποκλίνει ενώ το άλλο μένει πράσινο — και η μεταμφίεση
 * κρίνεται στο **ολόκληρο** σχήμα (§7.1).
 */
async function wire(res: { status: number; json: () => Promise<unknown> }) {
  return { status: res.status, body: await res.json() };
}

// ============================================================================
describe('⚓ ο πόρος βρίσκει όντως έγγραφα (φύλακας κατά σιωπηλά άδειας σάρωσης)', () => {
  it('δικό μου έγγραφο ⇒ επιστρέφεται, με ref και ωμό φορτίο', async () => {
    store.set(KEY, { companyId: 'comp_1', name: 'ISO-25' });

    const owned = await resource.load({
      docId: DOC_ID,
      caller: OWNER,
      action: 'update',
      refusal: resource.notFoundResponse,
    });

    expect(reads).toEqual([KEY]);
    expect(owned.refusal).toBeUndefined();
    expect(owned.doc?.data).toEqual({ companyId: 'comp_1', name: 'ISO-25' });
    expect(owned.doc?.ref).toBeDefined();
  });
});

// ============================================================================
describe('🔴 ΤΟ ΜΑΝΤΕΙΟ ΥΠΑΡΞΗΣ ΕΙΝΑΙ ΚΛΕΙΣΤΟ — τα δύο «όχι» είναι ΠΑΝΟΜΟΙΟΤΥΠΑ', () => {
  it('ανύπαρκτο και ξένο δίνουν ΤΟΝ ΙΔΙΟ κωδικό ΚΑΙ το ίδιο σώμα', async () => {
    const missing = await resource.load({
      docId: DOC_ID,
      caller: OWNER,
      action: 'update',
      refusal: resource.notFoundResponse,
    });

    store.set(KEY, { companyId: 'comp_ΞΕΝΗ', name: 'μυστικό' });
    const foreign = await resource.load({
      docId: DOC_ID,
      caller: OWNER,
      action: 'update',
      refusal: resource.notFoundResponse,
    });

    expect(await wire(missing.refusal!)).toEqual(await wire(foreign.refusal!));
    expect(await wire(foreign.refusal!)).toEqual({
      status: 404,
      body: { success: false, error: NOT_FOUND_MESSAGE },
    });
  });

  it('🔴 το ξένο έγγραφο ΔΕΝ διαρρέει στον καλούντα', async () => {
    store.set(KEY, { companyId: 'comp_ΞΕΝΗ', name: 'μυστικό' });

    const foreign = await resource.load({
      docId: DOC_ID,
      caller: OWNER,
      action: 'update',
      refusal: resource.notFoundResponse,
    });

    expect(foreign.doc).toBeUndefined();
  });

  it('🔴 το ίχνος ελέγχου ΚΡΑΤΑ την αλήθεια — η μεταμφίεση αφορά μόνο το σύρμα (§3.4)', async () => {
    store.set(KEY, { companyId: 'comp_ΞΕΝΗ' });

    await resource.load({
      docId: DOC_ID,
      caller: OWNER,
      action: 'update',
      refusal: resource.notFoundResponse,
    });

    expect(loggerCalls).toContainEqual({
      level: 'warn',
      message: 'TENANT ISOLATION VIOLATION — dimstyle access blocked',
    });
  });
});

// ============================================================================
describe('🔴 Η ΠΑΓΙΔΑ ΤΟΥ ΚΕΝΟΥ (§4) — το κενό δεν είναι tenant', () => {
  it('καλών με χαλασμένο token ΔΕΝ παίρνει έγγραφο με κενό companyId', async () => {
    store.set(KEY, { companyId: '' });

    const outcome = await resource.load({
      docId: DOC_ID,
      caller: BROKEN_TOKEN,
      action: 'update',
      refusal: resource.notFoundResponse,
    });

    expect(outcome.doc).toBeUndefined();
    expect(outcome.refusal!.status).toBe(404);
  });

  it('έγγραφο ΧΩΡΙΣ companyId δεν ανήκει σε κανέναν κανονικό χρήστη', async () => {
    store.set(KEY, { name: 'ορφανό' });

    const outcome = await resource.load({
      docId: DOC_ID,
      caller: OWNER,
      action: 'update',
      refusal: resource.notFoundResponse,
    });

    expect(outcome.doc).toBeUndefined();
  });
});

// ============================================================================
describe('⚓ ο bypass ρόλος (ADR-232) — ονομασμένη κατάσταση, όχι σιωπηλό «ναι»', () => {
  it('υπεργραφέας διαβάζει ξένο έγγραφο ΚΑΙ καταγράφεται', async () => {
    store.set(KEY, { companyId: 'comp_ΞΕΝΗ' });

    const outcome = await resource.load({
      docId: DOC_ID,
      caller: BYPASS,
      action: 'update',
      refusal: resource.notFoundResponse,
    });

    expect(outcome.doc?.data).toEqual({ companyId: 'comp_ΞΕΝΗ' });
    expect(loggerCalls).toContainEqual({
      level: 'info',
      message: '[SUPER_ADMIN] Cross-tenant dimstyle access',
    });
  });

  it('🔴 ΟΥΤΕ ο υπεργραφέας παίρνει ΑΝΥΠΑΡΚΤΟ έγγραφο — αλλιώς κατεβαίνει φάντασμα', async () => {
    const outcome = await resource.load({
      docId: DOC_ID,
      caller: BYPASS,
      action: 'update',
      refusal: resource.notFoundResponse,
    });

    expect(outcome.doc).toBeUndefined();
    expect(outcome.refusal!.status).toBe(404);
  });

  it('η ετυμηγορία διακρίνει τις ΤΡΕΙΣ καταστάσεις (σημείο εισόδου του JIT)', () => {
    const q = (data: unknown, caller: ResourceAccessCaller) => ({
      data: data as { companyId?: string | null },
      caller,
      resourceId: DOC_ID,
      action: 'check',
    });

    expect(resource.check(q({ companyId: 'comp_1' }, OWNER))).toBe('owned');
    expect(resource.check(q({ companyId: 'comp_ΞΕΝΗ' }, OWNER))).toBe('denied');
    expect(resource.check(q({ companyId: 'comp_ΞΕΝΗ' }, BYPASS))).toBe('cross-tenant-bypass');
  });
});

// ============================================================================
describe('⚓ το «όχι» ΤΗΣ ΔΙΑΔΡΟΜΗΣ, όταν το σχήμα της διαφέρει (§7.1)', () => {
  it('η διαδρομή δίνει δικό της εργοστάσιο και το παίρνουν ΚΑΙ ΟΙ ΔΥΟ κλάδοι', async () => {
    const refusal = jest.fn(() => ({ success: false, error: NOT_FOUND_MESSAGE, errorCode: 'FILE_NOT_FOUND' }));

    const missing = await resource.load({ docId: DOC_ID, caller: OWNER, action: 'process', refusal });

    store.set(KEY, { companyId: 'comp_ΞΕΝΗ' });
    const foreign = await resource.load({ docId: DOC_ID, caller: OWNER, action: 'process', refusal });

    expect(missing.refusal).toEqual(foreign.refusal);
    expect(refusal).toHaveBeenCalledTimes(2);
    expect(refusal).toHaveBeenCalledWith();
  });

  it('το κείμενο είναι εκτεθειμένο ώστε άλλα σχήματα να το ξαναχρησιμοποιούν', () => {
    expect(resource.notFoundMessage).toBe(NOT_FOUND_MESSAGE);
  });
});
