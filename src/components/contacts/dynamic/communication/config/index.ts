// ============================================================================
// 🏢 COMMUNICATION CONFIG - BARREL EXPORTS
// ============================================================================
//
// 🎯 PURPOSE: Clean barrel exports για όλα τα communication configs & styles
// 🔗 USAGE: import { COMMUNICATION_CONFIGS, COMMUNICATION_STYLES } from './config'
//
// ============================================================================

// Export all configurations
export * from './CommunicationConfigs';
export * from './CommunicationStyles';

// Re-export most commonly used configs για convenience
export {
  COMMUNICATION_CONFIGS,
  getCommunicationConfig,
  getEntityAwareCommunicationConfig,
  getAllCommunicationTypes,
  getTypeOptions,
  getPlatformOptions
} from './CommunicationConfigs';
export type { ContactEntityType } from './CommunicationConfigs';

export {
  COMMUNICATION_STYLES,
  RESPONSIVE_GRID_CLASSES,
  COMMUNICATION_BUTTON_STYLES,
  COMMUNICATION_BADGE_STYLES,
  getRowGridClass,
  isDesktopLayout,
  combineStyles
} from './CommunicationStyles';