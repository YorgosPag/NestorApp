/**
 * @jest-environment node
 */

/**
 * `GET /api/catalog/showcase-prices` — η νησίδα αγοραστή (ADR-923 §5.13 Σ6 · Δ2), εκτελεσμένη πάνω στο αληθινό factory
 * (ανασκόπηση Μ-2). Τρία πράγματα που δεν τα εγγυάται κανείς άλλος:
 * - άκυρο `supplier`/`model` ⇒ 400 **πριν** από κάθε ανάγνωση·
 * - το route ζητά το `catalog:pricing:view`: χωρίς αυτό, άρνηση και καμία ανάγνωση·
 * - η απάντηση εξαρτάται από τον χώρο του καλούντα ⇒ `private, no-store`, και ο χώρος έρχεται ΜΟΝΟ από τη σύνδεση.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { PRIVATE_NO_STORE } from '@/lib/http/cache-control';
import { CATALOG_AUTHORITY_PERMISSIONS } from '@/subapps/catalog/vocabulary/catalog-authorities';

const mockCtx = { uid: 'user-1', companyId: 'comp-buyer', globalRole: 'admin', isAuthenticated: true as const };
let mockGranted: readonly string[] = [];
const mockRead = jest.fn(async (_ctx: unknown, _request: unknown) => ({}));

jest.mock('@/lib/auth', () => ({
  withAuth: (
    handler: (request: unknown, ctx: unknown, cache: unknown, segment: unknown) => unknown,
    options: { readonly permissions?: string | readonly string[] } = {},
  ) => (request: unknown, segment: unknown) => {
    const required = options.permissions === undefined ? [] : ([] as string[]).concat(options.permissions);
    if (!required.every((permission) => mockGranted.includes(permission))) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
    }
    return handler(request, mockCtx, {}, segment);
  },
}));
jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withHighRateLimit: <T,>(handler: T) => handler,
  withStandardRateLimit: <T,>(handler: T) => handler,
  withSensitiveRateLimit: <T,>(handler: T) => handler,
  withHeavyRateLimit: <T,>(handler: T) => handler,
  withWebhookRateLimit: <T,>(handler: T) => handler,
  withTelegramRateLimit: <T,>(handler: T) => handler,
}));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }) }));
jest.mock('@/services/public-catalog/public-catalog-prices', () => ({
  readBuyerShowcasePrices: (ctx: unknown, request: unknown) => mockRead(ctx, request),
}));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθεί το route */
import { GET } from '../route';
/* eslint-enable import/first */

type Route = (request: NextRequest, segment?: unknown) => Promise<Response>;

function get(query: string): NextRequest {
  const url = `https://app.test/api/catalog/showcase-prices${query}`;
  return { url, method: 'GET', headers: new Headers(), nextUrl: new URL(url) } as unknown as NextRequest;
}

async function call(query: string) {
  const response = await (GET as unknown as Route)(get(query), { params: Promise.resolve({}) });
  return { status: response.status, cache: response.headers.get('Cache-Control'), body: await response.json().catch(() => null) };
}

beforeEach(() => {
  mockGranted = [CATALOG_AUTHORITY_PERMISSIONS.pricingView];
  mockRead.mockClear();
});

describe('GET /api/catalog/showcase-prices', () => {
  it('έγκυρο αίτημα ⇒ 200 `private, no-store` · ο αναγνώστης παίρνει τον χώρο ΑΠΟ ΤΗ ΣΥΝΔΕΣΗ, όχι από το αίτημα', async () => {
    mockRead.mockResolvedValueOnce({ v1: { kind: 'onRequest' } });
    const result = await call('?supplier=comp-supplier&model=cpmod_1&companyId=comp-evil');
    expect(result).toEqual({ status: 200, cache: PRIVATE_NO_STORE, body: { success: true, data: { prices: { v1: { kind: 'onRequest' } } } } });
    expect(mockRead).toHaveBeenCalledWith(mockCtx, { supplierCompanyId: 'comp-supplier', modelId: 'cpmod_1' });
  });

  it.each([
    ['χωρίς supplier', '?model=cpmod_1'],
    ['χωρίς model', '?supplier=comp-supplier'],
    ['κενό supplier', '?supplier=&model=cpmod_1'],
    ['υπερμεγέθες model', `?supplier=comp-supplier&model=${'x'.repeat(129)}`],
  ])('%s ⇒ 400, καμία ανάγνωση', async (_label, query) => {
    const result = await call(query);
    expect(result.status).toBe(400);
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('χωρίς `catalog:pricing:view` ⇒ άρνηση, καμία ανάγνωση', async () => {
    mockGranted = [CATALOG_AUTHORITY_PERMISSIONS.schema];
    const result = await call('?supplier=comp-supplier&model=cpmod_1');
    expect(result.status).toBe(403);
    expect(mockRead).not.toHaveBeenCalled();
  });
});
