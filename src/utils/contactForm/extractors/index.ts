// ============================================================================
// FORM DATA EXTRACTORS - MODULE INDEX
// ============================================================================
//
// 📊 Centralized exports for all extractor functions
// Clean import interface for form data extraction modules
//
// ============================================================================

// Core extractors
export * from './arrays';
export * from './photo-urls';

// Re-export key functions for convenience
export {
  createEmailsArray,
  createPhonesArray
} from './arrays';

export {
  extractMultiplePhotoURLs,
  extractPhotoURL,
  extractLogoURL
} from './photo-urls';