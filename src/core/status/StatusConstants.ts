/**
 * 🏷️ CENTRAL STATUS CONSTANTS
 *
 * ✅ ENTERPRISE PROFESSIONAL: Zero hardcoded values - Pure dependency injection
 * ✅ CENTRALIZED: Uses existing BadgeDefinition interface
 * ✅ NO DUPLICATES: Leverages core/types/BadgeTypes.ts
 * ✅ CLEAN: Enterprise-class status definitions με useSemanticColors hook
 */

import type {
  BadgeDefinition,
  BadgeSystemConfig,
  ObligationStatus,
  ProjectStatus,
  BuildingStatus,
  ContactStatus,
  PropertyStatus,
  UnitStatus,
  NavigationStatus
} from '../types/BadgeTypes';
import type { UseSemanticColorsReturn } from '../../ui-adapters/react/useSemanticColors';
// ✅ ENTERPRISE SOLUTION: Import complete COLOR_BRIDGE με all missing properties
import { COLOR_BRIDGE } from '../../design-system/color-bridge';

// 🏢 ENTERPRISE: Import centralized status labels - NO MORE HARDCODED VALUES
// 📌 NOTE: Import directly from modular files to avoid conflicts with original modal-select.ts re-exports
import {
  getProjectStatusLabels,
  getUnitStatusLabels,
  getContactStatusLabels,
  getContactTypeLabels,
  getPropertyMarketStatusLabels,
  getRentalTypeLabels,
  getStorageStatusLabels
} from '../../subapps/dxf-viewer/config/modal-select';

// 🏢 ENTERPRISE: Import from modular status.ts for extended property labels (market/sales-related)
import {
  MODAL_SELECT_PROPERTY_SPECIAL_STATUS_LABELS,
  MODAL_SELECT_PRIORITY_LABELS,
  MODAL_SELECT_RECORD_STATE_LABELS,
  MODAL_SELECT_ENTITY_TYPE_LABELS,
  MODAL_SELECT_DOCUMENT_STATUS_LABELS
} from '../../subapps/dxf-viewer/config/modal-select/core/labels/status';

// ============================================================================
// PROJECT STATUS DEFINITIONS
// ============================================================================

// ✅ ENTERPRISE: Get centralized labels via getter functions
const projectStatusLabels = getProjectStatusLabels();
const unitStatusLabels = getUnitStatusLabels();
const contactStatusLabels = getContactStatusLabels();
const contactTypeLabels = getContactTypeLabels();
const propertyMarketStatusLabels = getPropertyMarketStatusLabels();
const rentalTypeLabels = getRentalTypeLabels();
const storageStatusLabels = getStorageStatusLabels();

// ✅ ENTERPRISE: Direct constants from modular status.ts (avoid re-export conflicts)
const propertySpecialStatusLabels = MODAL_SELECT_PROPERTY_SPECIAL_STATUS_LABELS;
const priorityLabels = MODAL_SELECT_PRIORITY_LABELS;
const recordStateLabels = MODAL_SELECT_RECORD_STATE_LABELS;
const entityTypeLabels = MODAL_SELECT_ENTITY_TYPE_LABELS;
const documentStatusLabels = MODAL_SELECT_DOCUMENT_STATUS_LABELS;

// ============================================================================
// 🏢 ENTERPRISE: Dynamic Badge Generation με Dependency Injection
// ============================================================================

/**
 * ✅ ENTERPRISE PROFESSIONAL: Project Statuses Generator
 * 🎯 ZERO hardcoded values - Pure dependency injection pattern
 *
 * @param colors - useSemanticColors hook result (dependency injection)
 * @returns Project status definitions με centralized colors
 */
export const createProjectStatuses = (colors: UseSemanticColorsReturn): Record<ProjectStatus, BadgeDefinition> => {
  return ({
    planning: {
      label: projectStatusLabels.planning,
      variant: 'outline',
      backgroundColor: colors.bg.secondary,
      color: colors.text.muted,
      icon: 'planning'
    },
  in_progress: {
    label: projectStatusLabels.in_progress,
    variant: 'info',
    backgroundColor: colors.bg.info,
    color: colors.text.info,
    icon: 'play'
  },
  completed: {
    label: projectStatusLabels.completed,
    variant: 'success',
    backgroundColor: colors.bg.success,
    color: colors.text.success,
    icon: 'check'
  },
  on_hold: {
    label: projectStatusLabels.on_hold,
    variant: 'warning',
    backgroundColor: colors.bg.warning,
    color: colors.text.warning,
    icon: 'pause'
  },
  cancelled: {
    label: projectStatusLabels.cancelled,
    variant: 'destructive',
    backgroundColor: colors.bg.error,
    color: colors.text.error,
    icon: 'x'
  },
  review: {
    label: projectStatusLabels.review,
    variant: 'purple',
    backgroundColor: colors.bg.secondary,
    color: colors.text.primary,
    icon: 'review'
  },
  approved: {
    label: projectStatusLabels.approved,
    variant: 'success',
    backgroundColor: colors.bg.success,
    color: colors.text.success,
    icon: 'checkCircle'
  }
});
};

/**
 * ✅ ENTERPRISE PROFESSIONAL: Contact Statuses Generator
 */
export const createContactStatuses = (colors: UseSemanticColorsReturn): Record<ContactStatus, BadgeDefinition> => ({
  active: { label: contactStatusLabels.active, variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'userCheck' },
  inactive: { label: contactStatusLabels.inactive, variant: 'secondary', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'userX' },
  pending: { label: contactStatusLabels.pending, variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'clock' },
  blocked: { label: contactStatusLabels.blocked, variant: 'destructive', backgroundColor: colors.bg.error, color: colors.text.error, icon: 'shield' },
  archived: { label: contactStatusLabels.archived, variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'archive' }
});

/**
 * ✅ ENTERPRISE PROFESSIONAL: Contact Types Generator (Separate from statuses)
 */
export const createContactTypes = (colors: UseSemanticColorsReturn): Record<string, BadgeDefinition> => ({
  individual: { label: contactTypeLabels.individual, variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'user' },
  company: { label: contactTypeLabels.company, variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'building' },
  service: { label: contactTypeLabels.service, variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'landmark' }
});

/**
 * ✅ ENTERPRISE PROFESSIONAL: Property Statuses Generator
 */
export const createPropertyStatuses = (colors: UseSemanticColorsReturn): Record<PropertyStatus, BadgeDefinition> => ({
  available: { label: propertyMarketStatusLabels.available, variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'home' },
  reserved: { label: propertyMarketStatusLabels.reserved, variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'bookmark' },
  sold: { label: propertyMarketStatusLabels.sold, variant: 'destructive', backgroundColor: colors.bg.error, color: colors.text.error, icon: 'dollarSign' },
  pending: { label: propertyMarketStatusLabels.pending, variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'clock' },
  withdrawn: { label: propertyMarketStatusLabels.withdrawn, variant: 'secondary', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'arrowLeft' },
  expired: { label: propertyMarketStatusLabels.expired, variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'calendar' },
  'rental-only': { label: rentalTypeLabels.rent_only, variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'key' },
  // 🏢 ENTERPRISE: Property statuses using centralized labels - ZERO HARDCODED VALUES
  'for-sale': { label: unitStatusLabels.for_sale, variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'tag' },
  'for-rent': { label: unitStatusLabels.for_rent, variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'key' },
  rented: { label: unitStatusLabels.rented, variant: 'purple', backgroundColor: colors.bg.secondary, color: colors.text.primary, icon: 'handshake' },
  'under-negotiation': { label: propertySpecialStatusLabels.under_negotiation, variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'messageCircle' },
  'coming-soon': { label: propertySpecialStatusLabels.available_soon, variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'calendar' },
  landowner: { label: propertySpecialStatusLabels.landowner, variant: 'secondary', backgroundColor: colors.bg.secondary, color: colors.text.secondary, icon: 'map' },
  'off-market': { label: propertySpecialStatusLabels.off_market, variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'eyeOff' },
  unavailable: { label: propertySpecialStatusLabels.unavailable, variant: 'secondary', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'x' },
  'long-term-rental': { label: rentalTypeLabels.long_term, variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'calendar' },
  'short-term-rental': { label: rentalTypeLabels.short_term, variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'clock' },
  'reserved-pending': { label: propertySpecialStatusLabels.reserved_pending, variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'pause' },
  'contract-signed': { label: propertySpecialStatusLabels.contract_signed, variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'fileSignature' },
  'deposit-paid': { label: propertySpecialStatusLabels.deposit_paid, variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'creditCard' },
  'company-owned': { label: propertySpecialStatusLabels.corporate, variant: 'purple', backgroundColor: colors.bg.secondary, color: colors.text.primary, icon: 'building' },
  'not-for-sale': { label: propertySpecialStatusLabels.not_for_sale, variant: 'purple', backgroundColor: colors.bg.secondary, color: colors.text.primary, icon: 'shield' },
  'family-reserved': { label: propertySpecialStatusLabels.family, variant: 'purple', backgroundColor: colors.bg.secondary, color: colors.text.primary, icon: 'heart' },
  'pre-launch': { label: propertySpecialStatusLabels.pre_launch, variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'rocket' },
  'exclusive-listing': { label: propertySpecialStatusLabels.exclusive, variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'crown' },
  'price-reduced': { label: propertySpecialStatusLabels.reduced_price, variant: 'error', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'trendingDown' },
  'urgent-sale': { label: propertySpecialStatusLabels.urgent_sale, variant: 'destructive', backgroundColor: colors.bg.error, color: colors.text.error, icon: 'alertTriangle' },
  'under-renovation': { label: propertySpecialStatusLabels.under_renovation, variant: 'secondary', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'wrench' },
  'legal-issues': { label: propertySpecialStatusLabels.legal_issues, variant: 'destructive', backgroundColor: colors.bg.error, color: colors.text.error, icon: 'gavel' },
  'inspection-required': { label: propertySpecialStatusLabels.inspection_required, variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'search' },
  'documentation-pending': { label: propertySpecialStatusLabels.pending_documents, variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'fileText' }
});

/**
 * ✅ ENTERPRISE PROFESSIONAL: Unit Statuses Generator
 * 🏢 CENTRALIZED: Uses unitStatusLabels from modal-select - ZERO HARDCODED VALUES
 */
export const createUnitStatuses = (colors: UseSemanticColorsReturn): Record<UnitStatus, BadgeDefinition> => ({
  available: { label: storageStatusLabels.available, variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'home' },
  occupied: { label: unitStatusLabels.occupied, variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'users' },
  maintenance: { label: storageStatusLabels.maintenance, variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'wrench' },
  reserved: { label: storageStatusLabels.reserved, variant: 'purple', backgroundColor: colors.bg.secondary, color: colors.text.primary, icon: 'bookmark' }
});

/**
 * ✅ ENTERPRISE PROFESSIONAL: Navigation Statuses Generator
 * 🏢 CENTRALIZED: Uses priorityLabels from modal-select - ZERO HARDCODED VALUES
 */
export const createNavigationStatuses = (colors: UseSemanticColorsReturn): Record<NavigationStatus, BadgeDefinition> => ({
  no_projects: { label: priorityLabels.none, variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'alertTriangle' },
  empty: { label: priorityLabels.empty, variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'circle' },
  warning: { label: priorityLabels.warning, variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'alertTriangle' },
  alert: { label: priorityLabels.attention, variant: 'destructive', backgroundColor: colors.bg.error, color: colors.text.error, icon: 'alert' },
  success: { label: priorityLabels.success, variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'check' },
  info: { label: priorityLabels.info, variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'info' }
});

/**
 * ✅ ENTERPRISE PROFESSIONAL: Obligation Statuses Generator
 * 🏢 CENTRALIZED: Uses documentStatusLabels from modal-select - ZERO HARDCODED VALUES
 */
export const createObligationStatuses = (colors: UseSemanticColorsReturn): Record<ObligationStatus, BadgeDefinition> => ({
  draft: { label: documentStatusLabels.draft, variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'edit' },
  completed: { label: documentStatusLabels.completed, variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'check' },
  approved: { label: documentStatusLabels.approved, variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'checkCircle' }
});

/**
 * ✅ ENTERPRISE PROFESSIONAL: Common Statuses Generator
 * 🏢 CENTRALIZED: Uses recordStateLabels + entityTypeLabels from modal-select - ZERO HARDCODED VALUES
 */
export const createCommonStatuses = (colors: UseSemanticColorsReturn): Record<string, BadgeDefinition> => ({
  new: { label: recordStateLabels.new, variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'plus' },
  updated: { label: recordStateLabels.updated, variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'refresh' },
  deleted: { label: recordStateLabels.deleted, variant: 'destructive', backgroundColor: colors.bg.error, color: colors.text.error, icon: 'trash' },
  company: { label: entityTypeLabels.company, variant: 'secondary', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'building' },
  primary: { label: entityTypeLabels.main, variant: 'default', backgroundColor: colors.bg.secondary, color: colors.text.primary, icon: 'star' },
  secondary: { label: entityTypeLabels.secondary, variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'circle' }
});

/**
 * ✅ ENTERPRISE PROFESSIONAL: Building Statuses Generator
 * 🎯 ZERO hardcoded values - Pure dependency injection pattern
 */
export const createBuildingStatuses = (colors: UseSemanticColorsReturn): Record<BuildingStatus, BadgeDefinition> => ({
  available: {
    label: unitStatusLabels.available,
    variant: 'success',
    backgroundColor: colors.bg.success,
    color: colors.text.success,
    icon: 'home'
  },
  occupied: {
    label: unitStatusLabels.occupied,
    variant: 'info',
    backgroundColor: colors.bg.info,
    color: colors.text.info,
    icon: 'users'
  },
  maintenance: {
    label: unitStatusLabels.maintenance,
    variant: 'warning',
    backgroundColor: colors.bg.warning,
    color: colors.text.warning,
    icon: 'wrench'
  },
  for_sale: {
    label: unitStatusLabels.for_sale,
    variant: 'outline',
    backgroundColor: colors.bg.secondary,
    color: colors.text.muted,
    icon: 'tag'
  },
  for_rent: {
    label: unitStatusLabels.for_rent,
    variant: 'secondary',
    backgroundColor: colors.bg.secondary,
    color: colors.text.secondary,
    icon: 'key'
  },
  sold: {
    label: unitStatusLabels.sold,
    variant: 'destructive',
    backgroundColor: colors.bg.error,
    color: colors.text.error,
    icon: 'dollarSign'
  },
  rented: {
    label: unitStatusLabels.rented,
    variant: 'purple',
    backgroundColor: colors.bg.secondary,
    color: colors.text.primary,
    icon: 'handshake'
  },
  construction: {
    label: unitStatusLabels.under_construction,
    variant: 'warning',
    backgroundColor: colors.bg.warning,
    color: colors.text.warning,
    icon: 'hammer'
  },
  planned: {
    label: unitStatusLabels.planned,
    variant: 'outline',
    backgroundColor: colors.bg.secondary,
    color: colors.text.muted,
    icon: 'blueprint'
  }
});

// ============================================================================
// 🎯 SIMPLE CONSTANTS (SAFE - NO COLORS)
// ============================================================================

// ===== UNIT SALE STATUS CONSTANTS =====

export const UNIT_SALE_STATUS = {
  NOT_SOLD: 'NOT_SOLD',
  SOLD: 'SOLD',
  RESERVED: 'RESERVED',
  PENDING: 'PENDING'
} as const;

// 🏢 ENTERPRISE: Centralized labels - ZERO HARDCODED VALUES
export const UNIT_SALE_STATUS_LABELS = {
  'NOT_SOLD': propertyMarketStatusLabels.not_sold,
  'SOLD': propertyMarketStatusLabels.sold,
  'RESERVED': storageStatusLabels.reserved,
  'PENDING': propertyMarketStatusLabels.pending
} as const;

// ============================================================================
// UTILITIES
// ============================================================================

export const getObligationStatusLabel = (status: ObligationStatus): string => {
  return status; // Simple fallback since we use enterprise functions now
};

/**
 * ✅ ENTERPRISE PATTERN: Dependency Injection
 * Αντί να καλώ useSemanticColors() hook εδώ (violation των Rules of Hooks),
 * περνώ τα colors ως παράμετρο από το component που καλεί τη function.
 */
export const getObligationStatusColor = (status: ObligationStatus, colors: UseSemanticColorsReturn): string => {
  // ✅ ENTERPRISE PROFESSIONAL: Direct mapping using centralized color system
  const statusColorMap: Record<ObligationStatus, string> = {
    draft: `${colors.bg.warning} ${colors.text.warning}`,
    completed: `${colors.bg.success} ${colors.text.success}`,
    approved: `${colors.bg.info} ${colors.text.info}`
  };

  return statusColorMap[status] || `${colors.bg.secondary} ${colors.text.muted}`;
};

export const getObligationStatusIcon = (status: ObligationStatus): string => {
  const iconMap: Record<ObligationStatus, string> = {
    draft: "📝",
    completed: "✅",
    approved: "🔐"
  };
  return iconMap[status] || "📄";
};

// ============================================================================
// 🏢 ENTERPRISE: UNIFIED BADGE SYSTEM CONFIG με Dependency Injection
// ============================================================================

/**
 * ✅ ENTERPRISE PROFESSIONAL: Creates unified badge system με centralized colors
 * 🎯 ZERO hardcoded values - Pure dependency injection pattern
 *
 * @param colors - useSemanticColors hook result (dependency injection)
 * @returns Complete badge system configuration με centralized colors
 */
export const createUnifiedBadgeSystem = (colors: UseSemanticColorsReturn): BadgeSystemConfig => ({
  domains: {
    PROJECT: createProjectStatuses(colors),
    BUILDING: createBuildingStatuses(colors),
    CONTACT: createContactStatuses(colors),
    PROPERTY: createPropertyStatuses(colors),
    UNIT: createUnitStatuses(colors),
    NAVIGATION: createNavigationStatuses(colors),
    OBLIGATION: createObligationStatuses(colors)
  },
  common: {
    ...createCommonStatuses(colors),
    ...createContactTypes(colors) // Add contact types to common patterns
  }
});

// ============================================================================
// 🏢 ENTERPRISE: Static Exports με Default Colors - ΛΥΣΗ ΓΙΑ BACKWARDS COMPATIBILITY
// ============================================================================

/**
 * ✅ ENTERPRISE SOLUTION: Default-initialized exports για legacy code
 * 🎯 Uses centralized useSemanticColors με fallback values
 * 🔧 Solves import issues while maintaining enterprise standards
 */

// ============================================================================
// 🏢 ENTERPRISE: Color System Integration με Direct COLOR_BRIDGE Access
// ============================================================================

const getDefaultColors = (): UseSemanticColorsReturn => {
  // 🏢 ENTERPRISE SOLUTION: Use actual COLOR_BRIDGE με all properties
  return {
    // 🌉 Direct bridge mappings - ZERO LOGIC (same as useSemanticColors)
    text: COLOR_BRIDGE.text,
    bg: COLOR_BRIDGE.bg,
    border: COLOR_BRIDGE.border,
    interactive: COLOR_BRIDGE.interactive,
    gradients: COLOR_BRIDGE.gradients,
    ring: COLOR_BRIDGE.ring, // ✅ ENTERPRISE: Added missing ring property

    // 🎯 Simple utility methods - PURE MAPPING (same as useSemanticColors)
    getText: (type) => COLOR_BRIDGE.text[type],
    getBg: (type) => COLOR_BRIDGE.bg[type] || COLOR_BRIDGE.bg.primary,
    getBorder: (type) => COLOR_BRIDGE.border[type] || COLOR_BRIDGE.border.default,
    getGradient: (type) => COLOR_BRIDGE.gradients[type] || COLOR_BRIDGE.gradients.neutralSubtle,
    getRing: (type) => COLOR_BRIDGE.ring[type] || COLOR_BRIDGE.ring.default, // ✅ ENTERPRISE: Added missing getRing method
  };
};

// ============================================================================
// 🏷️ STATIC EXPORTS - Enterprise Compatibility Layer με Lazy Initialization
// ============================================================================

export const PROJECT_STATUSES = createProjectStatuses(getDefaultColors());
export const BUILDING_STATUSES = createBuildingStatuses(getDefaultColors());
export const CONTACT_STATUSES = createContactStatuses(getDefaultColors());
export const PROPERTY_STATUSES = createPropertyStatuses(getDefaultColors());
export const UNIT_STATUSES = createUnitStatuses(getDefaultColors());
export const COMMON_STATUSES = createCommonStatuses(getDefaultColors());
export const UNIFIED_BADGE_SYSTEM = createUnifiedBadgeSystem(getDefaultColors());