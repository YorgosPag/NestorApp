/**
 * Centralized Navigation System Exports
 * Main export file for all navigation components and utilities
 */

// Core exports
export { NavigationProvider, useNavigation } from './core/NavigationContext';
export type {
  NavigationState,
  NavigationActions,
  NavigationCompany,
  NavigationProject,
  NavigationBuilding,
  NavigationFloor,
  NavigationUnit,
  NavigationParkingSpot,
  NavigationLevel,
  NavigationOption,
  BreadcrumbItem
} from './core/types';

// Component exports
export { NavigationTree } from './components/NavigationTree';
export { NavigationBreadcrumb } from './components/NavigationBreadcrumb';
export { NavigationButton } from './components/NavigationButton';
export { NavigationSidebar } from './components/NavigationSidebar';
export { AdaptiveMultiColumnNavigation } from './components/AdaptiveMultiColumnNavigation';

// Default exports for convenience
export { default as NavigationContext } from './core/NavigationContext';