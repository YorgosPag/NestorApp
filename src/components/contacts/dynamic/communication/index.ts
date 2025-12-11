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
  getAllCommunicationTypes
} from './config';

// Renderers
export {
  PhoneRenderer,
  EmailRenderer,
  WebsiteRenderer,
  SocialRenderer
} from './renderers';