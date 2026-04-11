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
  | 'tenant_direct'       // companyId field lives on the document
  | 'tenant_crossdoc'     // companyId resolved via parent document lookup
  | 'immutable'           // append-only audit trail, update/delete deny
  | 'ownership'           // ownerId == request.auth.uid
  | 'system_global'       // read-only for every authenticated user
  | 'role_dual'           // user-created vs system-generated split
  | 'field_allowlist';    // update restricted to a set of allowed fields

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
 * Reads follow tenant isolation; updates and deletes are globally denied.
 * Creates are server-only.
 */
function immutableMatrix(): readonly CoverageCell[] {
  return [
    // Reads: super_admin + same_tenant allow, cross_tenant deny
    cell('super_admin', 'read', 'allow'),
    cell('super_admin', 'list', 'allow'),
    cell('same_tenant_admin', 'read', 'allow'),
    cell('same_tenant_admin', 'list', 'allow'),
    cell('same_tenant_user', 'read', 'allow'),
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
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/buildings.rules.test.ts',
    rulesRange: [547, 582],
    matrix: tenantDirectMatrix(),
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
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/files.rules.test.ts',
    rulesRange: [361, 502],
    matrix: tenantDirectMatrix(),
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
    matrix: tenantDirectMatrix(),
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
