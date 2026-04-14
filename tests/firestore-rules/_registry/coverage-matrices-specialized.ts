/**
 * Firestore Rules Test Coverage — Specialized Matrix Builders (Phase C.7)
 *
 * Matrix functions for the 11 remaining collections in FIRESTORE_RULES_PENDING
 * added in ADR-298 Phase C.7 (2026-04-14). Extracted into a dedicated module
 * per the Google SRP 500-line rule.
 *
 * Patterns covered:
 *   - contact_relationships / contact_links → contactRelationshipsMatrix()
 *     (creator-only update/delete; any authenticated can create — no companyId gate)
 *   - relationships               → crmDirectMatrix() (re-export, not here)
 *   - relationship_audit          → systemGlobalMatrix() (re-export, not here)
 *   - employment_records          → employmentRecordsMatrix()
 *     (authenticated-only create/update; crossdoc OR companyId read; delete=false)
 *   - notifications               → notificationsMatrix()
 *     (userId-owned read+update; create/delete server-only)
 *   - audit_logs (top-level)      → systemGlobalMatrix() (re-export, not here)
 *   - system_audit_logs           → systemGlobalMatrix() (re-export, not here)
 *   - audit_log (Cloud Functions) → auditLogMatrix()
 *     (super_admin-only read; write=false)
 *   - search_documents            → searchDocumentsMatrix()
 *     (tenant read via tenantId field; write=server-only)
 *   - voice_commands              → voiceCommandsMatrix()
 *     (userId-owned read-only; all writes server-only)
 *
 * @module tests/firestore-rules/_registry/coverage-matrices-specialized
 * @since 2026-04-14 (ADR-298 Phase C.7)
 */

import type { CoverageCell } from './coverage-manifest';
import { cell } from './coverage-matrices';

// ---------------------------------------------------------------------------
// ADR-298 Phase C.7 — contact relationships / links
// ---------------------------------------------------------------------------

/**
 * Matrix for `contact_relationships` and `contact_links` — creator-ownership
 * update/delete with NO companyId gate on create.
 *
 * Rule shape:
 *   - read:   isSuperAdminOnly() || (has companyId && belongsToCompany) || creator fallback
 *   - create: isAuthenticated() + required fields — NO companyId check → any
 *             authenticated persona (including cross_tenant_admin) can create.
 *   - update: createdBy==uid || isSuperAdminOnly()
 *   - delete: createdBy==uid || isSuperAdminOnly()
 *
 * Key deltas vs crmDirectMatrix():
 *   - create: cross_tenant_admin ALLOW (no companyId gate — same_tenant_admin
 *             also allowed for this reason, not the company check).
 *   - update/delete: same_tenant_admin DENY — not a creator, not super_admin.
 *     isSuperAdminOnly() is the only admin bypass here.
 *
 * Test contract: seed doc carries companyId=SAME_TENANT_COMPANY_ID and
 * createdBy=same_tenant_user.uid so the creator path is exercised for
 * same_tenant_user × update/delete. super_admin passes via isSuperAdminOnly().
 *
 * Collections: `contact_relationships`, `contact_links`.
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 */
export function contactRelationshipsMatrix(): readonly CoverageCell[] {
  return [
    // Read: companyId-gated (seed carries SAME_TENANT_COMPANY_ID)
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
    // Create: isAuthenticated() + required fields only — NO companyId gate.
    // Any authenticated persona can create regardless of tenant.
    cell('super_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'allow'),
    cell('cross_tenant_admin', 'create', 'allow'), // authenticated, no companyId check
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: createdBy==uid || isSuperAdminOnly.
    // Seed doc: createdBy=same_tenant_user.uid → owner + super_admin allowed.
    // same_tenant_admin is NOT isSuperAdminOnly and NOT the creator → deny.
    cell('super_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'update', 'deny', 'insufficient_role'),
    cell('same_tenant_user', 'update', 'allow'),
    cell('cross_tenant_admin', 'update', 'deny', 'insufficient_role'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: same gate as update
    cell('super_admin', 'delete', 'allow'),
    cell('same_tenant_admin', 'delete', 'deny', 'insufficient_role'),
    cell('same_tenant_user', 'delete', 'allow'),
    cell('cross_tenant_admin', 'delete', 'deny', 'insufficient_role'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}

// ---------------------------------------------------------------------------
// ADR-298 Phase C.7 — employment records
// ---------------------------------------------------------------------------

/**
 * Matrix for `employment_records` — weak write gate (any authenticated) with
 * tenant-scoped reads and permanent delete prohibition.
 *
 * Rule shape:
 *   - read:   isSuperAdminOnly() || (companyId && belongsToCompany) ||
 *             (projectId && belongsToProjectCompany — crossdoc fallback)
 *   - create: isAuthenticated() + required fields (projectId, contactId, month,
 *             year, totalDaysWorked, insuranceClassNumber, stampsCount,
 *             employerContribution, employeeContribution, totalContribution,
 *             apdStatus, createdAt, updatedAt) + apdStatus enum
 *             NO companyId gate → any authenticated can create.
 *   - update: isAuthenticated() + projectId/contactId immutable
 *             NO companyId gate → any authenticated can update.
 *   - delete: `allow delete: if false` — legal documents, never client-deleted.
 *
 * Test contract: seed doc carries companyId=SAME_TENANT_COMPANY_ID (primary read
 * gate). Create data includes all required fields. Update data repeats projectId
 * and contactId from the seeded doc (immutability check).
 *
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 */
export function employmentRecordsMatrix(): readonly CoverageCell[] {
  return [
    // Read: companyId path used (seed carries SAME_TENANT_COMPANY_ID)
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
    // Create: isAuthenticated() + required fields — no companyId gate.
    // cross_tenant_admin IS authenticated → allowed by the rule as written.
    cell('super_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'allow'),
    cell('cross_tenant_admin', 'create', 'allow'), // authenticated, no tenant check
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: isAuthenticated() + field immutability only — no tenant check.
    cell('super_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),
    cell('same_tenant_user', 'update', 'allow'),
    cell('cross_tenant_admin', 'update', 'allow'), // authenticated, no tenant check
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: `allow delete: if false` — legal records are permanently immutable.
    cell('super_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_user', 'delete', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}

// ---------------------------------------------------------------------------
// ADR-298 Phase C.7 — notifications
// ---------------------------------------------------------------------------

/**
 * Matrix for `notifications` — userId-owned read and update; create/delete
 * are server-only.
 *
 * Rule shape:
 *   - read:   isAuthenticated() && (resource==null || userId==auth.uid)
 *             Single-doc reads pass for the owner; list passes if the query
 *             has a `where('userId', '==', auth.uid)` predicate.
 *   - update: isAuthenticated() && userId==auth.uid && isValidNotificationUpdate()
 *             Only allowed fields: delivery, seenAt, actedAt, actionId, dismissedAt.
 *   - create: `if false` — server-only (notification-orchestrator.ts).
 *   - delete: `if false` — server-only.
 *
 * Test contract: seed doc carries userId=same_tenant_user.uid. The listFilter
 * in the suite targets `where('userId', '==', same_tenant_user.uid)` — this
 * satisfies Firestore's query-predicate verification for the owner persona and
 * fails for all others (their auth.uid ≠ 'persona-same-user').
 *
 * Collections: `notifications`.
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 */
export function notificationsMatrix(): readonly CoverageCell[] {
  return [
    // Read: userId==auth.uid gate — only the owner can read
    cell('same_tenant_user', 'read', 'allow'),
    cell('same_tenant_user', 'list', 'allow'),
    cell('super_admin', 'read', 'deny', 'insufficient_role'),
    cell('super_admin', 'list', 'deny', 'insufficient_role'),
    cell('same_tenant_admin', 'read', 'deny', 'insufficient_role'),
    cell('same_tenant_admin', 'list', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'read', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'list', 'deny', 'insufficient_role'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    cell('anonymous', 'list', 'deny', 'missing_claim'),
    // Create: if false — server-only for every persona
    cell('super_admin', 'create', 'deny', 'server_only'),
    cell('same_tenant_admin', 'create', 'deny', 'server_only'),
    cell('same_tenant_user', 'create', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'create', 'deny', 'server_only'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: userId==auth.uid && isValidNotificationUpdate — owner only
    cell('same_tenant_user', 'update', 'allow'),
    cell('super_admin', 'update', 'deny', 'insufficient_role'),
    cell('same_tenant_admin', 'update', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'update', 'deny', 'insufficient_role'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: if false — server-only for every persona
    cell('super_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_user', 'delete', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}

// ---------------------------------------------------------------------------
// ADR-298 Phase C.7 — audit_log (Cloud Functions purge trail)
// ---------------------------------------------------------------------------

/**
 * Matrix for `audit_log` — super_admin-only read, write=false.
 *
 * Rule shape:
 *   - read:  `allow read: if isSuperAdminOnly()` — only super admin may read
 *            the Cloud Functions purge audit trail (Cloud Functions write via
 *            Admin SDK which bypasses rules).
 *   - write: `allow write: if false` — server-only.
 *
 * Collections: `audit_log`.
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 */
export function auditLogMatrix(): readonly CoverageCell[] {
  return [
    // Read: isSuperAdminOnly() — super admin only
    cell('super_admin', 'read', 'allow'),
    cell('super_admin', 'list', 'allow'),
    cell('same_tenant_admin', 'read', 'deny', 'insufficient_role'),
    cell('same_tenant_admin', 'list', 'deny', 'insufficient_role'),
    cell('same_tenant_user', 'read', 'deny', 'insufficient_role'),
    cell('same_tenant_user', 'list', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'read', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'list', 'deny', 'insufficient_role'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    cell('anonymous', 'list', 'deny', 'missing_claim'),
    // Write: if false — server-only (Cloud Functions Admin SDK)
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

// ---------------------------------------------------------------------------
// ADR-298 Phase C.7 — search_documents
// ---------------------------------------------------------------------------

/**
 * Matrix for `search_documents` — tenant-scoped read via `tenantId` field,
 * write=server-only (Cloud Functions / Admin SDK).
 *
 * Rule shape:
 *   - read:  `isSuperAdminOnly() || belongsToCompany(resource.data.tenantId)`
 *            Uses `tenantId` field (NOT `companyId`). Behavior identical to
 *            adminWriteOnlyMatrix() reads; differs only in field name.
 *   - write: `allow create, update, delete: if false` — universally denied.
 *
 * Test contract: seed doc carries `tenantId=SAME_TENANT_COMPANY_ID` (not
 * companyId). The listFilter targets `where('tenantId', '==', SAME_TENANT_COMPANY_ID)`.
 *
 * Collections: `search_documents`.
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 */
export function searchDocumentsMatrix(): readonly CoverageCell[] {
  return [
    // Read: isSuperAdminOnly() || belongsToCompany(tenantId)
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
    // Write: if false — universally server-only
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

// ---------------------------------------------------------------------------
// ADR-298 Phase C.7 — voice_commands
// ---------------------------------------------------------------------------

/**
 * Matrix for `voice_commands` — userId-owned read-only; all writes server-only.
 *
 * Rule shape:
 *   - read:  isAuthenticated() && userId==auth.uid — only the issuing user
 *            may read their own AI pipeline results.
 *   - write: `allow create, update, delete: if false` — API route + Admin SDK
 *            owns the lifecycle exclusively.
 *
 * Test contract: seed doc carries userId=same_tenant_user.uid. listFilter
 * targets `where('userId', '==', same_tenant_user.uid)` — passes for owner,
 * denied for all others (their auth.uid ≠ 'persona-same-user').
 *
 * Collections: `voice_commands`.
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 */
export function voiceCommandsMatrix(): readonly CoverageCell[] {
  return [
    // Read: userId==auth.uid — only owner can read
    cell('same_tenant_user', 'read', 'allow'),
    cell('same_tenant_user', 'list', 'allow'),
    cell('super_admin', 'read', 'deny', 'insufficient_role'),
    cell('super_admin', 'list', 'deny', 'insufficient_role'),
    cell('same_tenant_admin', 'read', 'deny', 'insufficient_role'),
    cell('same_tenant_admin', 'list', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'read', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'list', 'deny', 'insufficient_role'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    cell('anonymous', 'list', 'deny', 'missing_claim'),
    // Write: if false — server-only for all personas
    cell('super_admin', 'create', 'deny', 'server_only'),
    cell('super_admin', 'update', 'deny', 'server_only'),
    cell('super_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_admin', 'create', 'deny', 'server_only'),
    cell('same_tenant_admin', 'update', 'deny', 'server_only'),
    cell('same_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_user', 'create', 'deny', 'server_only'),
    cell('same_tenant_user', 'update', 'deny', 'server_only'),
    cell('same_tenant_user', 'delete', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'create', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'update', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'delete', 'deny', 'server_only'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
  ];
}
