/**
 * Super Admin Active Company — module-level registry (ADR-354)
 *
 * Lightweight, zero-dep state holder so Firestore-side `requireAuthContext`
 * can read the super admin's currently selected company without importing
 * React context (which would create circular deps and SSR pitfalls).
 *
 * Populated by `SuperAdminCompanyContext` provider effect on every change.
 * Read by `requireAuthContext` to enrich `TenantContext.effectiveCompanyId`,
 * which `buildTenantConstraints` uses to filter Firestore SDK queries.
 *
 * When unset (regular users, or super admin without selection), behavior
 * is unchanged from before ADR-354.
 */

let activeCompanyId: string | null = null;
const listeners = new Set<() => void>();

export function setSuperAdminActiveCompanyId(id: string | null): void {
  if (id === activeCompanyId) return;
  activeCompanyId = id;
  listeners.forEach((cb) => {
    try { cb(); } catch { /* listener errors must not break the switcher */ }
  });
}

export function getSuperAdminActiveCompanyId(): string | null {
  return activeCompanyId;
}

/**
 * Subscribe to switcher changes. Used by `firestoreQueryService.subscribe`
 * to rebuild live Firestore queries with the new company filter (ADR-354).
 */
export function onSuperAdminActiveCompanyChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
