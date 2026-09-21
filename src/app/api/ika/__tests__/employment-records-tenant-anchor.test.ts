/**
 * ⚓ ADR-747 §13.7 — **τα ένσημα ΕΦΚΑ δεν αλλάζουν από ξένο χέρι**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΦΥΛΑΕΙ, ΚΑΙ ΓΙΑΤΙ ΚΑΜΙΑ ΠΥΛΗ ΔΕΝ ΤΟ ΕΒΛΕΠΕ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι τις 2026-09-21 και οι **δύο** διαδρομές του ΙΚΑ δέχονταν ταυτότητα από
 * τον καλούντα και **δεν ρωτούσαν ποτέ ποιανού είναι**:
 *
 * | Διαδρομή | Τι έπαιρνε από έξω | Τι έλεγχε |
 * |---|---|---|
 * | `POST /api/ika/employment-records` | `projectId` στο **σώμα** | μόνο `withAuth` |
 * | `PATCH /…/[id]/apd-status` | `id` ενσήμου στη **διαδρομή** | μόνο ότι **υπάρχει** |
 *
 * 🔴 **Το `withAuth` απαντά «είσαι συνδεδεμένος;», ποτέ «είναι δικό σου;»**, και τα
 * έγγραφα φέρουν ένσημα, εισφορές και κατάσταση ΑΠΔ. Η δεύτερη διαδρομή **γράφει**:
 * δεν ήταν διαρροή ανάγνωσης, ήταν **αλλοίωση ασφαλιστικού ιστορικού τρίτου**.
 *
 * ⚠️ **Γιατί χρειάζεται ΑΥΤΗ η άγκυρα και δεν αρκεί το `tenant-isolation.test.ts`**:
 * εκείνο αποδεικνύει ότι ο **φύλακας δουλεύει**. Αν κάποιος σβήσει τη γραμμή που τον
 * **καλεί**, ο φύλακας εξακολουθεί να δουλεύει μια χαρά και η σουίτα του μένει
 * κατάφωτη — *κατώφλι δεν πιάνει αφαίρεση* (ADR-742 μάθημα #7). Εδώ η κλήση
 * εκτελείται **μέσα από τον πραγματικό handler**, οπότε η αφαίρεσή της κοκκινίζει.
 *
 * ⚠️ Και ούτε η **πύλη** το έβλεπε: το CHECK 3.35 κρίνει **ερωτήματα** (`where`), ενώ
 * το `apd-status` διαβάζει με `.doc(id)`. Σημειακή ανάγνωση είναι **δομικά αόρατη**
 * σε κάθε σαρωτή ερωτημάτων — γι' αυτό το εύρημα δεν βρέθηκε από πύλη αλλά από
 * ανάγνωση του κώδικα δίπλα σε αυτήν.
 *
 * 🔑 **Ο φύλακας ΔΕΝ είναι mock**: mock-άρονται μόνο τα άκρα (Firestore, auth,
 * rate-limit, audit). Ένα mock του `tenant-isolation` θα απεδείκνυε ότι ο handler
 * καλεί **τον πλαστό**, δηλαδή τίποτα.
 *
 * @module app/api/ika/__tests__/employment-records-tenant-anchor
 * @see adrs/ADR-747 §13.7 · ADR-742 §7septies (γιατί 404 και όχι 403)
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(h: T) => h,
}));

// ─── Ελεγχόμενη «βάση» ───────────────────────────────────────────────────────
// Κλειδί: `${collection}/${id}`. Οι γραφές καταγράφονται ώστε το test να μπορεί να
// ρωτήσει **«έγινε γραφή;»** — η ερώτηση που έχει σημασία όταν η άρνηση αποτυγχάνει.
var store = new Map<string, Record<string, unknown>>();
var writes: Array<{ op: 'set' | 'update'; key: string; data: Record<string, unknown> }> = [];

function makeQuery(collection: string, filters: Array<[string, unknown]>) {
  const query = {
    where: (field: string, _op: string, value: unknown) =>
      makeQuery(collection, [...filters, [field, value]]),
    get: async () => {
      const docs = [...store.entries()]
        .filter(([key]) => key.startsWith(`${collection}/`))
        .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
        .map(([key, data]) => ({ id: key.slice(collection.length + 1), data: () => data }));
      return { empty: docs.length === 0, docs };
    },
  };
  return query;
}

function makeCollection(collection: string) {
  return {
    ...makeQuery(collection, []),
    doc: (id: string) => ({
      get: async () => {
        const data = store.get(`${collection}/${id}`);
        return { exists: data !== undefined, id, data: () => data };
      },
      update: async (data: Record<string, unknown>) => {
        writes.push({ op: 'update', key: `${collection}/${id}`, data });
      },
      _key: `${collection}/${id}`,
    }),
  };
}

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: (collection: string) => makeCollection(collection),
    batch: () => ({
      set: (ref: { _key: string }, data: Record<string, unknown>) => {
        writes.push({ op: 'set', key: ref._key, data });
      },
      update: (ref: { _key: string }, data: Record<string, unknown>) => {
        writes.push({ op: 'update', key: ref._key, data });
      },
      commit: async () => undefined,
    }),
  }),
}));

var authCompanyId = 'co-owner';

jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segmentData?: unknown) =>
      callback(
        request,
        { uid: 'user_1', companyId: authCompanyId, globalRole: 'company_admin' },
        { cache: true },
        segmentData,
      ),
  logAuditEvent: async () => undefined,
}));

// Ο φύλακας εισάγει το audit **απευθείας** (αποφυγή κυκλικής εξάρτησης με το barrel),
// άρα το barrel mock από πάνω δεν τον καλύπτει.
jest.mock('@/lib/auth/audit', () => ({ logAuditEvent: async () => undefined }));

import { COLLECTIONS } from '@/config/firestore-collections';
import type { NextRequest } from 'next/server';
import { POST } from '../employment-records/route';
import { PATCH } from '../employment-records/[id]/apd-status/route';

interface Envelope {
  status: number;
  json: () => Promise<{ success: boolean; error?: string }>;
}

const OWNER = 'co-owner';
const STRANGER = 'co-stranger';
const PROJECT_ID = 'proj-1';
const RECORD_ID = 'emrec-1';

function req(body: unknown): NextRequest {
  return { url: 'https://app.test/api/ika/employment-records', json: async () => body } as unknown as NextRequest;
}

/** Σώμα που **περνά** το zod schema — ώστε η μόνη αιτία άρνησης να είναι η ιδιοκτησία. */
function validBody(projectId = PROJECT_ID) {
  return {
    projectId,
    month: 9,
    year: 2026,
    workerSummaries: [
      {
        contactId: 'contact-1',
        daysWorked: 20,
        stampsCount: 20,
        employerContribution: 100,
        employeeContribution: 50,
        totalContribution: 150,
      },
    ],
  };
}

beforeEach(() => {
  store.clear();
  writes.length = 0;
  authCompanyId = OWNER;
});

// =============================================================================
// POST — ο γονέας κρίνεται ΠΡΙΝ το ερώτημα
// =============================================================================

describe('POST /api/ika/employment-records — ιδιοκτησία του έργου', () => {
  it('🔴 ΞΕΝΟ έργο ⇒ 404 μεταμφιεσμένο, και ΚΑΜΙΑ γραφή', async () => {
    store.set(`${COLLECTIONS.PROJECTS}/${PROJECT_ID}`, { companyId: STRANGER, name: 'Ξένο έργο' });

    const res = (await POST(req(validBody()))) as unknown as Envelope;

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Project not found');
    // 🔑 Η **ουσία**: όχι απλώς «κακός κωδικός», αλλά ότι δεν άγγιξε τίποτα.
    expect(writes).toEqual([]);
  });

  it('🔴 ΑΝΥΠΑΡΚΤΟ έργο ⇒ ίδια απάντηση με το ξένο (κανένα μαντείο ύπαρξης)', async () => {
    const res = (await POST(req(validBody('proj-φάντασμα')))) as unknown as Envelope;

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Project not found');
    expect(writes).toEqual([]);
  });

  it('✅ ΔΙΚΟ ΜΑΣ έργο ⇒ γράφει κανονικά (η άρνηση δεν έγινε φράχτης σε όλους)', async () => {
    store.set(`${COLLECTIONS.PROJECTS}/${PROJECT_ID}`, { companyId: OWNER, name: 'Δικό μας' });

    const res = (await POST(req(validBody()))) as unknown as Envelope;

    expect(res.status).toBe(201);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.op).toBe('set');
    expect(writes[0]?.data.companyId).toBe(OWNER);
  });

  it('🔑 Η ΑΝΑΓΝΩΣΗ ΜΕΝΕΙ ΠΛΗΡΗΣ — παλιό έγγραφο ΧΩΡΙΣ companyId ενημερώνεται, δεν διπλασιάζεται', async () => {
    // Αυτό είναι το test που **απαγορεύει** το «σκέτο where(companyId)»: με φίλτρο
    // εταιρείας το παρακάτω έγγραφο θα ήταν αόρατο ⇒ δεύτερο ένσημο για τον ίδιο
    // εργαζόμενο, τον ίδιο μήνα. Σφάλμα **τιμής**, όχι πρόσβασης.
    store.set(`${COLLECTIONS.PROJECTS}/${PROJECT_ID}`, { companyId: OWNER });
    store.set(`${COLLECTIONS.EMPLOYMENT_RECORDS}/${RECORD_ID}`, {
      projectId: PROJECT_ID, year: 2026, month: 9, contactId: 'contact-1', apdStatus: 'pending',
      apdSubmissionDate: null, apdReferenceNumber: null,
    });

    const res = (await POST(req(validBody()))) as unknown as Envelope;

    expect(res.status).toBe(201);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.op).toBe('update');
    expect(writes[0]?.key).toBe(`${COLLECTIONS.EMPLOYMENT_RECORDS}/${RECORD_ID}`);
  });
});

// =============================================================================
// PATCH — η ιδιοκτησία του ΙΔΙΟΥ του εγγράφου, πριν τη γραφή
// =============================================================================

describe('PATCH /…/[id]/apd-status — ιδιοκτησία του ενσήμου', () => {
  const segment = { params: Promise.resolve({ id: RECORD_ID }) };
  const patchBody = { status: 'submitted' as const };

  it('🔴 ΞΕΝΟ ένσημο ⇒ 404, και ΚΑΜΙΑ ενημέρωση της ΑΠΔ', async () => {
    store.set(`${COLLECTIONS.EMPLOYMENT_RECORDS}/${RECORD_ID}`, { companyId: STRANGER });

    const res = (await PATCH(req(patchBody), segment)) as unknown as Envelope;

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Employment record not found');
    expect(writes).toEqual([]);
  });

  it('🔴 Έγγραφο ΧΩΡΙΣ companyId δεν ανήκει σε κανέναν ⇒ άρνηση', async () => {
    // Η «παγίδα του κενού» του `tenant-ownership`: απουσία tenant ≠ δικό μας.
    store.set(`${COLLECTIONS.EMPLOYMENT_RECORDS}/${RECORD_ID}`, { apdStatus: 'pending' });

    const res = (await PATCH(req(patchBody), segment)) as unknown as Envelope;

    expect(res.status).toBe(404);
    expect(writes).toEqual([]);
  });

  it('✅ ΔΙΚΟ ΜΑΣ ένσημο ⇒ η ΑΠΔ ενημερώνεται', async () => {
    store.set(`${COLLECTIONS.EMPLOYMENT_RECORDS}/${RECORD_ID}`, { companyId: OWNER });

    const res = (await PATCH(req(patchBody), segment)) as unknown as Envelope;

    expect(res.status).toBe(200);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.data.apdStatus).toBe('submitted');
    expect(writes[0]?.data.apdSubmissionDate).toEqual(expect.any(String));
  });
});
