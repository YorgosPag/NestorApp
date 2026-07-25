/**
 * Tenant-scoped query — the *applying* half of tenant isolation (ADR-702).
 *
 * The resolver is tested next door in `lib/auth/__tests__/tenant-scope.test.ts`.
 * What matters here is narrower and, on the evidence of the buildings endpoint,
 * more easily lost: that a resolved scope actually reaches Firestore as a
 * `where(companyId, ==, …)`, and that the ONLY way to end up with no filter is
 * the branch a bypass role explicitly earned.
 */

import { scopeQueryToTenant, tenantScopedCollection, tenantScopeCompanyId } from '../tenant-scoped-query';
import type { TenantScope, TenantListScope } from '@/lib/auth/tenant-scope';

const COMPANY = 'comp_001';

/** Records every `.where()` the code under test applies. */
interface FakeQuery {
  readonly calls: Array<[string, string, unknown]>;
  where(field: string, op: string, value: unknown): FakeQuery;
}

function makeQuery(calls: Array<[string, string, unknown]> = []): FakeQuery {
  return {
    calls,
    where(field, op, value) {
      return makeQuery([...calls, [field, op, value]]);
    },
  };
}

const collectionMock = jest.fn((_path: string) => makeQuery());

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ collection: (path: string) => collectionMock(path) }),
}));

const COMPANY_SCOPE: TenantScope = { companyId: COMPANY, isSuperAdmin: false, isCrossTenant: false };
const LIST_COMPANY_SCOPE: TenantListScope = {
  kind: 'company',
  companyId: COMPANY,
  isSuperAdmin: true,
  isCrossTenant: true,
};
const ALL_TENANTS_SCOPE: TenantListScope = { kind: 'all-tenants', isSuperAdmin: true, isCrossTenant: true };

/** The fake query is structurally compatible; Firestore's type is not constructible in a unit test. */
function asQuery(query: FakeQuery): FirebaseFirestore.Query {
  return query as unknown as FirebaseFirestore.Query;
}

function callsOf(query: FirebaseFirestore.Query): Array<[string, string, unknown]> {
  return (query as unknown as FakeQuery).calls;
}

beforeEach(() => {
  collectionMock.mockClear();
});

describe('tenantScopeCompanyId', () => {
  it('reads the company off a strict scope', () => {
    expect(tenantScopeCompanyId(COMPANY_SCOPE)).toBe(COMPANY);
  });

  it('reads the company off a narrowed list scope', () => {
    expect(tenantScopeCompanyId(LIST_COMPANY_SCOPE)).toBe(COMPANY);
  });

  it('returns null — and only null — for the deliberate all-tenants read', () => {
    expect(tenantScopeCompanyId(ALL_TENANTS_SCOPE)).toBeNull();
  });
});

describe('scopeQueryToTenant', () => {
  it('applies the company filter for a strict scope', () => {
    const result = scopeQueryToTenant(asQuery(makeQuery()), COMPANY_SCOPE);

    expect(callsOf(result)).toEqual([['companyId', '==', COMPANY]]);
  });

  it('applies the company filter for a narrowed list scope', () => {
    const result = scopeQueryToTenant(asQuery(makeQuery()), LIST_COMPANY_SCOPE);

    expect(callsOf(result)).toEqual([['companyId', '==', COMPANY]]);
  });

  it('applies NO filter for an all-tenants scope', () => {
    const result = scopeQueryToTenant(asQuery(makeQuery()), ALL_TENANTS_SCOPE);

    expect(callsOf(result)).toEqual([]);
  });

  it('preserves filters the caller already applied', () => {
    const seeded = makeQuery().where('projectId', '==', 'proj_1');
    const result = scopeQueryToTenant(asQuery(seeded), COMPANY_SCOPE);

    expect(callsOf(result)).toEqual([
      ['projectId', '==', 'proj_1'],
      ['companyId', '==', COMPANY],
    ]);
  });

  it('uses the FIELDS constant, never a hand-typed field name', () => {
    const result = scopeQueryToTenant(asQuery(makeQuery()), COMPANY_SCOPE);

    // Guards the rename hazard: a typo'd field silently matches nothing and
    // returns an empty list, which reads as "no data" rather than "broken".
    expect(callsOf(result)[0][0]).toBe('companyId');
  });
});

describe('tenantScopedCollection', () => {
  it('opens the named collection and scopes it in one step', () => {
    const result = tenantScopedCollection('buildings', COMPANY_SCOPE);

    expect(collectionMock).toHaveBeenCalledWith('buildings');
    expect(callsOf(result)).toEqual([['companyId', '==', COMPANY]]);
  });

  it('returns the bare collection only for an all-tenants scope', () => {
    const result = tenantScopedCollection('buildings', ALL_TENANTS_SCOPE);

    expect(callsOf(result)).toEqual([]);
  });

  it('requires a scope to be named at all — there is no unscoped overload', () => {
    // Compile-time guarantee, asserted here so a future "convenience" overload
    // that defaults the scope trips this test rather than shipping quietly.
    expect(tenantScopedCollection).toHaveLength(2);
  });
});
