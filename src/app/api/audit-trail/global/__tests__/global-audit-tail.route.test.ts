/**
 * @jest-environment node
 *
 * **ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΟΥΡΑΣ ΤΟΥ ΙΣΤΟΡΙΚΟΥ ΟΛΗΣ ΤΗΣ ΕΤΑΙΡΕΙΑΣ** — `GET /api/audit-trail/global`
 * @related hooks/useGlobalAuditTrail.ts (άγκυρα = id της παλαιότερης γραμμής του ζωντανού παραθύρου)
 *
 * Ο ψεύτικος Firestore ΕΚΤΕΛΕΙ `where(companyId)` · `orderBy(timestamp ↓)` (+ σιωπηρό `__name__ ↓`) ·
 * `startAfter(snapshot)` · `limit`.
 *
 * 🔴 Ως 2026-10-30: `.limit(500)` ΧΩΡΙΣ `orderBy` (500 τυχαίες, όχι οι νεότερες) · `offset` ενώ ο πελάτης έστελνε id ⇒
 *    `parseInt` = NaN ⇒ κενή σελίδα + `hasMore: false` ⇒ η ουρά δεν φαινόταν ΠΟΤΕ.
 */

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(handler: T) => handler,
}));

jest.mock('@/lib/auth', () => ({
  // ΠΙΣΤΟ mock: τιμά το `requiredGlobalRoles` και χαρτογραφεί το `ApiError` όπως το πραγματικό `withAuth`.
  withAuth: (
    callback: (...args: unknown[]) => Promise<unknown>,
    options?: { requiredGlobalRoles?: readonly string[] },
  ) => async (request: unknown) => {
    const ctx = { uid: 'u_admin', companyId: 'comp_1', globalRole: 'company_admin' };
    if (options?.requiredGlobalRoles && !options.requiredGlobalRoles.includes(ctx.globalRole)) {
      return { status: 403, body: { error: 'Insufficient role' } };
    }
    try {
      return await callback(request, ctx, {});
    } catch (error) {
      const e = error as { statusCode?: number; errorCode?: string; message: string };
      return { status: e.statusCode ?? 500, body: { errorCode: e.errorCode, error: e.message } };
    }
  },
}));

jest.mock('@/lib/api/ApiErrorHandler', () => {
  const { ApiError } = jest.requireActual('@/lib/api/api-error-types');
  return { ApiError, apiSuccess: (data: unknown) => ({ status: 200, body: data }) };
});

// Το σύνορο ανάγνωσης έχει δικές του άγκυρες· εδώ: id + πεδία + ώρα σε ISO.
jest.mock('@/lib/audit/audit-entry-from-document', () => ({
  entityAuditEntriesFromData: (docs: { id: string; data: Record<string, unknown> }[]) =>
    docs.map(({ id, data }) => ({ ...data, id, timestamp: new Date(data.timestamp as number).toISOString() })),
}));

// ── Ψεύτικος Firestore ───────────────────────────────────────────────────────

interface Row { id: string; data: Record<string, unknown> }

var store: Row[] = [];
var queryReads = 0;

function snapshotOf(row: Row | undefined, id: string) {
  return {
    id,
    exists: row !== undefined,
    get: (field: string) => row?.data[field],
    data: () => row?.data,
  };
}

/** (timestamp ↓, __name__ ↓) */
const cmp = (a: Row, b: Row) =>
  (b.data.timestamp as number) - (a.data.timestamp as number) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

function fakeQuery(state: { company: unknown; ordered: boolean; after: Row | null; limit: number | null }): unknown {
  const next = (patch: Partial<typeof state>) => fakeQuery({ ...state, ...patch });
  return {
    where: (_field: string, _op: string, value: unknown) => next({ company: value }),
    orderBy: () => next({ ordered: true }),
    startAfter: (snap: { id: string; get: (f: string) => unknown }) =>
      next({ after: { id: snap.id, data: { timestamp: snap.get('timestamp') } } }),
    limit: (n: number) => next({ limit: n }),
    get: async () => {
      queryReads += 1;
      let rows = store.filter((row) => row.data.companyId === state.company);
      // Χωρίς orderBy ο Firestore επιστρέφει σε σειρά id — το παλιό λάθος.
      rows = state.ordered ? [...rows].sort(cmp) : [...rows].sort((a, b) => (a.id < b.id ? -1 : 1));
      if (state.after) rows = rows.filter((row) => cmp(row, state.after!) > 0);
      const docs = rows.slice(0, state.limit ?? rows.length).map((row) => ({
        ...snapshotOf(row, row.id),
        data: () => row.data,
      }));
      return { docs };
    },
  };
}

jest.mock('@/lib/api/admin-db', () => ({
  requireAdminFirestore: () => ({
    collection: () => ({
      ...(fakeQuery({ company: null, ordered: false, after: null, limit: null }) as object),
      doc: (id: string) => ({ get: async () => snapshotOf(store.find((row) => row.id === id), id) }),
    }),
  }),
}));

import { GET } from '../route';

// ── Βοηθητικά ────────────────────────────────────────────────────────────────

interface Body { entries?: { id: string }[]; hasMore?: boolean; nextCursor?: string; errorCode?: string }

async function call(query: Record<string, string>): Promise<{ status: number; body: Body }> {
  const url = `http://localhost/api/audit-trail/global?${new URLSearchParams(query).toString()}`;
  const handler = GET as unknown as (req: unknown) => Promise<{ status: number; body: Body }>;
  return handler({ url });
}

const T0 = Date.parse('2026-10-30T12:00:00.000Z');

/** id ΑΝΤΙΣΤΡΟΦΑ της χρονικής σειράς — ώστε «σειρά id» ≠ «νεότερα πρώτα». */
function seed(count: number, extra: (i: number) => Record<string, unknown> = () => ({})): string[] {
  store = Array.from({ length: count }, (_, i) => ({
    id: `r${String(i).padStart(4, '0')}`,
    data: {
      companyId: 'comp_1', entityType: 'contact', entityId: `c_${i}`, action: 'updated',
      performedBy: 'uid_x', performedByName: 'X', timestamp: T0 - (count - i) * 60_000, ...extra(i),
    },
  }));
  store.push({ id: 'foreign', data: { companyId: 'comp_2', timestamp: T0, entityType: 'contact', action: 'updated' } });
  // Νεότερα πρώτα = id φθίνοντα.
  return store.filter((r) => r.data.companyId === 'comp_1').sort(cmp).map((r) => r.id);
}

async function readAll(query: Record<string, string>, first: string | null = null): Promise<string[]> {
  const seen: string[] = [];
  let anchor = first;
  // Όριο ασφαλείας του βρόχου (όχι του διακομιστή): μέγεθος 1 × 250 γραμμές = 250 σελίδες.
  for (let pages = 0; pages < 400; pages += 1) {
    const { status, body } = await call({ ...query, ...(anchor ? { startAfter: anchor } : {}) });
    expect(status).toBe(200);
    seen.push(...body.entries!.map((e) => e.id));
    if (!body.hasMore) break;
    anchor = body.nextCursor!;
  }
  return seen;
}

beforeEach(() => {
  queryReads = 0;
});

// ── Άγκυρες ──────────────────────────────────────────────────────────────────

describe('GET /api/audit-trail/global — ουρά με άγκυρα', () => {
  it('🔴 Γ-1 νεότερα πρώτα (orderBy timestamp), όχι σειρά id — και καμία ξένη εταιρεία', async () => {
    const expected = seed(5);
    const { body } = await call({ limit: '5' });
    expect(body.entries!.map((e) => e.id)).toEqual(expected);
  });

  it.each([1, 7, 30, 100])('Γ-2 όλες οι σελίδες μεγέθους %i (250 γραμμές, >2 παρτίδες) = όλες, μία φορά η καθεμία', async (size) => {
    const expected = seed(250);
    expect(await readAll({ limit: String(size) })).toEqual(expected);
  });

  it('🔴 Γ-3 άγκυρα = id της παλαιότερης γραμμής του ζωντανού παραθύρου ⇒ ΣΥΝΕΧΕΙΑ (ήταν offset=NaN ⇒ κενό)', async () => {
    const expected = seed(80);
    const liveWindow = expected.slice(0, 30);
    const tail = await readAll({ limit: '30' }, liveWindow[liveWindow.length - 1]);
    expect(tail).toEqual(expected.slice(30));
  });

  it('Γ-4 `hasMore` ΜΕΤΡΙΕΤΑΙ: σύνολο ακριβώς = limit ⇒ όχι ψεύτικη επόμενη σελίδα', async () => {
    seed(20);
    const { body } = await call({ limit: '20' });
    expect(body.entries).toHaveLength(20);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeUndefined();
  });

  it('Γ-5 αραιό φίλτρο πέρα από το όριο σάρωσης ⇒ μικρότερη σελίδα με hasMore, και η συνέχεια τα βρίσκει ΟΛΑ', async () => {
    // 1 στις 400 είναι «created» ⇒ τα ταιριαστά απέχουν περισσότερο από μία σάρωση (1000).
    const ids = seed(2500, (i) => ({ action: i % 400 === 0 ? 'created' : 'updated' }));
    const expected = ids.filter((id) => Number(id.slice(1)) % 400 === 0);
    expect(await readAll({ limit: '2', action: 'created' })).toEqual(expected);
  });

  it('Γ-6 φίλτρο `performedBy` με ΟΝΟΜΑ (ελεύθερο κείμενο) — ίδιος κριτής με το ζωντανό παράθυρο', async () => {
    seed(10, (i) => (i === 3 ? { performedBy: 'uid_m', performedByName: 'Μαρία' } : {}));
    const { body } = await call({ performedBy: 'μαρ' });
    expect(body.entries!.map((e) => e.id)).toEqual(['r0003']);
  });

  it.each([
    ['ανύπαρκτη', 'gone'],
    ['άλλης εταιρείας', 'foreign'],
  ])('🔴 Γ-7 άγκυρα %s ⇒ 400 INVALID_PAGE_TOKEN χωρίς σάρωση', async (_label, anchor) => {
    seed(5);
    const { status, body } = await call({ startAfter: anchor });
    expect(status).toBe(400);
    expect(body.errorCode).toBe('INVALID_PAGE_TOKEN');
    expect(queryReads).toBe(0);
  });

  it.each([
    [{ limit: 'abc' }], [{ limit: '0' }], [{ limit: '101' }],
    [{ fromDate: 'χθες' }], [{ toDate: '2026-02-30' }], [{ fromDate: '2026-10-30', toDate: '2026-10-01' }],
    [{ action: 'hacked' }], [{ entityType: 'unicorn' }],
  ])('Γ-8 άκυρη παράμετρος %j ⇒ 400 χωρίς ανάγνωση', async (query) => {
    seed(5);
    const { status } = await call(query as Record<string, string>);
    expect(status).toBe(400);
    expect(queryReads).toBe(0);
  });
});
