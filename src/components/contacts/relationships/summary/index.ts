// ============================================================================
// SUMMARY MODULE INDEX - ENTERPRISE EXPORTS
// ============================================================================
//
// 📦 Centralized exports για το summary module
// Clean API για imports σε άλλα components
//
// ============================================================================

// 🎨 Main Components
export { StatisticsSection } from './StatisticsSection';
export { RecentRelationshipsSection } from './RecentRelationshipsSection';
export { ActionsSection } from './ActionsSection';
export { NewContactState, LoadingState, EmptyState } from './StateComponents';

// 🎯 Type Exports (για τσεκαρίσματα)
export type { default as StatisticsSectionProps } from './StatisticsSection';
export type { default as RecentRelationshipsSectionProps } from './RecentRelationshipsSection';
export type { default as ActionsSectionProps } from './ActionsSection';

// ============================================================================
// Re-exports from hooks and utils (convenience)
// ============================================================================

// 📊 Statistics Hook
export { useRelationshipStatistics } from '../hooks/summary/useRelationshipStatistics';

// 🔗 Navigation Utilities
export {
  navigateToDashboardFilter,
  navigateToRelationshipContact,
  getContactNamesForFilter
} from '../utils/summary/contact-navigation';

// 📈 Statistics Calculator
export {
  calculateRelationshipStats,
  calculateManagementStats,
  calculateRecentRelationships,
  calculateDepartmentsCount
} from '../utils/summary/statistics-calculator';

// 🏷️ Types
export type { RelationshipStats } from '../utils/summary/statistics-calculator';
export type { ContactNamesMap, NavigationFilters } from '../utils/summary/contact-navigation';

// ============================================================================
// DEFAULT EXPORT - Complete Module
// ============================================================================

// 🏢 ENTERPRISE: Import all for default export to avoid circular dependencies
import { StatisticsSection as Stats } from './StatisticsSection';
import { RecentRelationshipsSection as Recent } from './RecentRelationshipsSection';
import { ActionsSection as Actions } from './ActionsSection';
import { NewContactState as NewContact, LoadingState as Loading, EmptyState as Empty } from './StateComponents';
import { useRelationshipStatistics as useStats } from '../hooks/summary/useRelationshipStatistics';
import {
  navigateToDashboardFilter as navToFilter,
  navigateToRelationshipContact as navToContact
} from '../utils/summary/contact-navigation';
import { calculateRelationshipStats as calcStats } from '../utils/summary/statistics-calculator';

export default {
  // Components
  StatisticsSection: Stats,
  RecentRelationshipsSection: Recent,
  ActionsSection: Actions,
  NewContactState: NewContact,
  LoadingState: Loading,
  EmptyState: Empty,

  // Hooks
  useRelationshipStatistics: useStats,

  // Utils
  navigateToDashboardFilter: navToFilter,
  navigateToRelationshipContact: navToContact,
  calculateRelationshipStats: calcStats
};