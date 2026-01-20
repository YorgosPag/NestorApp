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

// 🏢 ENTERPRISE: Import components for default export (TypeScript requires explicit scope)
import { UnifiedPropertyStatusBadge as _UnifiedPropertyStatusBadge } from './UnifiedPropertyStatusBadge';
import { PropertyStatusSelector as _PropertyStatusSelector } from './PropertyStatusSelector';
import {
  CategoryStatusBadge as _CategoryStatusBadge,
  AnalyticsStatusBadge as _AnalyticsStatusBadge,
  InteractiveStatusBadge as _InteractiveStatusBadge
} from './UnifiedPropertyStatusBadge';

export default {
  UnifiedPropertyStatusBadge: _UnifiedPropertyStatusBadge,
  PropertyStatusSelector: _PropertyStatusSelector,
  CategoryStatusBadge: _CategoryStatusBadge,
  AnalyticsStatusBadge: _AnalyticsStatusBadge,
  InteractiveStatusBadge: _InteractiveStatusBadge,
};