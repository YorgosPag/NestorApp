/**
 * Storage Rules Test Coverage — SSoT Manifest
 *
 * Single source of truth for *which* (path × persona × operation) cells
 * must be exercised by the Storage rules unit test suite. CHECK 3.19 reads
 * this file, walks storage.rules, and blocks commits where the manifest
 * and the test files or the rules file have drifted.
 *
 * See ADR-301 §3.2 and §3.4.
 *
 * Contract:
 *   - Every top-level `match` block in storage.rules MUST be either
 *     (a) present in STORAGE_RULES_COVERAGE with a matching test file, or
 *     (b) explicitly listed in STORAGE_RULES_PENDING.
 *   - Every STORAGE_RULES_COVERAGE entry MUST have a test file at its
 *     `testFile` path with a `COVERAGE` export matching this manifest.
 *   - Every matrix cell MUST have a matching `describe('<persona> × <op>')`
 *     block in the corresponding test file.
 *
 * Zero-tolerance: CHECK 3.19 is not a ratchet. The pending list exists only
 * to handle future new path patterns added to storage.rules.
 *
 * @module tests/storage-rules/_registry/coverage-manifest
 * @since 2026-04-14 (ADR-301 Phase A)
 */

import type { StorageOperation, Outcome, StorageReason } from './operations';
import type { StoragePersona } from './personas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Architectural classification of a storage rules path block.
 *
 * `company_scoped_with_project` — companyId + projectId in path;
 *   read/write/delete gated on `belongsToCompany(companyId) || isSuperAdmin()`.
 *
 * `company_scoped_no_project` — companyId only in path; same claim gate.
 *
 * `owner_based` — userId embedded in path; read/delete allow owner OR
 *   super_admin, write allows owner only.
 *
 * `owner_based_no_superadmin` — userId embedded in path; ALL operations
 *   allow owner only, no super_admin bypass (temp/ path).
 */
export type StoragePathPattern =
  | 'company_scoped_with_project'
  | 'company_scoped_no_project'
  | 'owner_based'
  | 'owner_based_no_superadmin';

/** One (persona × operation) cell of a path's coverage matrix. */
export interface StorageCoverageCell {
  readonly persona: StoragePersona;
  readonly operation: StorageOperation;
  readonly outcome: Outcome;
  /** Optional reason tag documenting *why* the outcome is deny. */
  readonly reason?: StorageReason;
}

/** One path block entry in the coverage manifest. */
export interface StorageCoverageEntry {
  /**
   * Human-readable path identifier — matches the comment above the
   * `match` block in storage.rules.
   */
  readonly pathId: string;
  /** Architectural pattern driving this path's rule logic. */
  readonly pattern: StoragePathPattern;
  /**
   * Line range [startLine, endLine] (1-indexed) of the match block in
   * storage.rules. Allows CHECK 3.19 to pinpoint drift.
   */
  readonly rulesRange: readonly [number, number];
  /**
   * Path to the test file relative to the project root.
   * CHECK 3.19 verifies this file exists and exports `COVERAGE`.
   */
  readonly testFile: string;
  /** Coverage matrix: every (persona × operation) cell to exercise. */
  readonly matrix: readonly StorageCoverageCell[];
}

// ---------------------------------------------------------------------------
// Helper — cell factory (reduces verbosity in matrix declarations)
// ---------------------------------------------------------------------------

function cell(
  persona: StoragePersona,
  operation: StorageOperation,
  outcome: Outcome,
  reason?: StorageReason,
): StorageCoverageCell {
  return reason ? { persona, operation, outcome, reason } : { persona, operation, outcome };
}

// ---------------------------------------------------------------------------
// Company-scoped matrix builders (reused for with-project + no-project)
// ---------------------------------------------------------------------------

/**
 * Standard company-scoped matrix.
 * Gate: `belongsToCompany(companyId) || isSuperAdmin()`
 * Applied to both read and write variants (write also needs valid file).
 */
function companyScopedMatrix(): readonly StorageCoverageCell[] {
  return [
    cell('super_admin',       'read',   'allow'),
    cell('super_admin',       'write',  'allow'),
    cell('super_admin',       'delete', 'allow'),
    cell('same_tenant_user',  'read',   'allow'),
    cell('same_tenant_user',  'write',  'allow'),
    cell('same_tenant_user',  'delete', 'allow'),
    cell('cross_tenant_user', 'read',   'deny',  'cross_tenant'),
    cell('cross_tenant_user', 'write',  'deny',  'cross_tenant'),
    cell('cross_tenant_user', 'delete', 'deny',  'cross_tenant'),
    cell('anonymous',         'read',   'deny',  'missing_claim'),
    cell('anonymous',         'write',  'deny',  'missing_claim'),
    cell('anonymous',         'delete', 'deny',  'missing_claim'),
  ] as const;
}

// ---------------------------------------------------------------------------
// Coverage manifest
// ---------------------------------------------------------------------------

/**
 * STORAGE_RULES_COVERAGE — registered path blocks with full test coverage.
 *
 * Order matches the match blocks in storage.rules top-to-bottom.
 */
export const STORAGE_RULES_COVERAGE: readonly StorageCoverageEntry[] = [
  // -------------------------------------------------------------------------
  // Path 1: Canonical enterprise path (with projectId)
  // storage.rules lines 172-201
  // -------------------------------------------------------------------------
  {
    pathId: 'canonical_with_project',
    pattern: 'company_scoped_with_project',
    rulesRange: [172, 201],
    testFile: 'tests/storage-rules/suites/canonical-path-with-project.storage.test.ts',
    matrix: companyScopedMatrix(),
  },

  // -------------------------------------------------------------------------
  // Path 2: Simplified enterprise path (no projectId)
  // storage.rules lines 212-229
  // -------------------------------------------------------------------------
  {
    pathId: 'canonical_no_project',
    pattern: 'company_scoped_no_project',
    rulesRange: [212, 229],
    testFile: 'tests/storage-rules/suites/canonical-path-no-project.storage.test.ts',
    matrix: companyScopedMatrix(),
  },

  // -------------------------------------------------------------------------
  // Path 3: CAD files (ownership-based, super_admin can read/delete but not write)
  // storage.rules lines 238-249
  // -------------------------------------------------------------------------
  {
    pathId: 'cad',
    pattern: 'owner_based',
    rulesRange: [238, 249],
    testFile: 'tests/storage-rules/suites/cad-files.storage.test.ts',
    matrix: [
      // owner (same_tenant_user uid == path userId)
      cell('same_tenant_user',  'read',   'allow'),
      cell('same_tenant_user',  'write',  'allow'),
      cell('same_tenant_user',  'delete', 'allow'),
      // super_admin: read+delete bypass, write DENIED (isOwner only)
      cell('super_admin',       'read',   'allow'),
      cell('super_admin',       'write',  'deny',  'not_owner'),
      cell('super_admin',       'delete', 'allow'),
      // non-owner, non-superadmin
      cell('same_tenant_admin', 'read',   'deny',  'not_owner'),
      cell('same_tenant_admin', 'write',  'deny',  'not_owner'),
      cell('same_tenant_admin', 'delete', 'deny',  'not_owner'),
      // unauthenticated
      cell('anonymous',         'read',   'deny',  'missing_claim'),
      cell('anonymous',         'write',  'deny',  'missing_claim'),
      cell('anonymous',         'delete', 'deny',  'missing_claim'),
    ] as const,
  },

  // -------------------------------------------------------------------------
  // Path 4: Temp uploads (owner-only, NO super_admin bypass on any operation)
  // storage.rules lines 258-265
  //
  // NOTE: The `allow read, write` rule uses `isValidFileSize()` which checks
  // `request.resource.size`. For read operations, `request.resource` is null
  // in Firebase Storage Rules. If the emulator denies owner reads due to this
  // null-dereference, it indicates a latent bug in storage.rules line 261.
  // In that case update `same_tenant_user × read` to `deny` and file a fix.
  // -------------------------------------------------------------------------
  {
    pathId: 'temp',
    pattern: 'owner_based_no_superadmin',
    rulesRange: [258, 265],
    testFile: 'tests/storage-rules/suites/temp-uploads.storage.test.ts',
    matrix: [
      // owner (same_tenant_user uid == path userId)
      cell('same_tenant_user',  'read',   'allow'),
      cell('same_tenant_user',  'write',  'allow'),
      cell('same_tenant_user',  'delete', 'allow'),
      // super_admin: NO bypass — isOwner only, uid does not match path
      cell('super_admin',       'read',   'deny',  'not_owner'),
      cell('super_admin',       'write',  'deny',  'not_owner'),
      cell('super_admin',       'delete', 'deny',  'not_owner'),
      // non-owner authenticated
      cell('same_tenant_admin', 'read',   'deny',  'not_owner'),
      cell('same_tenant_admin', 'write',  'deny',  'not_owner'),
      cell('same_tenant_admin', 'delete', 'deny',  'not_owner'),
      // unauthenticated
      cell('anonymous',         'read',   'deny',  'missing_claim'),
      cell('anonymous',         'write',  'deny',  'missing_claim'),
      cell('anonymous',         'delete', 'deny',  'missing_claim'),
    ] as const,
  },
] as const;

/**
 * STORAGE_RULES_PENDING — path blocks not yet covered by tests.
 *
 * Zero-tolerance: CHECK 3.19 blocks commits that add new match blocks to
 * storage.rules without adding a corresponding entry here or in COVERAGE.
 */
export const STORAGE_RULES_PENDING: readonly string[] = [] as const;
