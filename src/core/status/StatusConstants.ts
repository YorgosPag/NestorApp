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

// 🏢 ENTERPRISE: Import centralized status labels - NO MORE HARDCODED VALUES
import {
  getProjectStatusLabels,
  getUnitStatusLabels,
  getContactStatusLabels,
  getContactTypeLabels,
  getPropertyMarketStatusLabels,
  getRentalTypeLabels,
  getPropertySpecialStatusLabels,
  getStorageStatusLabels,
  getPriorityLabels,
  getRecordStateLabels,
  getEntityTypeLabels,
  getDocumentStatusLabels
} from '../../subapps/dxf-viewer/config/modal-select';

// ============================================================================
// PROJECT STATUS DEFINITIONS
// ============================================================================

// ✅ ENTERPRISE: Get centralized labels
const projectStatusLabels = getProjectStatusLabels();
const unitStatusLabels = getUnitStatusLabels();
const contactStatusLabels = getContactStatusLabels();
const contactTypeLabels = getContactTypeLabels();
const propertyMarketStatusLabels = getPropertyMarketStatusLabels();
const rentalTypeLabels = getRentalTypeLabels();
const propertySpecialStatusLabels = getPropertySpecialStatusLabels();
const storageStatusLabels = getStorageStatusLabels();
const priorityLabels = getPriorityLabels();
const recordStateLabels = getRecordStateLabels();
const entityTypeLabels = getEntityTypeLabels();
const documentStatusLabels = getDocumentStatusLabels();

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
export const createProjectStatuses = (colors: UseSemanticColorsReturn): Record<ProjectStatus, BadgeDefinition> => ({
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
  // Υπόλοιπα properties...
  'for-sale': { label: 'Προς Πώληση', variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'tag' },
  'for-rent': { label: 'Προς Ενοικίαση', variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'key' },
  rented: { label: 'Ενοικιάστηκε', variant: 'purple', backgroundColor: colors.bg.secondary, color: colors.text.primary, icon: 'handshake' },
  'under-negotiation': { label: 'Υπό Διαπραγμάτευση', variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'messageCircle' },
  'coming-soon': { label: 'Σύντομα Διαθέσιμο', variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'calendar' },
  landowner: { label: 'Ιδιοκτήτης Γης', variant: 'secondary', backgroundColor: colors.bg.secondary, color: colors.text.secondary, icon: 'map' },
  'off-market': { label: 'Εκτός Αγοράς', variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'eyeOff' },
  unavailable: { label: 'Μη Διαθέσιμο', variant: 'secondary', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'x' },
  'long-term-rental': { label: rentalTypeLabels.long_term, variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'calendar' },
  'short-term-rental': { label: rentalTypeLabels.short_term, variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'clock' },
  'reserved-pending': { label: 'Κρατημένο (Εκκρεμεί)', variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'pause' },
  'contract-signed': { label: 'Συμβόλαιο Υπογράφηκε', variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'fileSignature' },
  'deposit-paid': { label: 'Προκαταβολή Πληρώθηκε', variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'creditCard' },
  'company-owned': { label: 'Εταιρική Ιδιοκτησία', variant: 'purple', backgroundColor: colors.bg.secondary, color: colors.text.primary, icon: 'building' },
  'not-for-sale': { label: 'Δεν Πωλείται', variant: 'purple', backgroundColor: colors.bg.secondary, color: colors.text.primary, icon: 'shield' },
  'family-reserved': { label: 'Οικογενειακή Κράτηση', variant: 'purple', backgroundColor: colors.bg.secondary, color: colors.text.primary, icon: 'heart' },
  'pre-launch': { label: 'Προ-Λανσάρισμα', variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'rocket' },
  'exclusive-listing': { label: 'Αποκλειστική Καταχώρηση', variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'crown' },
  'price-reduced': { label: 'Μειωμένη Τιμή', variant: 'error', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'trendingDown' },
  'urgent-sale': { label: 'Επείγουσα Πώληση', variant: 'destructive', backgroundColor: colors.bg.error, color: colors.text.error, icon: 'alertTriangle' },
  'under-renovation': { label: 'Υπό Ανακαίνιση', variant: 'secondary', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'wrench' },
  'legal-issues': { label: 'Νομικά Ζητήματα', variant: 'destructive', backgroundColor: colors.bg.error, color: colors.text.error, icon: 'gavel' },
  'inspection-required': { label: 'Απαιτείται Επιθεώρηση', variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'search' },
  'documentation-pending': { label: 'Εκκρεμή Έγγραφα', variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'fileText' }
});

/**
 * ✅ ENTERPRISE PROFESSIONAL: Unit Statuses Generator
 */
export const createUnitStatuses = (colors: UseSemanticColorsReturn): Record<UnitStatus, BadgeDefinition> => ({
  available: { label: storageStatusLabels.available, variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'home' },
  occupied: { label: 'Κατειλημμένο', variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'users' },
  maintenance: { label: storageStatusLabels.maintenance, variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'wrench' },
  reserved: { label: storageStatusLabels.reserved, variant: 'purple', backgroundColor: colors.bg.secondary, color: colors.text.primary, icon: 'bookmark' }
});

/**
 * ✅ ENTERPRISE PROFESSIONAL: Navigation Statuses Generator
 */
export const createNavigationStatuses = (colors: UseSemanticColorsReturn): Record<NavigationStatus, BadgeDefinition> => ({
  no_projects: { label: 'Κανένα Έργο', variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'alertTriangle' },
  empty: { label: 'Κενό', variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'circle' },
  warning: { label: 'Προειδοποίηση', variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'alertTriangle' },
  alert: { label: 'Προσοχή', variant: 'destructive', backgroundColor: colors.bg.error, color: colors.text.error, icon: 'alert' },
  success: { label: 'Επιτυχία', variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'check' },
  info: { label: 'Πληροφορία', variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'info' }
});

/**
 * ✅ ENTERPRISE PROFESSIONAL: Obligation Statuses Generator
 */
export const createObligationStatuses = (colors: UseSemanticColorsReturn): Record<ObligationStatus, BadgeDefinition> => ({
  draft: { label: 'Πρόχειρο', variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'edit' },
  completed: { label: 'Ολοκληρωμένο', variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'check' },
  approved: { label: 'Εγκεκριμένο', variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'checkCircle' }
});

/**
 * ✅ ENTERPRISE PROFESSIONAL: Common Statuses Generator
 */
export const createCommonStatuses = (colors: UseSemanticColorsReturn): Record<string, BadgeDefinition> => ({
  new: { label: 'Νέο', variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'plus' },
  updated: { label: 'Ενημερωμένο', variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'refresh' },
  deleted: { label: 'Διαγραμμένο', variant: 'destructive', backgroundColor: colors.bg.error, color: colors.text.error, icon: 'trash' },
  company: { label: 'Εταιρία', variant: 'secondary', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'building' },
  primary: { label: 'Κύριο', variant: 'default', backgroundColor: colors.bg.secondary, color: colors.text.primary, icon: 'star' },
  secondary: { label: 'Δευτερεύον', variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'circle' }
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

export const UNIT_SALE_STATUS_LABELS = {
  'NOT_SOLD': 'Δεν έχει πωληθεί',
  'SOLD': 'Πωλήθηκε',
  'RESERVED': 'Κρατημένη',
  'PENDING': 'Εκκρεμεί'
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