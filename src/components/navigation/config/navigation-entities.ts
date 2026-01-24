/**
 * 🏢 ENTERPRISE: Navigation Entity Configuration
 * Single Source of Truth for navigation entity icons, colors, and labels
 *
 * @fileoverview Centralized configuration για όλα τα navigation entities.
 * Εξαλείφει διπλότυπα icons/colors σε NavigationBreadcrumb, DesktopMultiColumn,
 * MobileNavigation, και NavigationButton components.
 *
 * @example
 * ```tsx
 * import { getEntityConfig, NAVIGATION_ENTITIES } from '../config/navigation-entities';
 *
 * // Get full config
 * const config = getEntityConfig('company');
 * // { icon: Factory, color: 'text-blue-600', label: 'Εταιρεία', pluralLabel: 'Εταιρείες' }
 *
 * // Direct access
 * const CompanyIcon = NAVIGATION_ENTITIES.company.icon;
 * const companyColor = NAVIGATION_ENTITIES.company.color;
 * ```
 *
 * @see centralized_systems.md - Rule #XX: Navigation Entity Configuration
 * @author Enterprise Architecture Team
 * @since 2026-01-07
 */

import type { LucideIcon } from 'lucide-react';
import {
  Factory,
  Construction,
  Building,
  Home,
  Layers,
  Car,
  Package,
  MapPin,
  Ruler,
  Euro,
  Trash2,
  Unlink2,
  Plus,
  Link2,
  Eye,
  Pencil,
  Share2,
  Filter,
  Phone,
  Mail,
  Receipt,
  User,
  Building2,
  Landmark
} from 'lucide-react';

// =============================================================================
// 🏢 ENTERPRISE TYPE DEFINITIONS
// =============================================================================

/**
 * Navigation entity types - matches NavigationLevel + additional entities
 */
export type NavigationEntityType =
  | 'company'
  | 'project'
  | 'building'
  | 'unit'
  | 'floor'
  | 'parking'
  | 'storage'
  | 'location'
  | 'area'
  | 'price'
  | 'phone'
  | 'email'
  | 'vat'
  | 'contactIndividual'
  | 'contactCompany'
  | 'contactService';

/**
 * Navigation action types - for toolbar and context menu actions
 */
export type NavigationActionType =
  | 'delete'
  | 'unlink'
  | 'add'
  | 'link'
  | 'actions'
  | 'view'
  | 'edit'
  | 'share'
  | 'filter';

/**
 * Configuration for a single navigation entity
 */
export interface NavigationEntityConfig {
  /** Lucide icon component for this entity */
  readonly icon: LucideIcon;
  /** Tailwind color class for the icon */
  readonly color: string;
  /** Singular label in Greek */
  readonly label: string;
  /** Plural label in Greek */
  readonly pluralLabel: string;
  /** Short description for tooltips */
  readonly description: string;
}

/**
 * Complete configuration map for all navigation entities
 */
export type NavigationEntitiesConfig = {
  readonly [K in NavigationEntityType]: NavigationEntityConfig;
};

/**
 * Configuration for a single navigation action
 */
export interface NavigationActionConfig {
  /** Lucide icon component for this action */
  readonly icon: LucideIcon;
  /** Tailwind color class for the icon */
  readonly color: string;
  /** Action label in Greek */
  readonly label: string;
  /** Short description for tooltips */
  readonly description: string;
}

/**
 * Complete configuration map for all navigation actions
 */
export type NavigationActionsConfig = {
  readonly [K in NavigationActionType]: NavigationActionConfig;
};

// =============================================================================
// 🏢 ENTERPRISE CONFIGURATION - SINGLE SOURCE OF TRUTH
// =============================================================================

/**
 * 🏢 NAVIGATION_ENTITIES
 *
 * Centralized configuration για όλα τα navigation entities.
 * ZERO hardcoded values σε components - όλα από εδώ.
 *
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 * Labels are translated at runtime by components using useTranslation
 *
 * @enterprise Fortune 500 compliant
 * @pattern Single Source of Truth
 */
export const NAVIGATION_ENTITIES: NavigationEntitiesConfig = {
  company: {
    icon: Factory,
    color: 'text-blue-600',
    label: 'navigation.entities.company.label',
    pluralLabel: 'navigation.entities.company.plural',
    description: 'navigation.entities.company.description'
  },
  project: {
    icon: Construction,
    color: 'text-green-600',
    label: 'navigation.entities.project.label',
    pluralLabel: 'navigation.entities.project.plural',
    description: 'navigation.entities.project.description'
  },
  building: {
    icon: Building,
    color: 'text-purple-600',
    label: 'navigation.entities.building.label',
    pluralLabel: 'navigation.entities.building.plural',
    description: 'navigation.entities.building.description'
  },
  unit: {
    icon: Home,
    color: 'text-teal-600',
    label: 'navigation.entities.unit.label',
    pluralLabel: 'navigation.entities.unit.plural',
    description: 'navigation.entities.unit.description'
  },
  floor: {
    icon: Layers,
    color: 'text-orange-600',
    label: 'navigation.entities.floor.label',
    pluralLabel: 'navigation.entities.floor.plural',
    description: 'navigation.entities.floor.description'
  },
  parking: {
    icon: Car,
    color: 'text-amber-600',
    label: 'navigation.entities.parking.label',
    pluralLabel: 'navigation.entities.parking.plural',
    description: 'navigation.entities.parking.description'
  },
  storage: {
    icon: Package,
    color: 'text-indigo-600',
    label: 'navigation.entities.storage.label',
    pluralLabel: 'navigation.entities.storage.plural',
    description: 'navigation.entities.storage.description'
  },
  location: {
    icon: MapPin,
    color: 'text-red-600',
    label: 'navigation.entities.location.label',
    pluralLabel: 'navigation.entities.location.plural',
    description: 'navigation.entities.location.description'
  },
  area: {
    icon: Ruler,
    color: 'text-pink-600',
    label: 'navigation.entities.area.label',
    pluralLabel: 'navigation.entities.area.plural',
    description: 'navigation.entities.area.description'
  },
  price: {
    icon: Euro,
    color: 'text-emerald-600',
    label: 'navigation.entities.price.label',
    pluralLabel: 'navigation.entities.price.plural',
    description: 'navigation.entities.price.description'
  },
  phone: {
    icon: Phone,
    color: 'text-sky-600',
    label: 'navigation.entities.phone.label',
    pluralLabel: 'navigation.entities.phone.plural',
    description: 'navigation.entities.phone.description'
  },
  email: {
    icon: Mail,
    color: 'text-rose-600',
    label: 'navigation.entities.email.label',
    pluralLabel: 'navigation.entities.email.plural',
    description: 'navigation.entities.email.description'
  },
  vat: {
    icon: Receipt,
    color: 'text-slate-600',
    label: 'navigation.entities.vat.label',
    pluralLabel: 'navigation.entities.vat.plural',
    description: 'navigation.entities.vat.description'
  },
  contactIndividual: {
    icon: User,
    color: 'text-blue-600',
    label: 'navigation.entities.contactIndividual.label',
    pluralLabel: 'navigation.entities.contactIndividual.plural',
    description: 'navigation.entities.contactIndividual.description'
  },
  contactCompany: {
    icon: Factory,
    color: 'text-blue-600',  // 🏢 ENTERPRISE: Same as company entity for consistency
    label: 'navigation.entities.contactCompany.label',
    pluralLabel: 'navigation.entities.contactCompany.plural',
    description: 'navigation.entities.contactCompany.description'
  },
  contactService: {
    icon: Landmark,
    color: 'text-amber-600',
    label: 'navigation.entities.contactService.label',
    pluralLabel: 'navigation.entities.contactService.plural',
    description: 'navigation.entities.contactService.description'
  }
} as const;

/**
 * 🏢 NAVIGATION_ACTIONS
 *
 * Centralized configuration για όλες τις navigation actions.
 * ZERO hardcoded action icons σε components - όλα από εδώ.
 *
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 * Labels are translated at runtime by components using useTranslation
 *
 * @enterprise Fortune 500 compliant
 * @pattern Single Source of Truth
 */
export const NAVIGATION_ACTIONS: NavigationActionsConfig = {
  delete: {
    icon: Trash2,
    color: 'text-destructive',
    label: 'actions.delete.label',
    description: 'actions.delete.description'
  },
  unlink: {
    icon: Unlink2,
    color: 'text-orange-500',
    label: 'actions.unlink.label',
    description: 'actions.unlink.description'
  },
  add: {
    icon: Plus,
    color: 'text-green-600',
    label: 'actions.add.label',
    description: 'actions.add.description'
  },
  link: {
    icon: Link2,
    color: 'text-blue-600',
    label: 'actions.link.label',
    description: 'actions.link.description'
  },
  actions: {
    icon: MapPin,
    color: 'text-red-600',
    label: 'actions.actions.label',
    description: 'actions.actions.description'
  },
  view: {
    icon: Eye,
    color: 'text-cyan-600',
    label: 'actions.view.label',
    description: 'actions.view.description'
  },
  edit: {
    icon: Pencil,
    color: 'text-cyan-600',
    label: 'actions.edit.label',
    description: 'actions.edit.description'
  },
  share: {
    icon: Share2,
    color: 'text-violet-600',
    label: 'actions.share.label',
    description: 'actions.share.description'
  },
  filter: {
    icon: Filter,
    color: 'text-orange-500',
    label: 'actions.filter.label',
    description: 'actions.filter.description'
  }
} as const;

// =============================================================================
// 🏢 ENTERPRISE UTILITY FUNCTIONS
// =============================================================================

/**
 * Get the complete configuration for a navigation entity
 *
 * @param entityType - The type of entity to get config for
 * @returns The complete configuration object
 *
 * @example
 * ```tsx
 * const config = getEntityConfig('company');
 * <config.icon className={config.color} />
 * ```
 */
export function getEntityConfig(entityType: NavigationEntityType): NavigationEntityConfig {
  return NAVIGATION_ENTITIES[entityType];
}

/**
 * Get just the icon component for an entity
 *
 * @param entityType - The type of entity
 * @returns The Lucide icon component
 *
 * @example
 * ```tsx
 * const Icon = getEntityIcon('building');
 * <Icon className="h-4 w-4" />
 * ```
 */
export function getEntityIcon(entityType: NavigationEntityType): LucideIcon {
  return NAVIGATION_ENTITIES[entityType].icon;
}

/**
 * Get just the color class for an entity
 *
 * @param entityType - The type of entity
 * @returns The Tailwind color class
 *
 * @example
 * ```tsx
 * const color = getEntityColor('project');
 * // Returns: 'text-green-600'
 * ```
 */
export function getEntityColor(entityType: NavigationEntityType): string {
  return NAVIGATION_ENTITIES[entityType].color;
}

/**
 * Get the singular label for an entity
 *
 * @param entityType - The type of entity
 * @returns The singular Greek label
 */
export function getEntityLabel(entityType: NavigationEntityType): string {
  return NAVIGATION_ENTITIES[entityType].label;
}

/**
 * Get the plural label for an entity
 *
 * @param entityType - The type of entity
 * @returns The plural Greek label
 */
export function getEntityPluralLabel(entityType: NavigationEntityType): string {
  return NAVIGATION_ENTITIES[entityType].pluralLabel;
}

/**
 * Type guard to check if a string is a valid NavigationEntityType
 *
 * @param value - The value to check
 * @returns True if the value is a valid entity type
 *
 * @example
 * ```tsx
 * if (isNavigationEntityType(someString)) {
 *   const config = getEntityConfig(someString);
 * }
 * ```
 */
export function isNavigationEntityType(value: string): value is NavigationEntityType {
  return value in NAVIGATION_ENTITIES;
}

// =============================================================================
// 🏢 ENTERPRISE ACTION UTILITY FUNCTIONS
// =============================================================================

/**
 * Get the complete configuration for a navigation action
 *
 * @param actionType - The type of action to get config for
 * @returns The complete configuration object
 *
 * @example
 * ```tsx
 * const config = getActionConfig('delete');
 * <config.icon className={config.color} />
 * ```
 */
export function getActionConfig(actionType: NavigationActionType): NavigationActionConfig {
  return NAVIGATION_ACTIONS[actionType];
}

/**
 * Get just the icon component for an action
 *
 * @param actionType - The type of action
 * @returns The Lucide icon component
 *
 * @example
 * ```tsx
 * const Icon = getActionIcon('unlink');
 * <Icon className="h-4 w-4" />
 * ```
 */
export function getActionIcon(actionType: NavigationActionType): LucideIcon {
  return NAVIGATION_ACTIONS[actionType].icon;
}

/**
 * Get just the color class for an action
 *
 * @param actionType - The type of action
 * @returns The Tailwind color class
 *
 * @example
 * ```tsx
 * const color = getActionColor('delete');
 * // Returns: 'text-destructive'
 * ```
 */
export function getActionColor(actionType: NavigationActionType): string {
  return NAVIGATION_ACTIONS[actionType].color;
}

/**
 * Get the label for an action
 *
 * @param actionType - The type of action
 * @returns The Greek label
 */
export function getActionLabel(actionType: NavigationActionType): string {
  return NAVIGATION_ACTIONS[actionType].label;
}

/**
 * Type guard to check if a string is a valid NavigationActionType
 *
 * @param value - The value to check
 * @returns True if the value is a valid action type
 */
export function isNavigationActionType(value: string): value is NavigationActionType {
  return value in NAVIGATION_ACTIONS;
}

// =============================================================================
// 🏢 ENTERPRISE EXPORTS
// =============================================================================

// =============================================================================
// 🏢 ENTERPRISE: Pre-configured Icon Components with Colors
// =============================================================================

/**
 * Get a pre-styled icon element for an entity
 *
 * @param entityType - The type of entity
 * @param className - Additional className (e.g., size)
 * @returns JSX element with icon and color applied
 *
 * @example
 * ```tsx
 * // In a component:
 * const BuildingIcon = NAVIGATION_ENTITIES.building.icon;
 * const buildingColor = NAVIGATION_ENTITIES.building.color;
 * <BuildingIcon className={cn(iconSizes.md, buildingColor)} />
 * ```
 */

export default NAVIGATION_ENTITIES;
