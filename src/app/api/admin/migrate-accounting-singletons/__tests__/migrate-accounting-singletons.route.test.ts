/**
 * Unit tests — /api/admin/migrate-accounting-singletons (ADR-439 Phase 2c).
 *
 * Contract:
 *  - GET (dry-run): zero writes; per-singleton status (READY_TO_MIGRATE / ALREADY_MIGRATED / NO_SOURCE).
 *  - POST (execute): idempotent per singleton; copies global → {companyId}__<type> with companyId
 *    stamped; never deletes the global docs; partial sources handled per-singleton.
 *  - super_admin gate on both verbs.
 *
 * Pattern mirrors migrate-accounting-profile.route.test.ts.
 *
 * @enterprise ADR-439 — Tenant Identity SSoT & Provisioning — Phase 2c
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
const mockedGetAdminFirestore = getAdminFirestore as jest.MockedFunction<typeof getAdminFirestore>;

const LEGACY = {
  partners: SYSTEM_DOCS.ACCT_PARTNERS,
  members: SYSTEM_DOCS.ACCT_MEMBERS,
  shareholders: SYSTEM_DOCS.ACCT_SHAREHOLDERS,
  service_presets: SYSTEM_DOCS.ACCT_SERVICE_PRESETS,
  matching_config: SYSTEM_DOCS.ACCT_MATCHING_CONFIG,
  efka_user_config: SYSTEM_DOCS.ACCT_EFKA_USER_CONFIG,
};

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

function statusOf(body: { singletons: Array<{ type: string; status: string }> }, type: string): string {
  return body.singletons.find((s) => s.type === type)?.status ?? 'MISSING';
}

beforeEach(() => {
  authCtx.globalRole = 'super_admin';
  installFirestore();
});

describe('GET — dry-run preview', () => {
  it('reports per-singleton status and writes nothing', async () => {
    docStore[LEGACY.partners] = { partners: [{ id: 'p1' }] };
    docStore[`${COMPANY_ID}__members`] = { members: [], companyId: COMPANY_ID };

    const res = await GET(req as never, undefined as never, undefined as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(statusOf(body, 'partners')).toBe('READY_TO_MIGRATE');
    expect(statusOf(body, 'members')).toBe('ALREADY_MIGRATED');
    expect(statusOf(body, 'shareholders')).toBe('NO_SOURCE');
    expect(statusOf(body, 'efka_user_config')).toBe('NO_SOURCE');
    expect(body.willMigrate).toBe(1);
    // zero writes
    expect(docStore[`${COMPANY_ID}__partners`]).toBeUndefined();
  });

  it('forbids non-super_admin', async () => {
    authCtx.globalRole = 'company_admin';
    const res = await GET(req as never, undefined as never, undefined as never);
    expect(res.status).toBe(403);
  });
});

describe('POST — execute migration', () => {
  it('copies each available global → per-tenant, stamps companyId, keeps globals', async () => {
    docStore[LEGACY.partners] = { partners: [{ id: 'p1' }] };
    docStore[LEGACY.matching_config] = { amountTolerancePercent: 5 };
    docStore[LEGACY.efka_user_config] = { contributionClass: 1 };

    const res = await POST(req as never, undefined as never, undefined as never);
    const body = await res.json();

    expect(body.migratedCount).toBe(3);
    expect(docStore[`${COMPANY_ID}__partners`]?.companyId).toBe(COMPANY_ID);
    expect(docStore[`${COMPANY_ID}__matching_config`]?.companyId).toBe(COMPANY_ID);
    expect(docStore[`${COMPANY_ID}__matching_config`]?.amountTolerancePercent).toBe(5);
    expect(docStore[`${COMPANY_ID}__partners`]?.updatedAt).toBeDefined();
    // EFKA config → bare {companyId} doc id (separate collection), companyId stamped
    expect(docStore[COMPANY_ID]?.companyId).toBe(COMPANY_ID);
    expect(docStore[COMPANY_ID]?.contributionClass).toBe(1);
    // globals intact (rollback safety)
    expect(docStore[LEGACY.partners]).toBeDefined();
    expect(docStore[LEGACY.efka_user_config]).toBeDefined();
    expect(deletedDocs).toHaveLength(0);
    // singletons without a source are skipped
    expect(docStore[`${COMPANY_ID}__shareholders`]).toBeUndefined();
  });

  it('is idempotent — a second run migrates nothing new', async () => {
    docStore[LEGACY.partners] = { partners: [{ id: 'p1' }] };

    const first = await (await POST(req as never, undefined as never, undefined as never)).json();
    expect(first.migratedCount).toBe(1);
    const migrated = docStore[`${COMPANY_ID}__partners`];

    const second = await (await POST(req as never, undefined as never, undefined as never)).json();
    expect(second.migratedCount).toBe(0);
    expect(docStore[`${COMPANY_ID}__partners`]).toBe(migrated); // unchanged reference
  });

  it('forbids non-super_admin', async () => {
    authCtx.globalRole = 'company_admin';
    const res = await POST(req as never, undefined as never, undefined as never);
    expect(res.status).toBe(403);
  });
});
