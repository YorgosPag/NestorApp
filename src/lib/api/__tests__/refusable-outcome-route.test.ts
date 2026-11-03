/**
 * @jest-environment node
 */

/**
 * Το συμβόλαιο των τεσσάρων routes προμηθευτή (ADR-923 §5.13 · §16), εκτελεσμένο πάνω στα αληθινά routes.
 * Η εξαγωγή του κοινού κώδικα δεν άλλαξε καμία απάντηση: κωδικοί, σώματα και `no-store` όπως πριν.
 */

import type { NextRequest } from 'next/server';

import { GET as listBrands, POST as decideBrand } from '@/app/api/admin/supplier-brand-claims/route';
import { GET as listReviews, POST as decideReview } from '@/app/api/admin/supplier-verifications/route';
import { GET as ownBrands, POST as requestBrand } from '@/app/api/catalog/supplier-brand-claims/route';
import { POST as requestReview } from '@/app/api/catalog/supplier-verification/route';

const mockCtx = { uid: 'user-1', companyId: 'comp-a' as string | null };
const server = {
  requestSupplierReview: jest.fn(),
  decideSupplierVerification: jest.fn(),
  revokeSupplierVerification: jest.fn(),
  listSupplierReviews: jest.fn(),
  requestSupplierBrand: jest.fn(),
  readOwnBrandClaims: jest.fn(),
  decideSupplierBrand: jest.fn(),
  revokeSupplierBrand: jest.fn(),
  listSupplierBrandClaims: jest.fn(),
};
const mockRefresh = jest.fn();
const mockAfter = jest.fn();

jest.mock('next/server', () => ({ ...jest.requireActual('next/server'), after: (task: () => void) => mockAfter(task) }));
jest.mock('@/lib/auth', () => ({
  withAuth: (handler: (request: unknown, ctx: unknown, cache: unknown) => unknown) => (request: unknown) => handler(request, mockCtx, {}),
}));
jest.mock('@/lib/auth/roles', () => ({ ADMINISTRATIVE_ROLES: [] }));
jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withSensitiveRateLimit: <T,>(handler: T) => handler,
  withStandardRateLimit: <T,>(handler: T) => handler,
}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }) }));
jest.mock('@/server/catalog/supplier-review.server', () => ({
  requestSupplierReview: (...args: unknown[]) => server.requestSupplierReview(...args),
  decideSupplierVerification: (...args: unknown[]) => server.decideSupplierVerification(...args),
  revokeSupplierVerification: (...args: unknown[]) => server.revokeSupplierVerification(...args),
  listSupplierReviews: (...args: unknown[]) => server.listSupplierReviews(...args),
  readOwnSupplierReview: jest.fn(),
}));
jest.mock('@/server/catalog/supplier-brand-claim.server', () => ({
  requestSupplierBrand: (...args: unknown[]) => server.requestSupplierBrand(...args),
  readOwnBrandClaims: (...args: unknown[]) => server.readOwnBrandClaims(...args),
  decideSupplierBrand: (...args: unknown[]) => server.decideSupplierBrand(...args),
  revokeSupplierBrand: (...args: unknown[]) => server.revokeSupplierBrand(...args),
  listSupplierBrandClaims: (...args: unknown[]) => server.listSupplierBrandClaims(...args),
}));
jest.mock('@/server/catalog/supplier-showcase.server', () => ({ refreshSupplierShowcaseStanding: (...args: unknown[]) => mockRefresh(...args) }));

type Route = (request: NextRequest, context?: unknown) => Promise<Response>;

const request = (body: unknown = null, status = '') =>
  ({ json: async () => body, nextUrl: { searchParams: new URLSearchParams(status) } }) as unknown as NextRequest;
const call = async (route: unknown, req: NextRequest) => {
  const response = await (route as Route)(req);
  return { status: response.status, body: await response.json(), cache: response.headers.get('Cache-Control') };
};

const REVIEW = { evidenceFileId: 'f' };
const BRAND = { brandName: 'Toshiba', relation: 'manufacturer', evidenceFileId: 'f' };
const REVIEW_DECISION = { companyId: 'comp-b', decision: 'approve' };
const BRAND_DECISION = { claimId: 'sbrnd_1', decision: 'approve', validUntil: '2030-01-01T00:00:00.000Z' };
const DONE = { kind: 'done', status: 'approved' };
const REFUSED = { kind: 'refused', reason: 'not-pending' };

beforeEach(() => {
  mockCtx.companyId = 'comp-a';
  Object.values(server).forEach((mock) => mock.mockReset());
  mockAfter.mockReset();
  mockRefresh.mockReset();
});

const ACTIONS = [
  ['αίτηση ελέγχου', requestReview, 'requestSupplierReview', REVIEW, null],
  ['αίτηση μάρκας', requestBrand, 'requestSupplierBrand', BRAND, null],
  ['απόφαση ελέγχου', decideReview, 'decideSupplierVerification', REVIEW_DECISION, 'no-store'],
  ['απόφαση μάρκας', decideBrand, 'decideSupplierBrand', BRAND_DECISION, 'no-store'],
] as const;

describe.each(ACTIONS)('%s', (_name, route, method, body, cache) => {
  it('επιτυχία ⇒ 200 με το αποτέλεσμα · ίδια κεφαλίδα μνήμης', async () => {
    server[method].mockResolvedValue(DONE);
    await expect(call(route, request(body))).resolves.toEqual({ status: 200, body: DONE, cache });
  });

  it('άρνηση ⇒ 409 με τον λόγο', async () => {
    server[method].mockResolvedValue(REFUSED);
    await expect(call(route, request(body))).resolves.toEqual({ status: 409, body: REFUSED, cache });
  });

  it('βλάβη ⇒ 503 χωρίς λεπτομέρεια', async () => {
    server[method].mockRejectedValue(new Error('secret-detail'));
    const result = await call(route, request(body));
    expect(result).toMatchObject({ status: 503, body: { error: 'UNAVAILABLE' } });
    expect(JSON.stringify(result.body)).not.toContain('secret-detail');
  });

  it('κακό σώμα ⇒ 400 `MALFORMED`, χωρίς κλήση στον γραφέα', async () => {
    await expect(call(route, request({ wrong: true }))).resolves.toMatchObject({ status: 400, body: { error: 'MALFORMED' } });
    expect(server[method]).not.toHaveBeenCalled();
  });
});

describe('οργανισμός', () => {
  it.each([['αίτηση ελέγχου', requestReview, REVIEW], ['αίτηση μάρκας', requestBrand, BRAND], ['ανάγνωση μαρκών', ownBrands, null]])('%s: χωρίς οργανισμό ⇒ 403 πριν από το σώμα', async (_name, route, body) => {
    mockCtx.companyId = ' ';
    await expect(call(route, request(body))).resolves.toMatchObject({ status: 403, body: { error: 'NO_ORGANIZATION' } });
  });

  it('🔒 ο οργανισμός έρχεται από το ctx, όχι από το σώμα', async () => {
    server.requestSupplierBrand.mockResolvedValue(DONE);
    await call(requestBrand, request({ ...BRAND, companyId: 'comp-evil' }));
    expect(server.requestSupplierBrand.mock.calls[0][1]).toMatchObject({ companyId: 'comp-a', actorUid: 'user-1' });
  });
});

describe('αναγνώσεις', () => {
  it('οι μάρκες του χώρου: `no-store` · βλάβη ⇒ 503', async () => {
    server.readOwnBrandClaims.mockResolvedValue([]);
    await expect(call(ownBrands, request())).resolves.toEqual({ status: 200, body: { claims: [] }, cache: 'no-store' });
    server.readOwnBrandClaims.mockRejectedValue(new Error('x'));
    await expect(call(ownBrands, request())).resolves.toMatchObject({ status: 503 });
  });

  it.each([
    ['επιβεβαίωση', listReviews, 'listSupplierReviews'],
    ['μάρκες', listBrands, 'listSupplierBrandClaims'],
  ] as const)('ουρά %s: η κατάσταση από το query · `no-store` · βλάβη ⇒ 503', async (_name, route, method) => {
    server[method].mockResolvedValue([]);
    await expect(call(route, request(null, 'status=approved'))).resolves.toEqual({ status: 200, body: { items: [] }, cache: 'no-store' });
    expect(server[method].mock.calls[0][1]).toBe('approved');
    server[method].mockRejectedValue(new Error('x'));
    await expect(call(route, request())).resolves.toMatchObject({ status: 503 });
  });
});

describe('ανάκληση', () => {
  it('επιβεβαίωση: η βιτρίνα αποσύρεται μετά την απάντηση, μόνο σε επιτυχία', async () => {
    server.revokeSupplierVerification.mockResolvedValue({ kind: 'done', status: 'revoked' });
    await call(decideReview, request({ companyId: 'comp-b', decision: 'revoke' }));
    expect(mockAfter).toHaveBeenCalledTimes(1);
    server.revokeSupplierVerification.mockResolvedValue(REFUSED);
    await call(decideReview, request({ companyId: 'comp-b', decision: 'revoke' }));
    expect(mockAfter).toHaveBeenCalledTimes(1);
  });

  it('μάρκα: πάει στον γραφέα ανάκλησης', async () => {
    server.revokeSupplierBrand.mockResolvedValue({ kind: 'done', status: 'revoked' });
    await expect(call(decideBrand, request({ claimId: 'sbrnd_1', decision: 'revoke' }))).resolves.toMatchObject({ status: 200 });
    expect(server.decideSupplierBrand).not.toHaveBeenCalled();
  });
});
