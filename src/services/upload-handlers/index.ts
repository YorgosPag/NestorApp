/**
 * 🏢 ENTERPRISE: Centralized Upload Handlers (ADR-054)
 *
 * This module provides factory functions for creating upload handlers
 * that integrate with the canonical file storage system (ADR-031).
 *
 * @example
 * ```typescript
 * // For new code - use canonical handler
 * import { createCanonicalUploadHandler } from '@/services/upload-handlers';
 *
 * const uploadHandler = createCanonicalUploadHandler({
 *   preset: 'contact-photo',
 *   contactId: 'contact_123',
 *   companyId: 'company_xyz',
 *   createdBy: 'user_abc',
 * });
 *
 * // For legacy code - use preset handler
 * import { createUploadHandlerFromPreset } from '@/services/upload-handlers';
 *
 * const uploadHandler = createUploadHandlerFromPreset('contact-photo');
 * ```
 */

export {
  // Types
  type UploadHandler,
  type UploadHandlerConfig,
  type UploadPreset,

  // Factory functions
  createUploadHandler,
  createUploadHandlerFromPreset,
  createCanonicalUploadHandler,

  // Default handlers (deprecated - use factory functions)
  defaultContactPhotoHandler,
  defaultCompanyLogoHandler,

  // Constants
  UPLOAD_PRESETS,
} from './defaultUploadHandler';
