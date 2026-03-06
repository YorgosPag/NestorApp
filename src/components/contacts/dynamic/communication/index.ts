// ============================================================================
// 🏢 ENTERPRISE COMMUNICATION SYSTEM - MASTER BARREL EXPORTS
// ============================================================================
//
// 🎯 PURPOSE: Single entry point για όλο το communication system
// 🔗 USAGE: import { COMMUNICATION_CONFIGS, CommunicationType } from './communication'
//
// ============================================================================

// Export all types
export * from './types';

// Export all configurations & styles
export * from './config';

// Export all renderers
export * from './renderers';

// Export all utilities
export * from './utils';

// ============================================================================
// CONVENIENCE RE-EXPORTS (Most Commonly Used Items)
// ============================================================================

// Types
export type {
  CommunicationType,
  CommunicationItem,
  CommunicationConfig,
  UniversalCommunicationManagerProps,
  TypeOption
} from './types';

// Configurations
export {
  COMMUNICATION_CONFIGS,
  COMMUNICATION_STYLES,
  getCommunicationConfig,
  getEntityAwareCommunicationConfig,
  getAllCommunicationTypes
} from './config';
export type { ContactEntityType } from './config';

// Renderers
export {
  PhoneRenderer,
  EmailRenderer,
  WebsiteRenderer,
  SocialRenderer
} from './renderers';

// Utilities
export {
  generateSocialUrl,
  validateSocialUrl,
  getPrimaryFieldLabel,
  getSecondaryFieldLabel,
  getInputType,
  getFieldPlaceholder,
  hasSecondaryField
} from './utils';