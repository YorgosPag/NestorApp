/**
 * 🏷️ CENTRAL STATUS CONSTANTS
 *
 * ✅ CENTRALIZED: Uses existing BadgeDefinition interface
 * ✅ NO DUPLICATES: Leverages core/types/BadgeTypes.ts
 * ✅ CLEAN: Enterprise-class status definitions
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
import { brandClasses } from '@/styles/design-tokens';
import type { UseSemanticColorsReturn } from '@/hooks/useSemanticColors';

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
} from '@/subapps/dxf-viewer/config/modal-select';

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

export const PROJECT_STATUSES: Record<ProjectStatus, BadgeDefinition> = {
  planning: {
    label: projectStatusLabels.planning,
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'planning'
  },
  in_progress: {
    label: projectStatusLabels.in_progress,
    variant: 'info',
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    icon: 'play'
  },
  completed: {
    label: projectStatusLabels.completed,
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'check'
  },
  on_hold: {
    label: projectStatusLabels.on_hold,
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'pause'
  },
  cancelled: {
    label: projectStatusLabels.cancelled,
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'x'
  },
  review: {
    label: projectStatusLabels.review,
    variant: 'purple',
    color: '#7C3AED',
    backgroundColor: '#F3E8FF',
    icon: 'review'
  },
  approved: {
    label: projectStatusLabels.approved,
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'checkCircle'
  }
} as const;

// ============================================================================
// BUILDING STATUS DEFINITIONS
// ============================================================================

export const BUILDING_STATUSES: Record<BuildingStatus, BadgeDefinition> = {
  available: {
    label: unitStatusLabels.available,
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'home'
  },
  occupied: {
    label: unitStatusLabels.occupied,
    variant: 'info',
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    icon: 'users'
  },
  maintenance: {
    label: unitStatusLabels.maintenance,
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'wrench'
  },
  for_sale: {
    label: unitStatusLabels.for_sale,
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'tag'
  },
  for_rent: {
    label: unitStatusLabels.for_rent,
    variant: 'secondary',
    color: '#4B5563',
    backgroundColor: '#F3F4F6',
    icon: 'key'
  },
  sold: {
    label: unitStatusLabels.sold,
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'dollarSign'
  },
  rented: {
    label: unitStatusLabels.rented,
    variant: 'purple',
    color: '#7C3AED',
    backgroundColor: '#F3E8FF',
    icon: 'handshake'
  },
  construction: {
    label: unitStatusLabels.under_construction,
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'hammer'
  },
  planned: {
    label: unitStatusLabels.planned,
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'blueprint'
  }
} as const;

// ============================================================================
// CONTACT STATUS DEFINITIONS
// ============================================================================

export const CONTACT_STATUSES: Record<ContactStatus, BadgeDefinition> = {
  active: {
    label: contactStatusLabels.active,
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'userCheck'
  },
  inactive: {
    label: contactStatusLabels.inactive,
    variant: 'secondary',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'userX'
  },
  pending: {
    label: contactStatusLabels.pending,
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'clock'
  },
  blocked: {
    label: contactStatusLabels.blocked,
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'shield'
  },
  archived: {
    label: contactStatusLabels.archived,
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'archive'
  },
  // Contact Types (added for centralization)
  individual: {
    label: contactTypeLabels.individual,
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'user'
  },
  company: {
    label: contactTypeLabels.company,
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'building'
  },
  service: {
    label: contactTypeLabels.service,
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'landmark'
  }
} as const;

// ============================================================================
// PROPERTY STATUS DEFINITIONS
// ============================================================================

export const PROPERTY_STATUSES: Record<PropertyStatus, BadgeDefinition> = {
  // Βασικές καταστάσεις (legacy - διατηρούμε για backward compatibility)
  available: {
    label: propertyMarketStatusLabels.available,
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'home'
  },
  reserved: {
    label: propertyMarketStatusLabels.reserved,
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'bookmark'
  },
  sold: {
    label: propertyMarketStatusLabels.sold,
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'dollarSign'
  },
  pending: {
    label: propertyMarketStatusLabels.pending,
    variant: 'info',
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    icon: 'clock'
  },
  withdrawn: {
    label: propertyMarketStatusLabels.withdrawn,
    variant: 'secondary',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'arrowLeft'
  },
  expired: {
    label: propertyMarketStatusLabels.expired,
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'calendar'
  },

  // 🏨 Advanced Rental Statuses
  'rental-only': {
    label: rentalTypeLabels.rent_only,
    variant: 'info',
    color: '#0369A1',
    backgroundColor: '#E0F2FE',
    icon: 'key'
  },
  'long-term-rental': {
    label: rentalTypeLabels.long_term,
    variant: 'info',
    color: '#0284C7',
    backgroundColor: '#F0F9FF',
    icon: 'calendar'
  },
  'short-term-rental': {
    label: rentalTypeLabels.short_term,
    variant: 'info',
    color: '#0EA5E9',
    backgroundColor: '#F0FAFF',
    icon: 'clock'
  },

  // 🔒 Advanced Reservation Statuses
  'reserved-pending': {
    label: propertySpecialStatusLabels.reserved_pending,
    variant: 'warning',
    color: '#EA580C',
    backgroundColor: '#FFF7ED',
    icon: 'pause'
  },
  'contract-signed': {
    label: propertySpecialStatusLabels.contract_signed,
    variant: 'warning',
    color: '#C2410C',
    backgroundColor: '#FEF2F2',
    icon: 'fileSignature'
  },
  'deposit-paid': {
    label: propertySpecialStatusLabels.deposit_paid,
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'creditCard'
  },

  // 👑 Ownership Statuses
  'company-owned': {
    label: propertySpecialStatusLabels.corporate,
    variant: 'purple',
    color: '#6B21A8',
    backgroundColor: '#FAF5FF',
    icon: 'building'
  },
  'not-for-sale': {
    label: propertySpecialStatusLabels.not_for_sale,
    variant: 'purple',
    color: '#7C3AED',
    backgroundColor: '#F3E8FF',
    icon: 'shield'
  },
  'family-reserved': {
    label: propertySpecialStatusLabels.family,
    variant: 'purple',
    color: '#8B5CF6',
    backgroundColor: '#F5F3FF',
    icon: 'heart'
  },

  // ⚡ Market Dynamics
  'pre-launch': {
    label: propertySpecialStatusLabels.pre_launch,
    variant: 'success',
    color: '#16A34A',
    backgroundColor: '#F0FDF4',
    icon: 'rocket'
  },
  'exclusive-listing': {
    label: propertySpecialStatusLabels.exclusive,
    variant: 'success',
    color: '#15803D',
    backgroundColor: '#ECFDF5',
    icon: 'crown'
  },
  'price-reduced': {
    label: propertySpecialStatusLabels.reduced_price,
    variant: 'error',
    color: '#F59E0B',
    backgroundColor: '#FEF3C7',
    icon: 'trendingDown'
  },
  'urgent-sale': {
    label: propertySpecialStatusLabels.urgent_sale,
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'alertTriangle'
  },

  // 🔧 Operational Statuses
  'under-renovation': {
    label: propertySpecialStatusLabels.under_renovation,
    variant: 'secondary',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'wrench'
  },
  'legal-issues': {
    label: propertySpecialStatusLabels.legal_issues,
    variant: 'destructive',
    color: '#B91C1C',
    backgroundColor: '#FEE2E2',
    icon: 'gavel'
  },
  'inspection-required': {
    label: propertySpecialStatusLabels.inspection_required,
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'search'
  },
  'documentation-pending': {
    label: propertySpecialStatusLabels.pending_documents,
    variant: 'outline',
    color: '#9CA3AF',
    backgroundColor: '#F9FAFB',
    icon: 'fileText'
  },

  // Βασικά από το παλιό σύστημα για πλήρη συμβατότητα
  'for-sale': {
    label: propertySpecialStatusLabels.for_sale,
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'tag'
  },
  'for-rent': {
    label: propertySpecialStatusLabels.for_rent,
    variant: 'info',
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    icon: 'key'
  },
  rented: {
    label: propertySpecialStatusLabels.rented,
    variant: 'purple',
    color: '#7C3AED',
    backgroundColor: '#F3E8FF',
    icon: 'handshake'
  },
  'under-negotiation': {
    label: propertySpecialStatusLabels.under_negotiation,
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'messageCircle'
  },
  'coming-soon': {
    label: propertySpecialStatusLabels.available_soon,
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'calendar'
  },
  landowner: {
    label: propertySpecialStatusLabels.landowner,
    variant: 'secondary',
    color: '#4B5563',
    backgroundColor: '#F3F4F6',
    icon: 'map'
  },
  'off-market': {
    label: propertySpecialStatusLabels.off_market,
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'eyeOff'
  },
  unavailable: {
    label: propertySpecialStatusLabels.unavailable,
    variant: 'secondary',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'x'
  }
} as const;

// ============================================================================
// UNIT STATUS DEFINITIONS
// ============================================================================

export const UNIT_STATUSES: Record<UnitStatus, BadgeDefinition> = {
  available: {
    label: storageStatusLabels.available,
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'home'
  },
  occupied: {
    label: storageStatusLabels.occupied,
    variant: 'info',
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    icon: 'users'
  },
  sold: {
    label: propertyMarketStatusLabels.sold,
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'dollarSign'
  },
  maintenance: {
    label: storageStatusLabels.maintenance,
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'wrench'
  },
  reserved: {
    label: storageStatusLabels.reserved,
    variant: 'purple',
    color: '#7C3AED',
    backgroundColor: '#F3E8FF',
    icon: 'bookmark'
  }
} as const;

// ===== UNIT SALE STATUS CONSTANTS =====

export const UNIT_SALE_STATUS = {
  NOT_SOLD: 'NOT_SOLD',
  SOLD: 'SOLD',
  RESERVED: 'RESERVED',
  PENDING: 'PENDING'
} as const;

export const UNIT_SALE_STATUS_LABELS = {
  [UNIT_SALE_STATUS.NOT_SOLD]: 'Δεν έχει πωληθεί',
  [UNIT_SALE_STATUS.SOLD]: 'Πωλήθηκε',
  [UNIT_SALE_STATUS.RESERVED]: 'Κρατημένη',
  [UNIT_SALE_STATUS.PENDING]: 'Εκκρεμεί'
} as const;

// ============================================================================
// NAVIGATION STATUS DEFINITIONS
// ============================================================================

export const NAVIGATION_STATUSES: Record<NavigationStatus, BadgeDefinition> = {
  no_projects: {
    label: priorityLabels.none,
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'alertTriangle'
  },
  empty: {
    label: priorityLabels.empty,
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'circle'
  },
  warning: {
    label: priorityLabels.warning,
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'alertTriangle'
  },
  alert: {
    label: priorityLabels.attention,
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'alert'
  },
  success: {
    label: priorityLabels.success,
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'check'
  },
  info: {
    label: priorityLabels.info,
    variant: 'info',
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    icon: 'info'
  }
} as const;

// ============================================================================
// COMMON STATUS DEFINITIONS
// ============================================================================

export const COMMON_STATUSES: Record<string, BadgeDefinition> = {
  new: {
    label: recordStateLabels.new,
    variant: 'info',
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    icon: 'plus'
  },
  updated: {
    label: recordStateLabels.updated,
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'refresh'
  },
  deleted: {
    label: recordStateLabels.deleted,
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'trash'
  },
  company: {
    label: entityTypeLabels.company,
    variant: 'secondary',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    icon: 'building'
  },
  primary: {
    label: entityTypeLabels.main,
    variant: 'default',
    color: '#374151',
    backgroundColor: '#F3F4F6',
    icon: 'star'
  },
  secondary: {
    label: entityTypeLabels.secondary,
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'circle'
  }
} as const;

// ============================================================================
// OBLIGATION STATUS DEFINITIONS
// ============================================================================

export const OBLIGATION_STATUSES: Record<ObligationStatus, BadgeDefinition> = {
  draft: {
    label: documentStatusLabels.draft,
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'edit'
  },
  completed: {
    label: documentStatusLabels.completed,
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'check'
  },
  approved: {
    label: documentStatusLabels.approved,
    variant: 'info',
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    icon: 'checkCircle'
  }
} as const;

// ============================================================================
// UTILITIES
// ============================================================================

export const getObligationStatusLabel = (status: ObligationStatus): string => {
  return OBLIGATION_STATUSES[status]?.label || status;
};

/**
 * ✅ ENTERPRISE PATTERN: Dependency Injection
 * Αντί να καλώ useSemanticColors() hook εδώ (violation των Rules of Hooks),
 * περνώ τα colors ως παράμετρο από το component που καλεί τη function.
 */
export const getObligationStatusColor = (status: ObligationStatus, colors: UseSemanticColorsReturn): string => {
  const config = OBLIGATION_STATUSES[status];

  if (!config) return `${colors.status.muted.bg} ${colors.status.muted.text} ${colors.status.muted.border}`;

  // Map status colors to semantic color patterns
  const colorMap: Record<string, string> = {
    '#D97706': `${colors.status.warning.bg} ${colors.status.warning.text} ${colors.status.warning.border}`, // Yellow
    '#059669': `${colors.status.success.bg} ${colors.status.success.text} ${colors.status.success.border}`, // Green
    '#3B82F6': `${colors.status.info.bg} ${colors.status.info.text} ${colors.status.info.border}`,       // Blue
  };

  return colorMap[config.color] || `${colors.status.muted.bg} ${colors.status.muted.text} ${colors.status.muted.border}`;
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
// UNIFIED BADGE SYSTEM CONFIG
// ============================================================================

export const UNIFIED_BADGE_SYSTEM: BadgeSystemConfig = {
  domains: {
    PROJECT: PROJECT_STATUSES,
    BUILDING: BUILDING_STATUSES,
    CONTACT: CONTACT_STATUSES,
    PROPERTY: PROPERTY_STATUSES,
    UNIT: UNIT_STATUSES,
    NAVIGATION: NAVIGATION_STATUSES,
    OBLIGATION: OBLIGATION_STATUSES
  },
  common: COMMON_STATUSES
};