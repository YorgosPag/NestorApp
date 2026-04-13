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
import {
  adminWriteOnlyMatrix,
  attendanceEventMatrix,
  immutableMatrix,
  overrideCells,
  roleDualMatrix,
  tenantDirectMatrix,
  tenantStateMachineMatrix,
  cell,
} from './coverage-matrices';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Architectural classification of a rules block. */
export type RulesPattern =
  | 'tenant_direct'        // companyId field lives on the document
  | 'tenant_crossdoc'      // companyId resolved via parent document lookup
  | 'tenant_dual_path'     // reads accept EITHER direct companyId OR crossdoc projectId
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
// The registry
// ---------------------------------------------------------------------------
//
// Matrix builders (tenantDirectMatrix, immutableMatrix, etc.) and the cell /
// overrideCells helpers live in `./coverage-matrices`. The split keeps this
// module focused on *what is covered* (the registry) while the matrix
// module owns *what a pattern looks like*. Extracted 2026-04-11 when this
// file outgrew the 500-line Google SRP limit — see ADR-298 §8 Phase B.1.

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
    collection: 'attendance_events',
    pattern: 'tenant_dual_path',
    testFile: 'tests/firestore-rules/suites/attendance-events.rules.test.ts',
    rulesRange: [196, 232],
    matrix: attendanceEventMatrix(),
    // Dual-path reads can resolve via parent project, so we seed a project
    // for the crossdoc regression block. The canonical matrix doc carries
    // its own companyId and resolves via the direct path.
    seedDependencies: ['projects'],
  },
  {
    collection: 'attendance_qr_tokens',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/attendance-qr-tokens.rules.test.ts',
    rulesRange: [240, 261],
    // QR tokens are admin-write-only: reads are tenant-scoped (dual path
    // like attendance_events), every client write denies. This matches the
    // canonical `adminWriteOnlyMatrix()` shape exactly. The dual read path
    // is exercised in the suite via a targeted crossdoc regression block.
    matrix: adminWriteOnlyMatrix(),
    seedDependencies: ['projects'],
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
  // ── ADR-298 Phase B.2 — accounting ΚΦΔ (2026-04-13) ─────────────────────
  {
    collection: 'accounting_invoices',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-invoices.rules.test.ts',
    rulesRange: [3013, 3019],
    matrix: roleDualMatrix(),
  },
  {
    collection: 'accounting_journal_entries',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-journal-entries.rules.test.ts',
    rulesRange: [3006, 3012],
    matrix: roleDualMatrix(),
  },
  {
    collection: 'accounting_audit_log',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-audit-log.rules.test.ts',
    rulesRange: [3099, 3108],
    // Q7 ΚΦΔ compliance: update/delete are `if false` — immutable for all personas.
    // Read + create follow the standard role_dual shape (canReadAccounting /
    // canCreateAccountingSystem + userId==uid; no isSuperAdminOnly short-circuit).
    matrix: overrideCells(roleDualMatrix(), [
      cell('super_admin', 'update', 'deny', 'immutable'),
      cell('same_tenant_admin', 'update', 'deny', 'immutable'),
      cell('same_tenant_user', 'update', 'deny', 'immutable'),
      cell('cross_tenant_admin', 'update', 'deny', 'immutable'),
      cell('anonymous', 'update', 'deny', 'immutable'),
      cell('super_admin', 'delete', 'deny', 'immutable'),
      cell('same_tenant_admin', 'delete', 'deny', 'immutable'),
      cell('same_tenant_user', 'delete', 'deny', 'immutable'),
      cell('cross_tenant_admin', 'delete', 'deny', 'immutable'),
      cell('anonymous', 'delete', 'deny', 'immutable'),
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
  // attendance_events + attendance_qr_tokens moved to COVERAGE (ADR-298 Phase B.1, 2026-04-11)
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
  // accounting_journal_entries → moved to COVERAGE (ADR-298 Phase B.2, 2026-04-13)
  // accounting_invoices        → moved to COVERAGE (ADR-298 Phase B.2, 2026-04-13)
  // accounting_audit_log       → moved to COVERAGE (ADR-298 Phase B.2, 2026-04-13)
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
