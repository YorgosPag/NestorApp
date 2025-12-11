// ============================================================================
// 🏢 COMMUNICATION TYPES - BARREL EXPORTS
// ============================================================================
//
// 🎯 PURPOSE: Clean barrel exports για όλα τα communication types
// 🔗 USAGE: import { CommunicationType, CommunicationItem } from './types'
//
// ============================================================================

// Export all types from CommunicationTypes
export * from './CommunicationTypes';

// Re-export most commonly used types για convenience
export type {
  CommunicationType,
  CommunicationItem,
  CommunicationConfig,
  CommunicationFieldValue, // 🆕 ENTERPRISE: Type-safe field values
  TypeOption,
  UniversalCommunicationManagerProps,
  CommunicationConfigRecord,
  PartialCommunicationItem
} from './CommunicationTypes';