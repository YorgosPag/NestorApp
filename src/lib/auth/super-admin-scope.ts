/**
 * Super Admin Project Scope — SSOT (ADR-356)
 *
 * Canonical decision function for super-admin-aware API routes that need to
 * pick:
 *   1. which `companyId` to filter Firestore by (or skip the filter),
 *   2. which cache slot to use so different effective tenants never collide.
 *
 * Every project-data route that previously branched on `ctx.globalRole === 'super_admin'`
 * + `ctx.superAdminOverride` should delegate to `resolveSuperAdminProjectScope(ctx)`
 * to avoid divergent implementations of the same rule.
 */

import type { AuthContext } from './types';

export type SuperAdminScopeMode =
  | 'tenant' // regular user OR super-admin defaulting to their JWT companyId
  | 'super-admin-global' // super admin without active switcher selection
  | 'super-admin-impersonate'; // super admin with switcher pointing at a non-home company

export interface SuperAdminProjectScope {
  /**
   * The companyId to use in a `where('companyId', '==', ...)` Firestore filter.
   * `null` means "no filter" — emitted only for `super-admin-global`, the
   * cross-tenant view a super admin sees when nothing is selected.
   */
  readonly filterCompanyId: string | null;
  /**
   * Cache-key suffix. Combined with a per-route prefix it yields a unique
   * cache slot per effective tenant — switching A → B → A in the UI never
   * serves the other tenant's cached payload.
   */
  readonly cacheSlot: string;
  /** Discriminator for logging / route-side branching. */
  readonly mode: SuperAdminScopeMode;
}

export function resolveSuperAdminProjectScope(ctx: AuthContext): SuperAdminProjectScope {
  if (ctx.globalRole === 'super_admin' && ctx.superAdminOverride) {
    return {
      filterCompanyId: ctx.companyId,
      cacheSlot: `super:${ctx.companyId}`,
      mode: 'super-admin-impersonate',
    };
  }
  if (ctx.globalRole === 'super_admin') {
    return {
      filterCompanyId: null,
      cacheSlot: 'all',
      mode: 'super-admin-global',
    };
  }
  return {
    filterCompanyId: ctx.companyId,
    cacheSlot: `tenant:${ctx.companyId}`,
    mode: 'tenant',
  };
}
