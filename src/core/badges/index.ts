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

// ===== ICON COUNT BADGE (ADR-854) =====
// SSoT για «αριθμητικός μετρητής πάνω σε εικονίδιο». Ξεχωριστό από τα status badges
// παραπάνω: εκείνα λένε ΤΙ ΕΙΝΑΙ κάτι, αυτό λέει ΠΟΣΑ είναι.
export {
  IconCountBadge,
  formatCount,
  ICON_COUNT_BADGE_DEFAULT_MAX
} from './IconCountBadge';

export type {
  IconCountBadgeProps,
  IconCountBadgeTone,
  IconCountBadgeSize,
  IconCountBadgePlacement,
  IconCountBadgeAnnounce
} from './IconCountBadge';

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

// ===== ENTERPRISE STATUS FACTORY FUNCTIONS =====
export {
  createProjectStatuses,
  createBuildingStatuses,
  createContactStatuses,
  createPropertyStatuses,
  createUnitStatuses,
  createCommonStatuses,
  createContactTypes,
  createNavigationStatuses,
  createObligationStatuses,
  createUnifiedBadgeSystem
} from '../status/StatusConstants';