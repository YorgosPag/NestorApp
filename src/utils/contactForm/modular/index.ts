// ============================================================================
// MODULAR FORM DATA MAPPER - MAIN INDEX
// ============================================================================
//
// 🏢 Enterprise Modular Form Data Mapping System - Main Entry Point
// Centralized access to all form data mapping functionalities
//
// 🎯 ENTERPRISE BENEFITS:
// - Tree-shaking optimization (import only what you need)
// - Clear separation of concerns (mappers vs extractors vs validators vs utils)
// - Enhanced maintainability (focused modules)
// - Better developer experience (organized imports)
//
// ============================================================================

// =============================================================================
// MAPPERS MODULE - 🗂️ Contact type-specific mapping functions
// =============================================================================
export * from '../mappers';

// =============================================================================
// EXTRACTORS MODULE - 📊 Data extraction utilities
// =============================================================================
export * from '../extractors';

// =============================================================================
// VALIDATORS MODULE - ✅ Validation and state checking
// =============================================================================
export * from '../validators';

// =============================================================================
// UTILS MODULE - 🛠️ Core utilities and helpers
// =============================================================================
export * from '../utils';

// =============================================================================
// CONVENIENCE RE-EXPORTS - Most commonly used functions
// =============================================================================

// Primary mappers
export {
  mapIndividualFormData,
  mapCompanyFormData,
  mapServiceFormData
} from '../mappers';

// Primary extractors
export {
  extractPhotoURL,
  extractLogoURL,
  extractMultiplePhotoURLs,
  createEmailsArray,
  createPhonesArray
} from '../extractors';

// Primary validators
export {
  validateUploadState
} from '../validators';

// Primary utilities
export {
  cleanUndefinedValues,
  isFirebaseStorageURL,
  requiresSpecialDeletion
} from '../utils';

// Key types
export type { UploadValidationResult } from '../validators';