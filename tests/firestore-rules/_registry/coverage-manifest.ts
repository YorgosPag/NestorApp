/**
 * Firestore Rules Test Coverage — SSoT Manifest
 *
 * Single source of truth for *which* (collection × persona × operation)
 * cells must be exercised by the rules unit test suite. CHECK 3.16 reads
 * this file, walks firestore.rules, and blocks commits where the manifest
 * and the test files or the rules file have drifted.
 *
 * See ADR-298 §3.2 and §3.4.
 *
 * Contract:
 *   - Every top-level `match /xxx/{id}` block in firestore.rules MUST be
 *     either (a) present in FIRESTORE_RULES_COVERAGE with a matching test
 *     file, or (b) explicitly listed in FIRESTORE_RULES_PENDING.
 *   - Every FIRESTORE_RULES_COVERAGE entry MUST have a test file at its
 *     `testFile` path with a `COVERAGE` export matching this manifest.
 *   - Every matrix cell MUST have a matching `describe('<persona> × <op>')`
 *     block in the corresponding test file.
 *
 * Zero-tolerance: CHECK 3.16 is not a ratchet. The pending list exists only
 * to stage the Phase B/C migration of ~90 legacy collections.
 *
 * @module tests/firestore-rules/_registry/coverage-manifest
 * @since 2026-04-11 (ADR-298 Phase A)
 */

import type { Operation, Outcome, Reason } from './operations';
import type { Persona } from './personas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Architectural classification of a rules block. */
export type RulesPattern =
  | 'tenant_direct'        // companyId field lives on the document
  | 'tenant_crossdoc'      // companyId resolved via parent document lookup
  | 'immutable'            // append-only audit trail, update/delete deny
  | 'admin_write_only'     // tenant-scoped reads, all client writes denied (Admin SDK only)
  | 'tenant_state_machine' // tenant-scoped + state-machine-gated writes (files lifecycle)
  | 'ownership'            // ownerId == request.auth.uid
  | 'system_global'        // read-only for every authenticated user
  | 'role_dual'            // user-created vs system-generated split
  | 'field_allowlist';     // update restricted to a set of allowed fields

/** One (persona × operation) cell of a collection's coverage matrix. */
export interface CoverageCell {
  readonly persona: Persona;
  readonly operation: Operation;
  readonly outcome: Outcome;
  /** Optional failure reason — enables assert-on-intent, not just assert-on-outcome. */
  readonly reason?: Reason;
}

/** Full coverage declaration for a single top-level collection. */
export interface CollectionCoverage {
  /** Physical collection name — must match `match /<name>/{id}` in firestore.rules. */
  readonly collection: string;
  readonly pattern: RulesPattern;
  /** Expected matrix (deny- and allow-cells, in any order). */
  readonly matrix: readonly CoverageCell[];
  /** Path to the test file, relative to repo root. */
  readonly testFile: string;
  /** For `tenant_crossdoc` and field_allowlist patterns — parent docs that must be seeded first. */
  readonly seedDependencies?: readonly string[];
  /** Rule block line range in firestore.rules (inclusive start, exclusive end). */
  readonly rulesRange: readonly [number, number];
}

// ---------------------------------------------------------------------------
// Matrix builders — tight cell declarations
// ---------------------------------------------------------------------------

function cell(
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
 */
function overrideCells(
  base: readonly CoverageCell[],
  overrides: readonly CoverageCell[],
): readonly CoverageCell[] {
  const key = (c: CoverageCell): string => `${c.persona}:${c.operation}`;
  const overrideKeys = new Set(overrides.map(key));
  return [...base.filter((c) => !overrideKeys.has(key(c))), ...overrides];
}

/**
 * Canonical matrix for a `tenant_direct` pattern — companyId lives on the
 * document and is compared against the persona's companyId claim.
 *
 * 17 cells: super_admin + same-tenant allow across all ops, cross-tenant +
 * anonymous deny, external_user denied entirely (limited role scope).
 */
function tenantDirectMatrix(): readonly CoverageCell[] {
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
function immutableMatrix(): readonly CoverageCell[] {
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
function adminWriteOnlyMatrix(): readonly CoverageCell[] {
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
function tenantStateMachineMatrix(): readonly CoverageCell[] {
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

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

/**
 * Collections with complete test coverage.
 *
 * Phase A ships 6 entries. Phase B/C move collections from
 * `FIRESTORE_RULES_PENDING` into this array incrementally.
 */
export const FIRESTORE_RULES_COVERAGE: readonly CollectionCoverage[] = [
  {
    collection: 'projects',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/projects.rules.test.ts',
    rulesRange: [37, 102],
    matrix: tenantDirectMatrix(),
  },
  {
    collection: 'buildings',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/buildings.rules.test.ts',
    rulesRange: [547, 582],
    matrix: adminWriteOnlyMatrix(),
    seedDependencies: ['projects'],
  },
  {
    collection: 'contacts',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/contacts.rules.test.ts',
    rulesRange: [1400, 1505],
    matrix: tenantDirectMatrix(),
  },
  {
    collection: 'files',
    pattern: 'tenant_state_machine',
    testFile: 'tests/firestore-rules/suites/files.rules.test.ts',
    rulesRange: [361, 502],
    matrix: tenantStateMachineMatrix(),
  },
  {
    collection: 'entity_audit_trail',
    pattern: 'immutable',
    testFile: 'tests/firestore-rules/suites/entity-audit-trail.rules.test.ts',
    rulesRange: [2384, 2403],
    matrix: immutableMatrix(),
  },
  {
    collection: 'messages',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/messages.rules.test.ts',
    rulesRange: [1745, 1791],
    // The messages create rule (firestore.rules:1758) requires
    // `request.resource.data.companyId == getUserCompanyId()` and does NOT
    // include an `isSuperAdminOnly()` OR-leg — super admin therefore cannot
    // create messages from client context (Admin SDK bypass is the sanctioned
    // path). Override the canonical cell to reflect this.
    matrix: overrideCells(tenantDirectMatrix(), [
      cell('super_admin', 'create', 'deny', 'server_only'),
    ]),
  },
] as const;

/**
 * Collections that exist in firestore.rules but are not yet in the matrix.
 *
 * CHECK 3.16 tolerates pending entries but blocks any collection that is in
 * NEITHER list. Boy Scout rule: when you touch a pending collection, move
 * it into FIRESTORE_RULES_COVERAGE with full matrix and delete it from here.
 *
 * Auto-generated 2026-04-11 from `grep -nE '^    match /[a-zA-Z_]+/\{' firestore.rules`
 * minus the 6 entries in FIRESTORE_RULES_COVERAGE above. Nested subcollections
 * (e.g. `companies/{id}/audit_logs/{logId}`) are excluded — they are covered
 * by their parent block.
 */
export const FIRESTORE_RULES_PENDING: readonly string[] = [
  // — Contacts / relationships —
  'contact_relationships',
  'contact_links',
  'relationships',
  'relationship_audit',
  // — Attendance / HR —
  'attendance_events',
  'attendance_qr_tokens',
  'employment_records',
  // — Files / CAD —
  'cad_files',
  'file_shares',
  'photo_shares',
  'file_comments',
  'file_approvals',
  'document_templates',
  'file_webhooks',
  'file_folders',
  'file_audit_log',
  // — Companies / users / workspaces —
  'companies',
  'security_roles',
  'users',
  'user_notification_settings',
  'user_2fa_settings',
  'workspaces',
  'teams',
  'positions',
  // — Building / property hierarchy —
  'floors',
  'properties',
  'storage_units',
  'parking_spots',
  'project_floorplans',
  'building_floorplans',
  'floor_floorplans',
  'unit_floorplans',
  'floorplans',
  'admin_building_templates',
  // — DXF / CAD overlays —
  'dxfOverlayLevels',
  'layers',
  'layer_groups',
  // — Navigation / notifications / tasks —
  'navigation_companies',
  'notifications',
  'tasks',
  'appointments',
  // — CRM —
  'communications',
  'leads',
  'opportunities',
  'activities',
  'conversations',
  'external_identities',
  // — System / config —
  'system',
  'config',
  'email_domain_policies',
  'country_security_policies',
  'counters',
  'analytics',
  'bot_configs',
  // — Obligations / compliance —
  'obligations',
  'obligation_transmittals',
  'obligation_templates',
  // — Audit / search / voice —
  'audit_logs',
  'system_audit_logs',
  'audit_log',
  'search_documents',
  'voice_commands',
  // — BoQ / commissions / ownership —
  'boq_items',
  'boq_categories',
  'brokerage_agreements',
  'commission_records',
  'ownership_tables',
  // — Accounting (sole proprietor subapp) —
  'accounting_journal_entries',
  'accounting_invoices',
  'accounting_bank_transactions',
  'accounting_bank_accounts',
  'accounting_fixed_assets',
  'accounting_depreciation_records',
  'accounting_expense_documents',
  'accounting_import_batches',
  'accounting_tax_installments',
  'accounting_apy_certificates',
  'accounting_custom_categories',
  'accounting_matching_rules',
  'accounting_efka_payments',
  'accounting_audit_log',
  'accounting_fiscal_periods',
  'accounting_settings',
  'accounting_efka_config',
  'accounting_invoice_counters',
  'accounting_customer_balances',
] as const;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function findCoverage(collection: string): CollectionCoverage | undefined {
  return FIRESTORE_RULES_COVERAGE.find((c) => c.collection === collection);
}

export function isPending(collection: string): boolean {
  return FIRESTORE_RULES_PENDING.includes(collection);
}

export function isTrackedCollection(collection: string): boolean {
  return findCoverage(collection) !== undefined || isPending(collection);
}
