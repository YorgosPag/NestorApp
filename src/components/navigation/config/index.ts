/**
 * 🏢 ENTERPRISE: Navigation Configuration Index
 * Central export point for all navigation configuration
 *
 * @fileoverview Barrel export για navigation config modules.
 *
 * @example
 * ```tsx
 * import {
 *   NAVIGATION_ENTITIES,
 *   NAVIGATION_ACTIONS,
 *   getEntityConfig,
 *   getEntityIcon,
 *   getActionConfig,
 *   getActionIcon
 * } from '../config';
 * ```
 */

// Entity configuration (icons, colors, labels)
export {
  // Entity exports
  NAVIGATION_ENTITIES,
  getEntityConfig,
  getEntityIcon,
  getEntityColor,
  getEntityLabel,
  getEntityPluralLabel,
  isNavigationEntityType,
  type NavigationEntityType,
  type NavigationEntityConfig,
  type NavigationEntitiesConfig,
  // Action exports
  NAVIGATION_ACTIONS,
  getActionConfig,
  getActionIcon,
  getActionColor,
  getActionLabel,
  isNavigationActionType,
  type NavigationActionType,
  type NavigationActionConfig,
  type NavigationActionsConfig
} from './navigation-entities';
