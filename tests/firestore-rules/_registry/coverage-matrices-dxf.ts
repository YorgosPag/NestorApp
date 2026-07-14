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
import { cell, overrideCells } from './coverage-matrices';

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


/**
 * ADR-657 PRESENTATION-tier matrix — the shared RBAC shape for every BIM /
 * floorplan collection whose reads stay tenant-wide while writes require an
 * internal user of the tenant.
 *
 * Read/list gate → `canReadBimPresentation(cid)` = `isSuperAdminOnly() ||
 *   belongsToCompany(cid)`. So `external_user` of the SAME tenant is ALLOWED to
 *   read/list — `belongsToCompany()` matches on the companyId claim and never
 *   inspects the role. That is the whole reason the presentation tier exists:
 *   /properties and the Buildings/Projects floorplan tabs (ADR-370) render for
 *   the client, whose default self-registration role is `external_user`.
 * Write gate → `isBimWriter(cid)` / `canCreateBimEntity()` — internal user of
 *   the tenant only. `external_user` is DENIED create/update/delete with
 *   `insufficient_role` (authed + tenant OK, but role below the writer floor).
 *
 * Cross-tenant personas fail the companyId leg on every op (`cross_tenant`);
 * `anonymous` fails the `isAuthenticated()` floor (`missing_claim`).
 *
 * Used by `floorplan_backgrounds`, `floorplan_overlays`, `floorplan_walls`,
 * `floorplan_stairs`, and — via `legacyFloorplanMatrix()` — the 5 legacy
 * containers. `bimAuthoringMatrix()` derives from it with a 2-cell delta.
 */
export function bimPresentationMatrix(): readonly CoverageCell[] {
  return [
    // super_admin — isSuperAdminOnly() short-circuits every op.
    cell('super_admin', 'read', 'allow'),
    cell('super_admin', 'list', 'allow'),
    cell('super_admin', 'create', 'allow'),
    cell('super_admin', 'update', 'allow'),
    cell('super_admin', 'delete', 'allow'),
    // same_tenant_admin — internal user of the tenant: full CRUD.
    cell('same_tenant_admin', 'read', 'allow'),
    cell('same_tenant_admin', 'list', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'delete', 'allow'),
    // same_tenant_user — internal user of the tenant: full CRUD.
    cell('same_tenant_user', 'read', 'allow'),
    cell('same_tenant_user', 'list', 'allow'),
    cell('same_tenant_user', 'create', 'allow'),
    cell('same_tenant_user', 'update', 'allow'),
    cell('same_tenant_user', 'delete', 'allow'),
    // cross_tenant_admin — companyId claim mismatch kills every op.
    cell('cross_tenant_admin', 'read', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'list', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
    // cross_tenant_user — companyId claim mismatch kills every op.
    cell('cross_tenant_user', 'read', 'deny', 'cross_tenant'),
    cell('cross_tenant_user', 'list', 'deny', 'cross_tenant'),
    cell('cross_tenant_user', 'create', 'deny', 'cross_tenant'),
    cell('cross_tenant_user', 'update', 'deny', 'cross_tenant'),
    cell('cross_tenant_user', 'delete', 'deny', 'cross_tenant'),
    // external_user — same tenant, so read/list PASS (belongsToCompany leg);
    // writes fail the internal-user floor.
    cell('external_user', 'read', 'allow'),
    cell('external_user', 'list', 'allow'),
    cell('external_user', 'create', 'deny', 'insufficient_role'),
    cell('external_user', 'update', 'deny', 'insufficient_role'),
    cell('external_user', 'delete', 'deny', 'insufficient_role'),
    // anonymous — no claims: isAuthenticated() floor denies every op.
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    cell('anonymous', 'list', 'deny', 'missing_claim'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}

/**
 * ADR-657 AUTHORING-tier matrix — identical to `bimPresentationMatrix()`
 * EXCEPT read + list flip `external_user` to DENY `insufficient_role`.
 *
 * Read/list gate → `canReadBimAuthoring(cid)` = `isInternalUserOfCompany(cid)`.
 * The hole ADR-657 closed: authoring data (roofs, foundations, topo, all MEP,
 * furniture, symbols, hatches, grid guides, …) lives inside /dxf/viewer behind
 * AdminGuard and must never be reachable by `external_user`. So `external_user`
 * is denied ALL FIVE ops.
 *
 * The two overridden cells are the entire security delta between the tiers —
 * declaring them as a delta over the presentation base keeps that one-line
 * difference auditable from this file alone (no 35-cell clone).
 */
export function bimAuthoringMatrix(): readonly CoverageCell[] {
  return overrideCells(bimPresentationMatrix(), [
    cell('external_user', 'read', 'deny', 'insufficient_role'),
    cell('external_user', 'list', 'deny', 'insufficient_role'),
  ]);
}

/**
 * ADR-657 legacy-container matrix — the 5 pre-tier floorplan containers
 * (`floorplans` + `project_`/`building_`/`floor_`/`unit_floorplans`). They sit
 * in the PRESENTATION tier and, for the canonical fixture (a doc that DOES
 * carry `companyId`, owned by `same_tenant_user`), every cell coincides with
 * `bimPresentationMatrix()` — so this delegates rather than clone 35 cells.
 *
 * The legacy rule bodies differ from the entity blocks in two ways that only
 * surface OUTSIDE the canonical matrix (exercised by suite hardening blocks,
 * not by cells):
 *   - create uses `canCreateLegacyFloorplan()` — NO `createdBy == uid` leg (the
 *     containers predate the scope-key contract), so a member may create a
 *     container without stamping their own uid.
 *   - read uses `canReadLegacyFloorplan()` — which has a creator-only fallback
 *     leg for docs missing `companyId` entirely (`belongsToCompany` can't gate
 *     a field that isn't there).
 * Neither changes the outcome for a well-formed, companyId-bearing document,
 * which is what the shared matrix asserts. Delete of legacy containers is gated
 * by `isBimWriter(resource.data.companyId)` — same internal-user floor as the
 * presentation write gate.
 */
export function legacyFloorplanMatrix(): readonly CoverageCell[] {
  return bimPresentationMatrix();
}

// ---------------------------------------------------------------------------
// ADR-344 Phase 7.E — DXF Text Engine: text_templates + company_fonts
// ---------------------------------------------------------------------------

/**
 * Matrix for `text_templates` (and the identical `company_fonts`) collections.
 *
 * Pattern: tenant_admin_write
 *   - read:   `isSuperAdminOnly() || belongsToCompany(companyId)` — any tenant member
 *   - create: `isSuperAdminOnly() || (companyId match && isCompanyAdminOfCompany)` — admin only
 *   - update: `isSuperAdminOnly() || isCompanyAdminOfCompany + companyId immutable` — admin only
 *   - delete: `isSuperAdminOnly() || isCompanyAdminOfCompany` — admin only
 *
 * Key delta from `fileTenantFullMatrix()`:
 *   `same_tenant_user × create/update/delete` → DENY (insufficient_role).
 *   Regular tenant users can read but not mutate these resource-type collections.
 *
 * Used by: `text_templates` (Phase 7.E), `company_fonts` (future Phase 6.F).
 * See ADR-344 §8 Phase 7.E (2026-05-11).
 */
export function textTemplateMatrix(): readonly CoverageCell[] {
  return [
    // Read: isSuperAdminOnly || belongsToCompany — all tenant members
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
    // Create: isSuperAdminOnly || (companyId match && isCompanyAdminOfCompany)
    cell('super_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: isSuperAdminOnly || isCompanyAdminOfCompany (+ companyId immutable guard)
    cell('super_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),
    cell('same_tenant_user', 'update', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: isSuperAdminOnly || isCompanyAdminOfCompany
    cell('super_admin', 'delete', 'allow'),
    cell('same_tenant_admin', 'delete', 'allow'),
    cell('same_tenant_user', 'delete', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}

/**
 * Matrix for `block_library` (ADR-652 M2/M3/M4) — the 2D DXF block content
 * library. Tenant-scoped, but with **two twists** that no canonical pattern
 * expresses, so this is a bespoke matrix:
 *
 *   1. **`user` scope is PRIVATE, even inside the tenant.** Whatever a user
 *      imports from a third-party DXF stays theirs — the read rule requires
 *      `scope != 'user' || createdBy == request.auth.uid`. So `same_tenant_admin`
 *      (a colleague *with more rights*) is DENIED read/list on someone else's
 *      user-scope block. That is the whole point of the rule, hence the
 *      `not_owner` reason tag.
 *   2. **`system` scope is seed-only.** Clients may never create it
 *      (`request.resource.data.scope != 'system'`) and — the M3 hole —
 *      may never *self-promote* into it on update. Both are exercised by the
 *      hardening block of the suite, outside the matrix (they need a second
 *      seeded document / a mutated payload).
 *
 * The seeded matrix target is a **user-scope block owned by `same_tenant_user`**
 * (companyId = SAME_TENANT_COMPANY_ID). Reading that matrix top-to-bottom is
 * the privacy contract:
 *   - owner (`same_tenant_user`)  → full CRUD
 *   - company admin              → cannot READ it, but CAN update/delete it
 *     (admin governance over tenant data: `isCompanyAdminOfCompany` is a leg
 *     of update/delete but NOT of read). Deliberate, and now pinned.
 *   - super_admin                → allow all (short-circuit on every op)
 *   - cross-tenant / anonymous   → deny everything
 *
 * Create is persona-aware in the suite (payload carries the caller's uid +
 * SAME_TENANT_COMPANY_ID), so cross-tenant personas fail on the companyId leg.
 *
 * **`list` is not `read`.** A list rule is evaluated against the *query*, not
 * the stored docs: every field the rule reads must be constrained by the query
 * ("rules are not filters"). So the list cells send the **real client query** —
 * the user scope bucket of `ScopedLibraryService`: `scope == 'user' &&
 * createdBy == <caller> && companyId == <caller's tenant>`. Under that query a
 * company admin is *allowed* to list — they get their own (empty) bucket, no
 * leak. The privacy statement for list is therefore an **attack test** in the
 * suite's hardening block: listing someone else's bucket, or the tenant's
 * user-scope blocks without the `createdBy` constraint, is denied.
 */
export function blockLibraryMatrix(): readonly CoverageCell[] {
  return [
    // Read — super admin + the owner only. A company admin is DENIED: this is
    // the private-import guarantee, and the only cell that states it.
    cell('super_admin', 'read', 'allow'),
    cell('same_tenant_user', 'read', 'allow'),
    cell('same_tenant_admin', 'read', 'deny', 'not_owner'),
    // List — the caller's OWN user bucket (see docblock). Admin gets an empty
    // bucket, not someone else's blocks; cross-tenant fails on companyId.
    cell('super_admin', 'list', 'allow'),
    cell('same_tenant_user', 'list', 'allow'),
    cell('same_tenant_admin', 'list', 'allow'),
    cell('cross_tenant_admin', 'read', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'list', 'deny', 'cross_tenant'),
    cell('cross_tenant_user', 'read', 'deny', 'cross_tenant'),
    cell('cross_tenant_user', 'list', 'deny', 'cross_tenant'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    cell('anonymous', 'list', 'deny', 'missing_claim'),
    // Create — companyId == claim && createdBy == uid && scope != 'system'.
    cell('super_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'allow'),
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('cross_tenant_user', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update — owner OR company admin; companyId immutable; scope stays != 'system'.
    cell('super_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),
    cell('same_tenant_user', 'update', 'allow'),
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete — owner OR company admin; never on a `system` block (hardening block).
    cell('super_admin', 'delete', 'allow'),
    cell('same_tenant_admin', 'delete', 'allow'),
    cell('same_tenant_user', 'delete', 'allow'),
    cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}

// ---------------------------------------------------------------------------
// ADR-657 — BIM tier matrices (bimPresentationMatrix / bimAuthoringMatrix /
// legacyFloorplanMatrix) live above. The former ADR-650
// floorplanScopeOwnerOrAdminMatrix() (creator-or-admin, external_user read
// ALLOW) was DELETED: it encoded the pre-ADR-657 bug where external_user could
// read/create authoring data. floorplan_topo_surfaces is now AUTHORING and
// points at bimAuthoringMatrix().
// ---------------------------------------------------------------------------
