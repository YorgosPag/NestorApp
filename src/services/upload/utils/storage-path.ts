/**
 * =============================================================================
 * 🏢 ENTERPRISE CANONICAL STORAGE PATH BUILDER
 * =============================================================================
 *
 * Builds Firebase Storage paths using ONLY IDs.
 * Human-readable names (Greek/any language) belong in Firestore FileRecord.displayName.
 *
 * @module upload/utils/storage-path
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-709 - Immutable Storage Path (single scheme)
 *
 * THE ONE PATH SCHEME (ADR-709 — no variants, no optional segments):
 * /companies/{companyId}/entities/{entityType}/{entityId}/
 *   domains/{domain}/categories/{category}/files/{fileId}.{ext}
 *
 * WHY exactly one: object-storage keys are immutable by design (renaming an
 * object means COPY + DELETE of every byte). A key may therefore only encode
 * facts that can never change. `companyId` / `entityType` / `entityId` are
 * immutable identities of the file's OWN entity. A *relationship* such as
 * "which project does this building belong to" is mutable — re-parenting a
 * building would silently invalidate every path already written. Relationships
 * live in Firestore (`FileRecord.projectId`), where they can change for free.
 *
 * This is the Autodesk APS split (flat OSS object keys + hierarchy in the Data
 * Management API) and the reason `projectId` is ABSENT from StoragePathParams:
 * the rule is enforced by the type system, not by convention.
 *
 * Reading legacy paths that still carry `projects/{projectId}/` is supported by
 * `parseStoragePath` (tolerant reader). Writing them is not expressible.
 *
 * OWNER ROOT (ADR-866 §5.2): the first two segments name the file's OWNER — exactly one:
 *   companies/{companyId}/…  — owned by a company (every path written before 2026-09-17)
 *   people/{userId}/…        — owned by a PERSON (a private individual has no company,
 *                              ADR-787 Ε-3 §3 — and must never be given a pseudo-company)
 * Everything after the root is the SAME scheme. The root is an immutable identity of the
 * owner, exactly like `companyId` always was, so ADR-709 "one scheme" still holds: an owner
 * change is a MOVE between roots (Google Drive: moving into a shared drive changes owner),
 * never a rename inside one. System-level paths without an owner are NOT supported.
 */

import {
  type EntityType,
  type FileDomain,
  type FileCategory,
  STORAGE_PATH_SEGMENTS,
  isPlatformEntityType,
} from '@/config/domain-constants';
import type { CustodyScope } from '@/lib/workspace/custody-scope';
import {
  isValidCategory,
  isValidDomain,
  validateStoragePathParams,
} from './storage-path-validation';

// Validation lives in `storage-path-validation.ts` (N.7.1 split) — re-exported
// so every existing importer of this module keeps working unchanged.
// `isPlatformEntityType` is deliberately NOT re-exported here: it belongs to
// `config/domain-constants` (where ENTITY_TYPES lives) and is used well beyond
// the storage surface, so a second import path for it would be the start of the
// next divergence rather than a convenience.
export {
  isValidCategory,
  isValidDomain,
  isValidExtension,
  isValidPathSegment,
  validateStoragePathParams,
} from './storage-path-validation';
export type { StoragePathValidationError } from './storage-path-validation';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Where a file sits inside its owner's tree — everything except WHO owns it.
 */
interface StorageEntityCoordinates {
  /** Entity type this file belongs to */
  entityType: EntityType;

  /** Entity ID this file belongs to */
  entityId: string;

  /** Business domain */
  domain: FileDomain;

  /** Content category */
  category: FileCategory;

  /** Generated file ID */
  fileId: string;

  /** File extension without dot (jpg, pdf, dxf, etc.) */
  ext: string;
}

/**
 * Parameters for building a canonical storage path: exactly ONE owner
 * (`{ companyId }` or `{ userId }`, ADR-866 §5.2) + the entity coordinates.
 * Existing callers passing `companyId` are the company member of the union — unchanged.
 */
export type StoragePathParams = CustodyScope & StorageEntityCoordinates;

/**
 * Result from building a storage path
 */
export interface StoragePathResult {
  /** Full storage path (IDs only, no Greek names) */
  path: string;

  /** Path segments for debugging/logging */
  segments: CustodyScope & StorageEntityCoordinates & { root: string };
}

/**
 * Result of `parseStoragePath` — canonical components plus a legacy marker.
 *
 * `legacyProjectId` is populated ONLY when the parsed path still carries the
 * pre-ADR-709 `projects/{projectId}/` segment. It exists so migration tooling
 * and prefix sweeps can recognise old objects; it is never an input anywhere.
 */
export type ParsedStoragePath = StoragePathParams & {
  /** Set when the path uses the legacy project-scoped scheme (ADR-709) — company roots only. */
  legacyProjectId?: string;
};

// ============================================================================
// BUILDER
// ============================================================================

/**
 * 🏢 ENTERPRISE: Builds canonical Firebase Storage path
 *
 * Path contains ONLY IDs - no human-readable names, no Greek characters.
 * Display names belong in Firestore FileRecord.displayName.
 *
 * Exactly one owner is REQUIRED (`companyId` or `userId`, ADR-866 §5.2).
 *
 * ADR-709: there is exactly ONE scheme. A file's project membership is NOT
 * expressible here — it belongs to `FileRecord.projectId` in Firestore.
 *
 * @example
 * ```typescript
 * const result = buildStoragePath({
 *   companyId: 'company_xyz',
 *   entityType: 'contact',
 *   entityId: 'contact_789',
 *   domain: 'admin',
 *   category: 'photos',
 *   fileId: 'file_abc123',
 *   ext: 'jpg',
 * });
 * // result.path = 'companies/company_xyz/entities/contact/contact_789/domains/admin/categories/photos/files/file_abc123.jpg'
 * ```
 *
 * @throws Error if validation fails (with detailed error messages)
 */
export function buildStoragePath(params: StoragePathParams): StoragePathResult {
  // Validate all parameters
  const validationErrors = validateStoragePathParams(params);
  if (validationErrors.length > 0) {
    const errorMessages = validationErrors
      .map((e) => `${e.field}: ${e.message}`)
      .join('; ');
    throw new Error(`Invalid storage path parameters: ${errorMessages}`);
  }

  // Normalize extension (remove leading dot if present)
  const cleanExt = params.ext.startsWith('.') ? params.ext.slice(1) : params.ext;

  // Entity root (SSoT — shared with prefix sweeps, see buildEntityStoragePrefix)
  const path = [
    buildEntityStoragePrefix(params).replace(/\/$/, ''),
    STORAGE_PATH_SEGMENTS.DOMAINS,
    params.domain,
    STORAGE_PATH_SEGMENTS.CATEGORIES,
    params.category,
    STORAGE_PATH_SEGMENTS.FILES,
    `${params.fileId}.${cleanExt}`,
  ].join('/');

  return {
    path,
    segments: {
      root: buildCustodyStorageRoot(params),
      ...custodyOnly(params),
      entityType: params.entityType,
      entityId: params.entityId,
      domain: params.domain,
      category: params.category,
      fileId: params.fileId,
      ext: cleanExt,
    },
  };
}

/**
 * 🏢 ENTERPRISE (ADR-709): Canonical Storage prefix that owns EVERY object of
 * one entity, across all domains and categories.
 *
 * SINGLE SOURCE OF TRUTH for prefix-based sweeps (deletion cleanup, floor wipe,
 * orphan GC). Every sweep must derive its prefix from here so that a change to
 * the path scheme can never leave one sweeper walking a tree that no longer
 * exists — the failure mode that made ADR-709 necessary.
 *
 * @example
 * buildEntityStoragePrefix({ companyId: 'c1', entityType: 'project', entityId: 'p1' })
 * // 'companies/c1/entities/project/p1/'
 */
export function buildEntityStoragePrefix(
  params: CustodyScope & { entityType: EntityType; entityId: string }
): string {
  return [
    buildCustodyStorageRoot(params),
    STORAGE_PATH_SEGMENTS.ENTITIES,
    params.entityType,
    params.entityId,
    '',
  ].join('/');
}

/**
 * 🏢 ENTERPRISE (ADR-709): Prefix of ONE domain+category folder of an entity.
 *
 * Narrower than `buildEntityStoragePrefix` — used by sweeps that must delete a
 * single category (e.g. wiping a floor's floorplans) without touching the rest.
 */
export function buildCategoryStoragePrefix(
  params: CustodyScope & {
    entityType: EntityType;
    entityId: string;
    domain: FileDomain;
    category: FileCategory;
  }
): string {
  return [
    buildEntityStoragePrefix(params).replace(/\/$/, ''),
    STORAGE_PATH_SEGMENTS.DOMAINS,
    params.domain,
    STORAGE_PATH_SEGMENTS.CATEGORIES,
    params.category,
    STORAGE_PATH_SEGMENTS.FILES,
    '',
  ].join('/');
}

/**
 * 🏢 ENTERPRISE (ADR-709): LEGACY prefix — the pre-ADR-709 project-scoped tree.
 *
 * SINGLE SOURCE OF TRUTH for reaching objects written before the scheme was
 * unified. Sweepers and migration tooling call this INSTEAD of hand-assembling
 * `projects/{projectId}/`, so the legacy shape is described in exactly one
 * place and can be deleted in exactly one edit once migration completes.
 *
 * NOT a builder for new writes — `buildStoragePath` cannot express this shape,
 * and that is deliberate.
 *
 * @param projectId The project the legacy object was scoped under
 * @param params Entity coordinates; omit domain+category for the entity-wide prefix
 */
export function buildLegacyProjectScopedPrefix(
  projectId: string,
  params: {
    companyId: string;
    entityType: EntityType;
    entityId: string;
    domain?: FileDomain;
    category?: FileCategory;
  }
): string {
  const canonical =
    params.domain && params.category
      ? buildCategoryStoragePrefix({ ...params, domain: params.domain, category: params.category })
      : buildEntityStoragePrefix(params);

  // Inject `projects/{projectId}` right after `companies/{companyId}`.
  const projectScope = `${STORAGE_PATH_SEGMENTS.COMPANIES}/${params.companyId}/${STORAGE_PATH_SEGMENTS.PROJECTS}/${projectId}`;
  return canonical.replace(
    `${STORAGE_PATH_SEGMENTS.COMPANIES}/${params.companyId}`,
    projectScope
  );
}

// ============================================================================
// OWNER ROOT (ADR-866 §5.2)
// ============================================================================

/**
 * **The ONE owner root** — `companies/{companyId}` or `people/{userId}`. Every builder
 * derives from here, so a prefix sweep can never walk a root a builder does not write.
 */
function buildCustodyStorageRoot(custody: CustodyScope): string {
  return custody.userId !== undefined
    ? `${STORAGE_PATH_SEGMENTS.PEOPLE}/${custody.userId}`
    : `${STORAGE_PATH_SEGMENTS.COMPANIES}/${custody.companyId}`;
}

/** Only the owner member of a wider object — never both keys, never an `undefined` twin. */
function custodyOnly(custody: CustodyScope): CustodyScope {
  return custody.userId !== undefined ? { userId: custody.userId } : { companyId: custody.companyId };
}

/**
 * Reads the owner root of a split path. `null` for any other first segment — the tolerant
 * reader accepts two ROOTS, never an unknown one.
 */
function parseCustodyRoot(segments: readonly string[]): CustodyScope | null {
  const ownerId = segments[1];
  if (!ownerId) return null;
  if (segments[0] === STORAGE_PATH_SEGMENTS.COMPANIES) return { companyId: ownerId };
  if (segments[0] === STORAGE_PATH_SEGMENTS.PEOPLE) return { userId: ownerId };
  return null;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generates a unique file ID using cryptographically secure UUID.
 * Delegates to enterprise-id.service for consistent ID generation.
 * Format: file_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 *
 * @example
 * const fileId = generateFileId(); // 'file_a1b2c3d4-...'
 */
export { generateFileId } from '@/services/enterprise-id.service';

/**
 * Extracts file extension from filename
 * Returns lowercase extension without dot
 *
 * @example
 * getFileExtension('photo.JPG') // 'jpg'
 * getFileExtension('document.PDF') // 'pdf'
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase();
}

// ============================================================================
// SPECIAL-PURPOSE PATHS (non-canonical, single-use)
// ============================================================================
// N.7.1 (2026-07-13): ζουν πλέον στο `storage-path-bim.ts` (BIM renders/HDRI/material
// textures + block-library geometry) — re-exported εδώ ώστε οι importers να μην αλλάξουν.
export * from './storage-path-bim';

/**
 * 🏢 ENTERPRISE (ADR-709): TOLERANT READER — parses a storage path back to its
 * components.
 *
 * Deliberately asymmetric with `buildStoragePath`: writing accepts exactly one
 * scheme, reading accepts two. Objects already in the bucket under the legacy
 * `companies/{c}/projects/{p}/entities/...` scheme must stay readable and
 * sweepable forever, or they become invisible garbage nobody can bill for or
 * delete. Their `projectId` is surfaced as `legacyProjectId` so migration
 * tooling can find them; it is never fed back into a builder.
 *
 * @returns Parsed components or null if path is invalid
 */
export function parseStoragePath(
  path: string
): ParsedStoragePath | null {
  try {
    const segments = path.split('/');

    // Canonical (ADR-709), two owner roots (ADR-866 §5.2):
    //   {companies/{companyId} | people/{userId}}/entities/{entityType}/{entityId}/domains/{domain}/categories/{category}/files/{filename}
    // Legacy (pre-ADR-709, read-only, company roots only — people/ was born canonical):
    //   companies/{companyId}/projects/{projectId}/entities/...

    let legacyProjectId: string | undefined;

    const custody = parseCustodyRoot(segments);
    if (!custody) return null;
    let currentIndex = 2;

    // Legacy project scope (pre-ADR-709) — recognised, never produced
    if (custody.companyId !== undefined && segments[currentIndex] === STORAGE_PATH_SEGMENTS.PROJECTS) {
      legacyProjectId = segments[currentIndex + 1];
      currentIndex += 2;
    }

    // Parse entities/{entityType}/{entityId}
    if (segments[currentIndex] !== STORAGE_PATH_SEGMENTS.ENTITIES) return null;
    const entityType = segments[currentIndex + 1] as EntityType;
    const entityId = segments[currentIndex + 2];
    currentIndex += 3;

    // Parse domains/{domain}
    if (segments[currentIndex] !== STORAGE_PATH_SEGMENTS.DOMAINS) return null;
    const domain = segments[currentIndex + 1] as FileDomain;
    currentIndex += 2;

    // Parse categories/{category}
    if (segments[currentIndex] !== STORAGE_PATH_SEGMENTS.CATEGORIES) return null;
    const category = segments[currentIndex + 1] as FileCategory;
    currentIndex += 2;

    // Parse files/{filename}
    if (segments[currentIndex] !== STORAGE_PATH_SEGMENTS.FILES) return null;
    const filename = segments[currentIndex + 1];

    // Extract fileId and ext from filename
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return null;
    const fileId = filename.substring(0, lastDotIndex);
    const ext = filename.substring(lastDotIndex + 1);

    // Validate parsed values
    if (!isPlatformEntityType(entityType)) return null;
    if (!isValidDomain(domain)) return null;
    if (!isValidCategory(category)) return null;

    return {
      ...custody,
      entityType,
      entityId,
      domain,
      category,
      fileId,
      ext,
      ...(legacyProjectId ? { legacyProjectId } : {}),
    };
  } catch {
    return null;
  }
}

