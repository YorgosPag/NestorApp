/**
 * 🏷️ CENTRAL STATUS CONSTANTS
 *
 * Enterprise-class status definitions - Single Source of Truth
 * Όλες οι status definitions σε ένα κεντρικό αρχείο
 */

import type { BadgeSystemConfig } from '../types/BadgeTypes';

// ===== PROJECTS STATUS DEFINITIONS =====

export const PROJECT_STATUSES = {
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

// ===== BUILDINGS STATUS DEFINITIONS =====

export const BUILDING_STATUSES = {
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

// ===== CONTACTS STATUS DEFINITIONS =====

export const CONTACT_STATUSES = {
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
  }
} as const;

// ===== PROPERTY STATUS DEFINITIONS =====

export const PROPERTY_STATUSES = {
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
  }
} as const;

// ===== UNIT STATUS DEFINITIONS =====

export const UNIT_STATUSES = {
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

// ===== NAVIGATION STATUS DEFINITIONS =====

export const NAVIGATION_STATUSES = {
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

// ===== COMMON/SHARED STATUSES =====

export const COMMON_STATUSES = {
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
  }
} as const;

// ===== UNIFIED BADGE SYSTEM CONFIG =====

export const UNIFIED_BADGE_SYSTEM: BadgeSystemConfig = {
  domains: {
    PROJECT: PROJECT_STATUSES,
    BUILDING: BUILDING_STATUSES,
    CONTACT: CONTACT_STATUSES,
    PROPERTY: PROPERTY_STATUSES,
    UNIT: UNIT_STATUSES,
    NAVIGATION: NAVIGATION_STATUSES
  },
  common: COMMON_STATUSES
};