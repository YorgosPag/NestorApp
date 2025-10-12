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

// Utility function to get all statuses as array
export function getAllStatuses(): PropertyStatus[] {
  return Object.keys(PROPERTY_STATUS_LABELS) as PropertyStatus[];
}