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

// ============================================================================
// PROJECT STATUS DEFINITIONS
// ============================================================================

export const PROJECT_STATUSES: Record<ProjectStatus, BadgeDefinition> = {
  planning: {
    label: 'Σχεδιασμός',
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'planning'
  },
  in_progress: {
    label: 'Σε Εξέλιξη',
    variant: 'info',
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    icon: 'play'
  },
  completed: {
    label: 'Ολοκληρωμένο',
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'check'
  },
  on_hold: {
    label: 'Σε Αναμονή',
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'pause'
  },
  cancelled: {
    label: 'Ακυρωμένο',
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'x'
  },
  review: {
    label: 'Υπό Έλεγχο',
    variant: 'purple',
    color: '#7C3AED',
    backgroundColor: '#F3E8FF',
    icon: 'review'
  },
  approved: {
    label: 'Εγκεκριμένο',
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
    label: 'Διαθέσιμο',
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'home'
  },
  occupied: {
    label: 'Κατειλημμένο',
    variant: 'info',
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    icon: 'users'
  },
  maintenance: {
    label: 'Συντήρηση',
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'wrench'
  },
  for_sale: {
    label: 'Προς Πώληση',
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'tag'
  },
  for_rent: {
    label: 'Προς Ενοικίαση',
    variant: 'secondary',
    color: '#4B5563',
    backgroundColor: '#F3F4F6',
    icon: 'key'
  },
  sold: {
    label: 'Πωλήθηκε',
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'dollarSign'
  },
  rented: {
    label: 'Ενοικιάστηκε',
    variant: 'purple',
    color: '#7C3AED',
    backgroundColor: '#F3E8FF',
    icon: 'handshake'
  },
  construction: {
    label: 'Υπό Κατασκευή',
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'hammer'
  },
  planned: {
    label: 'Σχεδιασμένο',
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
    label: 'Ενεργή',
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'userCheck'
  },
  inactive: {
    label: 'Ανενεργή',
    variant: 'secondary',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'userX'
  },
  pending: {
    label: 'Σε Αναμονή',
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'clock'
  },
  blocked: {
    label: 'Αποκλεισμένη',
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'shield'
  },
  archived: {
    label: 'Αρχειοθετημένη',
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'archive'
  },
  // Contact Types (added for centralization)
  individual: {
    label: 'Φυσικό Πρόσωπο',
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'user'
  },
  company: {
    label: 'Νομικό Πρόσωπο',
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'building'
  },
  service: {
    label: 'Δημόσια Υπηρεσία',
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
    label: 'Διαθέσιμο',
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'home'
  },
  reserved: {
    label: 'Κρατημένο',
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'bookmark'
  },
  sold: {
    label: 'Πωλήθηκε',
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'dollarSign'
  },
  pending: {
    label: 'Εκκρεμεί',
    variant: 'info',
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    icon: 'clock'
  },
  withdrawn: {
    label: 'Αποσύρθηκε',
    variant: 'secondary',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'arrowLeft'
  },
  expired: {
    label: 'Έληξε',
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'calendar'
  },

  // 🏨 Advanced Rental Statuses
  'rental-only': {
    label: 'Μόνο Ενοικίαση',
    variant: 'info',
    color: '#0369A1',
    backgroundColor: '#E0F2FE',
    icon: 'key'
  },
  'long-term-rental': {
    label: 'Μακροχρόνια Μίσθωση',
    variant: 'info',
    color: '#0284C7',
    backgroundColor: '#F0F9FF',
    icon: 'calendar'
  },
  'short-term-rental': {
    label: 'Βραχυχρόνια Μίσθωση',
    variant: 'info',
    color: '#0EA5E9',
    backgroundColor: '#F0FAFF',
    icon: 'clock'
  },

  // 🔒 Advanced Reservation Statuses
  'reserved-pending': {
    label: 'Δεσμευμένο Εκκρεμές',
    variant: 'warning',
    color: '#EA580C',
    backgroundColor: '#FFF7ED',
    icon: 'pause'
  },
  'contract-signed': {
    label: 'Συμβόλαιο Υπογεγραμμένο',
    variant: 'warning',
    color: '#C2410C',
    backgroundColor: '#FEF2F2',
    icon: 'fileSignature'
  },
  'deposit-paid': {
    label: 'Προκαταβολή Δεδομένη',
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'creditCard'
  },

  // 👑 Ownership Statuses
  'company-owned': {
    label: 'Εταιρικό',
    variant: 'purple',
    color: '#6B21A8',
    backgroundColor: '#FAF5FF',
    icon: 'building'
  },
  'not-for-sale': {
    label: 'Δεν Πωλείται',
    variant: 'purple',
    color: '#7C3AED',
    backgroundColor: '#F3E8FF',
    icon: 'shield'
  },
  'family-reserved': {
    label: 'Οικογενειακό',
    variant: 'purple',
    color: '#8B5CF6',
    backgroundColor: '#F5F3FF',
    icon: 'heart'
  },

  // ⚡ Market Dynamics
  'pre-launch': {
    label: 'Προ-εκκίνηση',
    variant: 'success',
    color: '#16A34A',
    backgroundColor: '#F0FDF4',
    icon: 'rocket'
  },
  'exclusive-listing': {
    label: 'Αποκλειστική Διάθεση',
    variant: 'success',
    color: '#15803D',
    backgroundColor: '#ECFDF5',
    icon: 'crown'
  },
  'price-reduced': {
    label: 'Μειωμένη Τιμή',
    variant: 'error',
    color: '#F59E0B',
    backgroundColor: '#FEF3C7',
    icon: 'trendingDown'
  },
  'urgent-sale': {
    label: 'Επείγουσα Πώληση',
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'alertTriangle'
  },

  // 🔧 Operational Statuses
  'under-renovation': {
    label: 'Υπό Ανακαίνιση',
    variant: 'secondary',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'wrench'
  },
  'legal-issues': {
    label: 'Νομικά Προβλήματα',
    variant: 'destructive',
    color: '#B91C1C',
    backgroundColor: '#FEE2E2',
    icon: 'gavel'
  },
  'inspection-required': {
    label: 'Απαιτείται Επιθεώρηση',
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'search'
  },
  'documentation-pending': {
    label: 'Εκκρεμή Έγγραφα',
    variant: 'outline',
    color: '#9CA3AF',
    backgroundColor: '#F9FAFB',
    icon: 'fileText'
  },

  // Βασικά από το παλιό σύστημα για πλήρη συμβατότητα
  'for-sale': {
    label: 'Προς Πώληση',
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'tag'
  },
  'for-rent': {
    label: 'Προς Ενοικίαση',
    variant: 'info',
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    icon: 'key'
  },
  rented: {
    label: 'Ενοικιασμένο',
    variant: 'purple',
    color: '#7C3AED',
    backgroundColor: '#F3E8FF',
    icon: 'handshake'
  },
  'under-negotiation': {
    label: 'Υπό Διαπραγμάτευση',
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'messageCircle'
  },
  'coming-soon': {
    label: 'Σύντομα Διαθέσιμο',
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'calendar'
  },
  landowner: {
    label: 'Ιδιοκτήτης Γης',
    variant: 'secondary',
    color: '#4B5563',
    backgroundColor: '#F3F4F6',
    icon: 'map'
  },
  'off-market': {
    label: 'Εκτός Αγοράς',
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'eyeOff'
  },
  unavailable: {
    label: 'Μη Διαθέσιμο',
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
    label: 'Διαθέσιμη',
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'home'
  },
  occupied: {
    label: 'Κατειλημμένη',
    variant: 'info',
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    icon: 'users'
  },
  sold: {
    label: 'Πωλήθηκε',
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'dollarSign'
  },
  maintenance: {
    label: 'Συντήρηση',
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'wrench'
  },
  reserved: {
    label: 'Κρατημένη',
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
    label: 'Χωρίς έργα',
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'alertTriangle'
  },
  empty: {
    label: 'Κενό',
    variant: 'outline',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    icon: 'circle'
  },
  warning: {
    label: 'Προειδοποίηση',
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'alertTriangle'
  },
  alert: {
    label: 'Προσοχή',
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'alert'
  },
  success: {
    label: 'Επιτυχία',
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'check'
  },
  info: {
    label: 'Πληροφορία',
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
    label: 'Νέο',
    variant: 'info',
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    icon: 'plus'
  },
  updated: {
    label: 'Ενημερωμένο',
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'refresh'
  },
  deleted: {
    label: 'Διαγραμμένο',
    variant: 'destructive',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    icon: 'trash'
  },
  company: {
    label: 'Εταιρεία',
    variant: 'secondary',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    icon: 'building'
  },
  primary: {
    label: 'Κύριο',
    variant: 'default',
    color: '#374151',
    backgroundColor: '#F3F4F6',
    icon: 'star'
  },
  secondary: {
    label: 'Δευτερεύον',
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
    label: 'Προσχέδιο',
    variant: 'warning',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    icon: 'edit'
  },
  completed: {
    label: 'Ολοκληρωμένο',
    variant: 'success',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    icon: 'check'
  },
  approved: {
    label: 'Εγκεκριμένο',
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

export const getObligationStatusColor = (status: ObligationStatus): string => {
  const config = OBLIGATION_STATUSES[status];
  if (!config) return 'bg-gray-100 text-gray-800 border-gray-200';

  // Generate Tailwind classes από τα centralized colors
  const isYellow = config.color === '#D97706';
  const isGreen = config.color === '#059669';
  const isBlue = config.color === '#3B82F6';

  if (isYellow) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (isGreen) return 'bg-green-100 text-green-800 border-green-200';
  if (isBlue) return brandClasses.primary.badge;

  return 'bg-gray-100 text-gray-800 border-gray-200';
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