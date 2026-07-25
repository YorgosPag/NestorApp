/**
 * 🔒 TENANT SCOPE — which company a *collection* query belongs to.
 *
 * `tenant-isolation.ts` answers "may this caller touch THIS document?" — one
 * document, already fetched. This module answers the question that comes
 * *before* the query is even built: "which company's rows is this caller
 * entitled to list?"
 *
 * The rule itself is one line and has been retyped in route file after route
 * file:
 *
 * ```ts
 * const isSuperAdmin = isRoleBypass(ctx.globalRole);
 * const tenantCompanyId = isSuperAdmin && queryCompanyId ? queryCompanyId : ctx.companyId;
 * ```
 *
 * It is short, which is exactly why it spread — and it is a **security**
 * decision, which is exactly why it must not. A single hand-edit that drops the
 * `isSuperAdmin &&` guard turns `?companyId=` into a cross-tenant data leak that
 * reads like ordinary code in review. Big-player practice (AWS IAM request
 * context, Salesforce `WITH SECURITY_ENFORCED`, GitHub's resource scoping) is
 * the same: the caller never hand-derives its own scope — it asks for a resolved
 * scope object and hands that to the query builder.
 *
 * ## The three questions (ADR-702)
 *
 * Copy-pasting made these look like one rule. They are three, and picking the
 * wrong one is a security bug rather than a style choice:
 *
 * | function | super admin, no `?companyId=` | non-admin asking for another company |
 * |---|---|---|
 * | {@link resolveTenantScope}     | their own company | silently ignored |
 * | {@link resolveTenantListScope} | **every** company (`all-tenants`) | silently ignored |
 * | {@link requireTenantScope}     | their own company | **403** |
 *
 * Use `resolveTenantScope` when a company must always be named (the trash
 * bins). Use `resolveTenantListScope` for the browse endpoints, where a super
 * admin with nothing selected deliberately sees the whole estate. Use
 * `requireTenantScope` for anything that acts *on* a named company — migrations,
 * backfills, cost reports — where silently retargeting the caller's own tenant
 * would be worse than refusing.
 *
 * ## Not to be confused with `super-admin-scope.ts` (ADR-356)
 *
 * A fourth doctrine exists and is deliberately NOT unified with these:
 *
 * | | driven by | super admin with nothing selected |
 * |---|---|---|
 * | `resolveSuperAdminProjectScope` (ADR-356) | the **header** switcher (`ctx.superAdminOverride`) | `filterCompanyId: null` → all tenants |
 * | this module | the **`?companyId=` query string** | see table above |
 *
 * Neither is a rewrite of the other; they read different inputs.
 *
 * ## Why the application layer is the only layer here
 *
 * These routes read through the Firebase **Admin SDK**, which bypasses
 * `firestore.rules` by design. The database-side net that OWASP's multi-tenant
 * guidance and Postgres RLS rely on does not exist on this path — so a missing
 * filter is not caught downstream by anything. That is why resolution and
 * *application* are both owned here: see `lib/firestore/tenant-scoped-query`.
 *
 * @module lib/auth/tenant-scope
 * @enterprise ADR-697 — Trash-List Route SSoT (tenant scoping extracted here)
 * @enterprise ADR-702 — Tenant Query Scope SSoT (list + strict doctrines)
 * @see lib/auth/tenant-isolation — per-document ownership checks (ADR-255)
 * @see lib/auth/super-admin-scope — header-switcher scoping (ADR-356)
 * @see lib/firestore/tenant-scoped-query — applies a resolved scope to a query
 */

// Direct imports to avoid a circular dependency with the @/lib/auth barrel
import type { AuthContext } from './types';
import { isRoleBypass } from './roles';
import { TenantIsolationError } from './tenant-isolation-error';

/** Query-string parameter through which a super admin targets another company. */
export const TENANT_SCOPE_QUERY_PARAM = 'companyId';

/**
 * The resolved answer to "whose rows may this request list?".
 *
 * `companyId` is the ONLY value a query may be scoped by. `isSuperAdmin` and
 * `isCrossTenant` exist for logging and audit — never re-derive the scope from
 * them at the call site.
 */
export interface TenantScope {
  /** Effective company the query must be filtered by. Never caller-controlled for non-admins. */
  readonly companyId: string;
  /** True when the caller holds a bypass role (ADR-232 super admin). */
  readonly isSuperAdmin: boolean;
  /** True when a super admin is deliberately reading another company's rows. */
  readonly isCrossTenant: boolean;
}

/**
 * The resolved answer for endpoints where "all companies" is a legal answer.
 *
 * Modelled as a discriminated union rather than a nullable `companyId` so the
 * unscoped case cannot be reached by accident: there is no `companyId` field to
 * read on the `all-tenants` branch, so a call site that forgets to handle it
 * does not silently filter by `undefined`.
 */
export type TenantListScope =
  | {
      readonly kind: 'company';
      /** Effective company the query must be filtered by. */
      readonly companyId: string;
      readonly isSuperAdmin: boolean;
      readonly isCrossTenant: boolean;
    }
  | {
      readonly kind: 'all-tenants';
      /** Only a bypass role can ever reach this branch. */
      readonly isSuperAdmin: true;
      readonly isCrossTenant: true;
    };

/**
 * Resolve the company a list query must be scoped to.
 *
 * A requested company is honoured **only** for bypass roles; for everyone else
 * it is ignored in favour of the token's own `companyId`. Ignored — not
 * rejected — because that is the behaviour the existing endpoints shipped: a
 * regular user passing `?companyId=other` silently gets their own rows rather
 * than a 403 that would confirm the other company exists.
 *
 * @param ctx                Authenticated request context
 * @param requestedCompanyId Company asked for via query string (may be null)
 */
export function resolveTenantScope(
  ctx: AuthContext,
  requestedCompanyId: string | null | undefined,
): TenantScope {
  const isSuperAdmin = isRoleBypass(ctx.globalRole);
  const companyId = isSuperAdmin && requestedCompanyId ? requestedCompanyId : ctx.companyId;

  return {
    companyId,
    isSuperAdmin,
    isCrossTenant: companyId !== ctx.companyId,
  };
}

/**
 * Resolve the scope for a browse endpoint, where a super admin who named no
 * company means "show me everything".
 *
 * This is the doctrine the buildings / properties / floors list endpoints
 * shipped, made explicit. For non-bypass callers it is identical to
 * {@link resolveTenantScope}: their own company, request ignored.
 *
 * @param ctx                Authenticated request context
 * @param requestedCompanyId Company asked for via query string (may be null)
 */
export function resolveTenantListScope(
  ctx: AuthContext,
  requestedCompanyId: string | null | undefined,
): TenantListScope {
  const isSuperAdmin = isRoleBypass(ctx.globalRole);

  if (!isSuperAdmin) {
    return { kind: 'company', companyId: ctx.companyId, isSuperAdmin: false, isCrossTenant: false };
  }

  if (!requestedCompanyId) {
    return { kind: 'all-tenants', isSuperAdmin: true, isCrossTenant: true };
  }

  return {
    kind: 'company',
    companyId: requestedCompanyId,
    isSuperAdmin: true,
    isCrossTenant: requestedCompanyId !== ctx.companyId,
  };
}

/**
 * Resolve the scope for an endpoint that *acts on* a named company, refusing
 * rather than retargeting.
 *
 * Where the list resolvers silently fall back to the caller's own company, a
 * migration or a cost report must not: quietly rewriting `?companyId=other` to
 * the caller's own tenant would run the job against the wrong data and report
 * success. A non-bypass caller that names someone else's company gets a 403,
 * which is also OWASP's guidance for cross-tenant requests — deny, do not
 * silently scope down.
 *
 * Naming *your own* company is always allowed, so a legitimate caller with the
 * right permission is never blocked by this.
 *
 * @param ctx                Authenticated request context
 * @param requestedCompanyId Company named by the request (query string or body)
 * @throws {TenantIsolationError} 403 when a non-bypass caller names another company
 */
export function requireTenantScope(
  ctx: AuthContext,
  requestedCompanyId: string | null | undefined,
): TenantScope {
  const isSuperAdmin = isRoleBypass(ctx.globalRole);

  if (!isSuperAdmin && requestedCompanyId && requestedCompanyId !== ctx.companyId) {
    throw new TenantIsolationError(
      'Cross-tenant access denied: caller may only act on their own company',
      403,
      'FORBIDDEN',
    );
  }

  const companyId = requestedCompanyId || ctx.companyId;

  return {
    companyId,
    isSuperAdmin,
    isCrossTenant: companyId !== ctx.companyId,
  };
}

/**
 * {@link resolveTenantScope} sourced straight from a request URL.
 *
 * Takes the URL as a string rather than a `NextRequest` so this module stays
 * free of server-only imports and remains unit-testable.
 *
 * @param url Full request URL (`request.url`)
 * @param ctx Authenticated request context
 */
export function resolveTenantScopeFromUrl(url: string, ctx: AuthContext): TenantScope {
  return resolveTenantScope(ctx, readRequestedCompanyId(url));
}

/**
 * {@link resolveTenantListScope} sourced straight from a request URL.
 *
 * @param url Full request URL (`request.url`)
 * @param ctx Authenticated request context
 */
export function resolveTenantListScopeFromUrl(url: string, ctx: AuthContext): TenantListScope {
  return resolveTenantListScope(ctx, readRequestedCompanyId(url));
}

/**
 * Stable log/audit label for a resolved list scope.
 *
 * Exists so the three browse endpoints do not each invent their own way of
 * logging "no company filter" — a grep for cross-tenant reads should find one
 * token, not three.
 */
export function tenantScopeLabel(scope: TenantListScope): string {
  return scope.kind === 'company' ? scope.companyId : 'ALL_TENANTS';
}

/** Read the requested company from a request URL's query string. */
function readRequestedCompanyId(url: string): string | null {
  return new URL(url).searchParams.get(TENANT_SCOPE_QUERY_PARAM);
}
