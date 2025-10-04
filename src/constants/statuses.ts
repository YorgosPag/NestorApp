// Κεντρικές σταθερές για τα statuses των ακινήτων
// Όλη η εφαρμογή πρέπει να χρησιμοποιεί αυτές τις σταθερές

export type PropertyStatus = 'for-sale' | 'for-rent' | 'reserved' | 'sold' | 'landowner';

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  'for-sale': 'Προς Πώληση',
  'for-rent': 'Προς Ενοικίαση', 
  'reserved': 'Δεσμευμένο',
  'sold': 'Πουλημένο',
  'landowner': 'Οικοπεδούχου',
};

// Semantic colors χρησιμοποιώντας CSS variables για theme consistency
export const PROPERTY_STATUS_COLORS: Record<PropertyStatus, string> = {
  'for-sale': 'hsl(var(--status-success))',     // Πράσινο - διαθέσιμο
  'for-rent': 'hsl(var(--status-info))',       // Μπλε - ενεργό
  'reserved': 'hsl(var(--status-warning))',    // Πορτοκαλί - δεσμευμένο
  'sold': 'hsl(var(--status-error))',          // Κόκκινο - πωλημένο
  'landowner': 'hsl(var(--status-purple))',    // Μοβ - ειδική κατάσταση
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