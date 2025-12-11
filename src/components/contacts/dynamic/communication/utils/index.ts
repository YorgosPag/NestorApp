// ============================================================================
// 🛠️ COMMUNICATION UTILITIES - BARREL EXPORTS
// ============================================================================
//
// 🎯 PURPOSE: Clean barrel exports για όλα τα communication utility functions
// 🔗 USAGE: import { generateSocialUrl, getPrimaryFieldLabel } from './utils'
//
// ============================================================================

// Export all utility functions
export * from './socialUrlGenerator';
export * from './fieldLabelUtils';

// ============================================================================
// CONVENIENCE RE-EXPORTS (Most Commonly Used Functions)
// ============================================================================

// Social URL utilities
export {
  generateSocialUrl,
  validateSocialUrl,
  extractUsernameFromSocialUrl,
  getSupportedSocialPlatforms,
  detectPlatformFromUrl,
  SOCIAL_URL_TEMPLATES,
  SOCIAL_URL_PLACEHOLDERS
} from './socialUrlGenerator';

// Field label utilities
export {
  getPrimaryFieldLabel,
  getSecondaryFieldLabel,
  getInputType,
  getFieldPlaceholder,
  hasSecondaryField,
  getFieldLabelConfig,
  getSupportedCommunicationTypes,
  isValidCommunicationType,
  FIELD_LABEL_MAPPINGS
} from './fieldLabelUtils';

// ============================================================================
// TYPE RE-EXPORTS
// ============================================================================

// Social URL types
export type {
  SocialPlatform,
  SocialUrlTemplate
} from './socialUrlGenerator';

// Field label types
export type {
  FieldLabelConfig,
  FieldLabelMapping,
  LocalizedFieldLabels
} from './fieldLabelUtils';