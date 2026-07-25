/**
 * 🔒 TENANT-SCOPED QUERY — the half of tenant isolation that resolving alone
 * never gave us.
 *
 * `lib/auth/tenant-scope` decides *which* company a request may read. This
 * module is what makes that decision impossible to compute and then forget —
 * the failure mode that actually shipped:
 *
 * > `src/app/api/buildings/route.ts` resolved `tenantCompanyId`, logged it, and
 * > then, on the super-admin branch, queried the collection with no filter at
 * > all. Two sibling endpoints applied the same resolved value. Three copies of
 * > "one rule" had already drifted into two behaviours.
 *
 * That is the whole argument for owning application, not just resolution. The
 * industry framing is blunt about it: *"any disciplined developer can remember
 * to write `where(tenant_id: …)`. The challenge is to design a system in which
 * forgetting to write it cannot violate the architecture."* Postgres answers
 * that with row-level security; OWASP's multi-tenant cheat sheet answers it with
 * a repository that binds the tenant at construction.
 *
 * **We get no such net.** These routes read through the Firebase Admin SDK,
 * which bypasses `firestore.rules` by design — the database-side backstop other
 * stacks lean on is switched off on this path. The application layer is the only
 * layer, so the entry point itself has to carry the scope: you cannot obtain the
 * collection without naming one.
 *
 * @example
 * // The scope is not something you *may* apply — it is how you get the query.
 * const scope = resolveTenantListScopeFromUrl(request.url, ctx);
 * let query = tenantScopedCollection(COLLECTIONS.BUILDINGS, scope);
 * if (projectId) query = query.where(FIELDS.PROJECT_ID, '==', projectId);
 *
 * @module lib/firestore/tenant-scoped-query
 * @enterprise ADR-702 — Tenant Query Scope SSoT
 * @see lib/auth/tenant-scope — resolves the scope this module applies
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FIELDS } from '@/config/firestore-field-constants';
import type { TenantScope, TenantListScope } from '@/lib/auth/tenant-scope';

/**
 * Any resolved scope from the `tenant-scope` family.
 *
 * A plain {@link TenantScope} always names a company; a {@link TenantListScope}
 * may legally mean "every company". Both are accepted so a call site never has
 * to unwrap one into the other by hand — unwrapping by hand is exactly where the
 * filter goes missing.
 */
export type AnyTenantScope = TenantScope | TenantListScope;

/**
 * Narrow a resolved scope to the single company it filters by, or `null` when
 * the scope deliberately spans every tenant.
 *
 * Exported for logging and for the rare caller that must branch on it. Prefer
 * {@link scopeQueryToTenant} — a `null` here is a filter you now have to
 * remember not to apply, which is the problem this module exists to remove.
 */
export function tenantScopeCompanyId(scope: AnyTenantScope): string | null {
  if (!('kind' in scope)) return scope.companyId;
  return scope.kind === 'company' ? scope.companyId : null;
}

/**
 * Apply a resolved scope to an existing query.
 *
 * Use when the query already exists — a collection group, or a collection
 * reference the caller obtained for other reasons. When you are starting from a
 * collection name, prefer {@link tenantScopedCollection}, which leaves no
 * unscoped intermediate value lying around to be used by mistake.
 *
 * @param query Query to constrain
 * @param scope Resolved scope from `lib/auth/tenant-scope`
 */
export function scopeQueryToTenant(
  query: FirebaseFirestore.Query,
  scope: AnyTenantScope,
): FirebaseFirestore.Query {
  const companyId = tenantScopeCompanyId(scope);
  return companyId === null ? query : query.where(FIELDS.COMPANY_ID, '==', companyId);
}

/**
 * Open a collection already constrained to the caller's scope.
 *
 * The scope is a required argument, so there is no expression in a route that
 * yields an unscoped query on one of these collections — the mistake is not
 * caught, it is unspellable.
 *
 * @param collectionPath Collection name, from `COLLECTIONS`
 * @param scope          Resolved scope from `lib/auth/tenant-scope`
 */
export function tenantScopedCollection(
  collectionPath: string,
  scope: AnyTenantScope,
): FirebaseFirestore.Query {
  return scopeQueryToTenant(getAdminFirestore().collection(collectionPath), scope);
}
