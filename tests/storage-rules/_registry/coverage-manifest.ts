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
  /**
   * `company_scoped_authoring` (ADR-657) — companyId in path, gated on the
   * authoring tier `isInternalUserOfCompany(companyId)`. Same-tenant *internal*
   * roles (+ super_admin) get read/write/delete; a same-tenant `external_user`
   * is DENIED all three (insufficient_role) despite a valid companyId claim;
   * cross-tenant is denied (cross_tenant); anonymous is denied (missing_claim).
   */
  | 'company_scoped_authoring'
  | 'owner_based'
  | 'owner_based_no_superadmin'
  /**
   * `server_only_read_superadmin_curation` (ADR-655 asset packs) — αδειοδοτημένο περιεχόμενο:
   * ΚΑΝΕΝΑΣ client δεν διαβάζει (`allow read: if false`), ούτε ο super_admin· η ανάγνωση γίνεται
   * μόνο server-side (Admin SDK) μέσα από την πύλη εξουσιοδότησης. Γράψιμο/σβήσιμο = curation,
   * μόνο super_admin.
   */
  | 'server_only_read_superadmin_curation';

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
// Row factories — the SSoT building blocks every matrix composes.
//
// A "row" = the three operations (read/write/delete) for one persona. Every
// coverage matrix is a spread of these, so an identical (persona × outcome)
// triple is authored exactly once. This is what keeps the token-based clone
// detector (CHECK 3.28) quiet: no matrix re-types another matrix's literal
// rows — they call the same factory. See ADR-584 / ADR-301 §3.2.
// ---------------------------------------------------------------------------

/** All three operations `allow` for one persona. */
function allowAll(persona: StoragePersona): readonly StorageCoverageCell[] {
  return [
    cell(persona, 'read',   'allow'),
    cell(persona, 'write',  'allow'),
    cell(persona, 'delete', 'allow'),
  ] as const;
}

/** All three operations `deny` for one persona, tagged with a single reason. */
function denyAll(
  persona: StoragePersona,
  reason: StorageReason,
): readonly StorageCoverageCell[] {
  return [
    cell(persona, 'read',   'deny', reason),
    cell(persona, 'write',  'deny', reason),
    cell(persona, 'delete', 'deny', reason),
  ] as const;
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
    ...allowAll('super_admin'),
    ...allowAll('same_tenant_user'),
    ...denyAll('cross_tenant_user', 'cross_tenant'),
    ...denyAll('anonymous', 'missing_claim'),
  ] as const;
}

// ---------------------------------------------------------------------------
// Authoring-tier matrix builder (ADR-657)
// ---------------------------------------------------------------------------

/**
 * Authoring company-scoped matrix.
 * Gate: `isInternalUserOfCompany(companyId)` = `isSuperAdmin() ||
 *        (isInternalUser() && belongsToCompany(companyId))`.
 *
 * Key difference from `companyScopedMatrix()`: a same-tenant `external_user`
 * (valid companyId claim, but a non-internal globalRole) is DENIED all three
 * operations with `insufficient_role`. That single row is the entire point of
 * the ADR-657 authoring/presentation split at the storage layer.
 */
function topoSurfacesAuthoringMatrix(): readonly StorageCoverageCell[] {
  return [
    ...allowAll('super_admin'),
    ...allowAll('same_tenant_admin'),
    ...allowAll('same_tenant_user'),
    // same tenant, but non-internal role → authoring tier denies all three.
    ...denyAll('external_user', 'insufficient_role'),
    ...denyAll('cross_tenant_user', 'cross_tenant'),
    ...denyAll('anonymous', 'missing_claim'),
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
  // Path 3: Topographic survey blobs — ADR-650, re-tiered by ADR-657
  // storage.rules lines 417-424
  //
  // Ο ορισμός μιας τοπογραφικής επιφάνειας όταν το point cloud ξεπερνά το όριο
  // του Firestore doc (1 MB) → offload σε JSON blob. ADR-657: η τοπογραφική
  // επιφάνεια είναι authoring geometry — και τα τρία σκέλη περνούν από
  // isInternalUserOfCompany(companyId), οπότε ο same-tenant external_user
  // απορρίπτεται (insufficient_role). Γι' αυτό χρησιμοποιεί το
  // topoSurfacesAuthoringMatrix() αντί για το companyScopedMatrix().
  // Το write έχει δύο επιπλέον σκέλη (contentType == application/json, size < 100 MB)
  // που δεν είναι persona-dependent: τα φυλάει το hardening block του suite.
  // -------------------------------------------------------------------------
  {
    pathId: 'topo_surfaces',
    pattern: 'company_scoped_authoring',
    rulesRange: [417, 424],
    testFile: 'tests/storage-rules/suites/topo-surfaces.storage.test.ts',
    matrix: topoSurfacesAuthoringMatrix(),
  },

  // -------------------------------------------------------------------------
  // Path 4: CAD files (ownership-based, super_admin can read/delete but not write)
  // storage.rules lines 409-420
  // -------------------------------------------------------------------------
  {
    pathId: 'cad',
    pattern: 'owner_based',
    rulesRange: [409, 420],
    testFile: 'tests/storage-rules/suites/cad-files.storage.test.ts',
    matrix: [
      // owner (same_tenant_user uid == path userId)
      ...allowAll('same_tenant_user'),
      // super_admin: read+delete bypass, write DENIED (isOwner only)
      cell('super_admin',       'read',   'allow'),
      cell('super_admin',       'write',  'deny',  'not_owner'),
      cell('super_admin',       'delete', 'allow'),
      // non-owner, non-superadmin
      ...denyAll('same_tenant_admin', 'not_owner'),
      // unauthenticated
      ...denyAll('anonymous', 'missing_claim'),
    ] as const,
  },

  // -------------------------------------------------------------------------
  // Path 5: Temp uploads (owner-only, NO super_admin bypass on any operation)
  // storage.rules lines 429-436
  //
  // NOTE: The `allow read, write` rule uses `isValidFileSize()` which checks
  // `request.resource.size`. For read operations, `request.resource` is null
  // in Firebase Storage Rules. If the emulator denies owner reads due to this
  // null-dereference, it indicates a latent bug in storage.rules.
  // In that case update `same_tenant_user × read` to `deny` and file a fix.
  // -------------------------------------------------------------------------
  {
    pathId: 'temp',
    pattern: 'owner_based_no_superadmin',
    rulesRange: [429, 436],
    testFile: 'tests/storage-rules/suites/temp-uploads.storage.test.ts',
    matrix: [
      // owner (same_tenant_user uid == path userId)
      ...allowAll('same_tenant_user'),
      // super_admin: NO bypass — isOwner only, uid does not match path
      ...denyAll('super_admin', 'not_owner'),
      // non-owner authenticated
      ...denyAll('same_tenant_admin', 'not_owner'),
      // unauthenticated
      ...denyAll('anonymous', 'missing_claim'),
    ] as const,
  },

  // -------------------------------------------------------------------------
  // Path 6: Asset packs — ADR-655 gated content libraries
  // storage.rules lines 514-522
  //
  // Το συμβόλαιο που φυλάει αυτό το suite: **καμία διαδρομή ανάγνωσης από client**.
  // Αν κάποιος «χαλαρώσει» το `allow read: if false` (π.χ. σε `isAuthenticated()`),
  // η πύλη εξουσιοδότησης (entitlement + RBAC + kill switch) παρακάμπτεται με σκέτο URL
  // — και το τεστ κοκκινίζει. Γι' αυτό ελέγχουμε deny ΚΑΙ για τον super_admin στο read.
  // -------------------------------------------------------------------------
  {
    pathId: 'asset_packs',
    pattern: 'server_only_read_superadmin_curation',
    rulesRange: [514, 522],
    testFile: 'tests/storage-rules/suites/asset-packs.storage.test.ts',
    matrix: [
      // super_admin: curation write/delete allowed — read STILL denied (server-only proxy).
      cell('super_admin',       'read',   'deny',  'server_only'),
      cell('super_admin',       'write',  'allow'),
      cell('super_admin',       'delete', 'allow'),
      // κάθε άλλος client: τίποτα, ούτε καν με το σωστό URL.
      cell('same_tenant_admin', 'read',   'deny',  'server_only'),
      cell('same_tenant_admin', 'write',  'deny',  'super_admin_only'),
      cell('same_tenant_admin', 'delete', 'deny',  'super_admin_only'),
      cell('same_tenant_user',  'read',   'deny',  'server_only'),
      cell('same_tenant_user',  'write',  'deny',  'super_admin_only'),
      cell('same_tenant_user',  'delete', 'deny',  'super_admin_only'),
      cell('cross_tenant_user', 'read',   'deny',  'server_only'),
      cell('cross_tenant_user', 'write',  'deny',  'super_admin_only'),
      cell('cross_tenant_user', 'delete', 'deny',  'super_admin_only'),
      // unauthenticated
      cell('anonymous',         'read',   'deny',  'server_only'),
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
export const STORAGE_RULES_PENDING: readonly string[] = [
  // ADR-327 P5 vendor-portal quote uploads (Admin SDK writes only, authenticated company-scoped reads).
  // Test suite to be added in follow-up: tests/storage-rules/suites/vendor-portal-quotes.storage.test.ts
  '/companies/{companyId}/quotes/{quoteId}/{fileName}',
  // ADR-366 §C.1.c BIM animation MP4 renders (company-scoped, client-side writes capped at 500 MB).
  // Test suite to be added in follow-up: tests/storage-rules/suites/bim-animation-renders.storage.test.ts
  '/companies/{companyId}/bim_animations/{animationId}/renders/{fileName}',
  // ADR-366 Group B custom HDRI environments (company-scoped, .hdr/.exr ≤ 50 MB).
  // Test suite to be added in follow-up: tests/storage-rules/suites/bim-environments.storage.test.ts
  '/companies/{companyId}/bim_environments/{fileName}',
  // ADR-413 §2D Phase 2 BIM material appearance thumbnails (company-scoped, image/* ≤ 5 MB).
  // Test suite to be added in follow-up: tests/storage-rules/suites/bim-material-thumbnails.storage.test.ts
  '/companies/{companyId}/bim-material-thumbnails/{fileName}',
  // ADR-651 Φάση Ε engineer stamp/signature image (company-scoped, image/* ≤ 2 MB).
  // Test suite to be added in follow-up: tests/storage-rules/suites/engineer-stamps.storage.test.ts
  '/companies/{companyId}/engineer-stamps/{fileName}',
  // ADR-413 §2D Phase 3 BIM material 3D PBR texture maps (company-scoped, image/* ≤ 10 MB,
  // keyed by materialId + map). Test suite to be added in follow-up:
  // tests/storage-rules/suites/bim-material-textures.storage.test.ts
  '/companies/{companyId}/bim-material-textures/{materialId}/{fileName}',
  // ADR-652 M2 Block Library geometry blobs (company-scoped, application/json ≤ 5 MB,
  // keyed by blklib_* id). Test suite to be added in follow-up:
  // tests/storage-rules/suites/block-library-geometry.storage.test.ts
  '/companies/{companyId}/block-library/{fileName}',
  // ADR-652 M3 system content (έτοιμη/partner βιβλιοθήκη): read = κάθε authenticated χρήστης,
  // write/delete = super-admin only (seed μέσω Admin SDK). Ίδιο test suite με το company path.
  '/system/block-library/{fileName}',
  // ADR-410 CC0 furniture mesh library (shared read-only catalog; super_admin curates writes/deletes).
  // Test suite to be added in follow-up: tests/storage-rules/suites/furniture-library.storage.test.ts
  '/furniture-library/{assetFile=**}',
  // ADR-411 unified BIM mesh library (entity-agnostic Revit-style content server; shared read-only,
  // super_admin curates writes/deletes). Supersedes /furniture-library/.
  // Test suite to be added in follow-up: tests/storage-rules/suites/bim-mesh-library.storage.test.ts
  '/bim-mesh-library/{assetFile=**}',
  // ADR-413 CC0 PBR texture content library (shared read-only catalog; super_admin curates writes/deletes).
  // Test suite to be added in follow-up: tests/storage-rules/suites/bim-texture-library.storage.test.ts
  '/bim-texture-library/{assetFile=**}',
] as const;
