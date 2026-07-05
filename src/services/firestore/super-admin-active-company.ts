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

import { createExternalStore } from '@/lib/state/createExternalStore';

// SSoT pub/sub primitive (WAVE 3) — the `if (id === activeCompanyId) return` identity
// guard is exactly `equals: Object.is`, so redundant writes stay no-ops.
const store = createExternalStore<string | null>(null, { equals: Object.is });

export function setSuperAdminActiveCompanyId(id: string | null): void {
  store.set(id);
}

export function getSuperAdminActiveCompanyId(): string | null {
  return store.get();
}

/**
 * Subscribe to switcher changes. Used by `firestoreQueryService.subscribe`
 * to rebuild live Firestore queries with the new company filter (ADR-354).
 */
export function onSuperAdminActiveCompanyChange(listener: () => void): () => void {
  return store.subscribe(listener);
}
