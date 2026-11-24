/**
 * @jest-environment node
 *
 * ADR-951 — **το route της επαφής του χώρου**: ποιος μπορεί · τι δέχεται · πώς μεταφράζει κάθε έκβαση του γραφέα.
 *
 * Τι κρίνεται: ανάγνωση από κάθε μέλος, εγγραφές ΜΟΝΟ από `ADMINISTRATIVE_ROLES` (403 αλλιώς) · `canEdit` από το ΙΔΙΟ
 * ταβάνι · σώμα `.strict()` (400) · αρνήσεις κατάστασης 409 / εισόδου 422 με κατονομασμένο `refusal` · βλάβη ανάγνωσης
 * 503 · απών χώρος 404 · κάθε επιτυχής πράξη απαντά με την ΙΔΙΑ όψη με το `GET`.
 * ⚠️ Το 401 (ανώνυμος) το κρίνει ο ίδιος ο `withAuth`, με δική του σουίτα — εδώ ο φρουρός σέβεται τον ΔΗΛΩΜΕΝΟ ρόλο.
 */

jest.mock('next/server', () =>
  jest.requireActual<typeof import('@/test-utils/next-response-json-mock')>('@/test-utils/next-response-json-mock')
    .nextServerJsonMock(),
);

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(h: T) => h,
  withSensitiveRateLimit: <T>(h: T) => h,
  withHeavyRateLimit: <T>(h: T) => h,
}));

var authCtx = { uid: 'u_admin', companyId: 'comp_a', email: 'admin@example.com', globalRole: 'admin', isAuthenticated: true as const };

/** Ο φρουρός τιμά τον ΔΗΛΩΜΕΝΟ ρόλο της διαδρομής — ό,τι δεν δηλώνεται, δεν φυλάσσεται. */
jest.mock('@/lib/auth', () => ({
  ADMINISTRATIVE_ROLES: jest.requireActual('@/lib/auth/roles').ADMINISTRATIVE_ROLES,
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>, options?: { requiredGlobalRoles?: readonly string[] }) =>
    async (request: unknown) => {
      if (options?.requiredGlobalRoles && !options.requiredGlobalRoles.includes(authCtx.globalRole)) {
        return { status: 403, json: async () => ({ success: false, error: 'Forbidden' }) };
      }
      return callback(request, authCtx, { cache: true });
    },
}));

var readState = jest.fn();
jest.mock('@/server/company/self-contact-read.server', () => ({ readSelfContactState: (...a: unknown[]) => readState(...a) }));

var store = { link: jest.fn(), create: jest.fn(), unlink: jest.fn() };
jest.mock('@/server/company/self-contact-store.server', () => ({
  linkSelfContact: (...a: unknown[]) => store.link(...a),
  createSelfContactFromWorkspace: (...a: unknown[]) => store.create(...a),
  unlinkSelfContact: (...a: unknown[]) => store.unlink(...a),
}));

import type { NextRequest } from 'next/server';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import { DELETE, GET, POST, PUT } from '../route';

interface Envelope {
  readonly status: number;
  readonly json: () => Promise<Record<string, unknown>>;
}

const req = (body?: unknown): NextRequest =>
  ({ json: async () => (body === undefined ? Promise.reject(new Error('no body')) : body) }) as unknown as NextRequest;

const call = async (handler: unknown, body?: unknown): Promise<Envelope> =>
  (handler as (r: NextRequest) => Promise<Envelope>)(req(body));

const VIEW = { linked: { contactId: 'cont_a', displayName: 'Α ΑΕ', hasOwnImage: false }, suggestion: null };
const LINKED = { kind: 'linked', selfContact: { contactId: 'cont_a', linkedAt: 't', linkedBy: 'u_admin' } };

beforeEach(() => {
  jest.clearAllMocks();
  authCtx.globalRole = ADMINISTRATIVE_ROLES[0];
  readState.mockResolvedValue({ kind: 'present', view: VIEW });
});

describe('Ρ — ποιος μπορεί', () => {
  it('Ρ1 GET: μέλος χωρίς διοικητικό ρόλο διαβάζει, με canEdit:false', async () => {
    authCtx.globalRole = 'internal_user';
    const res = await call(GET);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...VIEW, canEdit: false });
  });

  it('Ρ2 GET: διαχειριστής ⇒ canEdit:true (το ΙΔΙΟ ταβάνι με τις εγγραφές)', async () => {
    expect(await (await call(GET)).json()).toEqual({ ...VIEW, canEdit: true });
  });

  it.each([
    ['PUT', PUT, { contactId: 'cont_a', logoChoice: 'keep-workspace-logo' }],
    ['POST', POST, {}],
    ['DELETE', DELETE, undefined],
  ])('Ρ3 %s: μη διαχειριστής ⇒ 403 και ο γραφέας ΔΕΝ καλείται', async (_m, handler, body) => {
    authCtx.globalRole = 'internal_user';
    expect((await call(handler, body)).status).toBe(403);
    expect(store.link).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
    expect(store.unlink).not.toHaveBeenCalled();
  });
});

describe('Σ — τι δέχεται το PUT', () => {
  it.each([
    ['χωρίς σώμα', undefined],
    ['κενό contactId', { contactId: '  ', logoChoice: 'keep-workspace-logo' }],
    ['άγνωστη επιλογή εικόνας', { contactId: 'cont_a', logoChoice: 'delete-everything' }],
    ['ξένο πεδίο (.strict)', { contactId: 'cont_a', logoChoice: 'keep-workspace-logo', companyId: 'comp_b' }],
  ])('Σ1 %s ⇒ 400 INVALID_BODY, ο γραφέας δεν καλείται', async (_label, body) => {
    const res = await call(PUT, body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'INVALID_BODY' });
    expect(store.link).not.toHaveBeenCalled();
  });

  it('Σ2 έγκυρο σώμα ⇒ ο γραφέας με τον χώρο του ΑΙΤΟΥΝΤΑ (ποτέ από το σώμα) και φορέα τον άνθρωπο', async () => {
    store.link.mockResolvedValue(LINKED);
    const res = await call(PUT, { contactId: ' cont_a ', logoChoice: 'use-contact-image' });
    expect(res.status).toBe(200);
    expect(store.link).toHaveBeenCalledWith('comp_a', 'cont_a', 'use-contact-image', expect.objectContaining({ kind: 'user', uid: 'u_admin' }));
  });
});

describe('Ε — μετάφραση εκβάσεων', () => {
  it.each([
    ['already-linked', 409],
    ['contact-inactive', 409],
    ['contact-not-found', 422],
    ['not-a-company', 422],
    ['contact-image-unavailable', 422],
    ['contact-image-refused', 422],
    ['profile-nameless', 422],
  ])('Ε1 άρνηση %s ⇒ %i με κατονομασμένο refusal', async (refusal, status) => {
    store.link.mockResolvedValue({ kind: 'refused', refusal });
    const res = await call(PUT, { contactId: 'cont_a', logoChoice: 'keep-workspace-logo' });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: 'REFUSED', refusal });
  });

  it('Ε2 ο χώρος δεν υπάρχει ⇒ 404', async () => {
    store.unlink.mockResolvedValue({ kind: 'absent' });
    expect((await call(DELETE)).status).toBe(404);
  });

  it('Ε3 βλάβη ανάγνωσης προφίλ στη δημιουργία ⇒ 503 UNAVAILABLE (όχι άρνηση)', async () => {
    store.create.mockResolvedValue({ kind: 'unavailable' });
    const res = await call(POST, {});
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'UNAVAILABLE' });
  });

  it('Ε4 βλάβη ανάγνωσης στο GET ⇒ 503 · απών χώρος ⇒ 404', async () => {
    readState.mockResolvedValueOnce({ kind: 'unavailable' });
    expect((await call(GET)).status).toBe(503);
    readState.mockResolvedValueOnce({ kind: 'absent' });
    expect((await call(GET)).status).toBe(404);
  });

  it.each([
    ['PUT', PUT, { contactId: 'cont_a', logoChoice: 'keep-workspace-logo' }, 'link', LINKED],
    ['POST', POST, {}, 'create', LINKED],
    ['DELETE', DELETE, undefined, 'unlink', { kind: 'unlinked' }],
  ] as const)('Ε5 %s επιτυχία ⇒ η ΙΔΙΑ όψη με το GET, ξαναδιαβασμένη από τον server', async (_m, handler, body, op, outcome) => {
    store[op].mockResolvedValue(outcome);
    const res = await call(handler, body);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...VIEW, canEdit: true });
    expect(readState).toHaveBeenCalledWith('comp_a');
  });
});
