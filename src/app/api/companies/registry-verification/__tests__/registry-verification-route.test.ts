/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΟΡΤΑ ΤΗΣ ΕΠΑΛΗΘΕΥΣΗΣ ΓΕΜΗ** — ADR-841 §7 Α23 (Φ2 · κενό της §2 του handoff).
 * @related app/api/companies/registry-verification/route.ts
 *
 * 🔑 Η **κρίση** δοκιμάζεται στο `company-registry-verification.test.ts`. Εδώ δοκιμάζεται μόνο ό,τι
 * ανήκει στη **διαδρομή**: ποιος μπαίνει, από πού έρχεται ο οργανισμός, και ποιο σώμα φεύγει.
 *
 * ⚠️ **Ο mock του `withAuth` ΤΙΜΑ το `requiredGlobalRoles`** (ADR-801 §2.10): ένας mock που αγνοεί
 * τη δήλωση θα έδειχνε «καμία προστασία» σε φρουρημένη διαδρομή — ή, χειρότερα, πράσινο σε αφρούρητη.
 */

// ⚠️ Το `after` καταγράφει μέσα στο mock module (ίδιος λόγος με τις βαθμίδες παρακάτω).
jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  const afterTasks: Array<() => unknown> = [];
  return {
    NextResponse: MockNextResponse,
    NextRequest: class {},
    after: (task: () => unknown) => afterTasks.push(task),
    __afterTasks: afterTasks,
  };
});

const reconcileMock = jest.fn();
jest.mock('@/services/company/company-rename.service', () => ({
  reconcileShowcaseLegalIdentity: (...args: unknown[]) => reconcileMock(...args),
}));

function afterTasks(): Array<() => unknown> {
  return jest.requireMock<{ __afterTasks: Array<() => unknown> }>('next/server').__afterTasks;
}

// ⚠️ Οι βαθμίδες καταγράφονται ΜΕΣΑ στο mock module: η διαδρομή φορτώνεται πριν αρχικοποιηθεί
//    οποιαδήποτε μεταβλητή του αρχείου (τα imports ανεβαίνουν), άρα ένας εξωτερικός πίνακας είναι `undefined`.
jest.mock('@/lib/middleware/with-rate-limit', () => {
  const tiers: string[] = [];
  const tier = (name: string) => <T>(h: T) => {
    tiers.push(name);
    return h;
  };
  return { withStandardRateLimit: tier('standard'), withSensitiveRateLimit: tier('sensitive'), __tiers: tiers };
});

var authCtx: { uid: string; companyId: string | undefined; globalRole: string } = {
  uid: 'user_1',
  companyId: 'comp_alfa',
  globalRole: 'company_admin',
};

jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>, options?: { requiredGlobalRoles?: readonly string[] }) =>
    async (request: unknown) => {
      const required = options?.requiredGlobalRoles;
      if (required && !required.includes(authCtx.globalRole)) {
        return { status: 403, json: async () => ({ error: 'ROLE_REQUIRED' }) };
      }
      return callback(request, authCtx, {});
    },
}));

jest.mock('@/lib/auth/roles', () => ({ ADMINISTRATIVE_ROLES: ['super_admin', 'company_admin'] }));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));

const readReport = jest.fn();
const verifyReport = jest.fn();
jest.mock('@/services/company-registry/company-registry-verification.service', () => ({
  readRegistryIdentityReport: (...args: unknown[]) => readReport(...args),
  verifyRegistryIdentity: (...args: unknown[]) => verifyReport(...args),
}));

import { GET, POST } from '../route';

type Handler = (request: unknown) => Promise<{ status: number; json: () => Promise<Record<string, unknown>> }>;

const REPORT = {
  declaration: { entityType: 'ae', businessName: 'ΠΑΓΩΝΗΣ Α.Ε.', gemiNumber: '123456789000' },
  judgment: { state: 'declared', gap: 'not-checked', check: null },
  freshness: { kind: 'not-asked' },
};

async function call(handler: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await (handler as Handler)({});
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  jest.clearAllMocks();
  afterTasks().splice(0);
  authCtx.companyId = 'comp_alfa';
  authCtx.globalRole = 'company_admin';
  readReport.mockResolvedValue({ kind: 'report', report: REPORT });
  verifyReport.mockResolvedValue({ kind: 'report', report: REPORT });
});

describe('Ε — η πόρτα της νομικής ταυτότητας', () => {
  it.each([
    ['GET', GET],
    ['POST', POST],
  ])('🔑 Ε0 — %s: ο διαχειριστής παίρνει `{ success, data }` με την αναφορά', async (_verb, handler) => {
    const answer = await call(handler);

    expect(answer.status).toBe(200);
    expect(answer.body).toEqual({ success: true, data: REPORT });
  });

  it('🔴 Ε1 — ΤΟ GET ΔΕΝ ΡΩΤΑ ΤΟ ΜΗΤΡΩΟ· το POST ρωτά — για τον οργανισμό ΤΗΣ ΑΠΟΔΕΙΞΗΣ', async () => {
    await call(GET);
    expect(readReport).toHaveBeenCalledWith(expect.anything(), 'comp_alfa');
    expect(verifyReport).not.toHaveBeenCalled();

    await call(POST);
    expect(verifyReport).toHaveBeenCalledWith(expect.anything(), 'comp_alfa');
  });

  it.each(['user', 'company_user'])('🔴 Ε2 — ρόλος «%s» ⇒ 403, και ΚΑΜΙΑ ανάγνωση έδρας', async (role) => {
    // Η αναφορά κουβαλά την έδρα του μητρώου — σε ατομική, συχνά την ΚΑΤΟΙΚΙΑ.
    authCtx.globalRole = role;

    const [read, verify] = [await call(GET), await call(POST)];

    expect([read.status, verify.status]).toEqual([403, 403]);
    expect(readReport).not.toHaveBeenCalled();
    expect(verifyReport).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '   '])('🔴 Ε3 — οργανισμός «%s» ⇒ 403 NO_ORGANIZATION (fail-closed)', async (companyId) => {
    authCtx.companyId = companyId;

    const answer = await call(POST);

    expect(answer.status).toBe(403);
    expect(answer.body.error).toBe('NO_ORGANIZATION');
    expect(verifyReport).not.toHaveBeenCalled();
  });

  it('🔴 Ε4 — ΑΓΝΩΣΤΟ ≠ ΚΕΝΟ: το προφίλ δεν διαβάστηκε ⇒ 503, ποτέ «χωρίς αριθμό»', async () => {
    readReport.mockResolvedValue({ kind: 'profile-unavailable' });

    const answer = await call(GET);

    expect(answer.status).toBe(503);
    expect(answer.body).toEqual({ error: 'PROFILE_UNAVAILABLE' });
  });

  it('🔴 Ε6 — Α23: νέα απάντηση ΜΗΤΡΩΟΥ ⇒ ανανέωση της νομικής ταυτότητας της βιτρίνας, ΜΕΤΑ την απάντηση', async () => {
    verifyReport.mockResolvedValue({ kind: 'report', report: { ...REPORT, freshness: { kind: 'asked' } } });

    const answer = await call(POST);

    expect(answer.status).toBe(200);
    expect(reconcileMock).not.toHaveBeenCalled();
    for (const task of afterTasks().splice(0)) await task();
    expect(reconcileMock).toHaveBeenCalledWith(expect.anything(), 'comp_alfa');
  });

  it.each([
    ['δεν ρωτήθηκε (χωρίς αριθμό)', { kind: 'not-asked' }],
    ['το μητρώο δεν απάντησε', { kind: 'unavailable', reason: 'network' }],
  ])('🔑 Ε7 — %s ⇒ ΚΑΜΙΑ ανανέωση: τίποτα νέο δεν μάθαμε', async (_label, freshness) => {
    verifyReport.mockResolvedValue({ kind: 'report', report: { ...REPORT, freshness } });

    await call(POST);
    await call(GET);

    expect(afterTasks()).toHaveLength(0);
  });

  it('🔑 Ε5 — βαθμίδα ρυθμού: standard η ανάγνωση, sensitive η πράξη (CHECK 3.78)', () => {
    // Κάθε POST καταναλώνει όριο του κλειδιού ΓΕΜΗ.
    const { __tiers } = jest.requireMock<{ __tiers: string[] }>('@/lib/middleware/with-rate-limit');
    expect(__tiers).toEqual(['standard', 'sensitive']);
  });
});
