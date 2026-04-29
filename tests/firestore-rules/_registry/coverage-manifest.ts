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
  cell,
  crmDirectMatrix,
  immutableMatrix,
  overrideCells,
  roleDualMatrix,
  tenantDirectMatrix,
  tenantStateMachineMatrix,
} from './coverage-matrices';
import {
  accountingSingletonMatrix,
  accountingSystemCalcMatrix,
  denyAllMatrix,
  fiscalPeriodMatrix,
} from './coverage-matrices-accounting';
import {
  countersMatrix,
  systemAdminGlobalMatrix,
  systemGlobalMatrix,
  tasksMatrix,
} from './coverage-matrices-system';
import {
  cadFilesMatrix,
  fileApprovalsMatrix,
  fileAuditLogMatrix,
  fileCommentsMatrix,
  fileSharesMatrix,
  fileTenantFullMatrix,
  photoSharesMatrix,
} from './coverage-matrices-dxf';
import {
  boqCategoriesMatrix,
  brokerageMatrix,
  commissionRecordsMatrix,
  ownershipTablesMatrix,
} from './coverage-matrices-boq';
import {
  companiesMatrix,
  ownerOnlyMatrix,
  usersMatrix,
} from './coverage-matrices-users';
import {
  auditLogMatrix,
  contactRelationshipsMatrix,
  employmentRecordsMatrix,
  notificationsMatrix,
  searchDocumentsMatrix,
  voiceCommandsMatrix,
} from './coverage-matrices-specialized';

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
  | 'field_allowlist'      // update restricted to a set of allowed fields
  | 'deny_all';            // allow read,write: if false — no client access (Admin SDK only)

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
  // ── ADR-298 Phase B.3 — CRM core tenant_direct (2026-04-13) ─────────────
  {
    collection: 'leads',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/leads.rules.test.ts',
    rulesRange: [1584, 1625],
    // Create rule has no isSuperAdminOnly() short-circuit — super_admin denied.
    // Seed doc carries createdBy = same_tenant_user.uid for update/delete leg.
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'opportunities',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/opportunities.rules.test.ts',
    rulesRange: [1626, 1665],
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'activities',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/activities.rules.test.ts',
    rulesRange: [1666, 1705],
    matrix: crmDirectMatrix(),
  },
  // ── ADR-298 Phase B.6 — compliance tenant_direct (2026-04-13) ───────────
  {
    collection: 'obligations',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/obligations.rules.test.ts',
    rulesRange: [1981, 2024],
    // Read: isSuperAdminOnly() || companyId direct || projectId crossdoc || legacy createdBy.
    // Create has no isSuperAdminOnly() short-circuit — super_admin denied (cross_tenant).
    // Update/delete: createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly().
    // Seed doc carries createdBy=same_tenant_user.uid for uid-match update/delete leg.
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'obligation_transmittals',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/obligation-transmittals.rules.test.ts',
    rulesRange: [2033, 2062],
    // Simpler read: isSuperAdminOnly() || companyId direct (no crossdoc, no legacy).
    // Create: no isSuperAdminOnly() short-circuit — super_admin denied (cross_tenant).
    // Update: strict companyId immutability (no optional hasAny guard).
    // Update/delete: createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly().
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'obligation_templates',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/obligation-templates.rules.test.ts',
    rulesRange: [2069, 2107],
    // Read: isSuperAdminOnly() || companyId direct || legacy createdBy (no crossdoc).
    // Create: no isSuperAdminOnly() short-circuit — super_admin denied (cross_tenant).
    // Update/delete: createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly().
    // Update: optional companyId immutability guard (!hasAny || unchanged).
    matrix: crmDirectMatrix(),
  },
  // ── ADR-298 Phase B.5 — messaging tenant_direct (2026-04-13) ─────────────
  {
    collection: 'conversations',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/conversations.rules.test.ts',
    rulesRange: [1706, 1753],
    // Create rule requires isValidConversationData (channel + status enum) and
    // has no isSuperAdminOnly short-circuit — super_admin denied (cross_tenant).
    // same_tenant_user has full CRUD: create via companyId match, update/delete
    // via createdBy==uid path. Identical delta shape to crmDirectMatrix().
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'external_identities',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/external-identities.rules.test.ts',
    rulesRange: [1801, 1844],
    // No isValidConversationData on create/update. Same CRUD pattern as CRM
    // collections: super_admin denied on create (no isSuperAdminOnly short-circuit),
    // same_tenant_user full CRUD via companyId/createdBy paths.
    matrix: crmDirectMatrix(),
  },
  // ── ADR-298 Phase B.4 — property hierarchy admin_write_only (2026-04-13) ─
  {
    collection: 'floors',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/floors.rules.test.ts',
    rulesRange: [590, 618],
    matrix: adminWriteOnlyMatrix(),
    seedDependencies: ['projects', 'buildings'],
  },
  {
    collection: 'properties',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/properties.rules.test.ts',
    rulesRange: [619, 664],
    // Delta from canonical admin_write_only: update is allowed for super_admin
    // (isSuperAdminOnly bypass) and for company admins of the project's company
    // (isCompanyAdminOfProject + isAllowedPropertyFieldUpdate + propertyStructuralFieldsUnchanged).
    // Client create/delete remain server-only.
    matrix: overrideCells(adminWriteOnlyMatrix(), [
      cell('super_admin', 'update', 'allow'),
      cell('same_tenant_admin', 'update', 'allow'),
      cell('same_tenant_user', 'update', 'deny', 'insufficient_role'),
    ]),
    seedDependencies: ['projects'],
  },
  {
    collection: 'storage_units',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/storage-units.rules.test.ts',
    rulesRange: [665, 694],
    matrix: adminWriteOnlyMatrix(),
    seedDependencies: ['projects', 'buildings'],
  },
  {
    collection: 'parking_spots',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/parking-spots.rules.test.ts',
    rulesRange: [695, 725],
    matrix: adminWriteOnlyMatrix(),
    seedDependencies: ['projects', 'buildings'],
  },
  // ── ADR-298 Phase C.1 — remaining accounting (2026-04-13) ───────────────
  // Pattern A: standard role_dual (canCreateAccounting with createdBy==uid)
  {
    collection: 'accounting_bank_transactions',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-bank-transactions.rules.test.ts',
    rulesRange: [3020, 3027],
    matrix: roleDualMatrix(),
  },
  {
    collection: 'accounting_bank_accounts',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-bank-accounts.rules.test.ts',
    rulesRange: [3027, 3034],
    matrix: roleDualMatrix(),
  },
  {
    collection: 'accounting_fixed_assets',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-fixed-assets.rules.test.ts',
    rulesRange: [3034, 3041],
    matrix: roleDualMatrix(),
  },
  {
    collection: 'accounting_depreciation_records',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-depreciation-records.rules.test.ts',
    rulesRange: [3041, 3048],
    matrix: roleDualMatrix(),
  },
  {
    collection: 'accounting_expense_documents',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-expense-documents.rules.test.ts',
    rulesRange: [3048, 3055],
    matrix: roleDualMatrix(),
  },
  {
    collection: 'accounting_import_batches',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-import-batches.rules.test.ts',
    rulesRange: [3055, 3062],
    matrix: roleDualMatrix(),
  },
  {
    collection: 'accounting_tax_installments',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-tax-installments.rules.test.ts',
    rulesRange: [3062, 3069],
    matrix: roleDualMatrix(),
  },
  {
    collection: 'accounting_apy_certificates',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-apy-certificates.rules.test.ts',
    rulesRange: [3069, 3076],
    matrix: roleDualMatrix(),
  },
  {
    collection: 'accounting_custom_categories',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-custom-categories.rules.test.ts',
    rulesRange: [3076, 3083],
    matrix: roleDualMatrix(),
  },
  {
    collection: 'accounting_matching_rules',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-matching-rules.rules.test.ts',
    rulesRange: [3083, 3090],
    matrix: roleDualMatrix(),
  },
  {
    collection: 'accounting_efka_payments',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-efka-payments.rules.test.ts',
    rulesRange: [3090, 3097],
    matrix: roleDualMatrix(),
  },
  // Pattern C: fiscal periods — Q8 SAP state-machine
  {
    collection: 'accounting_fiscal_periods',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-fiscal-periods.rules.test.ts',
    rulesRange: [3111, 3132],
    // Fiscal period matrix: admin-only create, internal-user update with
    // state-machine guard, delete forbidden (business invariant).
    // See `fiscalPeriodMatrix()` in coverage-matrices.ts for full rationale.
    matrix: fiscalPeriodMatrix(),
  },
  // Pattern D: settings singletons — admin-only write, internal-user read
  {
    collection: 'accounting_settings',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-settings.rules.test.ts',
    rulesRange: [3132, 3146],
    matrix: accountingSingletonMatrix(),
  },
  {
    collection: 'accounting_efka_config',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-efka-config.rules.test.ts',
    rulesRange: [3146, 3162],
    matrix: accountingSingletonMatrix(),
  },
  // Pattern E: server-only — deny all client access
  {
    collection: 'accounting_invoice_counters',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/accounting-invoice-counters.rules.test.ts',
    rulesRange: [3162, 3169],
    // `allow read, write: if false` — no client reads or writes at all.
    // Stronger than `immutable` (which allows tenant-scoped reads).
    matrix: denyAllMatrix(),
  },
  // Pattern F: system-calculated — no createdBy, admin-delete
  {
    collection: 'accounting_customer_balances',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-customer-balances.rules.test.ts',
    rulesRange: [3169, 3178],
    matrix: accountingSystemCalcMatrix(),
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
  // ── ADR-298 Phase C.5 — System-global (2026-04-13) ───────────────────────
  {
    collection: 'config',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/config.rules.test.ts',
    rulesRange: [1579, 1583],
    matrix: systemGlobalMatrix(),
  },
  {
    collection: 'email_domain_policies',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/email-domain-policies.rules.test.ts',
    rulesRange: [1903, 1909],
    matrix: systemGlobalMatrix(),
  },
  {
    collection: 'country_security_policies',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/country-security-policies.rules.test.ts',
    rulesRange: [1910, 1916],
    matrix: systemGlobalMatrix(),
  },
  {
    collection: 'bot_configs',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/bot-configs.rules.test.ts',
    rulesRange: [2292, 2297],
    matrix: systemGlobalMatrix(),
  },
  {
    collection: 'system',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/system.rules.test.ts',
    rulesRange: [1563, 1572],
    // isCompanyAdmin() read (role-only, not tenant-bound), write=false
    matrix: systemAdminGlobalMatrix(),
  },
  {
    collection: 'navigation_companies',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/navigation-companies.rules.test.ts',
    rulesRange: [733, 739],
    matrix: adminWriteOnlyMatrix(),
  },
  {
    collection: 'appointments',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/appointments.rules.test.ts',
    rulesRange: [851, 868],
    matrix: adminWriteOnlyMatrix(),
  },
  {
    collection: 'counters',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/counters.rules.test.ts',
    rulesRange: [1922, 1928],
    // isAuthenticated() read+write — global increment counters
    matrix: countersMatrix(),
  },
  {
    collection: 'analytics',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/analytics.rules.test.ts',
    rulesRange: [1934, 1967],
    // Create: companyId==getUserCompanyId() only, no isSuperAdminOnly() — super_admin denied
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'communications',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/communications.rules.test.ts',
    rulesRange: [1521, 1554],
    // Create: companyId==getUserCompanyId() only, no isSuperAdminOnly() — super_admin denied
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'tasks',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/tasks.rules.test.ts',
    rulesRange: [784, 837],
    // Create: isSuperAdminOnly() OR-leg present → super_admin allowed (delta from crmDirectMatrix)
    // Seed doc: createdBy=assignedTo=same_tenant_user.uid for update/delete paths
    matrix: tasksMatrix(),
  },
  // ── ADR-298 Phase C.2 — DXF / CAD / Floorplan collections (2026-04-14) ──────
  {
    collection: 'project_floorplans',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/project-floorplans.rules.test.ts',
    rulesRange: [875, 913],
    // Create: companyId==getUserCompanyId() only — no isSuperAdminOnly() → super_admin denied.
    // Update/delete: createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly.
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'building_floorplans',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/building-floorplans.rules.test.ts',
    rulesRange: [918, 952],
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'floor_floorplans',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/floor-floorplans.rules.test.ts',
    rulesRange: [958, 994],
    // Has extra dev fallback leg on read (!companyId && !createdBy) — does not affect
    // canonical matrix (seed doc always carries companyId).
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'unit_floorplans',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/unit-floorplans.rules.test.ts',
    rulesRange: [999, 1036],
    // Delta from project_floorplans: create has isSuperAdminOnly() OR-leg → super_admin allowed.
    matrix: fileTenantFullMatrix(),
  },
  {
    collection: 'floorplans',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/floorplans.rules.test.ts',
    rulesRange: [2342, 2375],
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'dxf_overlay_levels',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/dxf_overlay_levels.rules.test.ts',
    rulesRange: [1051, 1098],
    // Items subcollection not tracked (nested subcollection — excluded from manifest).
    matrix: fileTenantFullMatrix(),
  },
  {
    collection: 'layers',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/layers.rules.test.ts',
    rulesRange: [1193, 1226],
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'layer_groups',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/layer-groups.rules.test.ts',
    rulesRange: [2303, 2336],
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'admin_building_templates',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/admin-building-templates.rules.test.ts',
    rulesRange: [2419, 2454],
    // Legacy fallback on read for !companyId docs (creator-only) — not exercised
    // by canonical matrix (seed doc carries companyId).
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'cad_files',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/cad-files.rules.test.ts',
    rulesRange: [332, 365],
    // Permissive write: create/update require only isAuthenticated() + fileName.
    // No companyId gate on write → cross_tenant_admin CAN create/update.
    // Read/delete: tenant-scoped (isSuperAdminOnly || belongsToCompany || legacy createdBy).
    matrix: cadFilesMatrix(),
  },
  // ── ADR-298 Phase C.3 — File management collections (2026-04-14) ──────────
  {
    collection: 'file_audit_log',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/file-audit-log.rules.test.ts',
    rulesRange: [2468, 2476],
    // Read gate: belongsToCompany only — NO isSuperAdminOnly bypass (super_admin denied).
    // Create allows super_admin (isSuperAdminOnly on create rule).
    // Update/delete: if false — immutable audit trail.
    // Note: pattern is 'tenant_direct' (not 'immutable') to avoid the Bug #1 shape
    // check which requires isSuperAdminOnly as first read leg — this collection
    // deliberately excludes super_admin from reads by design.
    matrix: fileAuditLogMatrix(),
  },
  {
    collection: 'file_shares',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/file-shares.rules.test.ts',
    rulesRange: [2485, 2508],
    // Read: if true — public (anonymous allowed for share token validation pages).
    // Delete: createdBy==uid only — super_admin and admin denied.
    matrix: fileSharesMatrix(),
  },
  {
    collection: 'photo_shares',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/photo-shares.rules.test.ts',
    rulesRange: [2513, 2527],
    // Update: if false — immutable CRM share history records.
    // Delete: isSuperAdminOnly() only.
    matrix: photoSharesMatrix(),
  },
  {
    collection: 'file_comments',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/file-comments.rules.test.ts',
    rulesRange: [2535, 2548],
    // Read gate: belongsToCompany (no isSuperAdminOnly bypass) → super_admin denied.
    // Update: any same-tenant member (authorId must be preserved).
    // Delete: author only (authorId == request.auth.uid). Seed: authorId=same_tenant_user.uid.
    matrix: fileCommentsMatrix(),
  },
  {
    collection: 'file_approvals',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/file-approvals.rules.test.ts',
    rulesRange: [2555, 2576],
    // Delete: if false — approval records are immutable business artifacts.
    matrix: fileApprovalsMatrix(),
  },
  {
    collection: 'document_templates',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/document-templates.rules.test.ts',
    rulesRange: [2583, 2610],
    // Full CRUD: isSuperAdminOnly || (companyId && belongsToCompany).
    // same_tenant_user has all operations (not just admin).
    matrix: fileTenantFullMatrix(),
  },
  {
    collection: 'file_webhooks',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/file-webhooks.rules.test.ts',
    rulesRange: [2617, 2620],
    // allow read, write: if false — Admin SDK only. Same shape as accounting_invoice_counters.
    matrix: denyAllMatrix(),
  },
  {
    collection: 'file_folders',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/file-folders.rules.test.ts',
    rulesRange: [2627, 2654],
    // Full CRUD: isSuperAdminOnly || (companyId && belongsToCompany).
    matrix: fileTenantFullMatrix(),
  },
  // ── ADR-298 Phase C.4 — BoQ / Commissions / Ownership collections (2026-04-14) ──
  {
    collection: 'boq_items',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/boq-items.rules.test.ts',
    rulesRange: [2791, 2837],
    // Full CRUD: isSuperAdminOnly || belongsToCompany(companyId).
    // Delete gated on status in ['draft', 'submitted'] — seed with status='draft'.
    // Update immutable: buildingId, projectId, companyId must not change.
    matrix: fileTenantFullMatrix(),
  },
  {
    collection: 'boq_categories',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/boq-categories.rules.test.ts',
    rulesRange: [2846, 2861],
    // Read-only: `allow create, update, delete: if false` — reserved for future admin UI.
    // Reads: isSuperAdminOnly || (companyId && belongsToCompany) || !companyId (system defaults).
    matrix: boqCategoriesMatrix(),
  },
  {
    collection: 'brokerage_agreements',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/brokerage-agreements.rules.test.ts',
    rulesRange: [2868, 2905],
    // Delete: createdBy==uid || isSuperAdminOnly (NO isCompanyAdminOfCompany).
    // same_tenant_admin can update (isCompanyAdminOfCompany) but NOT delete.
    // Seed doc: createdBy=same_tenant_user.uid.
    matrix: brokerageMatrix(),
  },
  {
    collection: 'commission_records',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/commission-records.rules.test.ts',
    rulesRange: [2910, 2942],
    // Delete: isSuperAdminOnly ONLY. No createdBy leg — super_admin is the only
    // persona allowed to permanently delete a commission record.
    // Update: createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly.
    matrix: commissionRecordsMatrix(),
  },
  {
    collection: 'ownership_tables',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/ownership-tables.rules.test.ts',
    rulesRange: [2950, 2977],
    // Delete: isSuperAdminOnly ONLY. Update: belongsToCompany (not createdBy).
    // Nested revisions subcollection excluded from top-level CHECK 3.16 scope.
    matrix: ownershipTablesMatrix(),
  },
  // ── ADR-298 Phase C.6 — ownership-based users / companies / workspaces (2026-04-14) ──
  {
    collection: 'companies',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/companies.rules.test.ts',
    rulesRange: [518, 550],
    // Read: isSuperAdminOnly() || getUserCompanyId() == companyId (path variable, not field).
    // Write: if false — Admin SDK only (ADR-252 FR-C3).
    // List: same-tenant personas denied (path-var rule, unrestricted queries blocked).
    // Nested audit_logs subcollection is covered by this parent block.
    matrix: companiesMatrix(),
  },
  {
    collection: 'security_roles',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/security-roles.rules.test.ts',
    rulesRange: [1309, 1312],
    // Read: isAuthenticated() — global, no tenant isolation (critical for login).
    // Write: if false — Admin SDK only.
    matrix: systemGlobalMatrix(),
  },
  {
    collection: 'users',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/users.rules.test.ts',
    rulesRange: [1319, 1361],
    // Read: uid==userId || (companyId && belongsToCompany) || isSuperAdminOnly (SPEC-259B).
    // Create/update: uid==userId || (companyId && isCompanyAdminOfCompany).
    // Delete: if false — user docs never client-deleted.
    // Nested sessions subcollection is covered by this parent block.
    matrix: usersMatrix(),
  },
  {
    collection: 'user_2fa_settings',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/user-2fa-settings.rules.test.ts',
    rulesRange: [1368, 1371],
    // Pure ownership: allow read, write: if isOwner(userId) = request.auth.uid == userId.
    // List + create: deny for all (path-var rule; harness fresh-docId constraint).
    // Own-uid create exercised in suite's dedicated regression block.
    matrix: ownerOnlyMatrix(),
  },
  {
    collection: 'user_notification_settings',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/user-notification-settings.rules.test.ts',
    rulesRange: [1378, 1381],
    // Pure ownership: allow read, write: if isOwner(userId) = request.auth.uid == userId.
    // List + create: deny for all (path-var rule; harness fresh-docId constraint).
    // Own-uid create exercised in suite's dedicated regression block.
    matrix: ownerOnlyMatrix(),
  },
  {
    collection: 'workspaces',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/workspaces.rules.test.ts',
    rulesRange: [1388, 1402],
    // Read: isSuperAdminOnly() || (companyId && belongsToCompany) (PR-1B, SPEC-259B).
    // Write: if false — Admin SDK only.
    matrix: adminWriteOnlyMatrix(),
  },
  {
    collection: 'teams',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/teams.rules.test.ts',
    rulesRange: [2678, 2712],
    // Create: companyId==getUserCompanyId() — no isSuperAdminOnly() short-circuit.
    // Update/delete: createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly.
    // Seed doc carries createdBy=same_tenant_user.uid.
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'positions',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/positions.rules.test.ts',
    rulesRange: [2719, 2722],
    // Read: isAuthenticated() — global, no tenant isolation.
    // Write: if false — Admin SDK only.
    matrix: systemGlobalMatrix(),
  },
  // ── ADR-298 Phase C.7 — specialized collections (2026-04-14) ─────────────
  {
    collection: 'contact_relationships',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/contact-relationships.rules.test.ts',
    rulesRange: [103, 142],
    // Create: isAuthenticated() + required fields only — NO companyId gate.
    // Update/delete: createdBy==uid || isSuperAdminOnly. same_tenant_admin denied.
    // Seed: createdBy=same_tenant_user.uid, companyId=SAME_TENANT_COMPANY_ID.
    matrix: contactRelationshipsMatrix(),
  },
  {
    collection: 'contact_links',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/contact-links.rules.test.ts',
    rulesRange: [151, 187],
    // Same pattern as contact_relationships: open create, creator-only update/delete.
    matrix: contactRelationshipsMatrix(),
  },
  {
    collection: 'relationships',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/relationships.rules.test.ts',
    rulesRange: [1860, 1897],
    // Create: companyId==getUserCompanyId() — no isSuperAdminOnly shortcut.
    // Update/delete: createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly.
    // Seed: createdBy=same_tenant_user.uid.
    matrix: crmDirectMatrix(),
  },
  {
    collection: 'relationship_audit',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/relationship-audit.rules.test.ts',
    rulesRange: [2381, 2385],
    // Read: isAuthenticated() — any authenticated, no tenant isolation.
    // Write: if false — Admin SDK only.
    matrix: systemGlobalMatrix(),
  },
  {
    collection: 'employment_records',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/employment-records.rules.test.ts',
    rulesRange: [285, 324],
    // Read: tenant-scoped (companyId OR crossdoc projectId). Write: open authenticated
    // create/update (no companyId gate). Delete: if false.
    matrix: employmentRecordsMatrix(),
  },
  {
    collection: 'notifications',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/notifications.rules.test.ts',
    rulesRange: [748, 769],
    // Read: userId==auth.uid — owner only. Update: owner + isValidNotificationUpdate.
    // Create/delete: if false — server-only.
    matrix: notificationsMatrix(),
  },
  {
    collection: 'audit_logs',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/audit-logs.rules.test.ts',
    rulesRange: [2455, 2459],
    // Top-level audit_logs (NOT the companies/{id}/audit_logs subcollection).
    // Read: isAuthenticated() — global, no tenant isolation. Write: if false.
    matrix: systemGlobalMatrix(),
  },
  {
    collection: 'system_audit_logs',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/system-audit-logs.rules.test.ts',
    rulesRange: [2655, 2659],
    // Read: isAuthenticated() — global, no tenant isolation. Write: if false.
    matrix: systemGlobalMatrix(),
  },
  {
    collection: 'audit_log',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/audit-log.rules.test.ts',
    rulesRange: [2667, 2671],
    // Cloud Functions purge trail. Read: isSuperAdminOnly() only. Write: if false.
    // Pattern system_global (not immutable) — Bug #1 check only applies to immutable.
    matrix: auditLogMatrix(),
  },
  {
    collection: 'search_documents',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/search-documents.rules.test.ts',
    rulesRange: [2742, 2758],
    // Read: isSuperAdminOnly() || belongsToCompany(tenantId) — uses tenantId field.
    // Write: if false — Cloud Functions / Admin SDK. Seed uses tenantId (not companyId).
    matrix: searchDocumentsMatrix(),
  },
  {
    collection: 'voice_commands',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/voice-commands.rules.test.ts',
    rulesRange: [2770, 2781],
    // Read: userId==auth.uid — owner only. All writes: if false — server-only.
    matrix: voiceCommandsMatrix(),
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
  // — Contacts / relationships — (all moved to COVERAGE in ADR-298 Phase C.7, 2026-04-14)
  // contact_relationships → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // contact_links         → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // relationships         → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // relationship_audit    → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // — Attendance / HR —
  // attendance_events + attendance_qr_tokens moved to COVERAGE (ADR-298 Phase B.1, 2026-04-11)
  // employment_records    → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // — Files / CAD — (all moved to COVERAGE in ADR-298 Phase C.2+C.3, 2026-04-14)
  // cad_files            → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // file_shares          → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // photo_shares         → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // file_comments        → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // file_approvals       → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // document_templates   → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // file_webhooks        → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // file_folders         → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // file_audit_log       → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // — Companies / users / workspaces — (all moved to COVERAGE in ADR-298 Phase C.6, 2026-04-14)
  // companies                  → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // security_roles             → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // users                      → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // user_notification_settings → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // user_2fa_settings          → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // workspaces                 → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // teams                      → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // positions                  → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // — Building / property hierarchy —
  // floors, properties, storage_units, parking_spots → moved to COVERAGE (ADR-298 Phase B.4, 2026-04-13)
  // project_floorplans     → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // building_floorplans    → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // floor_floorplans       → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // unit_floorplans        → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // floorplans             → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // admin_building_templates → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // — DXF / CAD overlays —
  // dxf_overlay_levels → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14; renamed from dxfOverlayLevels 2026-04-16)
  // layers           → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // layer_groups     → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // — DXF Viewer levels (post-rename underscore collections, 2026-04-16) —
  'dxf_viewer_levels',    // lines 3097-3117 — tenant read + bootstrap create
  // — Sharing (ADR-312 Phase 2 Property Showcase + ADR-315 Unified Sharing) —
  // TODO(ADR-298 Phase D): write full matrix for shares + share_dispatches
  'shares',               // lines 2428-2447 — ADR-312/315 unified sharing link tokens
  'share_dispatches',     // lines 2454-2463 — ADR-312/315 share dispatch events
  // dxf_overlay_levels → moved to COVERAGE (renamed from camelCase, 2026-04-16)
  // — Navigation / notifications / tasks —
  // navigation_companies → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // notifications        → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // tasks        → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // appointments → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // — CRM —
  // communications → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // leads, opportunities, activities → moved to COVERAGE (ADR-298 Phase B.3, 2026-04-13)
  // conversations, external_identities → moved to COVERAGE (ADR-298 Phase B.5, 2026-04-13)
  // — System / config —
  // system              → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // config              → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // email_domain_policies     → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // country_security_policies → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // counters → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // analytics → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // bot_configs → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // — Obligations / compliance —
  // obligations, obligation_transmittals, obligation_templates → moved to COVERAGE (ADR-298 Phase B.6, 2026-04-13)
  // — Audit / search / voice — (all moved to COVERAGE in ADR-298 Phase C.7, 2026-04-14)
  // audit_logs        → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // system_audit_logs → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // audit_log         → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // search_documents  → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // voice_commands    → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // — BoQ / commissions / ownership —
  // boq_items            → moved to COVERAGE (ADR-298 Phase C.4, 2026-04-14)
  // boq_categories       → moved to COVERAGE (ADR-298 Phase C.4, 2026-04-14)
  // brokerage_agreements → moved to COVERAGE (ADR-298 Phase C.4, 2026-04-14)
  // commission_records   → moved to COVERAGE (ADR-298 Phase C.4, 2026-04-14)
  // ownership_tables     → moved to COVERAGE (ADR-298 Phase C.4, 2026-04-14)
  // — Accounting (sole proprietor subapp) —
  // accounting_journal_entries      → moved to COVERAGE (ADR-298 Phase B.2, 2026-04-13)
  // accounting_invoices             → moved to COVERAGE (ADR-298 Phase B.2, 2026-04-13)
  // accounting_audit_log            → moved to COVERAGE (ADR-298 Phase B.2, 2026-04-13)
  // accounting_bank_transactions    → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_bank_accounts        → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_fixed_assets         → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_depreciation_records → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_expense_documents    → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_import_batches       → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_tax_installments     → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_apy_certificates     → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_custom_categories    → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_matching_rules       → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_efka_payments        → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_fiscal_periods       → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_settings             → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_efka_config          → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_invoice_counters     → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_customer_balances    → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // — Quotes / RFQ / Vendor Portal (ADR-327 P1a, 2026-04-25) —
  // TODO(ADR-298 Phase E): write full matrix for quotes + rfqs
  'rfqs',                   // Admin SDK writes only; read: auth + companyId
  'quotes',                 // Admin SDK writes only; vendor portal path in P3
  'quote_counters',         // Admin SDK only — no client access
  'vendor_invites',         // Admin SDK writes only; read: auth + companyId
  'vendor_invite_tokens',   // Admin SDK only — no client access
  'trades',                 // read: isAuthenticated(); write: Admin SDK only
  // — Multi-Vendor (ADR-327 §17 Q28-Q32 step b, 2026-04-29) —
  // Sub-collection rfqs/{id}/lines parses as 'rfqs' (already pending).
  // Full matrix lands in step (c) once services exist to drive seeding.
  'sourcing_events',        // Admin SDK writes only; read: auth + companyId
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
