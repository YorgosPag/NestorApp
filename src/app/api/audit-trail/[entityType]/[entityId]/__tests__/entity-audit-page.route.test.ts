/**
 * @jest-environment node
 *
 * **Η ΑΓΚΥΡΑ ΤΗΣ «ΕΠΟΜΕΝΗΣ ΣΕΛΙΔΑΣ» ΤΟΥ ΙΣΤΟΡΙΚΟΥ ΟΝΤΟΤΗΤΑΣ** — `GET /api/audit-trail/[entityType]/[entityId]`
 * @related hooks/audit/useAuditFeed.ts (η πρώτη άγκυρα = η παλαιότερη γραμμή της ζωντανής συνδρομής)
 *
 * 🔴 Ως 2026-10-30: άγκυρα που δεν υπάρχει ⇒ `if (cursorDoc.exists)` έπεφτε ⇒ η ΠΡΩΤΗ σελίδα σιωπηλά (διπλές
 *    γραμμές)· άγκυρα άλλης οντότητας ⇒ θέση σε ξένη σειρά· `limit=abc` ⇒ `NaN` ⇒ 500. Τώρα 400.
 * 🔑 Ο παρονομαστής: έγκυρη άγκυρα ⇒ `startAfter(snapshot)` (ο Firestore βάζει σιωπηρά το `__name__` ⇒ ισοπαλίες σωστές).
 */

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(handler: T) => handler,
}));

jest.mock('@/lib/auth/personal-scope-middleware', () => ({
  withPersonalOrOrgAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) =>
      callback(request, { scope: 'organization', ctx: { uid: 'u_1', companyId: 'comp_1' } }),
}));

jest.mock('@/lib/api/ApiErrorHandler', () => {
  const { ApiError } = jest.requireActual('@/lib/api/api-error-types');
  return {
    ApiError,
    apiSuccess: (data: unknown) => ({ status: 200, body: data }),
    apiErrorHandler: {
      handleError: (error: { statusCode?: number; errorCode?: string; message: string }) => ({
        status: error.statusCode ?? 500,
        body: { errorCode: error.errorCode, error: error.message },
      }),
    },
  };
});

jest.mock('@/lib/audit/audit-entry-from-document', () => ({
  entityAuditEntriesFromData: (docs: { id: string }[]) => docs.map((doc) => ({ id: doc.id })),
}));

// ── Ψεύτικος Firestore ───────────────────────────────────────────────────────

var anchors: Record<string, Record<string, unknown> | undefined> = {};
var recorded: { startAfter: unknown[] | null; limit: number | null; reads: number } = { startAfter: null, limit: null, reads: 0 };

function fakeQuery(): unknown {
  const query = {
    where: () => query,
    orderBy: () => query,
    limit: (n: number) => { recorded.limit = n; return query; },
    startAfter: (...values: unknown[]) => { recorded.startAfter = values; return query; },
    get: async () => { recorded.reads += 1; return { docs: [] }; },
  };
  return query;
}

jest.mock('@/lib/api/admin-db', () => ({
  requireAdminFirestore: () => ({
    collection: () => ({
      ...(fakeQuery() as object),
      doc: (id: string) => ({
        get: async () => ({ id, exists: anchors[id] !== undefined, data: () => anchors[id] }),
      }),
    }),
  }),
}));

import { AUDIT_ENTITY_TYPES } from '@/config/audit-entity-collection-map';
import { GET } from '../route';

const TYPE = [...AUDIT_ENTITY_TYPES][0];

async function call(query: Record<string, string>, entityId = 'e_1'): Promise<{ status: number; body: Record<string, unknown> }> {
  const url = `http://localhost/api/audit-trail/${TYPE}/${entityId}?${new URLSearchParams(query).toString()}`;
  const handler = GET as unknown as (req: unknown) => Promise<{ status: number; body: Record<string, unknown> }>;
  return handler({ url, nextUrl: new URL(url) });
}

beforeEach(() => {
  recorded = { startAfter: null, limit: null, reads: 0 };
  anchors = {
    mine: { entityType: TYPE, entityId: 'e_1', companyId: 'comp_1' },
    otherEntity: { entityType: TYPE, entityId: 'e_2', companyId: 'comp_1' },
    otherCompany: { entityType: TYPE, entityId: 'e_1', companyId: 'comp_2' },
  };
});

describe('GET /api/audit-trail/[entityType]/[entityId] — άγκυρα επόμενης σελίδας', () => {
  it('Ο-1 ο παρονομαστής: έγκυρη άγκυρα ⇒ `startAfter(snapshot)` + limit + 1', async () => {
    const { status } = await call({ startAfter: 'mine', limit: '5' });
    expect(status).toBe(200);
    expect(recorded.startAfter).toHaveLength(1);
    expect((recorded.startAfter![0] as { id: string }).id).toBe('mine');
    expect(recorded.limit).toBe(6);
  });

  it.each([
    ['ανύπαρκτη (σβήστηκε)', 'gone'],
    ['άλλης οντότητας', 'otherEntity'],
    ['άλλης εταιρείας', 'otherCompany'],
  ])('🔴 Ο-2 άγκυρα %s ⇒ 400 INVALID_PAGE_TOKEN, ΟΧΙ η πρώτη σελίδα σιωπηλά', async (_label, anchor) => {
    const { status, body } = await call({ startAfter: anchor });
    expect(status).toBe(400);
    expect(body.errorCode).toBe('INVALID_PAGE_TOKEN');
    expect(recorded.reads).toBe(0);
  });

  it.each([['abc'], ['0'], ['101'], ['2.5']])('Ο-3 limit=%s ⇒ 400 χωρίς ανάγνωση (ήταν NaN ⇒ 500)', async (limit) => {
    const { status } = await call({ limit });
    expect(status).toBe(400);
    expect(recorded.reads).toBe(0);
  });

  it('Ο-4 χωρίς άγκυρα ⇒ η πρώτη σελίδα, προεπιλογή 20 (+1)', async () => {
    const { status } = await call({});
    expect(status).toBe(200);
    expect(recorded.startAfter).toBeNull();
    expect(recorded.limit).toBe(21);
  });
});
