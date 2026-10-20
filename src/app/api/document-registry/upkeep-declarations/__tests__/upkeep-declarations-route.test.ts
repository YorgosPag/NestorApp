/**
 * @fileoverview `GET` · `PUT /api/document-registry/upkeep-declarations` — σύνορο, δικαίωμα, εμβέλεια από το `ctx`, σχήμα
 *   (εξαίρεση ΠΑΝΤΑ με λόγο) και κάθε άρνηση με τον κωδικό του ΕΝΟΣ πίνακα (ADR-915 §35 · §36).
 * @related app/api/document-registry/upkeep-declarations/route.ts
 *
 * ⚠️ Η πράξη ασκείται αληθινά στο `upkeep-declaration.service.test.ts`· εδώ μόνο η μετάφραση σε HTTP. Το σχήμα είναι το
 *    **αληθινό** (`upkeep-declaration-request.ts`) — ο κοινός πίνακας κωδικών με την οθόνη ελέγχεται εδώ.
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

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withStandardRateLimit: <T>(handler: T) => handler }));

/**
 * §37 — το σύνορο είναι το `withPersonalOrOrgAuth`: ο δρων είναι **οργανισμός ή ιδιώτης**. Το test ορίζει ποιος ζητά
 * (`actor`)· το `listingActorOf` μιμείται τη ΜΙΑ μετάφραση δρώντα → θεματοφυλακή (`companyId: null` για τον ιδιώτη).
 */
type TestActor =
  | { scope: 'organization'; ctx: { uid: string; email: string; companyId: string } }
  | { scope: 'personal'; ctx: { uid: string; email: string } };
const ORG: TestActor = { scope: 'organization', ctx: { uid: 'user_1', email: 'agent@example.test', companyId: 'comp_alfa' } };
const PERSONAL: TestActor = { scope: 'personal', ctx: { uid: 'user_owner', email: 'owner@example.test' } };
let actor: TestActor = ORG;

jest.mock('@/lib/auth/personal-scope-middleware', () => ({
  withPersonalOrOrgAuth: jest.fn((callback: (...args: unknown[]) => Promise<unknown>) => async (request: unknown) =>
    callback(request, actor)),
  listingActorOf: (a: TestActor) => ({ uid: a.ctx.uid, companyId: a.scope === 'organization' ? a.ctx.companyId : null }),
}));

const granted = jest.fn(async (..._args: unknown[]) => ({ granted: true, reason: null }));
jest.mock('@/lib/auth/permissions', () => ({ checkPermission: (...args: unknown[]) => granted(...args) }));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));

const declare = jest.fn(async (..._args: unknown[]): Promise<unknown> => ({ ok: true, outcome: 'changed' }));
jest.mock('@/services/document-registry/upkeep-declaration.service', () => ({
  declareRegistryUpkeep: (...args: unknown[]) => declare(...args),
}));

const readUpkeep = jest.fn(async (..._args: unknown[]): Promise<unknown> => ({ kind: 'ready', items: [] }));
jest.mock('@/services/document-registry/upkeep-subject.server', () => ({
  readPropertyUpkeep: (...args: unknown[]) => readUpkeep(...args),
}));

import { UPKEEP_DECLARATION_ERROR_CODES, upkeepDeclarationRefusalOfCode } from '@/lib/document-validity/upkeep-declaration-request';
import { GET, PUT } from '../route';

type Handler = (request: unknown) => Promise<{ status: number; json(): Promise<unknown> }>;
const put = (body: unknown) => (PUT as unknown as Handler)({ json: async () => body });
const get = (query: string) => (GET as unknown as Handler)({ nextUrl: new URL(`http://test/api?${query}`) });

const BODY = { propertyId: 'prop_1', documentKind: 'electrical-installation', decision: 'required', exemptionReason: null };

describe('PUT /api/document-registry/upkeep-declarations', () => {
  beforeEach(() => {
    actor = ORG;
    declare.mockClear();
    granted.mockClear();
  });

  it('οργανισμός: ζητά `properties:properties:update` από τον ΕΝΑ PDP· χωρίς αυτό ⇒ 403 ΠΡΙΝ από κάθε πράξη', async () => {
    granted.mockResolvedValueOnce({ granted: false, reason: 'permission_not_in_role' });
    expect((await put(BODY)).status).toBe(403);
    expect(granted.mock.calls[0].slice(1)).toEqual(['properties:properties:update']);
    expect(declare).not.toHaveBeenCalled();
  });

  it('η εμβέλεια έρχεται από το ΣΥΝΟΡΟ — `companyId`/`userId` στο σώμα αγνοούνται, η πρόταση ΔΕΝ περνά από τον πελάτη', async () => {
    const response = await put({ ...BODY, companyId: 'comp_beta', userId: 'user_x', proposalAtDecision: { verdict: 'proposed' } });
    expect(response.status).toBe(200);
    expect(declare.mock.calls[0][1]).toEqual({ companyId: 'comp_alfa', uid: 'user_1', name: 'agent@example.test' });
    expect(declare.mock.calls[0][2]).toEqual(BODY);
  });

  it('§37 ιδιώτης: ΚΑΝΕΝΑ δικαίωμα εταιρείας (δεν υπάρχει)· τον κρίνει ο κριτής θεματοφυλακής με `companyId: null`', async () => {
    actor = PERSONAL;
    expect((await put(BODY)).status).toBe(200);
    expect(granted).not.toHaveBeenCalled();
    expect(declare.mock.calls[0][1]).toEqual({ companyId: null, uid: 'user_owner', name: 'owner@example.test' });
  });

  it.each([
    [{ ...BODY, decision: 'not-required', exemptionReason: null }],
    [{ ...BODY, decision: 'required', exemptionReason: 'other' }],
    [{ ...BODY, documentKind: 'boiler' }],
    [{ decision: 'required', exemptionReason: null, documentKind: 'electrical-installation' }],
  ])('σώμα με αντίφαση ή ελλιπές (%j) ⇒ 400, καμία πράξη', async (body) => {
    expect((await put(body)).status).toBe(400);
    expect(declare).not.toHaveBeenCalled();
  });

  it.each([
    ['absent', 404, 'NOT_FOUND'],
    ['retired', 409, 'ENTITY_RETIRED'],
    ['not-standing', 422, 'NOT_STANDING_OBLIGATION'],
  ])('άρνηση `%s` ⇒ %i %s — και η οθόνη διαβάζει τον ΙΔΙΟ κωδικό πίσω', async (refusal, status, code) => {
    declare.mockResolvedValueOnce({ ok: false, refusal });
    await expect(put(BODY)).rejects.toMatchObject({ statusCode: status, errorCode: code });
    expect(UPKEEP_DECLARATION_ERROR_CODES[refusal as 'absent' | 'retired' | 'not-standing']).toBe(code);
    expect(upkeepDeclarationRefusalOfCode(code)).toBe(refusal);
  });

  it('άγνωστος κωδικός ⇒ καμία άρνηση (η οθόνη λέει «δεν αποθηκεύτηκε»)', () => {
    expect(upkeepDeclarationRefusalOfCode('SOMETHING_ELSE')).toBeNull();
    expect(upkeepDeclarationRefusalOfCode(null)).toBeNull();
  });
});

describe('GET /api/document-registry/upkeep-declarations (§36 · §37 — η ενότητα ενός ακινήτου)', () => {
  beforeEach(() => {
    actor = ORG;
    readUpkeep.mockClear();
    granted.mockClear();
  });

  it('εμβέλεια από το ΣΥΝΟΡΟ — `companyId` στο ερώτημα αγνοείται· items του διακομιστή + `canDecide` από τον ΙΔΙΟ PDP', async () => {
    const items = [{ propertyId: 'prop_1', documentKind: 'electrical-installation' }];
    readUpkeep.mockResolvedValueOnce({ kind: 'ready', items });
    const response = await get('propertyId=prop_1&companyId=comp_beta');
    expect(response.status).toBe(200);
    expect(readUpkeep.mock.calls[0].slice(1)).toEqual([{ uid: 'user_1', companyId: 'comp_alfa' }, 'prop_1']);
    expect(await response.json()).toMatchObject({ data: { items, canDecide: true } });
  });

  it('οργανισμός ΧΩΡΙΣ δικαίωμα ⇒ ΒΛΕΠΕΙ την πρόταση (200) με `canDecide: false` — ο ίδιος κανόνας με το PUT', async () => {
    granted.mockResolvedValueOnce({ granted: false, reason: 'permission_not_in_role' });
    const response = await get('propertyId=prop_1');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { canDecide: false } });
  });

  it('§37 ιδιώτης ⇒ `companyId: null` στον κριτή, `canDecide: true` (ο κριτής έχει ήδη πει «διαχειρίζεται»)', async () => {
    actor = PERSONAL;
    const response = await get('propertyId=ownp_me');
    expect(readUpkeep.mock.calls[0].slice(1)).toEqual([{ uid: 'user_owner', companyId: null }, 'ownp_me']);
    expect(await response.json()).toMatchObject({ data: { canDecide: true } });
    expect(granted).not.toHaveBeenCalled();
  });

  it('χωρίς `propertyId` (ή κενό) ⇒ 400, καμία ανάγνωση', async () => {
    expect((await get('')).status).toBe(400);
    expect((await get('propertyId=%20')).status).toBe(400);
    expect(readUpkeep).not.toHaveBeenCalled();
  });

  it.each([
    ['absent', 404, 'NOT_FOUND'],
    ['retired', 409, 'ENTITY_RETIRED'],
  ])('ακίνητο `%s` ⇒ %i %s — ο ΙΔΙΟΣ πίνακας με το PUT', async (kind, status, code) => {
    readUpkeep.mockResolvedValueOnce({ kind });
    await expect(get('propertyId=prop_1')).rejects.toMatchObject({ statusCode: status, errorCode: code });
  });
});
