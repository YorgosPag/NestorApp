/**
 * Firestore Rules Test Coverage — DXF / CAD / Floorplan / File Matrix Builders
 * (Phase C.2 + C.3)
 *
 * Matrix functions for the DXF/CAD/floorplan and file-management collections
 * added in ADR-298 Phase C.2+C.3 (2026-04-14). Extracted into a dedicated
 * module per the Google SRP 500-line rule.
 *
 * Patterns covered:
 *   - DXF/floorplan collections       → crmDirectMatrix() verbatim (re-export)
 *   - unit_floorplans / doc_templates / file_folders → fileTenantFullMatrix()
 *   - cad_files                       → cadFilesMatrix() (permissive write)
 *   - file_audit_log                  → fileAuditLogMatrix() (no super on read)
 *   - file_shares                     → fileSharesMatrix() (public read)
 *   - photo_shares                    → photoSharesMatrix() (super-only delete)
 *   - file_comments                   → fileCommentsMatrix() (author delete)
 *   - file_approvals                  → fileApprovalsMatrix() (delete deny)
 *   - file_webhooks                   → denyAllMatrix() (re-export from accounting)
 *
 * @module tests/firestore-rules/_registry/coverage-matrices-dxf
 * @since 2026-04-14 (ADR-298 Phase C.2+C.3)
 */

import type { CoverageCell } from './coverage-manifest';
import { cell } from './coverage-matrices';

// ---------------------------------------------------------------------------
// ADR-298 Phase C.2 — DXF / CAD / Floorplan collections
// ---------------------------------------------------------------------------

/**
 * Matrix for DXF/floorplan/template collections where tenant members have
 * full CRUD and super_admin is allowed on all ops (including create).
 *
 * Rule shape:
 *   - read:   `isSuperAdminOnly() || belongsToCompany(companyId)` (or legacy createdBy)
 *   - create: `isSuperAdminOnly() || companyId == getUserCompanyId()`
 *   - update: `(createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly) && companyId immutable`
 *   - delete: `createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly`
 *
 * Delta from `crmDirectMatrix()`: `super_admin × create` → ALLOW (the rule
 * has an `isSuperAdminOnly()` OR-leg on create).
 *
 * Used by: `unit_floorplans`, `document_templates`, `file_folders`.
 *
 * See ADR-298 §4 Phase C.2+C.3 (2026-04-14).
 */
export function fileTenantFullMatrix(): readonly CoverageCell[] {
  return [
    // Read: isSuperAdminOnly || belongsToCompany
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
    // Update: isSuperAdminOnly || isCompanyAdminOfCompany || createdBy==uid
    cell('super_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),
    cell('same_tenant_user', 'update', 'allow'),
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: same gate as update
    cell('super_admin', 'delete', 'allow'),
    cell('same_tenant_admin', 'delete', 'allow'),
    cell('same_tenant_user', 'delete', 'allow'),
    cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}

/**
 * Matrix for `cad_files` — DXF metadata store with permissive authenticated
 * writes (no companyId check on create/update) but tenant-scoped read/delete.
 *
 * Rule shape:
 *   - read/delete: `isSuperAdminOnly || (companyId && belongsToCompany) || (!companyId && createdBy==uid)`
 *   - create/update: `isAuthenticated() && fileName present && non-empty`
 *     ← NO companyId restriction — any authenticated user can write
 *
 * Key delta: `cross_tenant_admin × create/update` → ALLOW.
 * The rule enforces only `isAuthenticated() + fileName` on writes; the
 * companyId field in the doc is advisory, not a write gate.
 *
 * See ADR-298 §4 Phase C.2 (2026-04-14).
 */
export function cadFilesMatrix(): readonly CoverageCell[] {
  return [
    // Read: tenant-scoped (super || belongsToCompany || legacy createdBy)
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
    // Create/update: isAuthenticated() + fileName — NO companyId check
    // cross_tenant_admin is authenticated → ALLOW (intentional permissive rule)
    cell('super_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'allow'),
    cell('cross_tenant_admin', 'create', 'allow'),  // authenticated, no companyId gate
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    cell('super_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),
    cell('same_tenant_user', 'update', 'allow'),
    cell('cross_tenant_admin', 'update', 'allow'),  // authenticated, no companyId gate
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: tenant-scoped (isSuperAdminOnly || belongsToCompany || legacy createdBy)
    cell('super_admin', 'delete', 'allow'),
    cell('same_tenant_admin', 'delete', 'allow'),
    cell('same_tenant_user', 'delete', 'allow'),
    cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}

// ---------------------------------------------------------------------------
// ADR-298 Phase C.3 — File management collections
// ---------------------------------------------------------------------------

/**
 * Matrix for `file_audit_log` — append-only audit trail with tenant-scoped
 * reads (no `isSuperAdminOnly()` on the read gate) and server-only mutability.
 *
 * Rule shape:
 *   - read:   `isAuthenticated() && belongsToCompany(companyId)` — no super bypass
 *   - create: `isAuthenticated() && (isSuperAdminOnly() || companyId==getUserCompanyId())`
 *   - update/delete: `if false` — immutable
 *
 * Key delta: `super_admin × read/list` → DENY. The read rule uses
 * `belongsToCompany()` with no `isSuperAdminOnly()` short-circuit, so
 * super_admin (companyId='company-root') fails the tenant gate.
 *
 * See ADR-298 §4 Phase C.3 (2026-04-14).
 */
export function fileAuditLogMatrix(): readonly CoverageCell[] {
  return [
    // Read: belongsToCompany only — no isSuperAdminOnly bypass on read!
    cell('super_admin', 'read', 'deny', 'cross_tenant'),  // company-root != company-a
    cell('super_admin', 'list', 'deny', 'cross_tenant'),
    cell('same_tenant_admin', 'read', 'allow'),
    cell('same_tenant_admin', 'list', 'allow'),
    cell('same_tenant_user', 'read', 'allow'),
    cell('same_tenant_user', 'list', 'allow'),
    cell('cross_tenant_admin', 'read', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'list', 'deny', 'cross_tenant'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    cell('anonymous', 'list', 'deny', 'missing_claim'),
    // Create: isSuperAdminOnly || companyId==getUserCompanyId()
    cell('super_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'allow'),
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update/delete: if false — immutable audit trail
    cell('super_admin', 'update', 'deny', 'immutable'),
    cell('same_tenant_admin', 'update', 'deny', 'immutable'),
    cell('cross_tenant_admin', 'update', 'deny', 'immutable'),
    cell('anonymous', 'update', 'deny', 'immutable'),
    cell('super_admin', 'delete', 'deny', 'immutable'),
    cell('same_tenant_admin', 'delete', 'deny', 'immutable'),
    cell('cross_tenant_admin', 'delete', 'deny', 'immutable'),
    cell('anonymous', 'delete', 'deny', 'immutable'),
  ];
}

/**
 * Matrix for `file_shares` — shareable file links with public read.
 *
 * Rule shape:
 *   - read/list: `if true` — public, including anonymous
 *   - create: `isAuthenticated() && (isSuperAdminOnly || companyId==getUserCompanyId())`
 *   - update: `(isAuthenticated && (isSuperAdminOnly || belongsToCompany))
 *              || (public download counter — only downloadCount/lastDownloadedAt)`
 *             Matrix tests use a non-counter update → only tenant members allowed.
 *   - delete: `isAuthenticated() && resource.data.createdBy == request.auth.uid`
 *             Seed doc: createdBy = same_tenant_user.uid → only same_tenant_user can delete.
 *
 * See ADR-298 §4 Phase C.3 (2026-04-14).
 */
export function fileSharesMatrix(): readonly CoverageCell[] {
  return [
    // Read: if true — public access for share token validation
    cell('super_admin', 'read', 'allow'),
    cell('super_admin', 'list', 'allow'),
    cell('same_tenant_admin', 'read', 'allow'),
    cell('same_tenant_admin', 'list', 'allow'),
    cell('same_tenant_user', 'read', 'allow'),
    cell('same_tenant_user', 'list', 'allow'),
    cell('cross_tenant_admin', 'read', 'allow'),  // if true — no tenant gate
    cell('cross_tenant_admin', 'list', 'allow'),
    cell('anonymous', 'read', 'allow'),   // public read for share token pages
    cell('anonymous', 'list', 'allow'),
    // Create: tenant-scoped (isSuperAdminOnly || companyId match)
    cell('super_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'allow'),
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update (general, non-counter): isSuperAdminOnly || belongsToCompany
    cell('super_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),
    cell('same_tenant_user', 'update', 'allow'),
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: createdBy == request.auth.uid (seed: createdBy=same_tenant_user.uid)
    cell('super_admin', 'delete', 'deny', 'server_only'),    // uid mismatch
    cell('same_tenant_admin', 'delete', 'deny', 'server_only'), // uid mismatch
    cell('same_tenant_user', 'delete', 'allow'),            // uid == createdBy
    cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}

/**
 * Matrix for `photo_shares` — CRM contact photo share history.
 *
 * Rule shape:
 *   - read:   `isAuthenticated() && (isSuperAdminOnly || belongsToCompany)`
 *   - create: `isAuthenticated() && (isSuperAdminOnly || companyId==getUserCompanyId())`
 *   - update: `if false` — immutable records
 *   - delete: `isSuperAdminOnly()` — super admin only
 *
 * See ADR-298 §4 Phase C.3 (2026-04-14).
 */
export function photoSharesMatrix(): readonly CoverageCell[] {
  return [
    // Read: isSuperAdminOnly || belongsToCompany
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
    // Update: if false — immutable
    cell('super_admin', 'update', 'deny', 'immutable'),
    cell('same_tenant_admin', 'update', 'deny', 'immutable'),
    cell('cross_tenant_admin', 'update', 'deny', 'immutable'),
    cell('anonymous', 'update', 'deny', 'immutable'),
    // Delete: isSuperAdminOnly() only
    cell('super_admin', 'delete', 'allow'),
    cell('same_tenant_admin', 'delete', 'deny', 'insufficient_role'),
    cell('same_tenant_user', 'delete', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'delete', 'deny', 'insufficient_role'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}

/**
 * Matrix for `file_comments` — threaded file comments with author-owned delete.
 *
 * Rule shape:
 *   - read:   `isAuthenticated() && belongsToCompany(companyId)` — no super bypass
 *   - create: `isAuthenticated() && (isSuperAdminOnly || companyId==getUserCompanyId())`
 *   - update: `isAuthenticated() && belongsToCompany && authorId immutable`
 *             Any same-tenant member can update as long as authorId isn't changed.
 *   - delete: `isAuthenticated() && belongsToCompany && resource.data.authorId==uid`
 *             Only the author can delete. Seed: authorId = same_tenant_user.uid.
 *
 * Key deltas:
 *   - `super_admin × read/list/update/delete` → DENY: `belongsToCompany()` has no
 *     `isSuperAdminOnly()` bypass (company-root ≠ company-a).
 *   - `same_tenant_admin × delete` → DENY: authorId ('persona-same-user') ≠ admin uid.
 *
 * See ADR-298 §4 Phase C.3 (2026-04-14).
 */
export function fileCommentsMatrix(): readonly CoverageCell[] {
  return [
    // Read: belongsToCompany only — no isSuperAdminOnly bypass
    cell('super_admin', 'read', 'deny', 'cross_tenant'),
    cell('super_admin', 'list', 'deny', 'cross_tenant'),
    cell('same_tenant_admin', 'read', 'allow'),
    cell('same_tenant_admin', 'list', 'allow'),
    cell('same_tenant_user', 'read', 'allow'),
    cell('same_tenant_user', 'list', 'allow'),
    cell('cross_tenant_admin', 'read', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'list', 'deny', 'cross_tenant'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    cell('anonymous', 'list', 'deny', 'missing_claim'),
    // Create: isSuperAdminOnly || companyId match
    cell('super_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'allow'),
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: belongsToCompany && authorId NOT changed
    // super_admin: belongsToCompany fails → deny
    cell('super_admin', 'update', 'deny', 'cross_tenant'),
    cell('same_tenant_admin', 'update', 'allow'),  // belongsToCompany + authorId preserved
    cell('same_tenant_user', 'update', 'allow'),   // belongsToCompany + authorId preserved
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: belongsToCompany && authorId == request.auth.uid
    // Seed: authorId = same_tenant_user.uid
    cell('super_admin', 'delete', 'deny', 'cross_tenant'),
    cell('same_tenant_admin', 'delete', 'deny', 'insufficient_role'),  // authorId != admin uid
    cell('same_tenant_user', 'delete', 'allow'),  // authorId == same_tenant_user.uid
    cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}

/**
 * Matrix for `file_approvals` — multi-step approval chains, immutable delete.
 *
 * Rule shape:
 *   - read/update: `isAuthenticated() && (isSuperAdminOnly || (companyId && belongsToCompany))`
 *   - create: `isAuthenticated() && hasAny(['companyId']) && (isSuperAdminOnly || companyId==getUserCompanyId())`
 *   - delete: `if false` — approval records are immutable
 *
 * See ADR-298 §4 Phase C.3 (2026-04-14).
 */
export function fileApprovalsMatrix(): readonly CoverageCell[] {
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
    // Create: isSuperAdminOnly || companyId match
    cell('super_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'allow'),
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: same as read
    cell('super_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),
    cell('same_tenant_user', 'update', 'allow'),
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: if false — immutable
    cell('super_admin', 'delete', 'deny', 'immutable'),
    cell('same_tenant_admin', 'delete', 'deny', 'immutable'),
    cell('cross_tenant_admin', 'delete', 'deny', 'immutable'),
    cell('anonymous', 'delete', 'deny', 'immutable'),
  ];
}
