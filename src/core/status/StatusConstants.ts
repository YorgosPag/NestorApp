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
// 📌 NOTE: Import directly from modular files to avoid conflicts with original modal-select.ts re-exports
import {
  getProjectStatusLabels,
  getUnitStatusLabels,
  getContactStatusLabels,
  getContactTypeLabels,
  getPropertyMarketStatusLabels,
  getRentalTypeLabels,
  getStorageStatusLabels,
} from '@/config/vocabulary/labels/status';

// 🏢 ENTERPRISE: Import from modular status.ts for extended property labels (market/sales-related)
import {
  VOCAB_PROPERTY_SPECIAL_STATUS_LABELS,
  VOCAB_SEVERITY_LABELS,
  VOCAB_RECORD_STATE_LABELS,
  VOCAB_ENTITY_TYPE_LABELS,
  VOCAB_DOCUMENT_STATUS_LABELS
} from '@/config/vocabulary/labels/status';

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
const propertySpecialStatusLabels = VOCAB_PROPERTY_SPECIAL_STATUS_LABELS;
const severityLabels = VOCAB_SEVERITY_LABELS;
const recordStateLabels = VOCAB_RECORD_STATE_LABELS;
const entityTypeLabels = VOCAB_ENTITY_TYPE_LABELS;
const documentStatusLabels = VOCAB_DOCUMENT_STATUS_LABELS;

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
  // ADR-812: τα `review`/`approved` ΕΦΥΓΑΝ — ανήκουν στον άξονα έγκρισης
  // παραδοτέου (ISO 19650 S3/S4/B1 · Revit revision · Figma branch), όχι στο
  // lifecycle του έργου. Ο τύπος επιστροφής `Record<ProjectStatus, …>` δεν
  // επιτρέπει πια να ξαναμπούν χωρίς να αλλάξει το SSoT.
  deleted: {
    label: projectStatusLabels.deleted,
    variant: 'outline',
    backgroundColor: colors.bg.secondary,
    color: colors.text.muted,
    icon: 'trash'
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
  archived: { label: contactStatusLabels.archived, variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'archive' },
  deleted: { label: contactStatusLabels.deleted, variant: 'destructive', backgroundColor: colors.bg.error, color: colors.text.error, icon: 'trash' }
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
  'for-sale-and-rent': { label: unitStatusLabels.for_sale_and_rent, variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'tag' },
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
  'documentation-pending': { label: propertySpecialStatusLabels.pending_documents, variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'fileText' },
  deleted: { label: 'trash:trashView', variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'trash' }
});

/**
 * ✅ ENTERPRISE PROFESSIONAL: Unit Statuses Generator
 * 🏢 CENTRALIZED: Uses unitStatusLabels from modal-select - ZERO HARDCODED VALUES
 */
export const createUnitStatuses = (colors: UseSemanticColorsReturn): Record<UnitStatus, BadgeDefinition> => ({
  available: { label: storageStatusLabels.available, variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'home' },
  occupied: { label: unitStatusLabels.occupied, variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'users' },
  maintenance: { label: storageStatusLabels.maintenance, variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'wrench' },
  reserved: { label: storageStatusLabels.reserved, variant: 'purple', backgroundColor: colors.bg.secondary, color: colors.text.primary, icon: 'bookmark' },
  // 🏢 ENTERPRISE: Added parking-compatible statuses
  sold: { label: unitStatusLabels.sold, variant: 'destructive', backgroundColor: colors.bg.error, color: colors.text.error, icon: 'check' },
  owner: { label: 'properties.status.owner', variant: 'default', backgroundColor: colors.bg.secondary, color: colors.text.primary, icon: 'user' }
});

/**
 * ✅ ENTERPRISE PROFESSIONAL: Navigation Statuses Generator
 * 🏢 CENTRALIZED: Uses severityLabels from the vocabulary - ZERO HARDCODED VALUES
 * ⚠️ Λεγόταν «priorityLabels» και ήταν ψέμα: οι τιμές είναι `none · empty · warning ·
 * attention · success · info` — **σοβαρότητα**, όχι προτεραιότητα (ADR-806 §7 #2).
 */
export const createNavigationStatuses = (colors: UseSemanticColorsReturn): Record<NavigationStatus, BadgeDefinition> => ({
  no_projects: { label: severityLabels.none, variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'alertTriangle' },
  empty: { label: severityLabels.empty, variant: 'outline', backgroundColor: colors.bg.secondary, color: colors.text.muted, icon: 'circle' },
  warning: { label: severityLabels.warning, variant: 'warning', backgroundColor: colors.bg.warning, color: colors.text.warning, icon: 'alertTriangle' },
  alert: { label: severityLabels.attention, variant: 'destructive', backgroundColor: colors.bg.error, color: colors.text.error, icon: 'alert' },
  success: { label: severityLabels.success, variant: 'success', backgroundColor: colors.bg.success, color: colors.text.success, icon: 'check' },
  info: { label: severityLabels.info, variant: 'info', backgroundColor: colors.bg.info, color: colors.text.info, icon: 'info' }
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
  },
  // 🏢 ENTERPRISE: Additional building statuses to match BuildingStatus type
  planning: {
    label: projectStatusLabels.planning,
    variant: 'outline',
    backgroundColor: colors.bg.secondary,
    color: colors.text.muted,
    icon: 'planning'
  },
  completed: {
    label: projectStatusLabels.completed,
    variant: 'success',
    backgroundColor: colors.bg.success,
    color: colors.text.success,
    icon: 'check'
  },
  active: {
    label: contactStatusLabels.active,
    variant: 'info',
    backgroundColor: colors.bg.info,
    color: colors.text.info,
    icon: 'activity'
  },
  'partially-occupied': {
    label: 'buildings.status.partiallyOccupied',
    variant: 'warning',
    backgroundColor: colors.bg.warning,
    color: colors.text.warning,
    icon: 'users'
  },
  deleted: {
    label: 'trash:trashView',
    variant: 'outline',
    backgroundColor: colors.bg.secondary,
    color: colors.text.muted,
    icon: 'trash'
  }
});

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
// ============================================================================
// 🔴 ADR-812 — ΤΑ ΔΥΟ ΟΜΩΝΥΜΑ ΔΙΑΓΡΑΦΗΚΑΝ
// ============================================================================
//
// Εδώ ζούσαν `PROJECT_STATUSES` και `BUILDING_STATUSES` — **badge maps**
// (χρώμα · variant · εικονίδιο · ετικέτα) με τα ονόματα του ΛΕΞΙΛΟΓΙΟΥ. Το
// `PROJECT_STATUSES` ήταν ομώνυμο του κανονικού array στο
// `@/constants/project-statuses`, με ΑΛΛΟ περιεχόμενο και ΑΛΛΟ νόημα: «δες το
// PROJECT_STATUSES» δεν προσδιόριζε πράγμα.
//
// 🔴 Ο μοναδικός τους καταναλωτής ήταν το `types/validation/schemas.ts`, που
// έκανε `Object.keys()` πάνω τους και τα έδινε σε **Zod** — τα κλειδιά ενός
// πίνακα χρωμάτων γίνονταν κανόνας εγκυρότητας. Μόλις εκείνο έμαθε να ρωτά το
// SSoT, τα δύο έμειναν με ΜΗΔΕΝ καταναλωτές (AST μεταβατικά + `git grep`,
// 2026-08-26· το barrel `core/badges/index.ts` επανεξάγει μόνο τα `create*`).
//
// Μαζί τους έφυγε και ένας υπολογισμός σε χρόνο φόρτωσης module: το
// `createProjectStatuses(...)` έτρεχε με στιγμιότυπο των προεπιλεγμένων χρωμάτων
// σε κάθε import· μαζί τους έφυγε και ο βοηθός που τα παρήγε.
//
// ⚠️ Χρειάζεσαι badge configs; Κάλεσε τα `create*Statuses(colors)` με τα ΖΩΝΤΑΝΑ
// χρώματα του θέματος — όχι στιγμιότυπο των προεπιλεγμένων.
// ⚠️ Χρειάζεσαι το λεξιλόγιο; `@/constants/project-statuses`. Ένα σπίτι.