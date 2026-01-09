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
 * @enterprise Fortune 500 compliant
 * @pattern Single Source of Truth
 */
export const NAVIGATION_ENTITIES: NavigationEntitiesConfig = {
  company: {
    icon: Factory,
    color: 'text-blue-600',
    label: 'Εταιρεία',
    pluralLabel: 'Εταιρείες',
    description: 'Εταιρεία στο σύστημα'
  },
  project: {
    icon: Construction,
    color: 'text-green-600',
    label: 'Έργο',
    pluralLabel: 'Έργα',
    description: 'Κατασκευαστικό έργο'
  },
  building: {
    icon: Building,
    color: 'text-purple-600',
    label: 'Κτίριο',
    pluralLabel: 'Κτίρια',
    description: 'Κτίριο σε έργο'
  },
  unit: {
    icon: Home,
    color: 'text-teal-600',
    label: 'Μονάδα',
    pluralLabel: 'Μονάδες',
    description: 'Ακίνητη μονάδα'
  },
  floor: {
    icon: Layers,
    color: 'text-orange-600',
    label: 'Όροφος',
    pluralLabel: 'Όροφοι',
    description: 'Όροφος κτιρίου'
  },
  parking: {
    icon: Car,
    color: 'text-amber-600',
    label: 'Πάρκινγκ',
    pluralLabel: 'Θέσεις Πάρκινγκ',
    description: 'Θέση στάθμευσης'
  },
  storage: {
    icon: Package,
    color: 'text-indigo-600',
    label: 'Αποθήκη',
    pluralLabel: 'Αποθήκες',
    description: 'Χώρος αποθήκευσης'
  },
  location: {
    icon: MapPin,
    color: 'text-red-600',
    label: 'Τοποθεσία',
    pluralLabel: 'Τοποθεσίες',
    description: 'Γεωγραφική τοποθεσία'
  },
  area: {
    icon: Ruler,
    color: 'text-pink-600',
    label: 'Εμβαδόν',
    pluralLabel: 'Εμβαδά',
    description: 'Τετραγωνικά μέτρα'
  },
  price: {
    icon: Euro,
    color: 'text-emerald-600',
    label: 'Τιμή',
    pluralLabel: 'Τιμές',
    description: 'Τιμή σε ευρώ'
  },
  phone: {
    icon: Phone,
    color: 'text-sky-600',
    label: 'Τηλέφωνο',
    pluralLabel: 'Τηλέφωνα',
    description: 'Αριθμός τηλεφώνου'
  },
  email: {
    icon: Mail,
    color: 'text-rose-600',
    label: 'Email',
    pluralLabel: 'Emails',
    description: 'Διεύθυνση email'
  },
  vat: {
    icon: Receipt,
    color: 'text-slate-600',
    label: 'ΑΦΜ',
    pluralLabel: 'ΑΦΜ',
    description: 'Αριθμός Φορολογικού Μητρώου'
  },
  contactIndividual: {
    icon: User,
    color: 'text-blue-600',
    label: 'Φυσικό Πρόσωπο',
    pluralLabel: 'Φυσικά Πρόσωπα',
    description: 'Επαφή φυσικού προσώπου'
  },
  contactCompany: {
    icon: Factory,
    color: 'text-blue-600',  // 🏢 ENTERPRISE: Same as company entity for consistency
    label: 'Εταιρεία',
    pluralLabel: 'Εταιρείες',
    description: 'Επαφή νομικού προσώπου/εταιρείας'
  },
  contactService: {
    icon: Landmark,
    color: 'text-amber-600',
    label: 'Υπηρεσία',
    pluralLabel: 'Υπηρεσίες',
    description: 'Δημόσια υπηρεσία'
  }
} as const;

/**
 * 🏢 NAVIGATION_ACTIONS
 *
 * Centralized configuration για όλες τις navigation actions.
 * ZERO hardcoded action icons σε components - όλα από εδώ.
 *
 * @enterprise Fortune 500 compliant
 * @pattern Single Source of Truth
 */
export const NAVIGATION_ACTIONS: NavigationActionsConfig = {
  delete: {
    icon: Trash2,
    color: 'text-destructive',
    label: 'Διαγραφή',
    description: 'Αφαίρεση από τη λίστα πλοήγησης'
  },
  unlink: {
    icon: Unlink2,
    color: 'text-orange-500',
    label: 'Αποσύνδεση',
    description: 'Αποσύνδεση σχέσης μεταξύ entities'
  },
  add: {
    icon: Plus,
    color: 'text-green-600',
    label: 'Προσθήκη',
    description: 'Προσθήκη νέου στοιχείου'
  },
  link: {
    icon: Link2,
    color: 'text-blue-600',
    label: 'Σύνδεση',
    description: 'Σύνδεση με υπάρχον στοιχείο'
  },
  actions: {
    icon: MapPin,
    color: 'text-red-600',
    label: 'Ενέργειες',
    description: 'Διαθέσιμες ενέργειες'
  },
  view: {
    icon: Eye,
    color: 'text-cyan-600',
    label: 'Προβολή',
    description: 'Προβολή στοιχείου'
  },
  edit: {
    icon: Pencil,
    color: 'text-cyan-600',
    label: 'Επεξεργασία',
    description: 'Επεξεργασία στοιχείου'
  },
  share: {
    icon: Share2,
    color: 'text-violet-600',
    label: 'Κοινοποίηση',
    description: 'Κοινοποίηση στοιχείου'
  },
  filter: {
    icon: Filter,
    color: 'text-orange-500',
    label: 'Φίλτρα',
    description: 'Φιλτράρισμα στοιχείων'
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
