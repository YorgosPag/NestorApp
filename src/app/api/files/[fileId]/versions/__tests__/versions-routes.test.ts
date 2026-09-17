/**
 * @jest-environment node
 *
 * @fileoverview Οι διαδρομές της στοίβας εκδόσεων (ADR-862 Φ0 · **ADR-866 2β.3β**).
 * @related app/api/files/[fileId]/versions · app/api/files/[fileId]/versions/promote
 *
 * ⚠️ Ο PEP (`fileResource`/`personalFileResource` + `containerVisibilityRefusal`) **ΔΕΝ** γίνεται
 * mock στη `GET`: αν αφαιρεθεί, ξένο αρχείο ή κρυφή έκδοση πρέπει να κοκκινίσει. Στην `POST` mock
 * μόνο η υπηρεσία, γιατί εδώ κρίνεται η **αντιστοίχιση** έκβασης → HTTP (άγκυρα Α24).
 *
 * 🗂️ **ΔΥΟ ΔΙΑΜΕΡΙΣΜΑΤΑ** (ADR-866 §2.6.10): η πόρτα `withFileCustodyAuth` διαβάζει `?custody=`.
 * Οι δύο ταυτότητες είναι **διαφορετικοί άνθρωποι** επίτηδες — έτσι ένα διαμέρισμα που διαβάζει
 * κατά λάθος το άλλο **δεν μπορεί** να βγει πράσινο από σύμπτωση ταυτότητας.
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

const COMPANY_CALLER = {
  uid: 'u_alpha', companyId: 'c_alpha', globalRole: 'company_admin', permissions: [], isAuthenticated: true,
};
/** 🔑 **Άλλος άνθρωπος από τον εταιρικό καλούντα** — δες την κεφαλή. */
const PERSON = 'u_person';

jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segment: unknown) => callback(request, COMPANY_CALLER, undefined, segment),
}));

jest.mock('@/lib/auth/personal-scope-middleware', () => ({
  withPersonalOrOrgAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segment: unknown) => callback(request, { ctx: { uid: PERSON } }, segment),
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

/** Το αίτημα όπως το βλέπει η πόρτα: **μόνο** το `?custody=` την ενδιαφέρει. */
const requestWith = (custody?: string, body?: unknown) => ({
  nextUrl: { searchParams: new URLSearchParams(custody === undefined ? '' : `custody=${custody}`) },
  json: async () => body,
});

const BASE = {
  status: 'ready', lifecycleState: 'active', isDeleted: false,
  entityType: 'project', entityId: 'p1', domain: 'construction', category: 'drawings',
} as const;

function seed(id: string, extra: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.FILES, id, {
    ...BASE, id, companyId: 'c_alpha', createdBy: 'u_alpha',
    displayName: id, originalFilename: `${id}.pdf`, ext: 'pdf', contentType: 'application/pdf',
    storagePath: `companies/c_alpha/files/${id}.pdf`, cdeReadReach: 'tenant', ...extra,
  });
}

/** Προσωπικό αρχείο: **κανένα** `companyId`, **κανένα** πεδίο CDE, ρίζα `people/`. */
function seedPersonal(id: string, extra: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.FILES_PERSONAL, id, {
    ...BASE, id, userId: PERSON, createdBy: PERSON,
    displayName: id, originalFilename: `${id}.pdf`, ext: 'pdf', contentType: 'application/pdf',
    storagePath: `people/${PERSON}/files/${id}.pdf`, ...extra,
  });
}

async function get(fileId: string, custody?: string): Promise<Reply> {
  return (await GET(requestWith(custody) as never, segment(fileId) as never)) as unknown as Reply;
}

async function post(fileId: string, body: unknown, custody?: string): Promise<Reply> {
  return (await POST(requestWith(custody, body) as never, segment(fileId) as never)) as unknown as Reply;
}

beforeEach(() => {
  fake = new FakeFirestore();
  mockPromote.mockReset();
});

describe('GET /versions — εταιρικό διαμέρισμα (αμετάβλητο)', () => {
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

  it('🔑 απουσία `?custody=` ⇒ **εταιρεία** — μηδέν αλλαγή για κάθε υπάρχοντα καλούντα', async () => {
    seed('file_v1', { createdAt: '2026-09-01T00:00:00.000Z' });
    expect((await get('file_v1')).status).toBe(200);
    expect((await get('file_v1', 'company')).status).toBe(200);
  });
});

describe('GET /versions — προσωπικό διαμέρισμα (ADR-866 Ε-Φ0-1)', () => {
  it('🔑 ο κάτοχος βλέπει τη ΔΙΚΗ του στοίβα — χωρίς καμία φάση CDE', async () => {
    seedPersonal('pf_v1', { createdAt: '2026-09-01T00:00:00.000Z', supersededByFileId: 'pf_v2', lifecycleState: 'archived' });
    seedPersonal('pf_v2', { createdAt: '2026-09-02T00:00:00.000Z' });

    const reply = await get('pf_v2', 'personal');
    const body = await reply.json();

    expect(reply.status).toBe(200);
    expect(body.headFileId).toBe('pf_v2');
    const versions = body.versions as Array<Record<string, unknown>>;
    expect(versions.map(v => v.id)).toEqual(['pf_v2', 'pf_v1']);
    // Κάθε έκδοση μένει `pre-cde`: προσωπικό αρχείο δεν αποκτά ΠΟΤΕ φάση.
    expect(versions.every(v => v.phase === 'pre-cde')).toBe(true);
  });

  it('🔴 ΞΕΝΟΣ άνθρωπος ⇒ 404 — ίδιο κείμενο με την απουσία', async () => {
    seedPersonal('pf_other', { userId: 'u_someone_else', createdBy: 'u_someone_else' });
    expect((await get('pf_other', 'personal')).status).toBe(404);
  });

  it('🔴 εταιρικό αρχείο ΔΕΝ διαβάζεται από την προσωπική πόρτα (και αντίστροφα)', async () => {
    seed('file_v1');
    seedPersonal('pf_v1');
    expect((await get('file_v1', 'personal')).status).toBe(404);
    expect((await get('pf_v1', 'company')).status).toBe(404);
  });

  it('🔴 άγνωστο `?custody=` ⇒ **400**, ποτέ «μάντεψε εταιρεία»', async () => {
    seed('file_v1');
    expect((await get('file_v1', 'tenant')).status).toBe(400);
    expect((await get('file_v1', '')).status).toBe(400);
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

  it('🔑 προσωπικό: ο δράστης φτάνει στην υπηρεσία με **κάτοχο άνθρωπο**, ποτέ εταιρεία', async () => {
    seedPersonal('pf_v1');
    mockPromote.mockResolvedValue({ kind: 'promoted', successorId: 's', previousHeadFileId: 'h' });

    expect((await post('pf_v1', { expectedHeadFileId: 'pf_v2' }, 'personal')).status).toBe(200);
    expect(mockPromote).toHaveBeenCalledWith(expect.objectContaining({
      sourceFileId: 'pf_v1',
      actor: { uid: PERSON, custody: { userId: PERSON } },
    }));
  });

  it('🔴 ΞΕΝΟ προσωπικό αρχείο ⇒ 404 ΠΡΙΝ φτάσει στην υπηρεσία', async () => {
    seedPersonal('pf_other', { userId: 'u_someone_else', createdBy: 'u_someone_else' });
    expect((await post('pf_other', { expectedHeadFileId: 'x' }, 'personal')).status).toBe(404);
    expect(mockPromote).not.toHaveBeenCalled();
  });
});
