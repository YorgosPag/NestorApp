'use client';

import type { FileUploadProgress, FileUploadResult } from '@/hooks/useFileUploadState';
import type { UsageContext } from '@/config/photo-compression-config';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Upload handler function signature
 * Used by useEnterpriseFileUpload and usePhotoUploadLogic
 */
export type UploadHandler = (
  file: File,
  onProgress: (progress: FileUploadProgress) => void
) => Promise<FileUploadResult>;

/**
 * Configuration for creating an upload handler
 */
export interface UploadHandlerConfig {
  /** Storage folder path (e.g., 'contacts/photos') */
  folderPath: string;
  /** Enable image compression (default: true for images) */
  enableCompression?: boolean;
  /** Compression usage context for smart compression */
  compressionUsage?: UsageContext;
  /** Upload purpose for FileNamingService */
  purpose?: string;
  /** Contact data for filename generation */
  contactData?: Record<string, unknown>;
  /** Photo index for multiple photos */
  photoIndex?: number;
  /** Custom filename override */
  fileName?: string;

  // =========================================================================
  // CANONICAL PIPELINE FIELDS (ADR-031)
  // =========================================================================
  /** Contact ID for FileRecord linkage */
  contactId?: string;
  /** Company ID for multi-tenant isolation (REQUIRED for canonical) */
  companyId?: string;
  /** User ID who is uploading */
  createdBy?: string;
  /** Contact name for display name generation */
  contactName?: string;
}

/**
 * Preset configurations for common upload scenarios
 */
export type UploadPreset =
  | 'contact-photo'
  | 'contact-representative'
  | 'company-logo'
  | 'document'
  | 'floor-plan'
  | 'dxf-file';

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/**
 * Predefined configurations for common upload scenarios
 */
const UPLOAD_PRESETS: Record<UploadPreset, Partial<UploadHandlerConfig>> = {
  'contact-photo': {
    folderPath: 'contacts/photos',
    enableCompression: true,
    compressionUsage: 'profile-modal',
    purpose: 'photo',
  },
  'contact-representative': {
    folderPath: 'contacts/photos',
    enableCompression: true,
    compressionUsage: 'profile-modal',
    purpose: 'representative',
  },
  'company-logo': {
    folderPath: 'companies/logos',
    enableCompression: true,
    compressionUsage: 'company-logo',
    purpose: 'logo',
  },
  'document': {
    folderPath: 'documents',
    enableCompression: false,
    purpose: 'document',
  },
  'floor-plan': {
    folderPath: 'floor-plans',
    enableCompression: true,
    compressionUsage: 'document-scan',
    purpose: 'floor-plan',
  },
  'dxf-file': {
    folderPath: 'dxf-files',
    enableCompression: false,
    purpose: 'dxf',
  },
};

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates an upload handler with the specified configuration
 *
 * @param config - Upload handler configuration
 * @returns Upload handler function
 *
 * @example
 * ```typescript
 * // Create a custom upload handler
 * const uploadHandler = createUploadHandler({
 *   folderPath: 'contacts/photos',
 *   enableCompression: true,
 *   compressionUsage: 'profile-modal',
 *   purpose: 'representative',
 *   contactId: 'contact_123',
 *   companyId: 'company_xyz',
 *   createdBy: 'user_abc',
 * });
 *
 * // Use the handler
 * const result = await uploadHandler(file, onProgress);
 * ```
 */
export function createUploadHandler(config: UploadHandlerConfig): UploadHandler {
  return async (file: File, onProgress: (progress: FileUploadProgress) => void): Promise<FileUploadResult> => {
    // Dynamic import to avoid circular dependencies
    const { PhotoUploadService } = await import('@/services/photo-upload.service');

    return await PhotoUploadService.uploadPhoto(file, {
      folderPath: config.folderPath,
      enableCompression: config.enableCompression ?? file.type.startsWith('image/'),
      compressionUsage: config.compressionUsage || 'profile-modal',
      onProgress,
      purpose: config.purpose || 'photo',
      contactData: config.contactData,
      photoIndex: config.photoIndex,
      fileName: config.fileName,
      // Canonical pipeline fields (ADR-031)
      contactId: config.contactId,
      companyId: config.companyId,
      createdBy: config.createdBy,
      contactName: config.contactName,
    });
  };
}

/**
 * Creates an upload handler from a preset configuration
 *
 * @param preset - Preset name
 * @param overrides - Optional configuration overrides
 * @returns Upload handler function
 *
 * @example
 * ```typescript
 * // Create handler from preset
 * const uploadHandler = createUploadHandlerFromPreset('contact-photo', {
 *   contactId: 'contact_123',
 *   companyId: 'company_xyz',
 *   createdBy: 'user_abc',
 * });
 * ```
 */
export function createUploadHandlerFromPreset(
  preset: UploadPreset,
  overrides?: Partial<UploadHandlerConfig>
): UploadHandler {
  const presetConfig = UPLOAD_PRESETS[preset];
  const mergedConfig: UploadHandlerConfig = {
    folderPath: presetConfig.folderPath || 'uploads',
    ...presetConfig,
    ...overrides,
  };

  return createUploadHandler(mergedConfig);
}

// ============================================================================
// DEFAULT HANDLERS
// ============================================================================

/**
 * Default upload handler for contact photos
 * Uses Firebase Storage with automatic compression
 *
 * @deprecated Prefer createUploadHandlerFromPreset('contact-photo', { ...canonicalFields })
 * for new code to ensure canonical pipeline is used.
 */
export const defaultContactPhotoHandler: UploadHandler = createUploadHandlerFromPreset('contact-photo');

/**
 * Default upload handler for company logos
 * Uses Firebase Storage with logo-specific compression
 *
 * @deprecated Prefer createUploadHandlerFromPreset('company-logo', { ...canonicalFields })
 * for new code to ensure canonical pipeline is used.
 */
export const defaultCompanyLogoHandler: UploadHandler = createUploadHandlerFromPreset('company-logo');

// ============================================================================
// CANONICAL UPLOAD HANDLER
// ============================================================================

/**
 * Creates a canonical upload handler that ensures FileRecord creation
 *
 * This is the preferred method for new code - it guarantees:
 * - FileRecord creation in Firestore (ADR-031)
 * - Multi-tenant isolation (companyId required)
 * - Audit trail for all uploads
 * - Consistent file naming
 *
 * @param config - Configuration with required canonical fields
 * @returns Upload handler function
 * @throws Error if canonical fields are missing
 *
 * @example
 * ```typescript
 * const uploadHandler = createCanonicalUploadHandler({
 *   preset: 'contact-photo',
 *   contactId: 'contact_123',
 *   companyId: 'company_xyz', // REQUIRED
 *   createdBy: 'user_abc',    // REQUIRED
 * });
 * ```
 */
export function createCanonicalUploadHandler(config: {
  preset: UploadPreset;
  contactId: string;
  companyId: string;
  createdBy: string;
  contactName?: string;
  contactData?: Record<string, unknown>;
  photoIndex?: number;
}): UploadHandler {
  // Validate required canonical fields
  if (!config.companyId) {
    throw new Error('[ADR-031] companyId is required for canonical upload handler');
  }
  if (!config.createdBy) {
    throw new Error('[ADR-031] createdBy is required for canonical upload handler');
  }

  return createUploadHandlerFromPreset(config.preset, {
    contactId: config.contactId,
    companyId: config.companyId,
    createdBy: config.createdBy,
    contactName: config.contactName,
    contactData: config.contactData,
    photoIndex: config.photoIndex,
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export { UPLOAD_PRESETS };
