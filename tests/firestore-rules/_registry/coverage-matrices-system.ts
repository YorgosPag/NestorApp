/**
 * Firestore Rules Test Coverage — System-Global Matrix Builders (Phase C.5)
 *
 * Matrix functions for the system-global collections added in ADR-298 Phase C.5
 * (2026-04-13). Extracted into a dedicated module per the Google SRP 500-line
 * rule — `coverage-matrices.ts` would exceed the limit once Phase C.5 functions
 * are added.
 *
 * The four patterns here correspond to the rule shapes found in the
 * system/config/navigation/task/counter blocks of `firestore.rules`:
 *   - `systemGlobalMatrix`      → isAuthenticated() read, if false write (global configs)
 *   - `systemAdminGlobalMatrix` → isCompanyAdmin() read (role-only, not tenant-bound), if false write
 *   - `countersMatrix`          → isAuthenticated() read+write (auto-increment counters)
 *   - `tasksMatrix`             → tenant_direct + same_tenant_user CRUD + super_admin create allowed
 *
 * @module tests/firestore-rules/_registry/coverage-matrices-system
 * @since 2026-04-13 (ADR-298 Phase C.5)
 */

import type { CoverageCell } from './coverage-manifest';
import { cell } from './coverage-matrices';

// ---------------------------------------------------------------------------
// ADR-298 Phase C.5 — system-global collections
// ---------------------------------------------------------------------------

/**
 * Matrix for global read-only config collections — `isAuthenticated()` read,
 * `allow write: if false`.
 *
 * Used by: `config`, `email_domain_policies`, `country_security_policies`,
 * `bot_configs`.
 *
 * Key: ALL authenticated personas (including `cross_tenant_admin`) can read —
 * `isAuthenticated()` carries no tenant check. These are system-wide
 * configuration documents that any logged-in user may need (e.g. email
 * validation policies, country-level security restrictions, bot tokens for
 * webhook receivers). Only the Admin SDK mutates them.
 *
 * See ADR-298 §4 Phase C.5 (2026-04-13).
 */
export function systemGlobalMatrix(): readonly CoverageCell[] {
  return [
    // Read: isAuthenticated() — no tenant isolation, global configs
    cell('super_admin', 'read', 'allow'),
    cell('super_admin', 'list', 'allow'),
    cell('same_tenant_admin', 'read', 'allow'),
    cell('same_tenant_admin', 'list', 'allow'),
    cell('same_tenant_user', 'read', 'allow'),
    cell('same_tenant_user', 'list', 'allow'),
    cell('cross_tenant_admin', 'read', 'allow'),  // isAuthenticated() is global — no tenant gate
    cell('cross_tenant_admin', 'list', 'allow'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    cell('anonymous', 'list', 'deny', 'missing_claim'),
    // Write: if false — Admin SDK only for all personas
    cell('super_admin', 'create', 'deny', 'server_only'),
    cell('super_admin', 'update', 'deny', 'server_only'),
    cell('super_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_admin', 'create', 'deny', 'server_only'),
    cell('same_tenant_admin', 'update', 'deny', 'server_only'),
    cell('same_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'create', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'update', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
  ];
}

/**
 * Matrix for admin-global read collections — `isAuthenticated() && isCompanyAdmin()`
 * read, `allow write: if false`.
 *
 * Used by: `system`.
 *
 * Key deltas from `systemGlobalMatrix`:
 *   - read gate adds `isCompanyAdmin()` = role in ['super_admin', 'company_admin']
 *   - `same_tenant_user` (role=internal_user) denied (insufficient_role)
 *   - `cross_tenant_admin` (role=company_admin) ALLOWED — `isCompanyAdmin()` is
 *     role-only, NOT tenant-bound. Any company_admin across any tenant may read
 *     system-wide templates (intentional: cross-company-admin sees same templates).
 *
 * See ADR-298 §4 Phase C.5 (2026-04-13).
 */
export function systemAdminGlobalMatrix(): readonly CoverageCell[] {
  return [
    // Read: isAuthenticated() && isCompanyAdmin() — role-only check, no tenant gate
    cell('super_admin', 'read', 'allow'),
    cell('super_admin', 'list', 'allow'),
    cell('same_tenant_admin', 'read', 'allow'),
    cell('same_tenant_admin', 'list', 'allow'),
    cell('same_tenant_user', 'read', 'deny', 'insufficient_role'),  // internal_user not in ['super_admin', 'company_admin']
    cell('cross_tenant_admin', 'read', 'allow'),  // company_admin role passes isCompanyAdmin()
    cell('cross_tenant_admin', 'list', 'allow'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    // Write: if false — Admin SDK only for all personas
    cell('super_admin', 'create', 'deny', 'server_only'),
    cell('super_admin', 'update', 'deny', 'server_only'),
    cell('super_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_admin', 'create', 'deny', 'server_only'),
    cell('same_tenant_admin', 'update', 'deny', 'server_only'),
    cell('same_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'create', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'update', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
  ];
}

/**
 * Matrix for auto-increment counter collections — `allow read, write: if isAuthenticated()`.
 *
 * Used by: `counters`.
 *
 * Rule shape: both read AND write gated only on `isAuthenticated()`. No tenant
 * isolation — counters (project code sequences, etc.) must be accessible and
 * writable by any logged-in user regardless of company. Anonymous denied.
 *
 * See ADR-298 §4 Phase C.5 (2026-04-13).
 */
export function countersMatrix(): readonly CoverageCell[] {
  return [
    // Read + Write: isAuthenticated() — no tenant isolation, any authed user
    cell('super_admin', 'read', 'allow'),
    cell('super_admin', 'list', 'allow'),
    cell('super_admin', 'create', 'allow'),
    cell('super_admin', 'update', 'allow'),
    cell('super_admin', 'delete', 'allow'),
    cell('same_tenant_admin', 'read', 'allow'),
    cell('same_tenant_admin', 'list', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'delete', 'allow'),
    cell('same_tenant_user', 'read', 'allow'),
    cell('same_tenant_user', 'list', 'allow'),
    cell('same_tenant_user', 'create', 'allow'),
    cell('same_tenant_user', 'update', 'allow'),
    cell('same_tenant_user', 'delete', 'allow'),
    cell('cross_tenant_admin', 'read', 'allow'),
    cell('cross_tenant_admin', 'list', 'allow'),
    cell('cross_tenant_admin', 'create', 'allow'),
    cell('cross_tenant_admin', 'update', 'allow'),
    cell('cross_tenant_admin', 'delete', 'allow'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    cell('anonymous', 'list', 'deny', 'missing_claim'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
  ];
}

/**
 * Matrix for the `tasks` collection — tenant_direct with `same_tenant_user`
 * full CRUD and `super_admin` create allowed.
 *
 * Key deltas from `tenantDirectMatrix()`:
 *   - create: `isSuperAdminOnly()` OR-leg present → super_admin ALLOWED (unlike crmDirectMatrix)
 *   - same_tenant_user × create: `companyId == getUserCompanyId()` → ALLOW
 *   - same_tenant_user × update: `createdBy == auth.uid` (seed doc carries their uid) → ALLOW
 *   - same_tenant_user × delete: `createdBy == auth.uid` → ALLOW
 *
 * Create requires `isValidTaskData()` — test suites must provide valid create
 * data with all required fields: `title, type, assignedTo, status, priority`.
 *
 * See ADR-298 §4 Phase C.5 (2026-04-13).
 */
export function tasksMatrix(): readonly CoverageCell[] {
  return [
    // Read: isSuperAdminOnly() || createdBy==uid || assignedTo==uid || belongsToCompany(companyId)
    cell('super_admin', 'read', 'allow'),
    cell('super_admin', 'list', 'allow'),
    cell('same_tenant_admin', 'read', 'allow'),
    cell('same_tenant_admin', 'list', 'allow'),
    cell('same_tenant_user', 'read', 'allow'),
    cell('same_tenant_user', 'list', 'allow'),
    cell('cross_tenant_admin', 'read', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'list', 'deny', 'cross_tenant'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    cell('anonymous', 'list', 'deny', 'missing_claim'),
    // Create: (companyId == getUserCompanyId() || isSuperAdminOnly()) + isValidTaskData
    cell('super_admin', 'create', 'allow'),          // isSuperAdminOnly() short-circuit
    cell('same_tenant_admin', 'create', 'allow'),    // companyId match
    cell('same_tenant_user', 'create', 'allow'),     // companyId match
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: (createdBy==uid || assignedTo==uid || isCompanyAdminOfCompany || isSuperAdminOnly) + companyId immutable
    // Seed doc carries createdBy=same_tenant_user.uid, assignedTo=same_tenant_user.uid
    cell('super_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),
    cell('same_tenant_user', 'update', 'allow'),     // createdBy match on seed doc
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: (createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly)
    cell('super_admin', 'delete', 'allow'),
    cell('same_tenant_admin', 'delete', 'allow'),
    cell('same_tenant_user', 'delete', 'allow'),     // createdBy match on seed doc
    cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}
