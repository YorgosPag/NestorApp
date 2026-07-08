/**
 * Unit tests — defineRoute factory (ADR-602).
 *
 * Contract verified:
 *  - Envelope byte-identical to the migrated routes: ok/created/{success:true[,data]},
 *    error envelope {success:false,error[,...details]} with the thrown status.
 *  - Auth context (companyId/uid), awaited dynamic params, and parsed schema body
 *    are delivered to the handler.
 *  - Schema validation failure → 400 via safeParseBody (unchanged shape).
 *  - ApiError (business) → mapped status, NOT logged; unexpected error → 500 + log.
 *  - rateLimit tier maps to the matching pre-configured wrapper.
 *
 * Mocking pattern mirrors src/app/api/admin/migrate-accounting-profile.
 *
 * @enterprise ADR-602 API Route-Handler Factory SSoT
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

var rateSpies = {
  high: jest.fn(<T>(h: T) => h),
  standard: jest.fn(<T>(h: T) => h),
  sensitive: jest.fn(<T>(h: T) => h),
  heavy: jest.fn(<T>(h: T) => h),
  webhook: jest.fn(<T>(h: T) => h),
  telegram: jest.fn(<T>(h: T) => h),
};

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withHighRateLimit: (h: unknown) => rateSpies.high(h),
  withStandardRateLimit: (h: unknown) => rateSpies.standard(h),
  withSensitiveRateLimit: (h: unknown) => rateSpies.sensitive(h),
  withHeavyRateLimit: (h: unknown) => rateSpies.heavy(h),
  withWebhookRateLimit: (h: unknown) => rateSpies.webhook(h),
  withTelegramRateLimit: (h: unknown) => rateSpies.telegram(h),
}));

var authCtx = {
  uid: 'user_1',
  companyId: 'comp_caller',
  email: 'giorgio@example.com',
  globalRole: 'admin',
  mfaEnrolled: true,
  isAuthenticated: true as const,
};

var lastAuthOptions: unknown;

jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>, options?: unknown) => {
    lastAuthOptions = options;
    return async (request: unknown, segmentData?: unknown) =>
      callback(request, authCtx, { cache: true }, segmentData);
  },
}));

var errorLog = jest.fn();
jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    // Lazy indirection: ES imports hoist above the `errorLog` assignment, so the
    // module-load logger must defer reading it until call time.
    error: (...args: unknown[]) => errorLog(...args),
  }),
}));

import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { defineRoute, ok, created, conflict, notFound, badRequest } from '../define-route';

interface Envelope {
  status: number;
  json: () => Promise<Record<string, unknown>>;
}

function makeReq(
  body?: unknown,
  method = 'GET',
  url = 'https://app.test/api/accounting/apy-certificates',
): NextRequest {
  return {
    url,
    method,
    json: async () => body,
  } as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('defineRoute — success envelopes', () => {
  it('ok(data) → 200 { success:true, data } byte-identical', async () => {
    const GET = defineRoute({
      rateLimit: 'standard',
      handler: async ({ auth }) => ok([{ id: 'a', owner: auth.companyId }]),
    });
    const res = (await GET(makeReq())) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [{ id: 'a', owner: 'comp_caller' }] });
  });

  it('ok() with no payload → 200 { success:true } (no data key)', async () => {
    const PATCH = defineRoute({ rateLimit: 'sensitive', handler: async () => ok() });
    const res = (await PATCH(makeReq(undefined, 'PATCH'))) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('created(data) → 201 { success:true, data }', async () => {
    const POST = defineRoute({
      rateLimit: 'sensitive',
      handler: async () => created({ id: 'apy_1' }),
    });
    const res = (await POST(makeReq({}, 'POST'))) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { id: 'apy_1' } });
  });
});

describe('defineRoute — schema parsing', () => {
  const schema = z.object({ fiscalYear: z.number().int() });

  it('valid body is parsed and passed to handler', async () => {
    const seen: unknown[] = [];
    const POST = defineRoute({
      rateLimit: 'sensitive',
      schema,
      handler: async ({ body }) => {
        seen.push(body);
        return created({ ok: true });
      },
    });
    await POST(makeReq({ fiscalYear: 2026 }, 'POST'));
    expect(seen).toEqual([{ fiscalYear: 2026 }]);
  });

  it('invalid body → 400 via safeParseBody (unchanged shape)', async () => {
    const POST = defineRoute({ rateLimit: 'sensitive', schema, handler: async () => ok() });
    const res = (await POST(makeReq({ fiscalYear: 'nope' }, 'POST'))) as Envelope;
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Validation failed');
  });
});

describe('defineRoute — error envelopes', () => {
  it('conflict() → 409 with spread details, NOT logged', async () => {
    const POST = defineRoute({
      rateLimit: 'sensitive',
      handler: async () => conflict('Already exists', { existingCertificateId: 'apy_9' }),
    });
    const res = (await POST(makeReq({}, 'POST'))) as Envelope;
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      success: false,
      error: 'Already exists',
      existingCertificateId: 'apy_9',
    });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('notFound() → 404 { success:false, error }', async () => {
    const GET = defineRoute({
      rateLimit: 'standard',
      handler: async () => notFound('APY certificate not found'),
    });
    const res = (await GET(makeReq())) as Envelope;
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, error: 'APY certificate not found' });
  });

  it('badRequest() → 400 { success:false, error }', async () => {
    const GET = defineRoute({
      rateLimit: 'standard',
      handler: async () => badRequest('Invalid fiscalYear parameter'),
    });
    const res = (await GET(makeReq())) as Envelope;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'Invalid fiscalYear parameter' });
  });

  it('unexpected throw → 500 { success:false, error } + server log', async () => {
    const GET = defineRoute({
      rateLimit: 'standard',
      handler: async () => {
        throw new Error('boom');
      },
    });
    const res = (await GET(makeReq())) as Envelope;
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'boom' });
    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  it('non-Error throw (no message) → fallbackError in envelope', async () => {
    const GET = defineRoute({
      rateLimit: 'standard',
      fallbackError: 'Failed to list APY certificates',
      handler: async () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw { code: 'NO_MESSAGE' };
      },
    });
    const res = (await GET(makeReq())) as Envelope;
    expect((await res.json()).error).toBe('Failed to list APY certificates');
  });
});

describe('defineRoute — context wiring', () => {
  it('delivers awaited dynamic params to the handler', async () => {
    const seen: unknown[] = [];
    const GET = defineRoute<z.ZodTypeAny, { id: string }>({
      rateLimit: 'standard',
      handler: async ({ params }) => {
        seen.push(params);
        return ok();
      },
    });
    await GET(makeReq(), { params: Promise.resolve({ id: 'apy_42' }) });
    expect(seen).toEqual([{ id: 'apy_42' }]);
  });

  it('delivers auth context (companyId/uid) to the handler', async () => {
    let captured: { companyId?: string; uid?: string } = {};
    const GET = defineRoute({
      rateLimit: 'standard',
      handler: async ({ auth }) => {
        captured = { companyId: auth.companyId, uid: auth.uid };
        return ok();
      },
    });
    await GET(makeReq());
    expect(captured).toEqual({ companyId: 'comp_caller', uid: 'user_1' });
  });

  it('forwards auth options (permissions) to withAuth', async () => {
    const GET = defineRoute({
      rateLimit: 'standard',
      auth: { permissions: 'accounting.read' as never },
      handler: async () => ok(),
    });
    await GET(makeReq());
    expect(lastAuthOptions).toEqual({ permissions: 'accounting.read' });
  });
});

describe('defineRoute — rate-limit tier mapping', () => {
  it.each([
    ['high', () => rateSpies.high],
    ['standard', () => rateSpies.standard],
    ['sensitive', () => rateSpies.sensitive],
    ['heavy', () => rateSpies.heavy],
    ['webhook', () => rateSpies.webhook],
    ['telegram', () => rateSpies.telegram],
  ] as const)('tier "%s" → matching wrapper', (tier, spyGetter) => {
    defineRoute({ rateLimit: tier, handler: async () => ok() });
    expect(spyGetter()).toHaveBeenCalledTimes(1);
  });
});
