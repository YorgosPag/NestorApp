/**
 * @jest-environment node
 */

/**
 * Το σύνορο των routes καταλόγου (ADR-923 §5.14.1 Ζ23 · Ζ24), εκτελεσμένο πάνω στα αληθινά factories:
 * - κάθε επιτυχής απόκριση φεύγει με `private, no-store` (τιμές ενός κοινού δεν μένουν σε καμία μνήμη)·
 * - ο route που δηλώνει δική του πολιτική (αρχείο) κερδίζει·
 * - το σφάλμα του γραφέα/αναγνώστη δεν λέει «write» σε GET· η απρόβλεπτη βλάβη ανάγνωσης λέει «read».
 */

import { NextResponse, type NextRequest } from 'next/server';

import { CatalogWriteError } from '@/server/catalog/catalog-write-error';
import { PRIVATE_NO_STORE } from '@/lib/http/cache-control';
import { catalogActionRoute, catalogFileRoute, catalogReadRoute } from '../catalog-route';

const mockCtx = { uid: 'user-1', companyId: 'comp-a', globalRole: 'admin', isAuthenticated: true as const };

jest.mock('@/lib/auth', () => ({
  withAuth: (handler: (request: unknown, ctx: unknown, cache: unknown, segment: unknown) => unknown) =>
    (request: unknown, segment: unknown) => handler(request, mockCtx, {}, segment),
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

type Route = (request: NextRequest, segment?: unknown) => Promise<Response>;
const POLICY = { category: 'STANDARD', authority: 'pricingView' } as const;
const get = (url = 'https://app.test/api/catalog/x') => ({ url, method: 'GET', headers: new Headers(), nextUrl: new URL(url) }) as unknown as NextRequest;
const segment = { params: Promise.resolve({ id: 'cpub_1' }) };

async function call(route: unknown, req: NextRequest = get()) {
  const response = await (route as Route)(req, segment);
  return { status: response.status, cache: response.headers.get('Cache-Control'), body: await response.json().catch(() => null) };
}

describe('catalogReadRoute', () => {
  it('επιτυχία ⇒ 200 με `private, no-store`', async () => {
    const route = catalogReadRoute(POLICY, async () => ({ price: 10 }));
    await expect(call(route)).resolves.toEqual({ status: 200, cache: PRIVATE_NO_STORE, body: { success: true, data: { price: 10 } } });
  });

  it('`CatalogWriteError` σε GET ⇒ status από τον πίνακα, μήνυμα χωρίς «write»', async () => {
    const route = catalogReadRoute(POLICY, async () => { throw new CatalogWriteError('notFound'); });
    const result = await call(route);
    expect(result.status).toBe(404);
    expect(result.body).toMatchObject({ error: 'catalog request rejected: notFound', errorCode: 'catalog.notFound' });
    expect(JSON.stringify(result.body)).not.toMatch(/write/i);
  });

  // ⚠️ Μόνο βλάβη ΧΩΡΙΣ μήνυμα πέφτει στο fallback: με `Error` το `defineRoute` στέλνει το `message` αυτούσιο
  // (ADR-602, «byte-identical» — εκκρεμότητα στο `.claude-rules/pending-ratchet-work.md`, όχι αντικείμενο αυτής της άγκυρας).
  it('απρόβλεπτη βλάβη χωρίς μήνυμα ⇒ 500 «Catalog read failed»', async () => {
    const route = catalogReadRoute(POLICY, async () => { throw { code: 'NO_MESSAGE' }; });
    await expect(call(route)).resolves.toMatchObject({ status: 500, body: { error: 'Catalog read failed' } });
  });
});

describe('catalogFileRoute', () => {
  it('ο route δηλώνει δική του πολιτική ⇒ μένει αυτή', async () => {
    const route = catalogFileRoute(POLICY, async () => new NextResponse('pdf', { headers: { 'Cache-Control': 'private, max-age=60' } }));
    await expect(call(route)).resolves.toMatchObject({ status: 200, cache: 'private, max-age=60' });
  });

  it('ο route δεν είπε τίποτα ⇒ ποτέ χωρίς κεφαλίδα', async () => {
    const route = catalogFileRoute(POLICY, async () => new NextResponse('pdf'));
    await expect(call(route)).resolves.toMatchObject({ status: 200, cache: PRIVATE_NO_STORE });
  });
});

describe('catalogActionRoute', () => {
  it('και η απάντηση εγγραφής ανήκει σε έναν χώρο ⇒ `private, no-store`', async () => {
    const schema = (await import('zod')).z.object({});
    const route = catalogActionRoute({ category: 'STANDARD' }, schema, async () => ({ done: true }));
    const req = { ...get(), method: 'POST', json: async () => ({}) } as unknown as NextRequest;
    await expect(call(route, req)).resolves.toMatchObject({ cache: PRIVATE_NO_STORE });
  });
});
