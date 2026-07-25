/**
 * Regression guard — GET /api/buildings project scoping (ADR-707).
 *
 * WHY THIS FILE EXISTS: `?projectId=X` used to answer with **another project's**
 * buildings whenever X matched nothing, because an automatic company-wide fallback
 * fired on an empty result. Measured live on 2026-07-26: PRJ-002 (zero buildings)
 * received «Κτήριο Α», which belongs to ΕΡΓΟ Α — and four call sites rendered it as
 * "the buildings of this project" (measurements aggregate, timeline, navigation
 * tree, floorplan import target).
 *
 * The fallback is now opt-in. Nothing enforces that but this file: the defect is a
 * single deleted `&& allowCompanyFallback` away from returning, and it reappears
 * silently — the response looks perfectly healthy. Anchor, not decoration.
 *
 * @enterprise ADR-707 Buildings list scope SSoT
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(h: T) => h,
  withHighRateLimit: <T>(h: T) => h,
  withSensitiveRateLimit: <T>(h: T) => h,
  withHeavyRateLimit: <T>(h: T) => h,
}));

var authCtx = {
  uid: 'user_1',
  companyId: 'comp_A',
  email: 'giorgio@example.com',
  globalRole: 'admin',
  mfaEnrolled: true,
  isAuthenticated: true as const,
};

jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) => callback(request, authCtx, { cache: true }),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

var projectSnapshot: { empty: boolean; docs: unknown[] } = { empty: true, docs: [] };
var companySnapshot: { empty: boolean; docs: unknown[] } = { empty: true, docs: [] };

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      where: () => ({
        where: () => ({ get: async () => projectSnapshot }),
        get: async () => projectSnapshot,
      }),
    }),
  }),
}));

var tenantScopedCollectionMock = jest.fn(() => ({ get: async () => companySnapshot }));

jest.mock('@/lib/firestore/tenant-scoped-query', () => ({
  tenantScopedCollection: (...args: unknown[]) => tenantScopedCollectionMock(...(args as [])),
}));

jest.mock('@/lib/auth/tenant-scope', () => ({
  resolveTenantScopeFromUrl: () => ({ companyId: 'comp_A', isSuperAdmin: false }),
  resolveTenantListScopeFromUrl: () => ({ companyId: 'comp_A', isSuperAdmin: false }),
  tenantScopeLabel: () => 'comp_A',
}));

// POST-only collaborators — imported at module scope, never exercised here.
jest.mock('@/lib/firestore/entity-creation.service', () => ({ createEntity: jest.fn() }));
jest.mock('@/services/building/building-creation-policy', () => ({
  BuildingCreationPolicyError: class extends Error {},
  assertBuildingCreatePolicy: jest.fn(),
  assertBuildingUpstreamChain: jest.fn(),
}));

import type { NextRequest } from 'next/server';
import { GET } from '../route';

interface Envelope {
  status: number;
  json: () => Promise<{ data?: { buildings?: unknown[]; count?: number; scope?: string } }>;
}

function req(query: string): NextRequest {
  return { url: `https://app.test/api/buildings${query}`, method: 'GET' } as unknown as NextRequest;
}

function doc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

/** The exact live shape: a building owned by a DIFFERENT project, same company. */
const FOREIGN_BUILDING = doc('bldg_foreign', {
  name: 'Κτήριο Α',
  code: 'Κτήριο Α',
  projectId: 'proj_OTHER',
  companyId: 'comp_A',
});

const OWN_BUILDING = doc('bldg_own', {
  name: 'Κτήριο Β',
  code: 'Κτήριο Β',
  projectId: 'proj_TARGET',
  companyId: 'comp_A',
});

beforeEach(() => {
  jest.clearAllMocks();
  projectSnapshot = { empty: true, docs: [] };
  companySnapshot = { empty: false, docs: [FOREIGN_BUILDING] };
});

describe('GET /api/buildings — project scope (ADR-707)', () => {
  it('empty project answers EMPTY — never another project\'s buildings', async () => {
    const res = (await GET(req('?projectId=proj_TARGET'))) as Envelope;
    const { data } = await res.json();

    expect(res.status).toBe(200);
    expect(data?.buildings).toEqual([]);
    expect(data?.count).toBe(0);
    expect(data?.scope).toBe('project');
    // The company-wide query must not even be issued.
    expect(tenantScopedCollectionMock).not.toHaveBeenCalled();
  });

  it('project with buildings returns exactly its own, scope=project', async () => {
    projectSnapshot = { empty: false, docs: [OWN_BUILDING] };

    const res = (await GET(req('?projectId=proj_TARGET'))) as Envelope;
    const { data } = await res.json();

    expect(data?.count).toBe(1);
    expect((data?.buildings as Array<{ id: string }>)[0].id).toBe('bldg_own');
    expect(data?.scope).toBe('project');
    expect(tenantScopedCollectionMock).not.toHaveBeenCalled();
  });

  it('codesOnly on an empty project suggests NO reserved codes (next code stays «Κτήριο Α»)', async () => {
    // Before ADR-707 this returned the whole company's codes, so the first building
    // of a fresh project was proposed as «Κτήριο Β» or later.
    const res = (await GET(req('?projectId=proj_TARGET&codesOnly=true'))) as Envelope;
    const { data } = await res.json();

    expect(data?.buildings).toEqual([]);
    expect(data?.scope).toBe('project');
  });

  it('?fallback=company is honoured, and the response SAYS so', async () => {
    const res = (await GET(req('?projectId=proj_TARGET&fallback=company'))) as Envelope;
    const { data } = await res.json();

    expect(tenantScopedCollectionMock).toHaveBeenCalledTimes(1);
    expect(data?.count).toBe(1);
    expect((data?.buildings as Array<{ id: string }>)[0].id).toBe('bldg_foreign');
    // A caller that renders "buildings of this project" can assert on this and refuse.
    expect(data?.scope).toBe('company-fallback');
  });

  it('fallback stays off for any other value of the flag', async () => {
    for (const flag of ['true', '1', 'yes', 'Company']) {
      jest.clearAllMocks();
      const res = (await GET(req(`?projectId=proj_TARGET&fallback=${flag}`))) as Envelope;
      const { data } = await res.json();
      expect(tenantScopedCollectionMock).not.toHaveBeenCalled();
      expect(data?.scope).toBe('project');
    }
  });

  it('no projectId → tenant browse list, scope=tenant', async () => {
    companySnapshot = { empty: false, docs: [FOREIGN_BUILDING, OWN_BUILDING] };

    const res = (await GET(req(''))) as Envelope;
    const { data } = await res.json();

    expect(tenantScopedCollectionMock).toHaveBeenCalledTimes(1);
    expect(data?.count).toBe(2);
    expect(data?.scope).toBe('tenant');
  });

  it('soft-deleted buildings stay excluded (ADR-281) without disturbing scope', async () => {
    projectSnapshot = {
      empty: false,
      docs: [OWN_BUILDING, doc('bldg_trashed', { projectId: 'proj_TARGET', status: 'deleted' })],
    };

    const res = (await GET(req('?projectId=proj_TARGET'))) as Envelope;
    const { data } = await res.json();

    expect(data?.count).toBe(1);
    expect(data?.scope).toBe('project');
  });
});
