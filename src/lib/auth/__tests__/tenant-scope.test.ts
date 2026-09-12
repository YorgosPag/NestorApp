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
  resolveTenantListScope,
  resolveTenantListScopeFromUrl,
  requireTenantScope,
  tenantScopeLabel,
} from '../tenant-scope';
import { TenantIsolationError } from '../tenant-isolation-error';
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

// =============================================================================
// ADR-702 — the browse doctrine (`all-tenants` is a legal answer)
// =============================================================================

describe('resolveTenantListScope — regular users', () => {
  it('never reaches the all-tenants branch, whatever it asks for', () => {
    for (const requested of [null, undefined, '', OWN_COMPANY, OTHER_COMPANY]) {
      const scope = resolveTenantListScope(makeCtx('company_admin'), requested);

      expect(scope.kind).toBe('company');
      expect(scope.isSuperAdmin).toBe(false);
    }
  });

  it('IGNORES a requested foreign company — same guarantee as the strict resolver', () => {
    const scope = resolveTenantListScope(makeCtx('company_admin'), OTHER_COMPANY);

    expect(scope).toEqual({
      kind: 'company',
      companyId: OWN_COMPANY,
      isSuperAdmin: false,
      isCrossTenant: false,
    });
  });

  it('does not treat an unknown role as privileged', () => {
    expect(resolveTenantListScope(makeCtx('not_a_real_role'), OTHER_COMPANY).kind).toBe('company');
  });
});

describe('resolveTenantListScope — super admin', () => {
  it('spans every tenant when no company is named — the ADR-702 difference', () => {
    const scope = resolveTenantListScope(makeCtx('super_admin'), null);

    expect(scope.kind).toBe('all-tenants');
    expect(scope.isSuperAdmin).toBe(true);
    expect(scope.isCrossTenant).toBe(true);
  });

  it('narrows to the named company instead', () => {
    const scope = resolveTenantListScope(makeCtx('super_admin'), OTHER_COMPANY);

    expect(scope).toEqual({
      kind: 'company',
      companyId: OTHER_COMPANY,
      isSuperAdmin: true,
      isCrossTenant: true,
    });
  });

  it('is not cross-tenant when it names its own company', () => {
    const scope = resolveTenantListScope(makeCtx('super_admin'), OWN_COMPANY);

    expect(scope.isCrossTenant).toBe(false);
  });

  it('treats an empty string as "no company named", not as a company called ""', () => {
    expect(resolveTenantListScope(makeCtx('super_admin'), '').kind).toBe('all-tenants');
  });

  it('exposes no companyId on the all-tenants branch — nothing to filter by, by construction', () => {
    const scope = resolveTenantListScope(makeCtx('super_admin'), null);

    expect(scope).not.toHaveProperty('companyId');
  });
});

/**
 * 🔴🔴 ADR-787 §5.3 ζ, ΟΡΙΟ (1) — ΤΟ ΔΟΓΜΑ ΛΙΣΤΑΣ ΑΓΝΟΟΥΣΕ ΤΟΝ ΔΗΛΩΜΕΝΟ ΧΩΡΟ (2026-09-12)
 *
 * Το `all-tenants` ήταν η απάντηση σε **κάθε** αίτημα χωρίς `?companyId=` — και ο πελάτης
 * στέλνει εκείνο το ερώτημα σε **ΕΝΑ** σημείο όλου του `src/` (μετρημένο:
 * `SimpleProjectDialog.tsx`). Άρα ο super-admin μέσα στο `/o/<ΡΟΗ>/buildings` έπαιρνε
 * **όλες** τις εταιρείες: λάθος δεδομένα κάτω από διεύθυνση που ονομάζει **μία**.
 */
describe('resolveTenantListScope — Ο ΔΗΛΩΜΕΝΟΣ ΧΩΡΟΣ ΜΕΤΡΑΕΙ', () => {
  const withDeclaration = (
    globalRole: string,
    requestedWorkspace: AuthContext['requestedWorkspace'],
    companyId = OWN_COMPANY,
  ): AuthContext => ({ ...makeCtx(globalRole, companyId), requestedWorkspace });

  it('Δ1 🔴 super admin σε ΔΗΛΩΜΕΝΟ χώρο ⇒ ΜΟΝΟ αυτή η εταιρεία', () => {
    const scope = resolveTenantListScope(
      withDeclaration('super_admin', { kind: 'org', companyId: OWN_COMPANY }),
      null,
    );

    expect(scope).toEqual({
      kind: 'company',
      companyId: OWN_COMPANY,
      isSuperAdmin: true,
      isCrossTenant: false,
    });
  });

  it('Δ2 — ο δηλωμένος χώρος είναι ο ΚΡΙΜΕΝΟΣ: φιλτράρει με το `ctx.companyId`', () => {
    // ⚠️ Το `companyId` του context είναι ό,τι ενέκρινε ο `decideMembership` για τη
    //    δήλωση — γι' αυτό η λίστα δεν διαβάζει ποτέ την **ωμή** τιμή της δήλωσης.
    const scope = resolveTenantListScope(
      withDeclaration('super_admin', { kind: 'org', companyId: OTHER_COMPANY }, OTHER_COMPANY),
      null,
    );

    expect(scope).toEqual({
      kind: 'company',
      companyId: OTHER_COMPANY,
      isSuperAdmin: true,
      isCrossTenant: false,
    });
  });

  it('Δ3 — `default` (δηλωμένη σιωπή) ⇒ η παλιά, καθολική συμπεριφορά ΑΘΙΚΤΗ', () => {
    const scope = resolveTenantListScope(withDeclaration('super_admin', { kind: 'default' }), null);

    expect(scope.kind).toBe('all-tenants');
  });

  it('Δ4 — καμία δήλωση (context εκτός HTTP) ⇒ καθολική, όπως πριν', () => {
    expect(resolveTenantListScope(makeCtx('super_admin'), null).kind).toBe('all-tenants');
  });

  it('Δ5 — το ρητό `?companyId=` προηγείται της δήλωσης: είναι όρισμα της πράξης', () => {
    const scope = resolveTenantListScope(
      withDeclaration('super_admin', { kind: 'org', companyId: OWN_COMPANY }),
      OTHER_COMPANY,
    );

    expect(scope).toEqual({
      kind: 'company',
      companyId: OTHER_COMPANY,
      isSuperAdmin: true,
      isCrossTenant: true,
    });
  });

  /**
   * 🔴 BELT-AND-SUSPENDERS: ο ιδιωτικός χώρος δεν φτάνει εδώ (τον αρνείται το σύνορο με
   * 403 `MISSING_TENANT`) — και αν φτάσει, **δεν** γίνεται `all-tenants`.
   */
  it('Δ7 🔴 `personal` ΑΡΝΕΙΤΑΙ — ποτέ καθολική λίστα από παρακαμμένο σύνορο', () => {
    expect(() =>
      resolveTenantListScope(withDeclaration('super_admin', { kind: 'personal' }), null),
    ).toThrow(TenantIsolationError);
  });

  it('Δ6 — ο απλός χρήστης δεν κερδίζει τίποτα από δήλωση ξένου χώρου', () => {
    const scope = resolveTenantListScope(
      withDeclaration('company_admin', { kind: 'org', companyId: OTHER_COMPANY }),
      null,
    );

    expect(scope).toEqual({
      kind: 'company',
      companyId: OWN_COMPANY,
      isSuperAdmin: false,
      isCrossTenant: false,
    });
  });
});

describe('resolveTenantListScopeFromUrl', () => {
  it('reads the same documented parameter as the strict resolver', () => {
    const url = `https://app.example/api/buildings?${TENANT_SCOPE_QUERY_PARAM}=${OTHER_COMPANY}`;
    const scope = resolveTenantListScopeFromUrl(url, makeCtx('super_admin'));

    expect(scope).toMatchObject({ kind: 'company', companyId: OTHER_COMPANY });
  });

  it('spans all tenants for a super admin browsing with no filter', () => {
    const url = 'https://app.example/api/buildings?projectId=proj_1';

    expect(resolveTenantListScopeFromUrl(url, makeCtx('super_admin')).kind).toBe('all-tenants');
  });

  it('still pins a regular user to their own company', () => {
    const url = `https://app.example/api/buildings?${TENANT_SCOPE_QUERY_PARAM}=${OTHER_COMPANY}`;

    expect(resolveTenantListScopeFromUrl(url, makeCtx('project_manager'))).toMatchObject({
      kind: 'company',
      companyId: OWN_COMPANY,
    });
  });
});

// =============================================================================
// ADR-702 — the strict doctrine (refuse, never retarget)
// =============================================================================

describe('requireTenantScope', () => {
  it('REFUSES a non-bypass caller that names another company', () => {
    expect(() => requireTenantScope(makeCtx('company_admin'), OTHER_COMPANY))
      .toThrow(TenantIsolationError);
  });

  it('refuses with 403 FORBIDDEN, not 404 — the company exists, the caller may not act on it', () => {
    try {
      requireTenantScope(makeCtx('company_admin'), OTHER_COMPANY);
      throw new Error('expected a refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(TenantIsolationError);
      expect((error as TenantIsolationError).status).toBe(403);
      expect((error as TenantIsolationError).code).toBe('FORBIDDEN');
    }
  });

  it('does NOT silently retarget the caller onto their own company', () => {
    // The whole point: a migration must not run against the wrong tenant and
    // report success. Compare with resolveTenantScope, which does exactly that.
    expect(resolveTenantScope(makeCtx('company_admin'), OTHER_COMPANY).companyId).toBe(OWN_COMPANY);
    expect(() => requireTenantScope(makeCtx('company_admin'), OTHER_COMPANY)).toThrow();
  });

  it('allows a non-bypass caller to name its OWN company', () => {
    const scope = requireTenantScope(makeCtx('company_admin'), OWN_COMPANY);

    expect(scope.companyId).toBe(OWN_COMPANY);
    expect(scope.isCrossTenant).toBe(false);
  });

  it('allows a non-bypass caller that names nothing', () => {
    expect(requireTenantScope(makeCtx('company_admin'), null).companyId).toBe(OWN_COMPANY);
    expect(requireTenantScope(makeCtx('company_admin'), '').companyId).toBe(OWN_COMPANY);
  });

  it('lets a bypass role target any company and flags the crossing for audit', () => {
    const scope = requireTenantScope(makeCtx('super_admin'), OTHER_COMPANY);

    expect(scope.companyId).toBe(OTHER_COMPANY);
    expect(scope.isSuperAdmin).toBe(true);
    expect(scope.isCrossTenant).toBe(true);
  });

  it('refuses for every non-bypass role, including unknown ones', () => {
    const roles = ['company_admin', 'project_manager', 'sales_agent', 'viewer', 'vendor', 'not_a_real_role'];

    for (const role of roles) {
      expect(() => requireTenantScope(makeCtx(role), OTHER_COMPANY)).toThrow(TenantIsolationError);
    }
  });
});

describe('tenantScopeLabel', () => {
  it('labels a company scope with the company id', () => {
    expect(tenantScopeLabel(resolveTenantListScope(makeCtx('company_admin'), null))).toBe(OWN_COMPANY);
  });

  it('labels the unscoped read with one greppable token', () => {
    expect(tenantScopeLabel(resolveTenantListScope(makeCtx('super_admin'), null))).toBe('ALL_TENANTS');
  });
});
