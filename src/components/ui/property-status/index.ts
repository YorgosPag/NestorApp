/**
 * 🏢 ENTERPRISE PROPERTY STATUS SYSTEM - UI COMPONENTS
 *
 * Centralized exports για όλα τα property status UI components
 * Enterprise-ready status management system
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 */

// ============================================================================
// MAIN COMPONENTS
// ============================================================================

export { UnifiedPropertyStatusBadge } from './UnifiedPropertyStatusBadge';
export { PropertyStatusSelector } from './PropertyStatusSelector';

// Convenience components
export {
  CategoryStatusBadge,
  AnalyticsStatusBadge,
  InteractiveStatusBadge
} from './UnifiedPropertyStatusBadge';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type { UnifiedPropertyStatusBadgeProps } from './UnifiedPropertyStatusBadge';
export type { PropertyStatusSelectorProps } from './PropertyStatusSelector';

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  UnifiedPropertyStatusBadge,
  PropertyStatusSelector,
  CategoryStatusBadge,
  AnalyticsStatusBadge,
  InteractiveStatusBadge,
};