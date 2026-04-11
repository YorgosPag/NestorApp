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
 * Bespoke matrix for `attendance_events` — an append-only collection with
 * **dual-path reads** (either `companyId` direct OR `projectId` crossdoc) and
 * a **client-append-with-validation** create rule. Update/delete deny for all.
 *
 * This is a one-off — the rule shape does not fit `tenant_direct`,
 * `immutable`, or `admin_write_only` cleanly:
 *
 *   1. **Reads** follow tenant_direct semantics but via a dual OR path
 *      (`belongsToCompany(companyId)` OR `belongsToProjectCompany(projectId)`).
 *   2. **Create** is authenticated-only + payload field validation — **no
 *      tenant check**. This is a documented security gap (see ADR-298 §8
 *      Phase B.1 changelog): `cross_tenant_admin` can create an attendance
 *      event in any company. The matrix reflects the **actual** rule
 *      behaviour; the gap is tracked separately.
 *   3. **Update/delete** deny for every persona (`if false`).
 *
 * Expressed as a delta over `tenantDirectMatrix()` so the divergences are
 * auditable from the manifest alone.
 */
export function attendanceEventMatrix(): readonly CoverageCell[] {
  return overrideCells(tenantDirectMatrix(), [
    // Create: rule has no role gate and no tenant check.
    cell('same_tenant_user', 'create', 'allow'),
    // SECURITY GAP: cross_tenant_admin can create — rule validates only
    // shape/enums, never compares request.resource.data.companyId. Tracked
    // as a finding in ADR-298 §8 Phase B.1 changelog.
    cell('cross_tenant_admin', 'create', 'allow'),
    // Update: all deny with `immutable` reason (rule is `allow update: if false`).
    cell('super_admin', 'update', 'deny', 'immutable'),
    cell('same_tenant_admin', 'update', 'deny', 'immutable'),
    cell('cross_tenant_admin', 'update', 'deny', 'immutable'),
    // Delete: all deny with `immutable` reason.
    cell('super_admin', 'delete', 'deny', 'immutable'),
    cell('same_tenant_admin', 'delete', 'deny', 'immutable'),
  ]);
}
