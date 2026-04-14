/**
 * Firestore Rules Test Coverage — Canonical Matrix Builders
 *
 * Pure, side-effect-free factory functions that produce the canonical
 * (persona × operation) coverage matrix for each `RulesPattern`. The
 * registry in `coverage-manifest.ts` composes these into per-collection
 * `CollectionCoverage` entries, occasionally applying `overrideCells` to
 * express a collection's delta from the canonical shape.
 *
 * Extracted from `coverage-manifest.ts` in ADR-298 Phase B.1 (2026-04-11)
 * when the manifest outgrew the 500-line Google SRP limit. Splitting the
 * matrix builders out of the registry keeps the registry focused on *what
 * is covered* while the matrix module owns *what a pattern looks like*.
 *
 * Contract: every exported matrix function returns a `readonly
 * CoverageCell[]`. Functions are pure — no hidden state, no environment
 * reads — so the registry can call them at module-evaluation time without
 * ordering concerns.
 *
 * @module tests/firestore-rules/_registry/coverage-matrices
 * @since 2026-04-11 (ADR-298 Phase B.1 extraction)
 */

import type { Operation, Outcome, Reason } from './operations';
import type { Persona } from './personas';
import type { CoverageCell } from './coverage-manifest';

// ---------------------------------------------------------------------------
// Cell constructors and delta helpers
// ---------------------------------------------------------------------------

/**
 * Typed constructor for a single matrix cell. Omits the `reason` key
 * entirely when undefined so that `JSON.stringify` output (used by test
 * diagnostics) stays compact.
 */
export function cell(
  persona: Persona,
  operation: Operation,
  outcome: Outcome,
  reason?: Reason,
): CoverageCell {
  return reason === undefined
    ? { persona, operation, outcome }
    : { persona, operation, outcome, reason };
}

/**
 * Return a new matrix with specific (persona × operation) cells replaced.
 *
 * Used by collections whose rule body differs from a canonical shape by a
 * small number of cells (e.g. `messages` denies super_admin create because
 * the rule has no `isSuperAdminOnly()` leg on create). Keeping the canonical
 * shape as a base and declaring the delta explicitly makes the difference
 * auditable from the manifest alone — reviewers do not have to diff rule
 * bodies to understand which cells diverge.
 *
 * If an override key is not present in the base matrix, it is **appended**
 * rather than replaced — this is how `attendanceEventMatrix()` adds the
 * `same_tenant_user × create` cell that canonical tenant_direct omits.
 */
export function overrideCells(
  base: readonly CoverageCell[],
  overrides: readonly CoverageCell[],
): readonly CoverageCell[] {
  const key = (c: CoverageCell): string => `${c.persona}:${c.operation}`;
  const overrideKeys = new Set(overrides.map(key));
  return [...base.filter((c) => !overrideKeys.has(key(c))), ...overrides];
}

// ---------------------------------------------------------------------------
// Canonical pattern matrices
// ---------------------------------------------------------------------------

/**
 * Canonical matrix for a `tenant_direct` pattern — companyId lives on the
 * document and is compared against the persona's companyId claim.
 *
 * 17 cells: super_admin + same-tenant allow across all ops, cross-tenant +
 * anonymous deny, external_user denied entirely (limited role scope).
 */
export function tenantDirectMatrix(): readonly CoverageCell[] {
  return [
    // super_admin: allow all
    cell('super_admin', 'read', 'allow'),
    cell('super_admin', 'list', 'allow'),
    cell('super_admin', 'create', 'allow'),
    cell('super_admin', 'update', 'allow'),
    cell('super_admin', 'delete', 'allow'),
    // same_tenant_admin: allow all
    cell('same_tenant_admin', 'read', 'allow'),
    cell('same_tenant_admin', 'list', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'delete', 'allow'),
    // same_tenant_user: allow read/list/create/update, deny delete
    cell('same_tenant_user', 'read', 'allow'),
    cell('same_tenant_user', 'list', 'allow'),
    // cross_tenant_admin: deny read/list
    cell('cross_tenant_admin', 'read', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'list', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    // anonymous: deny everything
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    cell('anonymous', 'list', 'deny', 'missing_claim'),
  ];
}

/**
 * Canonical matrix for an `immutable` pattern — append-only audit trail.
 * Reads are **admin-only within the tenant** (company_admin + super_admin);
 * updates and deletes are globally denied; creates are server-only.
 *
 * Rationale: audit trails carry security-sensitive metadata (who did what,
 * when, to which entity) and must not be readable by line-level users even
 * within the same tenant. The `entity_audit_trail` rule at firestore.rules
 * L2385 enforces this — the read gate short-circuits on `isSuperAdminOnly`
 * and otherwise requires `isCompanyAdminOfCompany(resource.data.companyId)`.
 */
export function immutableMatrix(): readonly CoverageCell[] {
  return [
    // Reads: super_admin + same_tenant_admin allow, line users + cross_tenant deny
    cell('super_admin', 'read', 'allow'),
    cell('super_admin', 'list', 'allow'),
    cell('same_tenant_admin', 'read', 'allow'),
    cell('same_tenant_admin', 'list', 'allow'),
    cell('same_tenant_user', 'read', 'deny', 'insufficient_role'),
    cell('cross_tenant_admin', 'read', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'list', 'deny', 'cross_tenant'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    // Immutable writes: deny for everyone (server-only creation)
    cell('super_admin', 'create', 'deny', 'server_only'),
    cell('super_admin', 'update', 'deny', 'immutable'),
    cell('super_admin', 'delete', 'deny', 'immutable'),
    cell('same_tenant_admin', 'create', 'deny', 'server_only'),
    cell('same_tenant_admin', 'update', 'deny', 'immutable'),
    cell('same_tenant_admin', 'delete', 'deny', 'immutable'),
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'update', 'deny', 'immutable'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
  ];
}

/**
 * Canonical matrix for the `admin_write_only` pattern — reads follow tenant
 * isolation, but **every client-side write is denied** at the rule level
 * because mutations happen exclusively via Firebase Admin SDK on the server.
 *
 * Used by: `buildings`, `floors`, `properties` (and similar structural
 * hierarchies where client code must never mutate the graph directly).
 *
 * Failure reason `server_only` documents the intent — it's not that the
 * persona lacks privileges, it's that the rule deliberately forbids the
 * entire client surface.
 */
export function adminWriteOnlyMatrix(): readonly CoverageCell[] {
  return [
    // Reads follow tenant isolation
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
    // Writes: server-only. Every persona denies at rule level.
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
 * Matrix for the `tenant_state_machine` pattern — tenant-scoped reads plus
 * writes gated by a document lifecycle state machine. The `files` collection
 * is the canonical case:
 *   - create requires `status == 'pending'` and `createdBy == request.auth.uid`
 *   - update is split into four disjoint rule bodies:
 *       (a) pending → ready / pending → failed transition
 *       (b) ready → trashed (set `isDeleted: true`)
 *       (c) trashed → ready (set `isDeleted: false`)
 *       (d) linkedTo mutation
 *   - delete (hard) has **no super_admin leg** — super admin uses Admin SDK
 *
 * The test suite exercises the generic lifecycle: create (pending) and update
 * (trash, i.e. `isDeleted: false → true` on a ready doc). Hard delete is
 * marked `deny/server_only` because the rule intentionally excludes super
 * admin — the Admin SDK bypass is the sanctioned path.
 */
export function tenantStateMachineMatrix(): readonly CoverageCell[] {
  return [
    // Reads
    cell('super_admin', 'read', 'allow'),
    cell('super_admin', 'list', 'allow'),
    cell('same_tenant_admin', 'read', 'allow'),
    cell('same_tenant_admin', 'list', 'allow'),
    cell('same_tenant_user', 'read', 'allow'),
    cell('same_tenant_user', 'list', 'allow'),
    cell('cross_tenant_admin', 'read', 'deny', 'cross_tenant'),
    cell('cross_tenant_admin', 'list', 'deny', 'cross_tenant'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),
    // Create (status == 'pending'): super_admin + same_tenant_admin allow
    cell('super_admin', 'create', 'allow'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    // Update (trash transition): super_admin + same_tenant_admin allow
    cell('super_admin', 'update', 'allow'),
    cell('same_tenant_admin', 'update', 'allow'),
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    // Hard delete: super admin is gated out by the `companyId == getUserCompanyId()`
    // guard (super admin's own company != doc's company), so delete path is
    // Admin SDK only for that persona. Same-tenant admin has both companyId
    // match and admin role, so client delete is allowed for them.
    cell('super_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_admin', 'delete', 'allow'),
  ];
}

/**
 * Canonical matrix for the `role_dual` pattern — accounting collections where
 * reads follow standard tenant isolation (`canReadAccounting`) and writes use
 * the user-created pattern (`canCreateAccounting` requires both `companyId ==
 * getUserCompanyId()` and `createdBy == request.auth.uid`).
 *
 * Key deltas from `tenantDirectMatrix()`:
 *   - read:   `same_tenant_user` allowed (`canReadAccounting` = `isSuperAdminOnly ||
 *             isInternalUserOfCompany` — internal_user included)
 *   - create: `super_admin` denied (no `isSuperAdminOnly()` short-circuit in
 *             `canCreateAccounting` — super_admin's companyId 'company-root'
 *             does not match `SAME_TENANT_COMPANY_ID` 'company-a')
 *   - update/delete: `super_admin` allowed (via `isCompanyAdminOfCompany` →
 *             `isSuperAdminOnly()` short-circuit)
 *   - update/delete: `same_tenant_user` allowed when seeded doc carries their
 *             uid as `createdBy` (tests the `uid == createdBy` leg)
 *
 * Test contract: each test suite builds persona-aware createData inside the
 * cell loop, setting `companyId: SAME_TENANT_COMPANY_ID` and
 * `createdBy: persona.uid`. This ensures:
 *   - same-tenant personas satisfy `companyId == getUserCompanyId()` + uid match → allow
 *   - super_admin (company-root) and cross_tenant_admin (company-b) fail the
 *     companyId check against company-a → deny (cross_tenant)
 * Seed doc uses `createdBy = PERSONA_CLAIMS.same_tenant_user.uid` so the
 * `uid == createdBy` update/delete leg is exercised for same_tenant_user.
 *
 * Collections: `accounting_invoices`, `accounting_journal_entries`.
 * `accounting_audit_log` uses `overrideCells(roleDualMatrix(), [...])` to
 * swap update/delete to `immutable` deny (Q7 ΚΦΔ compliance).
 *
 * See ADR-298 §4 Phase B.2 (2026-04-13).
 */
export function roleDualMatrix(): readonly CoverageCell[] {
  return [
    // Read: isSuperAdminOnly() || isInternalUserOfCompany(companyId)
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
    // Create: isInternalUser() && companyId==getUserCompanyId() && createdBy==uid
    // No isSuperAdminOnly() short-circuit — super_admin (company-root)
    // fails the companyId check when targeting SAME_TENANT_COMPANY_ID (company-a)
    cell('super_admin', 'create', 'deny', 'cross_tenant'),
    cell('same_tenant_admin', 'create', 'allow'),
    cell('same_tenant_user', 'create', 'allow'),
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    cell('anonymous', 'create', 'deny', 'missing_claim'),
    // Update: (uid==createdBy || isCompanyAdminOfCompany(companyId)) && companyId immutable
    // Seed doc carries createdBy=same_tenant_user.uid → user-level allow exercised
    cell('super_admin', 'update', 'allow'),       // isCompanyAdminOfCompany → isSuperAdminOnly
    cell('same_tenant_admin', 'update', 'allow'), // isCompanyAdminOfCompany → company_admin match
    cell('same_tenant_user', 'update', 'allow'),  // uid == createdBy (seed doc)
    cell('cross_tenant_admin', 'update', 'deny', 'cross_tenant'),
    cell('anonymous', 'update', 'deny', 'missing_claim'),
    // Delete: uid==createdBy || isCompanyAdminOfCompany(companyId)
    cell('super_admin', 'delete', 'allow'),
    cell('same_tenant_admin', 'delete', 'allow'),
    cell('same_tenant_user', 'delete', 'allow'),
    cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
    cell('anonymous', 'delete', 'deny', 'missing_claim'),
  ];
}

/**
 * Canonical matrix for CRM `tenant_direct` collections (`leads`, `opportunities`,
 * `activities`) where the create rule lacks an `isSuperAdminOnly()` short-circuit.
 *
 * Key deltas from `tenantDirectMatrix()`:
 *   - super_admin × create → deny: the create rule is
 *     `companyId == getUserCompanyId()` only. Super admin's claim is
 *     'company-root' ≠ SAME_TENANT_COMPANY_ID ('company-a') → denied.
 *     Reason: `cross_tenant` (the companyId mismatch is the gate, not a
 *     missing role — super admin legitimately targets other tenants via
 *     Admin SDK; the client rule just can't express that without knowing
 *     target tenant at rule-eval time).
 *   - same_tenant_user × create → allow: companyId == getUserCompanyId()
 *     satisfied for same-tenant personas.
 *   - same_tenant_user × update/delete → allow: `resource.data.createdBy ==
 *     request.auth.uid`. Test contract: seed doc **must** carry
 *     `createdBy = PERSONA_CLAIMS.same_tenant_user.uid`.
 *
 * Collections: `leads`, `opportunities`, `activities`.
 * See ADR-298 §4 Phase B.3 (2026-04-13).
 */
export function crmDirectMatrix(): readonly CoverageCell[] {
  return overrideCells(tenantDirectMatrix(), [
    // No isSuperAdminOnly() short-circuit on create — super_admin companyId
    // claim ('company-root') does not match test tenant ('company-a').
    cell('super_admin', 'create', 'deny', 'cross_tenant'),
    // same_tenant_user: full CRUD via companyId match (create) and
    // createdBy == uid path (update/delete). Seed doc must carry their uid.
    cell('same_tenant_user', 'create', 'allow'),
    cell('same_tenant_user', 'update', 'allow'),
    cell('same_tenant_user', 'delete', 'allow'),
  ]);
}

/**
 * Bespoke matrix for `attendance_events` — an append-only collection with
 * **dual-path reads** (either `companyId` direct OR `projectId` crossdoc) and
 * a **tenant-bound client-append** create rule. Update/delete deny for all.
 *
 * This is a one-off — the rule shape does not fit `tenant_direct`,
 * `immutable`, or `admin_write_only` cleanly:
 *
 *   1. **Reads** follow tenant_direct semantics but via a dual OR path
 *      (`belongsToCompany(companyId)` OR `belongsToProjectCompany(projectId)`).
 *   2. **Create** requires (a) required payload fields + enum validation,
 *      (b) payload companyId matches the caller's claim (super_admin
 *      short-circuit), and (c) cross-doc project ownership via
 *      `belongsToProjectCompany(request.resource.data.projectId)`. This was
 *      tightened in ADR-298 §8 Phase B.2 (2026-04-11) — the prior rule shape
 *      validated only fields/enums with no tenant gate (documented latent gap
 *      in Phase B.1 changelog).
 *   3. **Update/delete** deny for every persona (`if false`).
 *
 * Expressed as a delta over `tenantDirectMatrix()` so the divergences are
 * auditable from the manifest alone.
 */
export function attendanceEventMatrix(): readonly CoverageCell[] {
  return overrideCells(tenantDirectMatrix(), [
    // Create: same_tenant_user allowed (no role gate — any authenticated user
    // in the same tenant whose payload references a same-tenant project).
    cell('same_tenant_user', 'create', 'allow'),
    // Cross-tenant create is now denied — post-Phase-B.2 the rule requires
    // both payload companyId match AND cross-doc project ownership. Prior to
    // the fix this cell was `allow` (security gap, see ADR-298 §8 Phase B.1).
    cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
    // Update: all deny with `immutable` reason (rule is `allow update: if false`).
    cell('super_admin', 'update', 'deny', 'immutable'),
    cell('same_tenant_admin', 'update', 'deny', 'immutable'),
    cell('cross_tenant_admin', 'update', 'deny', 'immutable'),
    // Delete: all deny with `immutable` reason.
    cell('super_admin', 'delete', 'deny', 'immutable'),
    cell('same_tenant_admin', 'delete', 'deny', 'immutable'),
  ]);
}

// Phase C.1 accounting matrix functions live in coverage-matrices-accounting.ts
// (extracted per Google SRP 500-line rule — ADR-298 Phase C.1, 2026-04-13).
// Re-exported here so callers that import from coverage-matrices don't need
// to know about the split.
export {
  accountingSingletonMatrix,
  accountingSystemCalcMatrix,
  denyAllMatrix,
  fiscalPeriodMatrix,
} from './coverage-matrices-accounting';

// Phase C.5 system-global matrix functions live in coverage-matrices-system.ts
// (extracted per Google SRP 500-line rule — ADR-298 Phase C.5, 2026-04-13).
export {
  countersMatrix,
  systemAdminGlobalMatrix,
  systemGlobalMatrix,
  tasksMatrix,
} from './coverage-matrices-system';

// Phase C.2+C.3 DXF/CAD/floorplan/file matrix functions live in coverage-matrices-dxf.ts
// (extracted per Google SRP 500-line rule — ADR-298 Phase C.2+C.3, 2026-04-14).
export {
  cadFilesMatrix,
  fileApprovalsMatrix,
  fileAuditLogMatrix,
  fileCommentsMatrix,
  fileSharesMatrix,
  fileTenantFullMatrix,
  photoSharesMatrix,
} from './coverage-matrices-dxf';

// Phase C.4 BoQ/commissions/ownership matrix functions live in coverage-matrices-boq.ts
// (extracted per Google SRP 500-line rule — ADR-298 Phase C.4, 2026-04-14).
export {
  boqCategoriesMatrix,
  brokerageMatrix,
  commissionRecordsMatrix,
  ownershipTablesMatrix,
} from './coverage-matrices-boq';

// Phase C.6 users/companies/ownership matrix functions live in coverage-matrices-users.ts
// (extracted per Google SRP 500-line rule — ADR-298 Phase C.6, 2026-04-14).
export {
  companiesMatrix,
  ownerOnlyMatrix,
  usersMatrix,
} from './coverage-matrices-users';

// Phase C.7 specialized collections live in coverage-matrices-specialized.ts
// (extracted per Google SRP 500-line rule — ADR-298 Phase C.7, 2026-04-14).
export {
  auditLogMatrix,
  contactRelationshipsMatrix,
  employmentRecordsMatrix,
  notificationsMatrix,
  searchDocumentsMatrix,
  voiceCommandsMatrix,
} from './coverage-matrices-specialized';

