/**
 * Unit tests — /api/admin/migrate-accounting-profile (ADR-439 Phase 2).
 *
 * Contract:
 *  - GET (dry-run): zero writes; reports READY_TO_MIGRATE / ALREADY_MIGRATED / NO_SOURCE.
 *  - POST (execute): idempotent — second run = ALREADY_MIGRATED no-op; copies global →
 *    per-tenant with companyId stamped; never deletes the global doc; 404 when no source.
 *  - super_admin gate on both verbs.
 *
 * Pattern mirrors src/app/api/files/__tests__/propagate-entity-rename.route.test.ts.
 *
 * @enterprise ADR-439 — Tenant Identity SSoT & Provisioning
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withSensitiveRateLimit: <T>(handler: T) => handler,
}));

var authCtx: { uid: string; companyId: string; email: string | null; globalRole: string } = {
  uid: 'user_1',
  companyId: 'comp_caller',
  email: 'giorgio@example.com',
  globalRole: 'super_admin',
};

jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>) => {
    return async (request: unknown, segmentData?: unknown) =>
      callback(request, authCtx, {}, segmentData);
  },
  logSystemOperation: jest.fn(async () => undefined),
  extractRequestMetadata: jest.fn(() => ({ ip: 'test' })),
}));

jest.mock('@/config/tenant', () => ({
  LEGACY_TENANT_COMPANY_ID: 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757',
}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { SYSTEM_DOCS } from '@/config/firestore-collections';
import { GET, POST } from '../route';

const COMPANY_ID = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';
const GLOBAL_DOC = SYSTEM_DOCS.ACCT_COMPANY_PROFILE;
const mockedGetAdminFirestore = getAdminFirestore as jest.MockedFunction<typeof getAdminFirestore>;

let docStore: Record<string, Record<string, unknown> | undefined>;
let deletedDocs: string[];

function installFirestore() {
  docStore = {};
  deletedDocs = [];
  mockedGetAdminFirestore.mockReturnValue({
    collection: (_name: string) => ({
      doc: (id: string) => ({
        get: async () => ({ exists: docStore[id] !== undefined, data: () => docStore[id] }),
        set: async (data: Record<string, unknown>) => {
          docStore[id] = data;
        },
        delete: async () => {
          deletedDocs.push(id);
          docStore[id] = undefined;
        },
      }),
    }),
  } as unknown as ReturnType<typeof getAdminFirestore>);
}

const req = {} as Parameters<typeof POST>[0];

beforeEach(() => {
  authCtx.globalRole = 'super_admin';
  installFirestore();
});

describe('GET — dry-run preview (ADR-439 Phase 2)', () => {
  it('reports READY_TO_MIGRATE and writes nothing when only the global doc exists', async () => {
    docStore[GLOBAL_DOC] = { businessName: 'ΠΑΓΩΝΗΣ Α.Ε.' };

    const res = await GET(req as never, undefined as never, undefined as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('READY_TO_MIGRATE');
    expect(body.willMigrate).toBe(true);
    expect(docStore[COMPANY_ID]).toBeUndefined(); // zero writes
  });

  it('reports ALREADY_MIGRATED when the per-tenant doc exists', async () => {
    docStore[COMPANY_ID] = { businessName: 'ΠΑΓΩΝΗΣ Α.Ε.', companyId: COMPANY_ID };

    const res = await GET(req as never, undefined as never, undefined as never);
    const body = await res.json();

    expect(body.status).toBe('ALREADY_MIGRATED');
    expect(body.willMigrate).toBe(false);
  });

  it('reports NO_SOURCE when neither doc exists', async () => {
    const res = await GET(req as never, undefined as never, undefined as never);
    const body = await res.json();
    expect(body.status).toBe('NO_SOURCE');
  });

  it('forbids non-super_admin', async () => {
    authCtx.globalRole = 'company_admin';
    const res = await GET(req as never, undefined as never, undefined as never);
    expect(res.status).toBe(403);
  });
});

describe('POST — execute migration (ADR-439 Phase 2)', () => {
  it('copies global → per-tenant, stamps companyId, keeps the global doc', async () => {
    docStore[GLOBAL_DOC] = { businessName: 'ΠΑΓΩΝΗΣ Α.Ε.', vatNumber: '801832652' };

    const res = await POST(req as never, undefined as never, undefined as never);
    const body = await res.json();

    expect(body.action).toBe('MIGRATED');
    expect(docStore[COMPANY_ID]?.companyId).toBe(COMPANY_ID);
    expect(docStore[COMPANY_ID]?.businessName).toBe('ΠΑΓΩΝΗΣ Α.Ε.');
    expect(docStore[COMPANY_ID]?.updatedAt).toBeDefined();
    expect(docStore[GLOBAL_DOC]).toBeDefined(); // global intact (rollback safety)
    expect(deletedDocs).not.toContain(GLOBAL_DOC);
  });

  it('is idempotent — a second run is a no-op (ALREADY_MIGRATED)', async () => {
    docStore[GLOBAL_DOC] = { businessName: 'ΠΑΓΩΝΗΣ Α.Ε.' };

    const first = await (await POST(req as never, undefined as never, undefined as never)).json();
    expect(first.action).toBe('MIGRATED');
    const migrated = docStore[COMPANY_ID];

    const second = await (await POST(req as never, undefined as never, undefined as never)).json();
    expect(second.action).toBe('ALREADY_MIGRATED');
    expect(docStore[COMPANY_ID]).toBe(migrated); // unchanged reference — no rewrite
  });

  it('returns 404 NO_SOURCE when the global doc is absent', async () => {
    const res = await POST(req as never, undefined as never, undefined as never);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.action).toBe('NO_SOURCE');
  });

  it('forbids non-super_admin', async () => {
    authCtx.globalRole = 'company_admin';
    const res = await POST(req as never, undefined as never, undefined as never);
    expect(res.status).toBe(403);
  });
});
