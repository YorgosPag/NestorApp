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
// INTERNAL IMPORTS (for local usage in this file)
// ============================================================================

// 🏢 ENTERPRISE: Import as local variables for use in convenience objects below
import {
  // Types
  type EnhancedPropertyStatus as _EnhancedPropertyStatus,

  // Constants
  ENHANCED_STATUS_LABELS as _ENHANCED_STATUS_LABELS,
  ENHANCED_STATUS_COLORS as _ENHANCED_STATUS_COLORS,
  STATUS_CATEGORIES as _STATUS_CATEGORIES,

  // Functions
  getEnhancedStatusLabel as _getEnhancedStatusLabel,
  getEnhancedStatusColor as _getEnhancedStatusColor,
  getStatusCategory as _getStatusCategory,
  isPropertyAvailable as _isPropertyAvailable,
  isPropertyCommitted as _isPropertyCommitted,
  isPropertyOffMarket as _isPropertyOffMarket,
  hasPropertyIssues as _hasPropertyIssues,
  getAllEnhancedStatuses as _getAllEnhancedStatuses,
} from '@/constants/property-statuses-enterprise';

import {
  propertyStatusEngine as _propertyStatusEngine,

  // Types
  type EnhancedProperty as _EnhancedProperty,

  // Functions
  validatePropertyStatus as _validatePropertyStatus,
  canChangeStatus as _canChangeStatus,
  getStatusSuggestions as _getStatusSuggestions,
  getPropertyAnalytics as _getPropertyAnalytics
} from './PropertyStatusEngine';

import {
  UnifiedPropertyStatusBadge as _UnifiedPropertyStatusBadge,
  PropertyStatusSelector as _PropertyStatusSelector,
} from '@/components/ui/property-status';

import { createModuleLogger } from '@/lib/telemetry';

const _logger = createModuleLogger('PropertyStatus');

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
 * 🏢 ENTERPRISE: Renamed to PropertyStatusAPI to avoid conflict with PropertyStatus type
 */
export const PropertyStatusAPI = {
  // Main engine
  engine: _propertyStatusEngine,

  // Quick functions
  getLabel: _getEnhancedStatusLabel,
  getColor: _getEnhancedStatusColor,
  getCategory: _getStatusCategory,
  validate: _validatePropertyStatus,
  canChange: _canChangeStatus,
  suggest: _getStatusSuggestions,
  analyze: _getPropertyAnalytics,

  // Status checks
  isAvailable: _isPropertyAvailable,
  isCommitted: _isPropertyCommitted,
  isOffMarket: _isPropertyOffMarket,
  hasIssues: _hasPropertyIssues,

  // Data access
  getAllStatuses: _getAllEnhancedStatuses,
  getCategories: () => _STATUS_CATEGORIES,
  getLabels: () => _ENHANCED_STATUS_LABELS,
  getColors: () => _ENHANCED_STATUS_COLORS,
};

/**
 * 📊 Analytics & Reporting utilities
 */
export const PropertyAnalytics = {
  generate: _getPropertyAnalytics,
  engine: _propertyStatusEngine,

  // Helper functions for common analytics
  getTotalsByStatus: (properties: _EnhancedProperty[]) => {
    const analytics = _getPropertyAnalytics(properties);
    return analytics.byStatus;
  },

  getTotalsByCategory: (properties: _EnhancedProperty[]) => {
    const analytics = _getPropertyAnalytics(properties);
    return analytics.byCategory;
  },

  getMarketOverview: (properties: _EnhancedProperty[]) => {
    const analytics = _getPropertyAnalytics(properties);
    return {
      total: analytics.totalProperties,
      available: Object.entries(analytics.byStatus)
        .filter(([status]) => _isPropertyAvailable(status as _EnhancedPropertyStatus))
        .reduce((sum, [, count]) => sum + (count as number), 0),
      committed: Object.entries(analytics.byStatus)
        .filter(([status]) => _isPropertyCommitted(status as _EnhancedPropertyStatus))
        .reduce((sum, [, count]) => sum + (count as number), 0),
      offMarket: Object.entries(analytics.byStatus)
        .filter(([status]) => _isPropertyOffMarket(status as _EnhancedPropertyStatus))
        .reduce((sum, [, count]) => sum + (count as number), 0),
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
  createTestProperty: (overrides: Partial<_EnhancedProperty> = {}): _EnhancedProperty => ({
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
    _logger.info('Property Status System Validation', {
      availableStatuses: _getAllEnhancedStatuses().length,
      statusCategories: Object.keys(_STATUS_CATEGORIES),
      engineInstance: !!_propertyStatusEngine,
    });

    // Test basic functionality
    const testProperty = PropertyStatusDev.createTestProperty();
    const validation = _validatePropertyStatus(testProperty);
    _logger.info('Test validation result', { validation });

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
  PropertyStatusAPI,
  PropertyAnalytics,

  // Components
  UnifiedPropertyStatusBadge: _UnifiedPropertyStatusBadge,
  PropertyStatusSelector: _PropertyStatusSelector,

  // Engine
  propertyStatusEngine: _propertyStatusEngine,

  // Development
  PropertyStatusDev,

  // Meta
  version: PROPERTY_STATUS_SYSTEM_VERSION,
  build: PROPERTY_STATUS_SYSTEM_BUILD,
};
