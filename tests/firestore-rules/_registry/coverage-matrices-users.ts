/**
 * Firestore Rules Test Coverage — Users / Companies / Workspaces Matrix Builders
 * (Phase C.6)
 *
 * Matrix functions for the ownership-based user and company collections
 * added in ADR-298 Phase C.6 (2026-04-14). Extracted into a dedicated module
 * per the Google SRP 500-line rule.
 *
 * Patterns covered:
 *   - companies              → companiesMatrix()  (own-company read + server-only write)
 *   - users                  → usersMatrix()      (ownership + companyAdmin write)
 *   - user_2fa_settings      → ownerOnlyMatrix()  (pure isOwner() read+write)
 *   - user_notification_settings → ownerOnlyMatrix()
 *   - workspaces             → adminWriteOnlyMatrix() (re-export, not here)
 *   - security_roles         → systemGlobalMatrix()   (re-export, not here)
 *   - teams                  → crmDirectMatrix()       (re-export, not here)
 *   - positions              → systemGlobalMatrix()    (re-export, not here)
 *
 * @module tests/firestore-rules/_registry/coverage-matrices-users
 * @since 2026-04-14 (ADR-298 Phase C.6)
 */

import type { CoverageCell } from './coverage-manifest';
import { cell } from './coverage-matrices';

// ---------------------------------------------------------------------------
// ADR-298 Phase C.6 — ownership-based user / company collections
// ---------------------------------------------------------------------------

/**
 * Matrix for `companies` — tenant-scoped own-company read, write = if false.
 *
 * Rule shape:
 *   - read: `isSuperAdminOnly() || getUserCompanyId() == companyId`
 *     where `companyId` is the **document ID** (path variable), not a field.
 *   - write: `allow write: if false` — Admin SDK only
 *
 * Key delta from adminWriteOnlyMatrix():
 *   - same_tenant × list → DENY: the path-variable rule `getUserCompanyId() == companyId`
 *     cannot be evaluated safely against an unrestricted collection query.
 *     Firestore denies queries that could return docs the caller can't read.
 *     Only super_admin (isSuperAdminOnly() is unconditional) may list.
 *
 * Test contract: seed doc carries `docId = SAME_TENANT_COMPANY_ID` so the
 * `getUserCompanyId() == companyId` leg is exercised for same-tenant personas.
 *
 * See ADR-298 §4 Phase C.6 (2026-04-14).
 */
export function companiesMatrix(): readonly CoverageCell[] {
  return [
    // Read (single get): isSuperAdminOnly() || getUserCompanyId() == companyId
    // Seed docId = SAME_TENANT_COMPANY_ID ('company-a') — same_tenant personas pass
    cell('super_admin', 'read', 'allow'),
    cell('same_tenant_admin', 'read', 'allow'),   // getUserCompanyId()=='company-a'==docId
    cell('same_tenant_user', 'read', 'allow'),    // getUserCompanyId()=='company-a'==docId
    cell('cross_tenant_admin', 'read', 'deny', 'cross_tenant'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    // List (query): path-var rule — unrestricted queries denied for non-super
    cell('super_admin', 'list', 'allow'),
    cell('same_tenant_admin', 'list', 'deny', 'insufficient_role'),
    cell('same_tenant_user', 'list', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'list', 'deny', 'cross_tenant'),
    cell('anonymous', 'list', 'deny', 'missing_claim'),
    // Write: if false — Admin SDK only for all personas
    cell('super_admin', 'create', 'deny', 'server_only'),
    cell('super_admin', 'update', 'deny', 'server_only'),
    cell('super_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_admin', 'create', 'deny', 'server_only'),
    cell('same_tenant_admin', 'update', 'deny', 'server_only'),
    cell('same_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
  ];
}

/**
 * Matrix for `users` — ownership + company admin pattern.
 *
 * Rule shape:
 *   - read:   uid==userId || (companyId && belongsToCompany(companyId)) || isSuperAdminOnly()
 *   - create: uid==userId || (companyId && isCompanyAdminOfCompany(companyId))
 *   - update: uid==userId || (companyId && isCompanyAdminOfCompany(companyId))
 *   - delete: `allow delete: if false` — user docs are never client-deleted
 *
 * Key details:
 *   - `isCompanyAdminOfCompany` includes `isSuperAdminOnly()` short-circuit →
 *     super_admin can create/update any user doc via the company admin leg.
 *   - same_tenant_user × create → DENY: harness uses fresh docId ≠ their uid,
 *     and they're not a company admin. Own-profile signup path exercised in
 *     dedicated regression block in the suite.
 *   - same_tenant_user × update → ALLOW: seed docId = same_tenant_user.uid →
 *     `uid == userId` leg satisfied.
 *   - delete: `if false` → server_only for all authenticated personas.
 *
 * Test contract: seed doc carries `docId = PERSONA_CLAIMS.same_tenant_user.uid`
 * and `companyId = SAME_TENANT_COMPANY_ID`.
 *
 * See ADR-298 §4 Phase C.6 (2026-04-14).
 */
export function usersMatrix(): readonly CoverageCell[] {
  return [
    // Read: uid==userId || (companyId && belongsToCompany) || isSuperAdminOnly
    cell('super_admin', 'read', 'allow'),
    cell('super_admin', 'list', 'allow'),
    cell('same_tenant_admin', 'read', 'allow'),    // belongsToCompany('company-a')
    cell('same_tenant_admin', 'list', 'allow'),
    cell('same_tenant_user', 'read', 'allow'),     // uid==docId + belongsToCompany
    cell('same_tenant_user', 'list', 'allow'),     // belongsToCompany('company-a')
    cell('cross_tenant_admin', 'read', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'list', 'deny', 'cross_tenant'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    cell('anonymous', 'list', 'deny', 'missing_claim'),
    // Create: uid==userId || isCompanyAdminOfCompany(companyId)
    // Harness uses fresh docId → uid never matches; company admin leg exercised
    cell('super_admin', 'create', 'allow'),           // isCompanyAdminOfCompany → isSuperAdminOnly
    cell('same_tenant_admin', 'create', 'allow'),     // isCompanyAdminOfCompany for company-a
    cell('same_tenant_user', 'create', 'deny', 'insufficient_role'),  // uid!=fresh docId, not admin
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: uid==userId || isCompanyAdminOfCompany(companyId)
    // Seed docId = same_tenant_user.uid → uid==userId leg exercised
    cell('super_admin', 'update', 'allow'),           // isCompanyAdminOfCompany → isSuperAdminOnly
    cell('same_tenant_admin', 'update', 'allow'),     // isCompanyAdminOfCompany for company-a
    cell('same_tenant_user', 'update', 'allow'),      // uid == docId (seed doc)
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: allow delete: if false — user docs never client-deleted
    cell('super_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_user', 'delete', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}

/**
 * Matrix for pure ownership collections — `allow read, write: if isOwner(userId)`
 * where `userId` is the document path variable (the doc ID IS the owner's uid).
 *
 * Used by: `user_2fa_settings`, `user_notification_settings`.
 *
 * Key constraints from the harness:
 *   - read/update/delete: seed docId = same_tenant_user.uid → owner path exercised.
 *   - create: harness generates fresh docId (`${target.docId}-create-<timestamp>`) →
 *     uid never matches for ANY persona → all creates deny via harness constraint.
 *     Own-uid create (the real use case) is exercised in a dedicated regression
 *     block in each suite.
 *   - list: path-var rule cannot be evaluated for unrestricted queries →
 *     Firestore denies all unrestricted collection queries.
 *
 * Denial reason for authenticated non-owners: `insufficient_role` — they ARE
 * authenticated but the rule's floor is ownership (uid == docId), which they
 * don't satisfy. This is the closest semantic fit in the existing reason set.
 *
 * See ADR-298 §4 Phase C.6 (2026-04-14).
 */
export function ownerOnlyMatrix(): readonly CoverageCell[] {
  return [
    // Read (single get): isOwner(userId) — seed docId = same_tenant_user.uid
    cell('same_tenant_user', 'read', 'allow'),    // uid == docId ✓
    cell('super_admin', 'read', 'deny', 'insufficient_role'),
    cell('same_tenant_admin', 'read', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'read', 'deny', 'insufficient_role'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    // List (query): path-var rule — unrestricted queries denied for all personas
    cell('same_tenant_user', 'list', 'deny', 'insufficient_role'),
    cell('super_admin', 'list', 'deny', 'insufficient_role'),
    cell('same_tenant_admin', 'list', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'list', 'deny', 'insufficient_role'),
    cell('anonymous', 'list', 'deny', 'missing_claim'),
    // Create: isOwner(userId) — harness uses fresh docId → uid never matches
    cell('same_tenant_user', 'create', 'deny', 'insufficient_role'),
    cell('super_admin', 'create', 'deny', 'insufficient_role'),
    cell('same_tenant_admin', 'create', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'create', 'deny', 'insufficient_role'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: isOwner(userId) — seed docId = same_tenant_user.uid → owner allowed
    cell('same_tenant_user', 'update', 'allow'),  // uid == docId ✓
    cell('super_admin', 'update', 'deny', 'insufficient_role'),
    cell('same_tenant_admin', 'update', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'update', 'deny', 'insufficient_role'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: isOwner(userId) — seed docId = same_tenant_user.uid → owner allowed
    cell('same_tenant_user', 'delete', 'allow'),  // uid == docId ✓
    cell('super_admin', 'delete', 'deny', 'insufficient_role'),
    cell('same_tenant_admin', 'delete', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'delete', 'deny', 'insufficient_role'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}
