// Κεντρικές σταθερές για τα statuses των ακινήτων
// Όλη η εφαρμογή πρέπει να χρησιμοποιεί αυτές τις σταθερές

export type PropertyStatus =
  | 'for-sale'
  | 'for-rent'
  | 'reserved'
  | 'sold'
  | 'landowner'
  | 'rented'           // 🔴 Ενοικιάστηκε (νέο για Phase 2.5)
  | 'under-negotiation' // 🟡 Υπό διαπραγμάτευση (νέο για Phase 2.5)
  | 'coming-soon'      // 🟣 Σύντομα διαθέσιμο (νέο για Phase 2.5)
  | 'off-market'       // ⚪ Εκτός αγοράς (νέο για Phase 2.5)
  | 'unavailable';     // ⚫ Μη διαθέσιμο (νέο για Phase 2.5)

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  'for-sale': 'Προς Πώληση',
  'for-rent': 'Προς Ενοικίαση',
  'reserved': 'Δεσμευμένο',
  'sold': 'Πουλημένο',
  'landowner': 'Οικοπεδούχου',
  // 🏠 Phase 2.5: Real Estate Innovation System - Enhanced Statuses
  'rented': 'Ενοικιάστηκε',
  'under-negotiation': 'Υπό Διαπραγμάτευση',
  'coming-soon': 'Σύντομα Διαθέσιμο',
  'off-market': 'Εκτός Αγοράς',
  'unavailable': 'Μη Διαθέσιμο',
};

// Semantic colors χρησιμοποιώντας CSS variables για theme consistency
export const PROPERTY_STATUS_COLORS: Record<PropertyStatus, string> = {
  'for-sale': 'hsl(var(--status-success))',     // 🟢 Πράσινο - διαθέσιμο
  'for-rent': 'hsl(var(--status-info))',       // 🔵 Μπλε - ενεργό
  'reserved': 'hsl(var(--status-warning))',    // 🟡 Πορτοκαλί - δεσμευμένο
  'sold': 'hsl(var(--status-error))',          // 🔴 Κόκκινο - πωλημένο
  'landowner': 'hsl(var(--status-purple))',    // 🟣 Μοβ - ειδική κατάσταση
  // 🏠 Phase 2.5: Real Estate Innovation System - Enhanced Colors
  'rented': 'hsl(var(--status-error-dark))',   // 🔴 Σκούρο κόκκινο - ενοικιάστηκε
  'under-negotiation': 'hsl(var(--status-warning-light))', // 🟡 Ανοιχτό πορτοκαλί
  'coming-soon': 'hsl(var(--status-purple-light))',        // 🟣 Ανοιχτό μοβ
  'off-market': 'hsl(var(--neutral-400))',     // ⚪ Γκρι - εκτός αγοράς
  'unavailable': 'hsl(var(--neutral-500))',    // ⚫ Σκούρο γκρι - μη διαθέσιμο
};

// Default status
export const DEFAULT_PROPERTY_STATUS: PropertyStatus = 'for-sale';

// Utility function to get status label
export function getStatusLabel(status: PropertyStatus): string {
  return PROPERTY_STATUS_LABELS[status];
}

// Utility function to get status color (returns CSS variable)
export function getStatusColor(status: PropertyStatus): string {
  return PROPERTY_STATUS_COLORS[status];
}

// Utility function to get Tailwind classes για status colors
export function getStatusClasses(status: PropertyStatus): {
  text: string;
  bg: string;
  border: string;
} {
  const statusColorMap: Record<PropertyStatus, string> = {
    'for-sale': 'status-success',
    'for-rent': 'status-info',
    'reserved': 'status-warning',
    'sold': 'status-error',
    'landowner': 'status-purple',
    // 🏠 Phase 2.5: Real Estate Innovation System - Enhanced Tailwind Classes
    'rented': 'status-error-dark',
    'under-negotiation': 'status-warning-light',
    'coming-soon': 'status-purple-light',
    'off-market': 'neutral-400',
    'unavailable': 'neutral-500',
  };

  const colorVar = statusColorMap[status];
  
  return {
    text: `text-[hsl(var(--${colorVar}))]`,
    bg: `bg-[hsl(var(--${colorVar}))]`,
    border: `border-[hsl(var(--${colorVar}))]`,
  };
}

// ============================================================================
// 🎯 OVERLAY & REGION SPECIFIC STATUSES (DXF-Viewer)
// ============================================================================

// Extended type for overlay regions (includes drawing states + property statuses)
export type RegionStatus = PropertyStatus | 'draft' | 'active' | 'locked' | 'hidden';

// Labels για τα ειδικά overlay statuses (σε ελληνικά για συνοχή με UI)
export const REGION_STATUS_LABELS: Record<RegionStatus, string> = {
  // Property statuses (κεντρικοποιημένα)
  'for-sale': PROPERTY_STATUS_LABELS['for-sale'],
  'for-rent': PROPERTY_STATUS_LABELS['for-rent'],
  'reserved': PROPERTY_STATUS_LABELS['reserved'],
  'sold': PROPERTY_STATUS_LABELS['sold'],
  'landowner': PROPERTY_STATUS_LABELS['landowner'],
  'rented': PROPERTY_STATUS_LABELS['rented'],
  'under-negotiation': PROPERTY_STATUS_LABELS['under-negotiation'],
  'coming-soon': PROPERTY_STATUS_LABELS['coming-soon'],
  'off-market': PROPERTY_STATUS_LABELS['off-market'],
  'unavailable': PROPERTY_STATUS_LABELS['unavailable'],

  // Overlay-specific drawing/editing states
  'draft': 'Προσχέδιο',
  'active': 'Ενεργό',
  'locked': 'Κλειδωμένο',
  'hidden': 'Κρυφό',
};

// Colors για overlay statuses (χρησιμοποιεί τα property colors + ειδικά για drawing states)
export const REGION_STATUS_COLORS: Record<RegionStatus, string> = {
  // Property colors (κεντρικοποιημένα)
  'for-sale': PROPERTY_STATUS_COLORS['for-sale'],
  'for-rent': PROPERTY_STATUS_COLORS['for-rent'],
  'reserved': PROPERTY_STATUS_COLORS['reserved'],
  'sold': PROPERTY_STATUS_COLORS['sold'],
  'landowner': PROPERTY_STATUS_COLORS['landowner'],
  'rented': PROPERTY_STATUS_COLORS['rented'],
  'under-negotiation': PROPERTY_STATUS_COLORS['under-negotiation'],
  'coming-soon': PROPERTY_STATUS_COLORS['coming-soon'],
  'off-market': PROPERTY_STATUS_COLORS['off-market'],
  'unavailable': PROPERTY_STATUS_COLORS['unavailable'],

  // Overlay-specific colors για drawing/editing states
  'draft': 'hsl(var(--neutral-500))',     // ⚪ Γκρι - προσωρινό
  'active': 'hsl(var(--accent))',         // 🟦 Accent - ενεργό για επεξεργασία
  'locked': 'hsl(var(--destructive))',    // 🔴 Κόκκινο - κλειδωμένο
  'hidden': 'hsl(var(--muted))',          // 🟤 Muted - κρυφό
};

// Utility functions για region statuses
export function getRegionLabel(status: RegionStatus): string {
  return REGION_STATUS_LABELS[status];
}

export function getRegionColor(status: RegionStatus): string {
  return REGION_STATUS_COLORS[status];
}

export function getAllRegionStatuses(): RegionStatus[] {
  return Object.keys(REGION_STATUS_LABELS) as RegionStatus[];
}

// Utility function to get all property statuses as array
export function getAllStatuses(): PropertyStatus[] {
  return Object.keys(PROPERTY_STATUS_LABELS) as PropertyStatus[];
}