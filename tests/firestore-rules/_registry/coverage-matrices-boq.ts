/**
 * Firestore Rules Test Coverage — BoQ / Commissions / Ownership Matrix Builders
 * (Phase C.4)
 *
 * Matrix functions for the BoQ, brokerage, commission, and ownership collections
 * added in ADR-298 Phase C.4 (2026-04-14). Extracted into a dedicated module per
 * the Google SRP 500-line rule.
 *
 * Patterns covered:
 *   - boq_items           → fileTenantFullMatrix() verbatim (re-export from dxf)
 *   - boq_categories      → boqCategoriesMatrix() (read-only: write = if false)
 *   - brokerage_agreements → brokerageMatrix() (creator-only delete)
 *   - commission_records   → commissionRecordsMatrix() (super-only delete)
 *   - ownership_tables     → ownershipTablesMatrix() (super-only delete, companyId update)
 *
 * @module tests/firestore-rules/_registry/coverage-matrices-boq
 * @since 2026-04-14 (ADR-298 Phase C.4)
 */

import type { CoverageCell } from './coverage-manifest';
import { cell } from './coverage-matrices';

// ---------------------------------------------------------------------------
// ADR-298 Phase C.4 — BoQ / Commissions / Ownership collections
// ---------------------------------------------------------------------------

/**
 * Matrix for `boq_categories` — company-specific BOQ category overrides.
 *
 * Rule shape:
 *   - read:   isSuperAdminOnly() || (companyId && belongsToCompany) || !companyId (system defaults)
 *   - write:  `allow create, update, delete: if false` — reserved for future admin UI
 *
 * All write operations denied for every persona. The `server_only` reason is used
 * for same-tenant personas; `cross_tenant` for cross-tenant personas (consistent
 * with `adminWriteOnlyMatrix` convention).
 *
 * Seeded doc carries `companyId = SAME_TENANT_COMPANY_ID` so the cross-tenant read
 * denial path is exercised for cross_tenant_admin.
 *
 * See ADR-298 §4 Phase C.4 (2026-04-14).
 */
export function boqCategoriesMatrix(): readonly CoverageCell[] {
  return [
    // Read: isSuperAdminOnly || (companyId && belongsToCompany) || !companyId
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
    // Write: if false — reserved for future admin UI (not a tenant/role gate)
    cell('super_admin', 'create', 'deny', 'server_only'),
    cell('super_admin', 'update', 'deny', 'server_only'),
    cell('super_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_admin', 'create', 'deny', 'server_only'),
    cell('same_tenant_admin', 'update', 'deny', 'server_only'),
    cell('same_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_user', 'create', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
  ];
}

/**
 * Matrix for `brokerage_agreements` — agent contract records with creator-gated delete.
 *
 * Rule shape:
 *   - read:   isSuperAdminOnly() || (companyId && belongsToCompany) || legacy createdBy
 *   - create: isSuperAdminOnly() || companyId == getUserCompanyId()
 *   - update: createdBy==uid || isCompanyAdminOfCompany(companyId) || isSuperAdminOnly()
 *   - delete: createdBy==uid || isSuperAdminOnly()
 *             (NO isCompanyAdminOfCompany leg — company admin cannot delete)
 *
 * Key delta from `fileTenantFullMatrix()`:
 *   - same_tenant_admin × delete → DENY (not creator, not super_admin)
 *
 * Test contract: seed doc carries `createdBy = same_tenant_user.uid` so:
 *   - same_tenant_user × update/delete → allow (uid == createdBy)
 *   - same_tenant_admin × update → allow (isCompanyAdminOfCompany)
 *   - same_tenant_admin × delete → deny (not creator, not super)
 *
 * See ADR-298 §4 Phase C.4 (2026-04-14).
 */
export function brokerageMatrix(): readonly CoverageCell[] {
  return [
    // Read: isSuperAdminOnly || (companyId && belongsToCompany)
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
    // Create: isSuperAdminOnly || companyId == getUserCompanyId()
    cell('super_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'allow'),
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly
    cell('super_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),   // isCompanyAdminOfCompany
    cell('same_tenant_user', 'update', 'allow'),    // createdBy==uid (seed doc)
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: createdBy==uid || isSuperAdminOnly  (NO isCompanyAdminOfCompany)
    cell('super_admin', 'delete', 'allow'),
    cell('same_tenant_admin', 'delete', 'deny', 'insufficient_role'),  // not creator, not super
    cell('same_tenant_user', 'delete', 'allow'),    // createdBy==uid (seed doc)
    cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}

/**
 * Matrix for `commission_records` — commission payment records with super-only delete.
 *
 * Rule shape:
 *   - read:   isSuperAdminOnly() || (companyId && belongsToCompany) || legacy createdBy
 *   - create: isSuperAdminOnly() || companyId == getUserCompanyId()
 *   - update: createdBy==uid || isCompanyAdminOfCompany(companyId) || isSuperAdminOnly()
 *   - delete: isSuperAdminOnly() ONLY
 *             (no createdBy leg — unlike brokerage_agreements)
 *
 * Key delta from `brokerageMatrix()`:
 *   - same_tenant_user × delete → DENY (super-only delete, not creator-based)
 *
 * Test contract: seed doc carries `createdBy = same_tenant_user.uid` so the
 * update `uid == createdBy` leg is exercised for same_tenant_user.
 *
 * See ADR-298 §4 Phase C.4 (2026-04-14).
 */
export function commissionRecordsMatrix(): readonly CoverageCell[] {
  return [
    // Read: isSuperAdminOnly || (companyId && belongsToCompany)
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
    // Create: isSuperAdminOnly || companyId == getUserCompanyId()
    cell('super_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'allow'),
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly
    cell('super_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),   // isCompanyAdminOfCompany
    cell('same_tenant_user', 'update', 'allow'),    // createdBy==uid (seed doc)
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: isSuperAdminOnly ONLY
    cell('super_admin', 'delete', 'allow'),
    cell('same_tenant_admin', 'delete', 'deny', 'insufficient_role'),
    cell('same_tenant_user', 'delete', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}

/**
 * Matrix for `ownership_tables` — property ownership percentage tables (χιλιοστά).
 *
 * Rule shape:
 *   - read:   isSuperAdminOnly() || (companyId && belongsToCompany) || legacy createdBy
 *   - create: isSuperAdminOnly() || companyId == getUserCompanyId()
 *   - update: isSuperAdminOnly() || (companyId && belongsToCompany) || legacy createdBy
 *   - delete: isSuperAdminOnly() ONLY
 *
 * Key delta: both same_tenant_admin and same_tenant_user denied on delete.
 * Update uses `belongsToCompany` (not createdBy), so no creator contract needed —
 * any same-tenant member can update; only super_admin can delete.
 *
 * See ADR-298 §4 Phase C.4 (2026-04-14).
 */
export function ownershipTablesMatrix(): readonly CoverageCell[] {
  return [
    // Read: isSuperAdminOnly || (companyId && belongsToCompany)
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
    // Create: isSuperAdminOnly || companyId == getUserCompanyId()
    cell('super_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'allow'),
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: isSuperAdminOnly || (companyId && belongsToCompany)
    cell('super_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),   // belongsToCompany
    cell('same_tenant_user', 'update', 'allow'),    // belongsToCompany
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: isSuperAdminOnly ONLY
    cell('super_admin', 'delete', 'allow'),
    cell('same_tenant_admin', 'delete', 'deny', 'insufficient_role'),
    cell('same_tenant_user', 'delete', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}
