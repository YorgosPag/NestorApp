/**
 * Unit tests — POST /api/files/propagate-entity-rename (Batch 30)
 *
 * Contract:
 *  - 200 happy path: entityType + ownership match → propagator invoked with
 *    authCtx-derived fields (companyId, performedBy, performedByName)
 *  - 400 invalid entityType / missing entityId / missing newEntityLabel
 *  - 404 entity snapshot not found
 *  - 403 cross-tenant (entity companyId !== caller companyId)
 *  - 403 entity without companyId (edge: null/missing)
 *  - 500 propagator throws
 *
 * Pattern: mirrors src/app/api/contacts/__tests__/contact-impact-preview-routes.test.ts
 *  - withAuth injects a fixed authCtx
 *  - withStandardRateLimit passes through
 *  - firebaseAdmin mocked for ownership snapshot
 *  - propagator service mocked — we verify call args, not its behaviour
 */

// `next/server` pulls in web-spec `Request` / `Response` which aren't
// available in jsdom. We only need `NextResponse.json(body, { status })`
// to produce an object with `.status` and an async `.json()` reader.
jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return {
        status: init?.status ?? 200,
        json: async () => body,
      };
    }
  }
  return { NextResponse: MockNextResponse };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(handler: T) => handler,
}));

var authCtx: {
  uid: string;
  companyId: string;
  email: string | null;
  globalRole: string;
} = {
  uid: 'user_1',
  companyId: 'comp_1',
  email: 'giorgio@example.com',
  globalRole: 'company_admin',
};

jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>) => {
    return async (request: unknown, segmentData?: unknown) => {
      return callback(request, authCtx, {}, segmentData);
    };
  },
}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/services/filesystem/entity-file-display-propagator.service', () => ({
  EntityFileDisplayPropagator: {
    propagate: jest.fn(),
  },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { EntityFileDisplayPropagator } from '@/services/filesystem/entity-file-display-propagator.service';
import { POST } from '../propagate-entity-rename/route';

const mockedGetAdminFirestore = getAdminFirestore as jest.MockedFunction<typeof getAdminFirestore>;
const mockedPropagate = EntityFileDisplayPropagator.propagate as jest.MockedFunction<
  typeof EntityFileDisplayPropagator.propagate
>;

interface MockDocSnapshot {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

function makeFirestore(entitySnapshot: MockDocSnapshot | { exists: false }) {
  const snap: MockDocSnapshot = 'data' in entitySnapshot
    ? entitySnapshot
    : { exists: false, data: () => undefined };

  mockedGetAdminFirestore.mockReturnValue({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(async () => snap),
      })),
    })),
  } as never);
}

function makeRequest(body?: unknown) {
  return {
    json: jest.fn(async () => body),
  } as never;
}

beforeEach(() => {
  authCtx = {
    uid: 'user_1',
    companyId: 'comp_1',
    email: 'giorgio@example.com',
    globalRole: 'company_admin',
  };
  mockedGetAdminFirestore.mockReset();
  mockedPropagate.mockReset();
});

describe('POST /api/files/propagate-entity-rename', () => {
  test('200 happy path: ownership match → propagator invoked with auth context', async () => {
    makeFirestore({ exists: true, data: () => ({ companyId: 'comp_1', name: 'Studio 40' }) });
    mockedPropagate.mockResolvedValue({
      updatedCount: 3,
      skippedCount: 0,
      updatedFiles: [
        { fileId: 'f1', newDisplayName: 'new-1' },
        { fileId: 'f2', newDisplayName: 'new-2' },
        { fileId: 'f3', newDisplayName: 'new-3' },
      ],
    });

    const req = makeRequest({
      entityType: 'property',
      entityId: 'prop_1',
      newEntityLabel: 'Studio 40 m²',
    });

    const res = await POST(req, undefined as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      success: true,
      updatedCount: 3,
      skippedCount: 0,
      updatedFiles: [
        { fileId: 'f1', newDisplayName: 'new-1' },
        { fileId: 'f2', newDisplayName: 'new-2' },
        { fileId: 'f3', newDisplayName: 'new-3' },
      ],
    });

    expect(mockedPropagate).toHaveBeenCalledWith({
      entityType: 'property',
      entityId: 'prop_1',
      newEntityLabel: 'Studio 40 m²',
      companyId: 'comp_1',
      performedBy: 'user_1',
      performedByName: 'giorgio@example.com',
    });
  });

  test('200 with null email: performedByName is null, not undefined', async () => {
    authCtx = { ...authCtx, email: null };
    makeFirestore({ exists: true, data: () => ({ companyId: 'comp_1' }) });
    mockedPropagate.mockResolvedValue({
      updatedCount: 0,
      skippedCount: 0,
      updatedFiles: [],
    });

    await POST(
      makeRequest({ entityType: 'property', entityId: 'prop_1', newEntityLabel: 'X' }),
      undefined as never,
    );

    expect(mockedPropagate).toHaveBeenCalledWith(
      expect.objectContaining({ performedByName: null }),
    );
  });

  test('400 invalid entityType not in AuditEntityType union', async () => {
    const res = await POST(
      makeRequest({ entityType: 'not-a-real-entity', entityId: 'x', newEntityLabel: 'y' }),
      undefined as never,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'Invalid entityType' });
    expect(mockedPropagate).not.toHaveBeenCalled();
  });

  test('400 missing entityId (empty string)', async () => {
    const res = await POST(
      makeRequest({ entityType: 'property', entityId: '', newEntityLabel: 'y' }),
      undefined as never,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'entityId is required' });
    expect(mockedPropagate).not.toHaveBeenCalled();
  });

  test('400 missing newEntityLabel (whitespace only)', async () => {
    const res = await POST(
      makeRequest({ entityType: 'property', entityId: 'p1', newEntityLabel: '   ' }),
      undefined as never,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'newEntityLabel is required' });
    expect(mockedPropagate).not.toHaveBeenCalled();
  });

  test('404 entity not found in Firestore', async () => {
    makeFirestore({ exists: false });

    const res = await POST(
      makeRequest({ entityType: 'property', entityId: 'ghost', newEntityLabel: 'Y' }),
      undefined as never,
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, error: 'Entity not found' });
    expect(mockedPropagate).not.toHaveBeenCalled();
  });

  test('403 cross-tenant: entity companyId differs from caller companyId', async () => {
    makeFirestore({ exists: true, data: () => ({ companyId: 'other_company' }) });

    const res = await POST(
      makeRequest({ entityType: 'property', entityId: 'prop_1', newEntityLabel: 'Y' }),
      undefined as never,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      success: false,
      error: 'Forbidden: entity belongs to a different tenant',
    });
    expect(mockedPropagate).not.toHaveBeenCalled();
  });

  test('403 entity without companyId field (null/missing)', async () => {
    makeFirestore({ exists: true, data: () => ({ name: 'no-tenant' }) });

    const res = await POST(
      makeRequest({ entityType: 'property', entityId: 'prop_1', newEntityLabel: 'Y' }),
      undefined as never,
    );

    expect(res.status).toBe(403);
    expect(mockedPropagate).not.toHaveBeenCalled();
  });

  test('500 when propagator throws', async () => {
    makeFirestore({ exists: true, data: () => ({ companyId: 'comp_1' }) });
    mockedPropagate.mockRejectedValue(new Error('Firestore write failed'));

    const res = await POST(
      makeRequest({ entityType: 'property', entityId: 'prop_1', newEntityLabel: 'Y' }),
      undefined as never,
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Firestore write failed');
  });
});
