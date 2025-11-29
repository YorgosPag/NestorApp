/**
 * 🏷️ CENTRAL BADGE SYSTEM - MAIN EXPORTS
 *
 * Single import point για το entire badge system
 * Enterprise-class centralized exports
 */

// ===== MAIN COMPONENTS =====
export {
  UnifiedBadge as default,
  UnifiedBadge,
  ProjectBadge,
  BuildingBadge,
  ContactBadge,
  PropertyBadge,
  UnitBadge,
  CommonBadge,
  BadgeGroup,
  withConditionalBadge
} from './UnifiedBadgeSystem';

// ===== FACTORY CLASSES & FUNCTIONS =====
export {
  BadgeFactory,
  createProjectBadge,
  createBuildingBadge,
  createContactBadge,
  createPropertyBadge,
  createUnitBadge
} from './BadgeFactory';

// ===== HOOKS =====
export {
  useBadgeConfig,
  useBadgeValidation
} from './UnifiedBadgeSystem';

// ===== TYPES =====
export type {
  // Badge Types
  BadgeVariant,
  BadgeSize,
  BadgeDefinition,
  BadgeFactoryOptions,
  BadgeSystemConfig,
  DomainBadgeConfig,

  // Domain Types
  DomainType,
  ProjectStatus,
  BuildingStatus,
  ContactStatus,
  PropertyStatus,
  UnitStatus,

  // Component Props
  UnifiedBadgeProps,
  ProjectBadgeProps,
  BuildingBadgeProps,
  ContactBadgeProps,
  PropertyBadgeProps,
  UnitBadgeProps,
  CommonBadgeProps,
  BadgeGroupProps,

  // Transition Types
  StatusTransitionRule,
  DomainTransitionRules
} from '../types/BadgeTypes';

// ===== CONSTANTS =====
export {
  PROJECT_STATUSES,
  BUILDING_STATUSES,
  CONTACT_STATUSES,
  PROPERTY_STATUSES,
  UNIT_STATUSES,
  COMMON_STATUSES,
  UNIFIED_BADGE_SYSTEM
} from '../status/StatusConstants';