/**
 * 🔒 ANCHOR — every Admin-SDK read of `contact_links` pins the tenant (ADR-745 G6).
 *
 * Deliberately organised by *invariant* rather than by module. ADR-745 closed the
 * tenant hole on the client path and left three server call sites open, and the
 * reason it could: nothing anywhere asked the question "does this query name a
 * company?" of the collection as a whole. A per-module test would have been
 * written next to the code that was already correct.
 *
 * Why this cannot be a `firestore.rules` test: these call sites run on the
 * **Admin SDK, which bypasses the rules by design**. The 75 rules tests that pass
 * for `contact_links` say nothing about this path — the guard they exercise is
 * not in it. The query is the only gate, so the query is what is asserted here.
 *
 * ➕ Adding a server-side reader of `contact_links`? Add it below.
 *
 * @see lib/firestore/tenant-scoped-query — the SSoT these sites now go through
 * @see ADR-745 §9.2 — the measurement that found them
 */

import { deactivatePropertyContactLinks } from '@/app/api/properties/[id]/property-contact-links';
import { resolveWorkerForProject } from '@/services/attendance/attendance-server-service';
import { COLLECTIONS } from '@/config/firestore-collections';

const COMPANY = 'comp_alpha';
const OTHER_COMPANY = 'comp_beta';
const PROJECT_ID = 'prj_001';
const PROPERTY_ID = 'prop_001';

// ---------------------------------------------------------------------------
// Fake Firestore — records the filters, returns what the caller asks for
// ---------------------------------------------------------------------------

type WhereCall = readonly [field: string, op: string, value: unknown];

interface FakeDoc {
  readonly id: string;
  data(): Record<string, unknown>;
  readonly ref: { readonly id: string };
}

interface FakeQuery {
  readonly path: string;
  readonly calls: readonly WhereCall[];
  where(field: string, op: string, value: unknown): FakeQuery;
  select(): FakeQuery;
  get(): Promise<{ empty: boolean; size: number; docs: FakeDoc[] }>;
}

/** Every query the code under test built, in order, for post-hoc assertions. */
let issued: FakeQuery[] = [];
/** Docs each collection answers with, keyed by collection path. */
let stored: Record<string, FakeDoc[]> = {};

function makeDoc(id: string, data: Record<string, unknown>): FakeDoc {
  return { id, data: () => data, ref: { id } };
}

function makeQuery(path: string, calls: readonly WhereCall[] = []): FakeQuery {
  const query: FakeQuery = {
    path,
    calls,
    where: (field, op, value) => makeQuery(path, [...calls, [field, op, value]]),
    select: () => query,
    get: async () => {
      issued.push(query);
      const docs = stored[path] ?? [];
      return { empty: docs.length === 0, size: docs.length, docs };
    },
  };
  return query;
}

const batchUpdates: Array<{ id: string; patch: Record<string, unknown> }> = [];

function makeDb() {
  return {
    collection: (path: string) => makeQuery(path),
    batch: () => ({
      update: (ref: { id: string }, patch: Record<string, unknown>) => {
        batchUpdates.push({ id: ref.id, patch });
      },
      commit: async () => undefined,
    }),
  };
}

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => makeDb(),
  getAdminStorage: () => ({}),
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));

// Side modules pulled in by the units under test — irrelevant to the invariant.
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn() },
}));
jest.mock('@/services/attendance/qr-token-service', () => ({ validateQrToken: jest.fn() }));
jest.mock('@/services/attendance/geofence-service', () => ({ isWithinGeofence: jest.fn() }));
jest.mock('@/services/upload/utils/storage-path', () => ({ buildStoragePath: jest.fn() }));

/** The filters a query pinned, as `field=value`, ignoring order. */
function filtersOf(query: FakeQuery): string[] {
  return query.calls.map(([field, , value]) => `${field}=${String(value)}`);
}

function contactLinkQueries(): FakeQuery[] {
  return issued.filter((q) => q.path === COLLECTIONS.CONTACT_LINKS);
}

beforeEach(() => {
  issued = [];
  stored = {};
  batchUpdates.length = 0;
});

// ---------------------------------------------------------------------------

describe('the invariant', () => {
  it.each([
    [
      'deactivatePropertyContactLinks (WRITE — a cancellation in one company must not touch another)',
      async () => {
        await deactivatePropertyContactLinks(
          makeDb() as unknown as FirebaseFirestore.Firestore,
          PROPERTY_ID,
          COMPANY,
          'user_1',
        );
      },
    ],
    [
      'resolveWorkerForProject (READ — feeds ΑΜΚΑ → contactId identification)',
      async () => {
        await resolveWorkerForProject(PROJECT_ID, COMPANY, '12345678901');
      },
    ],
  ])('%s pins companyId on the wire', async (_label, run) => {
    await run();

    const queries = contactLinkQueries();
    expect(queries.length).toBeGreaterThan(0);

    for (const query of queries) {
      expect(filtersOf(query)).toContain(`companyId=${COMPANY}`);
    }
  });
});

describe('deactivatePropertyContactLinks', () => {
  it('deactivates only what the scoped query returned', async () => {
    stored[COLLECTIONS.CONTACT_LINKS] = [makeDoc('cl_mine', { companyId: COMPANY })];

    await deactivatePropertyContactLinks(
      makeDb() as unknown as FirebaseFirestore.Firestore,
      PROPERTY_ID,
      COMPANY,
      'user_1',
    );

    expect(batchUpdates).toHaveLength(1);
    expect(batchUpdates[0]).toMatchObject({ id: 'cl_mine', patch: { status: 'inactive' } });
  });

  it('still pins the property and the active status — the tenant filter is an addition, not a swap', async () => {
    await deactivatePropertyContactLinks(
      makeDb() as unknown as FirebaseFirestore.Firestore,
      PROPERTY_ID,
      COMPANY,
      'user_1',
    );

    expect(filtersOf(contactLinkQueries()[0])).toEqual(
      expect.arrayContaining([
        `companyId=${COMPANY}`,
        'targetEntityType=property',
        `targetEntityId=${PROPERTY_ID}`,
        'status=active',
      ]),
    );
  });

  it('scopes to the company it was given, not one baked in', async () => {
    await deactivatePropertyContactLinks(
      makeDb() as unknown as FirebaseFirestore.Firestore,
      PROPERTY_ID,
      OTHER_COMPANY,
      'user_1',
    );

    expect(filtersOf(contactLinkQueries()[0])).toContain(`companyId=${OTHER_COMPANY}`);
  });
});

describe('resolveWorkerForProject — the three breaks of ADR-745 §9.2', () => {
  it('filters on targetEntityId/targetEntityType, the fields the collection actually stores', async () => {
    await resolveWorkerForProject(PROJECT_ID, COMPANY, '12345678901');

    const filters = filtersOf(contactLinkQueries()[0]);
    expect(filters).toEqual(
      expect.arrayContaining([
        `companyId=${COMPANY}`,
        `targetEntityId=${PROJECT_ID}`,
        'targetEntityType=project',
      ]),
    );
    // The generic FIELDS pair is what made the dead query read as correct.
    expect(filters.some((f) => f.startsWith('entityId=') || f.startsWith('entityType='))).toBe(false);
  });

  it('reads sourceContactId off each link — `contactId` yielded undefined ids', async () => {
    stored[COLLECTIONS.CONTACT_LINKS] = [
      makeDoc('cl_1', { sourceContactId: 'cnt_777', companyId: COMPANY }),
    ];
    stored[COLLECTIONS.CONTACTS] = [];

    await resolveWorkerForProject(PROJECT_ID, COMPANY, '12345678901');

    const contactsQuery = issued.find((q) => q.path === COLLECTIONS.CONTACTS);
    expect(contactsQuery).toBeDefined();
    expect(contactsQuery!.calls).toEqual([['__name__', 'in', ['cnt_777']]]);
  });

  it('returns null without reaching contacts when no link matches', async () => {
    const result = await resolveWorkerForProject(PROJECT_ID, COMPANY, '12345678901');

    expect(result).toBeNull();
    expect(issued.some((q) => q.path === COLLECTIONS.CONTACTS)).toBe(false);
  });
});
