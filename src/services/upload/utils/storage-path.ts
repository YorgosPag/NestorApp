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
 *
 * Path Scheme (Full - with project scope):
 * /companies/{companyId}/projects/{projectId}/entities/{entityType}/{entityId}/
 *   domains/{domain}/categories/{category}/files/{fileId}.{ext}
 *
 * Path Scheme (Simplified - no project scope):
 * /companies/{companyId}/entities/{entityType}/{entityId}/
 *   domains/{domain}/categories/{category}/files/{fileId}.{ext}
 *
 * NOTE: companyId is REQUIRED - all files must belong to a company for proper
 * multi-tenant isolation. System-level paths without company are NOT supported.
 */

import {
  type EntityType,
  type FileDomain,
  type FileCategory,
  STORAGE_PATH_SEGMENTS,
  ENTITY_TYPES,
  FILE_DOMAINS,
  FILE_CATEGORIES,
} from '@/config/domain-constants';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parameters for building a canonical storage path
 */
export interface StoragePathParams {
  /** Company ID for multi-tenant isolation (REQUIRED) */
  companyId: string;

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

  /** Project ID for project-scoped files (optional) */
  projectId?: string;
}

/**
 * Result from building a storage path
 */
export interface StoragePathResult {
  /** Full storage path (IDs only, no Greek names) */
  path: string;

  /** Path segments for debugging/logging */
  segments: {
    root: string;
    companyId: string;
    entityType: EntityType;
    entityId: string;
    domain: FileDomain;
    category: FileCategory;
    fileId: string;
    ext: string;
    projectId?: string;
  };
}

/**
 * Validation error with specific field information
 */
export interface StoragePathValidationError {
  field: keyof StoragePathParams;
  message: string;
  value: unknown;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates that a string contains only safe path characters (IDs)
 * Allows alphanumeric, underscore, hyphen
 */
function isValidPathSegment(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  // Allow only alphanumeric, underscore, hyphen, dot (for extensions)
  return /^[a-zA-Z0-9_-]+$/.test(value);
}

/**
 * Validates file extension (allows alphanumeric only)
 */
function isValidExtension(ext: string): boolean {
  if (!ext || typeof ext !== 'string') return false;
  // Remove leading dot if present
  const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext;
  return /^[a-zA-Z0-9]+$/.test(cleanExt);
}

/**
 * Validates entityType against ENTITY_TYPES enum
 */
function isValidEntityType(value: string): value is EntityType {
  return Object.values(ENTITY_TYPES).includes(value as EntityType);
}

/**
 * Validates domain against FILE_DOMAINS enum
 */
function isValidDomain(value: string): value is FileDomain {
  return Object.values(FILE_DOMAINS).includes(value as FileDomain);
}

/**
 * Validates category against FILE_CATEGORIES enum
 */
function isValidCategory(value: string): value is FileCategory {
  return Object.values(FILE_CATEGORIES).includes(value as FileCategory);
}

/**
 * Validates all storage path parameters
 * @returns Array of validation errors (empty if valid)
 */
export function validateStoragePathParams(
  params: StoragePathParams
): StoragePathValidationError[] {
  const errors: StoragePathValidationError[] = [];

  // Required fields validation
  if (!isValidEntityType(params.entityType)) {
    errors.push({
      field: 'entityType',
      message: `Invalid entityType. Must be one of: ${Object.values(ENTITY_TYPES).join(', ')}`,
      value: params.entityType,
    });
  }

  if (!isValidPathSegment(params.entityId)) {
    errors.push({
      field: 'entityId',
      message: 'Invalid entityId. Must contain only alphanumeric, underscore, or hyphen characters.',
      value: params.entityId,
    });
  }

  if (!isValidDomain(params.domain)) {
    errors.push({
      field: 'domain',
      message: `Invalid domain. Must be one of: ${Object.values(FILE_DOMAINS).join(', ')}`,
      value: params.domain,
    });
  }

  if (!isValidCategory(params.category)) {
    errors.push({
      field: 'category',
      message: `Invalid category. Must be one of: ${Object.values(FILE_CATEGORIES).join(', ')}`,
      value: params.category,
    });
  }

  if (!isValidPathSegment(params.fileId)) {
    errors.push({
      field: 'fileId',
      message: 'Invalid fileId. Must contain only alphanumeric, underscore, or hyphen characters.',
      value: params.fileId,
    });
  }

  if (!isValidExtension(params.ext)) {
    errors.push({
      field: 'ext',
      message: 'Invalid extension. Must contain only alphanumeric characters.',
      value: params.ext,
    });
  }

  // companyId is REQUIRED for multi-tenant isolation
  if (!isValidPathSegment(params.companyId)) {
    errors.push({
      field: 'companyId',
      message: 'companyId is REQUIRED. Must contain only alphanumeric, underscore, or hyphen characters.',
      value: params.companyId,
    });
  }

  // Optional projectId validation (only if provided)
  if (params.projectId !== undefined && !isValidPathSegment(params.projectId)) {
    errors.push({
      field: 'projectId',
      message: 'Invalid projectId. Must contain only alphanumeric, underscore, or hyphen characters.',
      value: params.projectId,
    });
  }

  return errors;
}

// ============================================================================
// BUILDER
// ============================================================================

/**
 * 🏢 ENTERPRISE: Builds canonical Firebase Storage path
 *
 * Path contains ONLY IDs - no human-readable names, no Greek characters.
 * Display names belong in Firestore FileRecord.displayName.
 *
 * companyId is REQUIRED for multi-tenant isolation.
 *
 * @example
 * ```typescript
 * // Full enterprise path (with company + project)
 * const result = buildStoragePath({
 *   companyId: 'company_xyz',
 *   projectId: 'project_456',
 *   entityType: 'contact',
 *   entityId: 'contact_789',
 *   domain: 'admin',
 *   category: 'photos',
 *   fileId: 'file_abc123',
 *   ext: 'jpg',
 * });
 * // result.path = 'companies/company_xyz/projects/project_456/entities/contact/contact_789/domains/admin/categories/photos/files/file_abc123.jpg'
 *
 * // Simplified path (no project)
 * const result2 = buildStoragePath({
 *   companyId: 'company_xyz',
 *   entityType: 'contact',
 *   entityId: 'contact_789',
 *   domain: 'admin',
 *   category: 'photos',
 *   fileId: 'file_abc123',
 *   ext: 'jpg',
 * });
 * // result2.path = 'companies/company_xyz/entities/contact/contact_789/domains/admin/categories/photos/files/file_abc123.jpg'
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

  // Build path segments array
  const pathSegments: string[] = [];

  // Root segment: companies/{companyId} (REQUIRED)
  pathSegments.push(STORAGE_PATH_SEGMENTS.COMPANIES);
  pathSegments.push(params.companyId);

  // Optional project scope
  if (params.projectId) {
    pathSegments.push(STORAGE_PATH_SEGMENTS.PROJECTS);
    pathSegments.push(params.projectId);
  }

  // Entity path
  pathSegments.push(STORAGE_PATH_SEGMENTS.ENTITIES);
  pathSegments.push(params.entityType);
  pathSegments.push(params.entityId);

  // Domain & Category
  pathSegments.push(STORAGE_PATH_SEGMENTS.DOMAINS);
  pathSegments.push(params.domain);
  pathSegments.push(STORAGE_PATH_SEGMENTS.CATEGORIES);
  pathSegments.push(params.category);

  // File
  pathSegments.push(STORAGE_PATH_SEGMENTS.FILES);
  pathSegments.push(`${params.fileId}.${cleanExt}`);

  // Join with forward slash (Storage paths use forward slash)
  const path = pathSegments.join('/');

  return {
    path,
    segments: {
      root: `${STORAGE_PATH_SEGMENTS.COMPANIES}/${params.companyId}`,
      companyId: params.companyId,
      entityType: params.entityType,
      entityId: params.entityId,
      domain: params.domain,
      category: params.category,
      fileId: params.fileId,
      ext: cleanExt,
      projectId: params.projectId,
    },
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generates a unique file ID using timestamp + random string
 * Format: file_{timestamp}_{random}
 *
 * @example
 * const fileId = generateFileId(); // 'file_1705234567890_x7k2m9'
 */
export function generateFileId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `file_${timestamp}_${random}`;
}

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

/**
 * Parses a storage path back to its components
 * Useful for debugging and migration tools
 *
 * @returns Parsed components or null if path is invalid
 */
export function parseStoragePath(
  path: string
): StoragePathParams | null {
  try {
    const segments = path.split('/');

    // Path must start with companies/{companyId}
    // companies/{companyId}/entities/{entityType}/{entityId}/domains/{domain}/categories/{category}/files/{filename}
    // OR with project:
    // companies/{companyId}/projects/{projectId}/entities/...

    let projectId: string | undefined;
    let currentIndex = 0;

    // Must start with 'companies'
    if (segments[0] !== STORAGE_PATH_SEGMENTS.COMPANIES) {
      return null;
    }

    const companyId = segments[1];
    if (!companyId) {
      return null;
    }
    currentIndex = 2;

    // Check for optional project scope
    if (segments[currentIndex] === STORAGE_PATH_SEGMENTS.PROJECTS) {
      projectId = segments[currentIndex + 1];
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
    if (!isValidEntityType(entityType)) return null;
    if (!isValidDomain(domain)) return null;
    if (!isValidCategory(category)) return null;

    return {
      companyId,
      projectId,
      entityType,
      entityId,
      domain,
      category,
      fileId,
      ext,
    };
  } catch {
    return null;
  }
}

