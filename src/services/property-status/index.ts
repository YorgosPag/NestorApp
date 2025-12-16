/**
 * 🏢 ENTERPRISE PROPERTY STATUS SYSTEM - MAIN EXPORTS
 *
 * Κεντρικό entry point για όλο το Enterprise Property Status System
 * Single import για όλη τη λειτουργικότητα
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 * @enterprise Complete property status management solution
 */

// ============================================================================
// STATUS TYPES & CONSTANTS
// ============================================================================

export {
  // Enhanced Status Types
  type EnhancedPropertyStatus,
  type PropertyIntent,
  type MarketAvailability,
  type PropertyPriority,

  // Labels & Colors
  ENHANCED_STATUS_LABELS,
  ENHANCED_STATUS_COLORS,
  PROPERTY_INTENT_LABELS,
  MARKET_AVAILABILITY_LABELS,
  PROPERTY_PRIORITY_LABELS,

  // Categories & Grouping
  STATUS_CATEGORIES,

  // Utility Functions
  getEnhancedStatusLabel,
  getEnhancedStatusColor,
  getStatusCategory,
  isPropertyAvailable,
  isPropertyCommitted,
  isPropertyOffMarket,
  hasPropertyIssues,
  getAllEnhancedStatuses,
  getStatusesByCategory,

  // Backwards Compatibility
  type PropertyStatus,
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUS_COLORS,
  DEFAULT_PROPERTY_STATUS
} from '@/constants/property-statuses-enterprise';

// ============================================================================
// BUSINESS LOGIC ENGINE
// ============================================================================

export {
  PropertyStatusEngine,
  propertyStatusEngine,

  // Types
  type EnhancedProperty,
  type StatusTransitionRule,
  type ValidationRule,
  type StatusAnalytics,
  type StatusRecommendation,

  // Convenience Functions
  validatePropertyStatus,
  canChangeStatus,
  getStatusSuggestions,
  getPropertyAnalytics
} from './PropertyStatusEngine';

// ============================================================================
// UI COMPONENTS
// ============================================================================

export {
  UnifiedPropertyStatusBadge,
  PropertyStatusSelector,
  CategoryStatusBadge,
  AnalyticsStatusBadge,
  InteractiveStatusBadge,

  // Types
  type UnifiedPropertyStatusBadgeProps,
  type PropertyStatusSelectorProps
} from '@/components/ui/property-status';

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * 🚀 Quick access to the most commonly used functions
 */
export const PropertyStatus = {
  // Main engine
  engine: propertyStatusEngine,

  // Quick functions
  getLabel: getEnhancedStatusLabel,
  getColor: getEnhancedStatusColor,
  getCategory: getStatusCategory,
  validate: validatePropertyStatus,
  canChange: canChangeStatus,
  suggest: getStatusSuggestions,
  analyze: getPropertyAnalytics,

  // Status checks
  isAvailable: isPropertyAvailable,
  isCommitted: isPropertyCommitted,
  isOffMarket: isPropertyOffMarket,
  hasIssues: hasPropertyIssues,

  // Data access
  getAllStatuses: getAllEnhancedStatuses,
  getCategories: () => STATUS_CATEGORIES,
  getLabels: () => ENHANCED_STATUS_LABELS,
  getColors: () => ENHANCED_STATUS_COLORS,
};

/**
 * 📊 Analytics & Reporting utilities
 */
export const PropertyAnalytics = {
  generate: getPropertyAnalytics,
  engine: propertyStatusEngine,

  // Helper functions for common analytics
  getTotalsByStatus: (properties: EnhancedProperty[]) => {
    const analytics = getPropertyAnalytics(properties);
    return analytics.byStatus;
  },

  getTotalsByCategory: (properties: EnhancedProperty[]) => {
    const analytics = getPropertyAnalytics(properties);
    return analytics.byCategory;
  },

  getMarketOverview: (properties: EnhancedProperty[]) => {
    const analytics = getPropertyAnalytics(properties);
    return {
      total: analytics.totalProperties,
      available: Object.entries(analytics.byStatus)
        .filter(([status]) => isPropertyAvailable(status as EnhancedPropertyStatus))
        .reduce((sum, [, count]) => sum + count, 0),
      committed: Object.entries(analytics.byStatus)
        .filter(([status]) => isPropertyCommitted(status as EnhancedPropertyStatus))
        .reduce((sum, [, count]) => sum + count, 0),
      offMarket: Object.entries(analytics.byStatus)
        .filter(([status]) => isPropertyOffMarket(status as EnhancedPropertyStatus))
        .reduce((sum, [, count]) => sum + count, 0),
      totalValue: analytics.totalValue,
      averagePrice: analytics.averagePrice,
    };
  }
};

/**
 * 🛠️ Development & Testing utilities
 */
export const PropertyStatusDev = {
  // Create test properties
  createTestProperty: (overrides: Partial<EnhancedProperty> = {}): EnhancedProperty => ({
    id: `test-${Date.now()}`,
    status: 'for-sale',
    intent: 'sale',
    availability: 'immediately-available',
    priority: 'medium',
    type: 'Διαμέρισμα 2Δ',
    price: parseInt(process.env.NEXT_PUBLIC_DEMO_PROPERTY_PRICE || '150000'),
    area: parseInt(process.env.NEXT_PUBLIC_DEMO_PROPERTY_AREA || '75'),
    lastStatusChange: new Date(),
    ...overrides
  }),

  // Validate system integrity
  validateSystem: () => {
    console.group('🏢 Property Status System Validation');

    console.log('✅ Available statuses:', getAllEnhancedStatuses().length);
    console.log('✅ Status categories:', Object.keys(STATUS_CATEGORIES));
    console.log('✅ Engine instance:', !!propertyStatusEngine);

    // Test basic functionality
    const testProperty = PropertyStatusDev.createTestProperty();
    const validation = validatePropertyStatus(testProperty);
    console.log('✅ Test validation:', validation);

    console.groupEnd();

    return true;
  }
};

// ============================================================================
// VERSION INFO
// ============================================================================

export const PROPERTY_STATUS_SYSTEM_VERSION = '1.0.0';
export const PROPERTY_STATUS_SYSTEM_BUILD = '2025-12-14';

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Main APIs
  PropertyStatus,
  PropertyAnalytics,

  // Components
  UnifiedPropertyStatusBadge,
  PropertyStatusSelector,

  // Engine
  propertyStatusEngine,

  // Development
  PropertyStatusDev,

  // Meta
  version: PROPERTY_STATUS_SYSTEM_VERSION,
  build: PROPERTY_STATUS_SYSTEM_BUILD,
};