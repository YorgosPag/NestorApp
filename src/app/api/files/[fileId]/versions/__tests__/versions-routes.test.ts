/**
 * @jest-environment node
 *
 * @fileoverview Οι διαδρομές της στοίβας εκδόσεων (ADR-862 Φ0).
 * @related app/api/files/[fileId]/versions · app/api/files/[fileId]/versions/promote
 *
 * ⚠️ Ο PEP (`fileResource` + `containerVisibilityRefusal`) **ΔΕΝ** γίνεται mock στη `GET`: αν
 * αφαιρεθεί, ξένο αρχείο ή κρυφή έκδοση πρέπει να κοκκινίσει. Στην `POST` mock μόνο η υπηρεσία,
 * γιατί εδώ κρίνεται η **αντιστοίχιση** έκβασης → HTTP (η υπηρεσία έχει την άγκυρα Α24).
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

let fake: FakeFirestore;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
}));

jest.mock('next/server', () => {
  class MockNextResponse {
    readonly status: number;
    private readonly body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    async json(): Promise<unknown> { return this.body; }
    static json(body: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(h: T) => h,
  withSensitiveRateLimit: <T>(h: T) => h,
}));

const caller = { uid: 'u_alpha', companyId: 'c_alpha', globalRole: 'company_admin', permissions: [], isAuthenticated: true };
jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segment: unknown) => callback(request, caller, undefined, segment),
}));

const mockPromote = jest.fn();
jest.mock('@/services/iso19650/version-promotion', () => ({
  promoteVersion: (...args: unknown[]) => mockPromote(...args),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { GET } = require('../route') as typeof import('../route');
const { POST } = require('../promote/route') as typeof import('../promote/route');
/* eslint-enable @typescript-eslint/no-require-imports */

type Reply = { status: number; json: () => Promise<Record<string, unknown>> };
const segment = (fileId: string) => ({ params: Promise.resolve({ fileId }) });

function seed(id: string, extra: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.FILES, id, {
    id, companyId: 'c_alpha', createdBy: 'u_alpha', status: 'ready', lifecycleState: 'active', isDeleted: false,
    displayName: id, originalFilename: `${id}.pdf`, ext: 'pdf', contentType: 'application/pdf',
    storagePath: `companies/c_alpha/files/${id}.pdf`, entityType: 'project', entityId: 'p1',
    domain: 'construction', category: 'drawings', cdeReadReach: 'tenant', ...extra,
  });
}

async function get(fileId: string): Promise<Reply> {
  return (await GET({} as never, segment(fileId) as never)) as unknown as Reply;
}

async function post(fileId: string, body: unknown): Promise<Reply> {
  return (await POST({ json: async () => body } as never, segment(fileId) as never)) as unknown as Reply;
}

beforeEach(() => {
  fake = new FakeFirestore();
  mockPromote.mockReset();
});

describe('GET /versions', () => {
  it('ξένος μισθωτής ⇒ 404, κανένα μαντείο ύπαρξης', async () => {
    seed('file_foreign', { companyId: 'c_beta' });
    expect((await get('file_foreign')).status).toBe(404);
  });

  it('η στοίβα: κεφαλή πρώτη, σημειωμένη ως τρέχουσα, κλειστό σχήμα σύρματος', async () => {
    seed('file_v1', { createdAt: '2026-09-01T00:00:00.000Z', supersededByFileId: 'file_v2', lifecycleState: 'archived' });
    seed('file_v2', { createdAt: '2026-09-02T00:00:00.000Z' });
    const reply = await get('file_v2');
    const body = await reply.json();

    expect(reply.status).toBe(200);
    expect(body.headFileId).toBe('file_v2');
    const versions = body.versions as Array<Record<string, unknown>>;
    expect(versions[0]).toMatchObject({ id: 'file_v2', isCurrent: true, phase: 'pre-cde' });
    expect(versions[0]).not.toHaveProperty('cdeReadReach');
    expect(versions.map(v => v.id)).toEqual(['file_v2', 'file_v1']);
  });
});

describe('POST /versions/promote', () => {
  it('χωρίς προϋπόθεση κεφαλής ⇒ 400, η υπηρεσία δεν καλείται', async () => {
    seed('file_v1');
    expect((await post('file_v1', {})).status).toBe(400);
    expect(mockPromote).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: 'refused', why: 'head-moved' }, 409],
    [{ kind: 'refused', why: 'predecessor-not-active' }, 409],
    [{ kind: 'refused', why: 'not-capable' }, 403],
    [{ kind: 'refused', why: 'not-found' }, 404],
    [{ kind: 'promoted', successorId: 's', previousHeadFileId: 'h' }, 200],
  ])('έκβαση %j ⇒ HTTP %i', async (outcome, status) => {
    seed('file_v1');
    mockPromote.mockResolvedValue(outcome);
    expect((await post('file_v1', { expectedHeadFileId: 'file_v2' })).status).toBe(status);
  });

  it('ξένο αρχείο ⇒ 404 ΠΡΙΝ φτάσει στην υπηρεσία', async () => {
    seed('file_foreign', { companyId: 'c_beta' });
    expect((await post('file_foreign', { expectedHeadFileId: 'x' })).status).toBe(404);
    expect(mockPromote).not.toHaveBeenCalled();
  });
});
