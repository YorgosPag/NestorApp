/**
 * 🔒 TENANT SCOPE — which company a *collection* query belongs to.
 *
 * `tenant-isolation.ts` answers "may this caller touch THIS document?" — one
 * document, already fetched. This module answers the question that comes
 * *before* the query is even built: "which company's rows is this caller
 * entitled to list?"
 *
 * The rule itself is one line and has been retyped in 30+ route files:
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
 * ## Not to be confused with `super-admin-scope.ts` (ADR-356)
 *
 * The codebase has two distinct scoping doctrines, and picking the wrong one is
 * a security bug rather than a style choice:
 *
 * | | driven by | super admin with nothing selected |
 * |---|---|---|
 * | `resolveSuperAdminProjectScope` (ADR-356) | the **header** switcher (`ctx.superAdminOverride`) | `filterCompanyId: null` → **no filter, all tenants** |
 * | `resolveTenantScope` (here) | the **`?companyId=` query string** | falls back to the caller's own `ctx.companyId` |
 *
 * Use this module for endpoints where a company must always be named. Use
 * ADR-356 for the project-data routes that deliberately expose a cross-tenant
 * view. Neither is a rewrite of the other; they answer different questions.
 *
 * @module lib/auth/tenant-scope
 * @enterprise ADR-697 — Trash-List Route SSoT (tenant scoping extracted here)
 * @see lib/auth/tenant-isolation — per-document ownership checks (ADR-255)
 * @see lib/auth/super-admin-scope — header-switcher scoping (ADR-356)
 */

// Direct imports to avoid a circular dependency with the @/lib/auth barrel
import type { AuthContext } from './types';
import { isRoleBypass } from './roles';

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
 * {@link resolveTenantScope} sourced straight from a request URL.
 *
 * Takes the URL as a string rather than a `NextRequest` so this module stays
 * free of server-only imports and remains unit-testable.
 *
 * @param url Full request URL (`request.url`)
 * @param ctx Authenticated request context
 */
export function resolveTenantScopeFromUrl(url: string, ctx: AuthContext): TenantScope {
  const requested = new URL(url).searchParams.get(TENANT_SCOPE_QUERY_PARAM);
  return resolveTenantScope(ctx, requested);
}
