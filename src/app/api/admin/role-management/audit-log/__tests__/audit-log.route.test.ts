/**
 * @jest-environment node
 *
 * **ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΣΕΛΙΔΑΣ ΤΟΥ ΙΣΤΟΡΙΚΟΥ ΡΟΛΩΝ** — `GET /api/admin/role-management/audit-log`
 * @related lib/admin-keyset-page.ts (kind: 'timestamp') · pending «Δρομέας keyset»
 *
 * Ο ψεύτικος Firestore ΕΚΤΕΛΕΙ `where` (== / >= / <) · `orderBy(timestamp, __name__)` · `startAfter` · `limit`, ώστε
 * το «διάβασε όλες τις σελίδες» να αποδεικνύει ότι καμία γραμμή δεν χάνεται ή διπλασιάζεται.
 *
 * 🔴 Ως 2026-10-30: δρομέας = id + `doc(cursor).get()` ⇒ σβησμένη γραμμή-δρομέας (TTL) ⇒ ΠΡΩΤΗ σελίδα σιωπηλά.
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

jest.mock('@/lib/auth', () => ({
  // ΠΙΣΤΟ mock: τιμά το `requiredGlobalRoles` της δήλωσης (ADR-801 §2.10).
  withAuth: (
    callback: (...args: unknown[]) => Promise<unknown>,
    options?: { requiredGlobalRoles?: readonly string[] },
  ) => async (request: unknown) => {
    const ctx = { uid: 'u_admin', companyId: 'comp_1', globalRole: 'company_admin' };
    if (options?.requiredGlobalRoles && !options.requiredGlobalRoles.includes(ctx.globalRole)) {
      return { status: 403, json: async () => ({ error: 'Insufficient role' }) };
    }
    return callback(request, ctx, {});
  },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }),
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldPath: { documentId: () => '__name__' },
  Timestamp: class {
    seconds: number;
    nanoseconds: number;
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
  },
}));

// ── Ψεύτικος Firestore ───────────────────────────────────────────────────────

interface FakeTs { seconds: number; nanoseconds: number; toDate: () => Date }

const ts = (seconds: number, nanoseconds = 0): FakeTs => ({
  seconds,
  nanoseconds,
  toDate: () => new Date(seconds * 1000 + Math.floor(nanoseconds / 1e6)),
});

interface Row { id: string; data: Record<string, unknown> }

var store: Row[] = [];
var reads = 0;
var wheres: [string, string, unknown][] = [];

function tsKey(value: unknown): number {
  const v = value as { seconds: number; nanoseconds: number };
  return v.seconds * 1e9 + v.nanoseconds;
}

function fakeQuery(state: {
  filters: [string, string, unknown][];
  order: [string, string][];
  after: unknown[] | null;
  limit: number | null;
}): unknown {
  const next = (patch: Partial<typeof state>) => fakeQuery({ ...state, ...patch });
  return {
    where: (field: string, op: string, value: unknown) => {
      wheres.push([field, op, value]);
      return next({ filters: [...state.filters, [field, op, value]] });
    },
    orderBy: (field: string, direction: string) => next({ order: [...state.order, [String(field), direction]] }),
    startAfter: (...values: unknown[]) => next({ after: values }),
    limit: (n: number) => next({ limit: n }),
    get: async () => {
      reads += 1;
      let rows = store.filter((row) =>
        state.filters.every(([field, op, value]) => {
          const actual = row.data[field];
          if (op === '==') return actual === value;
          const ms = tsKey(actual) / 1e6;
          if (op === '>=') return ms >= (value as Date).getTime();
          if (op === '<') return ms < (value as Date).getTime();
          throw new Error(`unexpected op ${op}`);
        }),
      );
      // (timestamp ↓, __name__ ↓)
      const cmp = (a: Row, b: Row) => tsKey(b.data.timestamp) - tsKey(a.data.timestamp) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
      rows = [...rows].sort(cmp);
      if (state.after) {
        const [value, id] = state.after as [unknown, string];
        const pivot: Row = { id, data: { timestamp: value } };
        rows = rows.filter((row) => cmp(row, pivot) > 0);
      }
      const docs = rows.slice(0, state.limit ?? rows.length).map((row) => ({ id: row.id, data: () => row.data }));
      return { docs };
    },
  };
}

const emptyUsers = { where: () => ({ select: () => ({ get: async () => ({ docs: [] }) }) }) };

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: (name: string) =>
      name === 'users'
        ? emptyUsers
        : { doc: () => ({ collection: () => fakeQuery({ filters: [], order: [], after: null, limit: null }) }) },
  }),
}));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { COMPANIES: 'companies', USERS: 'users' },
  SUBCOLLECTIONS: { COMPANY_AUDIT_LOGS: 'audit_logs' },
}));

import { GET } from '../route';

// ── Βοηθητικά ────────────────────────────────────────────────────────────────

interface Body {
  success: boolean;
  code?: string;
  data?: { entries: { id: string }[]; nextCursor: string | null };
}

async function call(query: Record<string, string>): Promise<{ status: number; body: Body }> {
  const url = `http://localhost/api/admin/role-management/audit-log?${new URLSearchParams(query).toString()}`;
  const handler = GET as unknown as (req: unknown) => Promise<{ status: number; json: () => Promise<Body> }>;
  const res = await handler({ url });
  return { status: res.status, body: await res.json() };
}

const entry = (id: string, timestamp: FakeTs, extra: Record<string, unknown> = {}): Row => ({
  id,
  data: { action: 'role_changed', actorId: 'u_a', targetId: 'u_t', targetType: 'user', timestamp, ...extra },
});

beforeEach(() => {
  reads = 0;
  wheres = [];
  // 6 γραμμές, τρεις με το ΙΔΙΟ timestamp — ώστε το όριο σελίδας να πέσει μέσα στην ισοπαλία.
  store = [
    entry('a1', ts(1_800_000_300)),
    entry('a2', ts(1_800_000_200)),
    entry('a3', ts(1_800_000_200)),
    entry('a4', ts(1_800_000_200)),
    entry('a5', ts(1_800_000_100)),
    entry('a6', ts(1_800_000_000)),
  ];
});

async function readAll(pageSize: number, query: Record<string, string> = {}): Promise<string[]> {
  const seen: string[] = [];
  let cursor: string | null = null;
  for (let pages = 0; pages < 20; pages += 1) {
    const { status, body } = await call({ ...query, limit: String(pageSize), ...(cursor ? { cursor } : {}) });
    expect(status).toBe(200);
    seen.push(...body.data!.entries.map((e) => e.id));
    cursor = body.data!.nextCursor;
    if (cursor === null) break;
  }
  return seen;
}

// ── Άγκυρες ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/role-management/audit-log — σελίδα keyset', () => {
  it.each([1, 2, 3, 6])('Α-1 όλες οι σελίδες μεγέθους %i = όλες οι γραμμές, μία φορά η καθεμία (και σε ισοπαλία)', async (size) => {
    expect(await readAll(size)).toEqual(['a1', 'a4', 'a3', 'a2', 'a5', 'a6']);
  });

  it('🔴 Α-2 σβησμένη γραμμή-δρομέας (TTL) ⇒ η επόμενη σελίδα ΣΥΝΕΧΙΖΕΙ, δεν γυρίζει στην πρώτη', async () => {
    const first = await call({ limit: '2' });
    expect(first.body.data!.entries.map((e) => e.id)).toEqual(['a1', 'a4']);
    store = store.filter((row) => row.id !== 'a4');
    const second = await call({ limit: '2', cursor: first.body.data!.nextCursor! });
    expect(second.body.data!.entries.map((e) => e.id)).toEqual(['a3', 'a2']);
  });

  it('Α-3 το `id` κάθε γραμμής είναι το id του εγγράφου (δεν αποθηκεύεται μέσα του)', async () => {
    const { body } = await call({ limit: '1' });
    expect(body.data!.entries[0].id).toBe('a1');
  });

  it.each([['abc'], ['0'], ['101'], ['-1'], ['2.5']])('Α-4 limit=%s ⇒ 400 χωρίς ανάγνωση (ήταν NaN ⇒ 500)', async (limit) => {
    const { status, body } = await call({ limit });
    expect(status).toBe(400);
    expect(body.code).toBe('INVALID_ARGUMENT');
    expect(reads).toBe(0);
  });

  it.each([
    [{ dateFrom: 'χθες' }],
    [{ dateTo: '2026-02-30' }],
    [{ dateFrom: '2026-10-30', dateTo: '2026-10-01' }],
  ])('Α-5 άκυρη ημερομηνία %j ⇒ 400 (ήταν: το φίλτρο αγνοούνταν σιωπηλά)', async (query) => {
    const { status } = await call(query as Record<string, string>);
    expect(status).toBe(400);
    expect(reads).toBe(0);
  });

  it('Α-6 δρομέας άλλων φίλτρων ⇒ 400 INVALID_PAGE_TOKEN (ποτέ σελίδα του λάθος συνόλου)', async () => {
    const first = await call({ limit: '2' });
    const { status, body } = await call({ limit: '2', actorId: 'u_a', cursor: first.body.data!.nextCursor! });
    expect(status).toBe(400);
    expect(body.code).toBe('INVALID_PAGE_TOKEN');
    expect(reads).toBe(1);
  });

  it('Α-7 `dateTo` = ως την ΑΡΧΗ της επόμενης ημέρας, αποκλειστικά (η 00:00:00 της επόμενης ΔΕΝ χωρά)', async () => {
    const dayStart = Date.parse('2026-10-30T00:00:00.000Z') / 1000;
    store = [
      entry('in', ts(dayStart + 86_399, 999_000_000)),
      entry('out', ts(dayStart + 86_400)),
    ];
    expect(await readAll(10, { dateFrom: '2026-10-30', dateTo: '2026-10-30' })).toEqual(['in']);
    expect(wheres).toContainEqual(['timestamp', '<', new Date('2026-10-31T00:00:00.000Z')]);
    expect(wheres).toContainEqual(['timestamp', '>=', new Date('2026-10-30T00:00:00.000Z')]);
  });

  it('Α-8 τα φίλτρα ισότητας φτάνουν στον Firestore όπως πριν· `action=all` δεν φιλτράρει', async () => {
    store = [entry('x', ts(1_800_000_000), { action: 'user_invited' }), entry('y', ts(1_800_000_001))];
    expect(await readAll(10, { action: 'user_invited' })).toEqual(['x']);
    wheres = [];
    expect(await readAll(10, { action: 'all' })).toEqual(['y', 'x']);
    expect(wheres).toEqual([]);
  });
});
