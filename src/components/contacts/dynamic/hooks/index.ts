/**
 * 🏢 ENTERPRISE HOOKS BARREL EXPORTS
 *
 * @fileoverview Centralized exports για όλα τα communication hooks
 * @version 1.0.0
 * @since 2025-12-28
 *
 * Provides clean barrel exports following enterprise patterns για
 * reusability και maintainability.
 */

// Responsive layout hook
export { useResponsiveLayout } from './useResponsiveLayout';
export type { ResponsiveLayoutState } from './useResponsiveLayout';

// Business logic hooks
export { useCommunicationOperations } from './useCommunicationOperations';
export type {
  CommunicationOperations,
  UseCommunicationOperationsParams
} from './useCommunicationOperations';