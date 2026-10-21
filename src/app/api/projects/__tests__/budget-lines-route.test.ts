/**
 * ADR-917 Φ3β — PUT / DELETE /api/projects/[projectId]/budget-lines/[costCode] · GET …/budget-lines.
 *
 * Through the REAL `defineRoute` factory: the project's tenant fence runs BEFORE any write (foreign ⇒ 404,
 * ADR-742), a code outside the taxonomy ⇒ 400 with NO write, a stale revision ⇒ 409 with the current one,
 * the write is scoped by the CALLER's company, and the permission is declared on the boundary.
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

// No initializer: the route modules load (and call `withAuth`) before this line runs.
var authOptions: unknown[] | undefined;
var requireProjectInTenant = jest.fn();
jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>, options?: unknown) => {
    (authOptions = authOptions ?? []).push(options);
    return async (request: unknown, segmentData?: unknown) => callback(request, authCtx, { cache: true }, segmentData);
  },
  requireProjectInTenant: (...a: unknown[]) => requireProjectInTenant(...a),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));

var writeProjectBudgetLine = jest.fn();
var readProjectBudgetLines = jest.fn();
jest.mock('@/services/project-cost/project-budget-lines.server', () => ({
  writeProjectBudgetLine: (...a: unknown[]) => writeProjectBudgetLine(...a),
  readProjectBudgetLines: (...a: unknown[]) => readProjectBudgetLines(...a),
}));

import { TenantIsolationError } from '@/lib/auth/tenant-isolation-error';
import { DELETE, PUT } from '../[projectId]/budget-lines/[costCode]/route';
import { GET } from '../[projectId]/budget-lines/route';

type Res = { status: number; json: () => Promise<Record<string, unknown>> };

function put(costCode: string, body: unknown, projectId = 'p1') {
  const req = { url: 'http://x', method: 'PUT', nextUrl: new URL('http://x'), json: async () => body };
  return PUT(req as never, { params: Promise.resolve({ projectId, costCode }) }) as unknown as Promise<Res>;
}

function del(costCode: string, query: string) {
  const req = { url: 'http://x', method: 'DELETE', nextUrl: new URL(`http://x/?${query}`) };
  return DELETE(req as never, { params: Promise.resolve({ projectId: 'p1', costCode }) }) as unknown as Promise<Res>;
}

const LINE = { id: 'pbl_1', costCode: 'SOFT-PERMITS', amount: 12000, revision: 1 };

describe('budget-lines routes (ADR-917 Φ3β)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireProjectInTenant.mockResolvedValue({ companyId: 'comp_A', name: 'Έργο 1' });
  });

  it('declares the permission on the boundary: update to write, view to read', () => {
    expect(authOptions).toEqual(expect.arrayContaining([
      { permissions: 'projects:projects:update' },
      { permissions: 'projects:projects:view' },
    ]));
  });

  it('PUT → ONE writer, scoped by the CALLER company, the project name on the history', async () => {
    writeProjectBudgetLine.mockResolvedValueOnce({ kind: 'changed', line: LINE });
    const res = await put('SOFT-PERMITS', { amount: 12000, note: '  ', expectedRevision: 0 });
    expect(res.status).toBe(200);
    expect(writeProjectBudgetLine).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actor: expect.objectContaining({ companyId: 'comp_A', uid: 'user_1' }),
      target: { projectId: 'p1', projectName: 'Έργο 1', costCode: 'SOFT-PERMITS' },
      next: { amount: 12000, note: null },
      expectedRevision: 0,
    }));
  });

  it('🔴 Α7-type — foreign project → 404 and NO write', async () => {
    requireProjectInTenant.mockRejectedValueOnce(new TenantIsolationError('Project not found', 404, 'NOT_FOUND'));
    const res = await put('SOFT-PERMITS', { amount: 1, note: null, expectedRevision: 0 }, 'p_foreign');
    expect(res.status).toBe(404);
    expect(writeProjectBudgetLine).not.toHaveBeenCalled();
  });

  it.each(['OTHER', 'SOFT-UNKNOWN', 'OIK-99', 'SOFT-PERMITS.free text'])('🔴 code %s → 400 and NO write', async code => {
    const res = await put(code, { amount: 1, note: null, expectedRevision: 0 });
    expect(res.status).toBe(400);
    expect(writeProjectBudgetLine).not.toHaveBeenCalled();
  });

  it('🔴 negative amount → 400 and NO write', async () => {
    const res = await put('SOFT-PERMITS', { amount: -5, note: null, expectedRevision: 0 });
    expect(res.status).toBe(400);
    expect(writeProjectBudgetLine).not.toHaveBeenCalled();
  });

  it('🔴 stale revision → 409 with the current revision', async () => {
    writeProjectBudgetLine.mockResolvedValueOnce({ kind: 'conflict', currentRevision: 4 });
    const res = await put('SOFT-PERMITS', { amount: 1, note: null, expectedRevision: 2 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(expect.objectContaining({ currentRevision: 4 }));
  });

  it('DELETE archives through the SAME writer (`next: null`) with the revision from the query', async () => {
    writeProjectBudgetLine.mockResolvedValueOnce({ kind: 'changed', line: { ...LINE, revision: 2 } });
    const res = await del('SOFT-PERMITS', 'expectedRevision=1');
    expect(res.status).toBe(200);
    expect(writeProjectBudgetLine).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ next: null, expectedRevision: 1 }));
  });

  it('DELETE without a revision → 400 and NO write', async () => {
    const res = await del('SOFT-PERMITS', '');
    expect(res.status).toBe(400);
    expect(writeProjectBudgetLine).not.toHaveBeenCalled();
  });

  it('GET → the active lines of the CALLER company, in taxonomy order', async () => {
    readProjectBudgetLines.mockResolvedValueOnce([{ ...LINE, costCode: 'SOFT-LEGAL' }, { ...LINE, costCode: 'OIK-2' }]);
    const req = { url: 'http://x', method: 'GET', nextUrl: new URL('http://x') };
    const res = (await GET(req as never, { params: Promise.resolve({ projectId: 'p1' }) })) as unknown as Res;
    const body = (await res.json()) as { data: { lines: Array<{ costCode: string }> } };
    expect(readProjectBudgetLines).toHaveBeenCalledWith(expect.anything(), 'comp_A', 'p1');
    expect(body.data.lines.map(line => line.costCode)).toEqual(['OIK-2', 'SOFT-LEGAL']);
  });
});
