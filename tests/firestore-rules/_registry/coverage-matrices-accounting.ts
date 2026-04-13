/**
 * Firestore Rules Test Coverage — Accounting Matrix Builders (Phase C.1)
 *
 * Matrix functions for the accounting collections added in ADR-298 Phase C.1
 * (2026-04-13). Extracted from `coverage-matrices.ts` per the Google SRP
 * 500-line rule — the parent module hit the limit when Phase C.1 functions
 * were added.
 *
 * The four patterns here correspond to the four rule shapes found in
 * `firestore.rules` lines 3111–3177 (Pattern C/D/E/F in the accounting block):
 *   - `fiscalPeriodMatrix`        → Pattern C: Q8 SAP state-machine
 *   - `accountingSingletonMatrix` → Pattern D: settings singletons (admin-write)
 *   - `denyAllMatrix`             → Pattern E: server-only, no client access
 *   - `accountingSystemCalcMatrix`→ Pattern F: system-calculated balances
 *
 * @module tests/firestore-rules/_registry/coverage-matrices-accounting
 * @since 2026-04-13 (ADR-298 Phase C.1)
 */

import type { CoverageCell } from './coverage-manifest';
import { cell } from './coverage-matrices';

// ---------------------------------------------------------------------------
// ADR-298 Phase C.1 — remaining accounting collections
// ---------------------------------------------------------------------------

/**
 * Matrix for `accounting_fiscal_periods` — Q8 SAP-pattern state machine.
 *
 * Key deltas from `roleDualMatrix()`:
 *   - create: `isCompanyAdminOfCompany(companyId) && companyId==getUserCompanyId()`.
 *     super_admin passes `isCompanyAdminOfCompany` (via `isSuperAdminOnly`) but
 *     fails `getUserCompanyId()=='company-a'` (their claim is 'company-root') →
 *     denied (cross_tenant). same_tenant_user fails `isCompanyAdminOfCompany`
 *     (internal_user role) → denied (insufficient_role).
 *   - update: `isInternalUserOfCompany(companyId) && companyId immutable &&
 *     state-machine gate`. Test seeds an OPEN doc and writes a same-status delta
 *     (`updatedAt`) so every internal-user persona exercises the first arm
 *     (status not changing → allow). super_admin reaches `isInternalUserOfCompany`
 *     via `isSuperAdminOnly()` → allowed.
 *   - delete: `if false` → server_only for all personas.
 *
 * See ADR-298 §4 Phase C.1 (2026-04-13).
 */
export function fiscalPeriodMatrix(): readonly CoverageCell[] {
  return [
    // Read: canReadAccounting = isSuperAdminOnly || isInternalUserOfCompany
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
    // Create: isCompanyAdminOfCompany + companyId==getUserCompanyId()
    cell('super_admin', 'create', 'deny', 'cross_tenant'),           // getUserCompanyId()='company-root' != doc companyId
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'deny', 'insufficient_role'), // internal_user not company_admin
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: isInternalUserOfCompany + state-machine (test seeds status-neutral delta)
    cell('super_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),
    cell('same_tenant_user', 'update', 'allow'),
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: if false — no client deletion of fiscal periods (business invariant)
    cell('super_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_user', 'delete', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('anonymous', 'delete', 'deny', 'server_only'),
  ];
}

/**
 * Matrix for accounting settings singletons (`accounting_settings`,
 * `accounting_efka_config`) — admin-only write, internal-user read.
 *
 * Rule shape (Pattern D):
 *   - read:   `isAuthenticated() && (isSuperAdminOnly() || isInternalUserOfCompany(companyId))`
 *   - create: `isCompanyAdmin() && companyId == getUserCompanyId()`
 *     super_admin: `isCompanyAdmin()`=true (role=super_admin) but getUserCompanyId()=
 *     'company-root' != 'company-a' → deny (cross_tenant). same_tenant_user:
 *     `isCompanyAdmin()`=false (internal_user) → deny (insufficient_role).
 *   - update: `canWriteAccountingSingleton(companyId)` = `isCompanyAdminOfCompany(companyId)`
 *     → same_tenant_user denied (insufficient_role), super_admin allowed via
 *     `isSuperAdminOnly()` short-circuit.
 *   - delete: `if false` → server_only for all.
 *
 * See ADR-298 §4 Phase C.1 (2026-04-13).
 */
export function accountingSingletonMatrix(): readonly CoverageCell[] {
  return [
    // Read: isSuperAdminOnly || isInternalUserOfCompany
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
    // Create: isCompanyAdmin() && companyId==getUserCompanyId()
    cell('super_admin', 'create', 'deny', 'cross_tenant'),           // getUserCompanyId() mismatch
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'deny', 'insufficient_role'), // internal_user != company_admin
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: canWriteAccountingSingleton = isCompanyAdminOfCompany
    cell('super_admin', 'update', 'allow'),                          // isSuperAdminOnly short-circuit
    cell('same_tenant_admin', 'update', 'allow'),
    cell('same_tenant_user', 'update', 'deny', 'insufficient_role'), // role floor = company_admin
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: if false
    cell('super_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_user', 'delete', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('anonymous', 'delete', 'deny', 'server_only'),
  ];
}

/**
 * Matrix for completely server-managed collections (`accounting_invoice_counters`).
 *
 * Rule: `allow read, write: if false` — no client access whatsoever.
 * All operations for all personas are denied with `server_only` reason.
 *
 * The distinction from `immutableMatrix()` is that **reads are also blocked**
 * (invoice counters contain internal sequencing data; only the Admin SDK
 * increments and reads them server-side).
 *
 * See ADR-298 §4 Phase C.1 (2026-04-13).
 */
export function denyAllMatrix(): readonly CoverageCell[] {
  return [
    cell('super_admin', 'read', 'deny', 'server_only'),
    cell('super_admin', 'list', 'deny', 'server_only'),
    cell('same_tenant_admin', 'read', 'deny', 'server_only'),
    cell('same_tenant_admin', 'list', 'deny', 'server_only'),
    cell('same_tenant_user', 'read', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'read', 'deny', 'server_only'),
    cell('anonymous', 'read', 'deny', 'server_only'),
    cell('super_admin', 'create', 'deny', 'server_only'),
    cell('same_tenant_admin', 'create', 'deny', 'server_only'),
    cell('same_tenant_user', 'create', 'deny', 'server_only'),
    cell('anonymous', 'create', 'deny', 'server_only'),
    cell('super_admin', 'update', 'deny', 'server_only'),
    cell('same_tenant_admin', 'update', 'deny', 'server_only'),
    cell('super_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_admin', 'delete', 'deny', 'server_only'),
  ];
}

/**
 * Matrix for system-calculated accounting collections (`accounting_customer_balances`).
 *
 * Rule shape (Pattern F):
 *   - read:   `canReadAccounting(companyId)` — identical to roleDualMatrix reads.
 *   - create: `canCreateAccountingSystem()` = `isInternalUser() && companyId==getUserCompanyId()`.
 *     No `createdBy==uid` requirement (system-generated, no human author).
 *     super_admin's companyId 'company-root' ≠ 'company-a' → denied (cross_tenant).
 *   - update: `canUpdateAccountingSystem(companyId)` = `isInternalUserOfCompany(companyId)`
 *     + companyId immutable. All internal personas allowed; super_admin via
 *     `isSuperAdminOnly()` inside `isInternalUserOfCompany`.
 *   - delete: `isCompanyAdminOfCompany(companyId)` — admin cleans up stale balances.
 *     same_tenant_user denied (insufficient_role), cross_tenant denied.
 *
 * See ADR-298 §4 Phase C.1 (2026-04-13).
 */
export function accountingSystemCalcMatrix(): readonly CoverageCell[] {
  return [
    // Read: same as roleDualMatrix
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
    // Create: canCreateAccountingSystem — no createdBy required, companyId must match
    cell('super_admin', 'create', 'deny', 'cross_tenant'),    // 'company-root' != 'company-a'
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'allow'),              // isInternalUser + companyId match
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: canUpdateAccountingSystem = isInternalUserOfCompany + companyId immutable
    cell('super_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),
    cell('same_tenant_user', 'update', 'allow'),
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: isCompanyAdminOfCompany — admin-only cleanup
    cell('super_admin', 'delete', 'allow'),
    cell('same_tenant_admin', 'delete', 'allow'),
    cell('same_tenant_user', 'delete', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}
