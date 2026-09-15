/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΟΡΤΑ ΤΗΣ «ΥΙΟΘΕΤΗΣΗΣ ΕΠΩΝΥΜΙΑΣ ΓΕΜΗ»** — ADR-841 §7 Α23, Φ3.2 Γ.
 * @related app/api/companies/registry-verification/legal-name/route.ts
 *
 * 🔑 Η **κρίση** και ο **δίσκος** δοκιμάζονται στο `legal-name-adoption.test.ts`. Εδώ μόνο ό,τι ανήκει
 * στη διαδρομή: ποιος μπαίνει, από πού έρχεται ο οργανισμός, ποιο σώμα γίνεται δεκτό, ποιος κωδικός φεύγει,
 * και πότε τρέχει η συνέπεια.
 *
 * ⚠️ Ο mock του `NextResponse.json` επιστρέφει **στιγμιότυπο** της κλάσης (παγίδα handoff Φ3.2): μια απλή
 * αντικείμενο θα έκρυβε κάθε διάκριση `instanceof`.
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    constructor(
      private readonly body: unknown,
      public readonly status: number,
    ) {}
    static json(body: unknown, init?: { status?: number }) {
      return new MockNextResponse(body, init?.status ?? 200);
    }
    async json() {
      return this.body;
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

const propagateMock = jest.fn();
jest.mock('@/services/company/company-rename.service', () => ({
  propagateCompanyRename: (...args: unknown[]) => propagateMock(...args),
}));

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

const adoptMock = jest.fn();
jest.mock('@/services/company-registry/legal-name-adoption.service', () => ({
  adoptRegistryLegalName: (...args: unknown[]) => adoptMock(...args),
}));

import { POST } from '../route';

type Handler = (request: unknown) => Promise<{ status: number; json: () => Promise<Record<string, unknown>> }>;

const REGISTRY_NAME = 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ';
const REPORT = {
  declaration: { entityType: 'ae', businessName: REGISTRY_NAME, gemiNumber: '123456789000' },
  judgment: { state: 'verified', issuer: 'gemi', check: null },
  freshness: { kind: 'not-asked' },
};

function afterTasks(): Array<() => unknown> {
  return jest.requireMock<{ __afterTasks: Array<() => unknown> }>('next/server').__afterTasks;
}

async function call(body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const request = { json: async () => body };
  const response = await (POST as unknown as Handler)(request);
  return { status: response.status, body: await response.json() };
}

async function runAfterTasks(): Promise<void> {
  for (const task of afterTasks().splice(0)) await task();
}

beforeEach(() => {
  jest.clearAllMocks();
  afterTasks().splice(0);
  authCtx.companyId = 'comp_alfa';
  authCtx.globalRole = 'company_admin';
  adoptMock.mockResolvedValue({ kind: 'adopted', report: REPORT });
});

describe('Ρ — η πόρτα της υιοθέτησης επωνυμίας', () => {
  it('🔑 Ρ0 — υιοθετήθηκε ⇒ 200 `{ success, data }` · οργανισμός + δράστης από την ΑΠΟΔΕΙΞΗ · διάδοση ΜΕΤΑ την απάντηση', async () => {
    const answer = await call({ expectedLegalName: REGISTRY_NAME });

    expect(answer).toEqual({ status: 200, body: { success: true, data: REPORT } });
    expect(adoptMock).toHaveBeenCalledWith(expect.anything(), {
      companyId: 'comp_alfa',
      actorUid: 'user_1',
      expectedLegalName: REGISTRY_NAME,
    });
    expect(propagateMock).not.toHaveBeenCalled();
    await runAfterTasks();
    expect(propagateMock).toHaveBeenCalledWith(expect.anything(), 'comp_alfa', 'user_1');
  });

  it('🔑 Ρ1 — ήδη υιοθετημένη ⇒ 200 ΚΑΙ διάδοση (ζώνη ασφαλείας: επισκευάζει αποτυχημένη πρώτη συνέπεια)', async () => {
    adoptMock.mockResolvedValue({ kind: 'already-adopted', report: REPORT });

    const answer = await call({ expectedLegalName: REGISTRY_NAME });

    expect(answer.status).toBe(200);
    await runAfterTasks();
    expect(propagateMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['not-adoptable', 422, 'NAME_NOT_ADOPTABLE'],
    ['registry-changed', 409, 'REGISTRY_CHANGED'],
  ])('🔴 Ρ2 — `%s` ⇒ %i + ονομασμένο σφάλμα + ΝΕΑ αναφορά, ΚΑΜΙΑ διάδοση', async (kind, status, error) => {
    adoptMock.mockResolvedValue({ kind, report: REPORT });

    const answer = await call({ expectedLegalName: REGISTRY_NAME });

    expect(answer).toEqual({ status, body: { error, data: REPORT } });
    expect(afterTasks()).toHaveLength(0);
  });

  it.each(['user', 'company_user'])('🔴 Ρ3 — ρόλος «%s» ⇒ 403, καμία πράξη', async (role) => {
    authCtx.globalRole = role;

    expect((await call({ expectedLegalName: REGISTRY_NAME })).status).toBe(403);
    expect(adoptMock).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '   '])('🔴 Ρ4 — οργανισμός «%s» ⇒ 403 NO_ORGANIZATION (fail-closed)', async (companyId) => {
    authCtx.companyId = companyId;

    const answer = await call({ expectedLegalName: REGISTRY_NAME });

    expect(answer).toEqual({ status: 403, body: { error: 'NO_ORGANIZATION' } });
    expect(adoptMock).not.toHaveBeenCalled();
  });

  it.each([
    ['χωρίς πεδίο', {}],
    ['κενό', { expectedLegalName: '' }],
    ['όχι κείμενο', { expectedLegalName: 42 }],
    ['σκουπίδι', null],
  ])('🔴 Ρ5 — σώμα %s ⇒ 400 MALFORMED_BODY, καμία πράξη', async (_label, body) => {
    const answer = await call(body);

    expect(answer.status).toBe(400);
    expect(answer.body.error).toBe('MALFORMED_BODY');
    expect(adoptMock).not.toHaveBeenCalled();
  });

  it('🔴 Ρ6 — `companyId` στο σώμα ΑΓΝΟΕΙΤΑΙ: η πράξη γίνεται για τον οργανισμό της απόδειξης', async () => {
    await call({ expectedLegalName: REGISTRY_NAME, companyId: 'comp_evil' });

    expect(adoptMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ companyId: 'comp_alfa' }));
  });

  it('🔑 Ρ7 — βαθμίδα ρυθμού `sensitive`, ρητά (CHECK 3.78)', () => {
    const { __tiers } = jest.requireMock<{ __tiers: string[] }>('@/lib/middleware/with-rate-limit');
    expect(__tiers).toEqual(['sensitive']);
  });
});
