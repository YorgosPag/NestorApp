/**
 * ADR-917 §7 A7 — GET /api/projects/[projectId]/cost-ledger.
 *
 * Through the REAL `defineRoute` factory: the project's tenant fence runs BEFORE
 * any source read, a foreign project answers 404 (ADR-742), and the ledger is
 * scoped by the CALLER's company.
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
  withHighRateLimit: <T>(h: T) => h,
  withStandardRateLimit: <T>(h: T) => h,
  withSensitiveRateLimit: <T>(h: T) => h,
  withHeavyRateLimit: <T>(h: T) => h,
  withWebhookRateLimit: <T>(h: T) => h,
  withTelegramRateLimit: <T>(h: T) => h,
}));

var authCtx = {
  uid: 'user_1',
  companyId: 'comp_A',
  email: 'g@example.com',
  globalRole: 'company_admin',
  isAuthenticated: true as const,
};

var requireProjectInTenant = jest.fn();
jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segmentData?: unknown) =>
      callback(request, authCtx, { cache: true }, segmentData),
  requireProjectInTenant: (...a: unknown[]) => requireProjectInTenant(...a),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));

var loadProjectCostLedger = jest.fn();
jest.mock('@/services/project-cost/project-cost-ledger.server', () => ({
  loadProjectCostLedger: (...a: unknown[]) => loadProjectCostLedger(...a),
}));

import { TenantIsolationError } from '@/lib/auth/tenant-isolation-error';
import { GET } from '../[projectId]/cost-ledger/route';

function call(projectId: string) {
  const req = { url: `http://x/api/projects/${projectId}/cost-ledger`, method: 'GET', nextUrl: new URL('http://x') };
  return GET(req as never, { params: Promise.resolve({ projectId }) }) as unknown as Promise<{
    status: number;
    json: () => Promise<{ success: boolean; data?: { projectId: string; isEmpty: boolean } }>;
  }>;
}

describe('GET /api/projects/[projectId]/cost-ledger (ADR-917 Φ2)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('own project → ledger view scoped by the caller company', async () => {
    requireProjectInTenant.mockResolvedValueOnce({ id: 'p1' });
    loadProjectCostLedger.mockResolvedValueOnce({ rows: [], boqItemCount: 0, coveredBoqItemCount: 0 });
    const res = await call('p1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(expect.objectContaining({ projectId: 'p1', isEmpty: true }));
    expect(loadProjectCostLedger).toHaveBeenCalledWith(expect.anything(), 'comp_A', 'p1');
  });

  it('Φ3β — the project bartexPercentage reaches the view (in-kind figure, Ζ2)', async () => {
    requireProjectInTenant.mockResolvedValueOnce({ id: 'p1', bartexPercentage: 35 });
    loadProjectCostLedger.mockResolvedValueOnce({ rows: [], boqItemCount: 0, coveredBoqItemCount: 0 });
    const body = (await (await call('p1')).json()) as { data?: { landExchange: { bartexPercentage: number } | null } };
    expect(body.data?.landExchange).toEqual(expect.objectContaining({ bartexPercentage: 35 }));
  });

  it('🔴 A7 — foreign project → 404 and NO source read', async () => {
    requireProjectInTenant.mockRejectedValueOnce(new TenantIsolationError('Project not found', 404, 'NOT_FOUND'));
    const res = await call('p_foreign');
    expect(res.status).toBe(404);
    expect(loadProjectCostLedger).not.toHaveBeenCalled();
  });
});
