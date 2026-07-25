/**
 * Tenant scope — the `?companyId=` list-scoping rule (ADR-697).
 *
 * These are security tests, not shape tests: the point of every case below is
 * that a caller-supplied company reaches the query ONLY behind a bypass role.
 */

import {
  TENANT_SCOPE_QUERY_PARAM,
  resolveTenantScope,
  resolveTenantScopeFromUrl,
} from '../tenant-scope';
import type { AuthContext } from '../types';
import type { GlobalRole } from '../types';

const OWN_COMPANY = 'comp_own_001';
const OTHER_COMPANY = 'comp_other_999';

function makeCtx(globalRole: string, companyId = OWN_COMPANY): AuthContext {
  return {
    uid: 'user_1',
    email: 'user@example.com',
    companyId,
    globalRole: globalRole as GlobalRole,
    mfaEnrolled: false,
    isAuthenticated: true,
  };
}

describe('resolveTenantScope — regular users', () => {
  it('scopes to the token company when no company is requested', () => {
    const scope = resolveTenantScope(makeCtx('company_admin'), null);

    expect(scope.companyId).toBe(OWN_COMPANY);
    expect(scope.isSuperAdmin).toBe(false);
    expect(scope.isCrossTenant).toBe(false);
  });

  it('IGNORES a requested foreign company — the core tenant-isolation guarantee', () => {
    const scope = resolveTenantScope(makeCtx('company_admin'), OTHER_COMPANY);

    expect(scope.companyId).toBe(OWN_COMPANY);
    expect(scope.isCrossTenant).toBe(false);
  });

  it('ignores a foreign company for every non-bypass role', () => {
    const roles = ['company_admin', 'project_manager', 'sales_agent', 'viewer', 'vendor'];

    for (const role of roles) {
      expect(resolveTenantScope(makeCtx(role), OTHER_COMPANY).companyId).toBe(OWN_COMPANY);
    }
  });

  it('ignores an unknown role rather than treating it as privileged', () => {
    const scope = resolveTenantScope(makeCtx('not_a_real_role'), OTHER_COMPANY);

    expect(scope.isSuperAdmin).toBe(false);
    expect(scope.companyId).toBe(OWN_COMPANY);
  });
});

describe('resolveTenantScope — super admin', () => {
  it('honours a requested company and flags it as cross-tenant', () => {
    const scope = resolveTenantScope(makeCtx('super_admin'), OTHER_COMPANY);

    expect(scope.companyId).toBe(OTHER_COMPANY);
    expect(scope.isSuperAdmin).toBe(true);
    expect(scope.isCrossTenant).toBe(true);
  });

  it('falls back to its own company when none is requested', () => {
    const scope = resolveTenantScope(makeCtx('super_admin'), null);

    expect(scope.companyId).toBe(OWN_COMPANY);
    expect(scope.isCrossTenant).toBe(false);
  });

  it('is not cross-tenant when it names its own company explicitly', () => {
    const scope = resolveTenantScope(makeCtx('super_admin'), OWN_COMPANY);

    expect(scope.companyId).toBe(OWN_COMPANY);
    expect(scope.isCrossTenant).toBe(false);
  });

  it('treats an empty requested company as absent, not as a company named ""', () => {
    const scope = resolveTenantScope(makeCtx('super_admin'), '');

    expect(scope.companyId).toBe(OWN_COMPANY);
  });

  it('treats undefined the same as null', () => {
    expect(resolveTenantScope(makeCtx('super_admin'), undefined).companyId).toBe(OWN_COMPANY);
  });
});

describe('resolveTenantScopeFromUrl', () => {
  it('reads the company from the documented query parameter', () => {
    const url = `https://app.example/api/buildings/trash?${TENANT_SCOPE_QUERY_PARAM}=${OTHER_COMPANY}`;

    expect(resolveTenantScopeFromUrl(url, makeCtx('super_admin')).companyId).toBe(OTHER_COMPANY);
  });

  it('still ignores the parameter for a regular user', () => {
    const url = `https://app.example/api/buildings/trash?${TENANT_SCOPE_QUERY_PARAM}=${OTHER_COMPANY}`;

    expect(resolveTenantScopeFromUrl(url, makeCtx('company_admin')).companyId).toBe(OWN_COMPANY);
  });

  it('falls back to the token company when the URL carries no query string', () => {
    const url = 'https://app.example/api/buildings/trash';

    expect(resolveTenantScopeFromUrl(url, makeCtx('super_admin')).companyId).toBe(OWN_COMPANY);
  });

  it('ignores unrelated query parameters', () => {
    const url = 'https://app.example/api/buildings/trash?projectId=proj_1&limit=50';

    expect(resolveTenantScopeFromUrl(url, makeCtx('super_admin')).companyId).toBe(OWN_COMPANY);
  });

  it('uses the documented parameter name', () => {
    expect(TENANT_SCOPE_QUERY_PARAM).toBe('companyId');
  });
});
