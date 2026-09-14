/**
 * @jest-environment node
 *
 * @fileoverview **Η ΔΗΛΩΣΗ ΜΕΣΙΤΕΙΑΣ ΔΙΑΒΑΖΕΙ ΤΟΝ ΑΡΙΘΜΟ ΓΕΜΗ ΑΠΟ ΤΟ ΠΡΟΦΙΛ** — ADR-841 §7 Α23 · ADR-824 §5.3.
 * @related app/api/companies/capabilities/brokerage/route.ts
 *
 * 🔴 **Η ΑΓΚΥΡΑ ΤΗΣ Δ1**: ως τις 2026-09-14 ο αριθμός γραφόταν ελεύθερα εδώ, και το ζωντανό γραφείο
 * είχε `123456789000` στη δήλωση και **κενό** στο προφίλ. Αν κάποιος ξαναβάλει `gemiNumber` στο
 * σχήμα, το Β2 κοκκινίζει: ο αριθμός του σώματος θα έφτανε στον γραφέα.
 */

/**
 * ⚠️ **Το `json` επιστρέφει INSTANCE, όχι απλό αντικείμενο — και είναι η πιστότητα του mock.** Η
 * διαδρομή ξεχωρίζει άρνηση από αριθμό με `instanceof NextResponse`: με σκέτο `{ status, json }`
 * κάθε 422/503 περνούσε ως «αριθμός» και η δήλωση γραφόταν — μετρημένο στην πρώτη γραφή αυτής της
 * σουίτας (Β2/Β3/Β4 έδιναν 200). Πράσινο με τέτοιο mock θα σήμαινε «δεν κοίταξα».
 */
jest.mock('next/server', () => {
  class MockNextResponse {
    readonly status: number;
    private readonly body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    async json(): Promise<unknown> {
      return this.body;
    }
    static json(body: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withSensitiveRateLimit: <T>(h: T) => h }));

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

const readDeclaration = jest.fn();
jest.mock('@/services/company/company-legal-identity', () => ({
  readCompanyRegistryDeclaration: (...args: unknown[]) => readDeclaration(...args),
}));

const declareMock = jest.fn();
jest.mock('@/services/company/organization-capability.service', () => ({
  declareBrokerage: (...args: unknown[]) => declareMock(...args),
}));

import { POST } from '../route';

const BODY = { chamberRegistryNumber: 'ΕΒΕΘ-42', legalRepresentativeName: 'Γ. Παγώνης' };

function profileWith(gemiNumber: string | null): void {
  readDeclaration.mockResolvedValue({
    kind: 'present',
    declaration: { entityType: 'ae', businessName: 'ΠΑΓΩΝΗΣ Α.Ε.', gemiNumber },
  });
}

async function post(body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const handler = POST as unknown as (r: unknown) => Promise<{ status: number; json: () => Promise<Record<string, unknown>> }>;
  const response = await handler({ json: async () => body });
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  jest.clearAllMocks();
  authCtx.companyId = 'comp_alfa';
  authCtx.globalRole = 'company_admin';
  profileWith('001234567000');
  declareMock.mockResolvedValue({ kind: 'applied', status: 'pending' });
});

describe('Β — ο αριθμός ΓΕΜΗ ζει ΜΙΑ φορά, στο προφίλ', () => {
  it('🔑 Β0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η δήλωση φτάνει στον γραφέα ⇒ pending', async () => {
    const answer = await post(BODY);

    expect(answer.status).toBe(200);
    expect(answer.body).toEqual({ status: 'pending' });
    expect(declareMock).toHaveBeenCalledWith(
      expect.anything(),
      'comp_alfa',
      expect.objectContaining({ ...BODY, gemiNumber: '001234567000', declaredByUserId: 'user_1' }),
    );
  });

  it('🔴 Β1 — ΑΡΙΘΜΟΣ ΣΤΟ ΣΩΜΑ ΑΓΝΟΕΙΤΑΙ: γράφεται ο αριθμός ΤΟΥ ΠΡΟΦΙΛ', async () => {
    await post({ ...BODY, gemiNumber: '999999999999' });

    expect(declareMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ gemiNumber: '001234567000' }),
    );
  });

  it.each([
    ['χωρίς αριθμό', null],
    ['άκυρος αριθμός', 'ΑΒΓ-12'],
  ])('🔴 Β2 — προφίλ %s ⇒ 422 PROFILE_REGISTRATION_MISSING, και ΚΑΜΙΑ δήλωση', async (_label, gemiNumber) => {
    profileWith(gemiNumber);

    const answer = await post({ ...BODY, gemiNumber: '123456789000' });

    expect(answer.status).toBe(422);
    expect(answer.body.error).toBe('PROFILE_REGISTRATION_MISSING');
    expect(declareMock).not.toHaveBeenCalled();
  });

  it('🔴 Β3 — ΚΑΝΕΝΑ ΠΡΟΦΙΛ ⇒ 422, ΙΔΙΟ με «χωρίς αριθμό»', async () => {
    readDeclaration.mockResolvedValue({ kind: 'absent' });

    const answer = await post(BODY);

    expect(answer.status).toBe(422);
    expect(answer.body.error).toBe('PROFILE_REGISTRATION_MISSING');
  });

  it('🔴 Β4 — ΑΓΝΩΣΤΟ ≠ ΚΕΝΟ: το προφίλ δεν διαβάστηκε ⇒ 503, ποτέ «γράψε αριθμό»', async () => {
    readDeclaration.mockResolvedValue({ kind: 'unavailable' });

    const answer = await post(BODY);

    expect(answer.status).toBe(503);
    expect(answer.body.error).toBe('PROFILE_UNAVAILABLE');
    expect(declareMock).not.toHaveBeenCalled();
  });

  it('🔴 Β5 — ο ΟΡΓΑΝΙΣΜΟΣ έρχεται από την απόδειξη: `companyId` στο σώμα αγνοείται', async () => {
    await post({ ...BODY, companyId: 'comp_beta' });

    expect(readDeclaration).toHaveBeenCalledWith('comp_alfa');
    expect(declareMock).toHaveBeenCalledWith(expect.anything(), 'comp_alfa', expect.anything());
  });

  it('🔴 Β6 — μη διαχειριστής ⇒ 403, και ΚΑΜΙΑ ανάγνωση προφίλ', async () => {
    authCtx.globalRole = 'company_user';

    const answer = await post(BODY);

    expect(answer.status).toBe(403);
    expect(readDeclaration).not.toHaveBeenCalled();
  });

  it('🔑 Β7 — χωρίς οργανισμό ⇒ 403 NO_ORGANIZATION', async () => {
    authCtx.companyId = '  ';

    const answer = await post(BODY);

    expect(answer.status).toBe(403);
    expect(answer.body.error).toBe('NO_ORGANIZATION');
  });

  it('Β8 — ελλιπές σώμα ⇒ 400 MALFORMED_BODY που ΟΝΟΜΑΖΕΙ το πεδίο', async () => {
    const answer = await post({ chamberRegistryNumber: 'ΕΒΕΘ-42' });

    expect(answer.status).toBe(400);
    expect(answer.body.malformed).toEqual(['legalRepresentativeName']);
  });

  it.each([
    [{ kind: 'illegal-transition', from: 'active' }, 409],
    [{ kind: 'absent' }, 404],
    [{ kind: 'failed' }, 500],
  ])('Β9 — έκβαση γραφέα %j ⇒ %i', async (result, status) => {
    declareMock.mockResolvedValue(result);

    const answer = await post(BODY);

    expect(answer.status).toBe(status);
  });
});
