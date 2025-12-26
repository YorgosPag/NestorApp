
import { Home, Building } from "lucide-react";
import { PROPERTY_STATUS_LABELS } from '@/constants/property-statuses-enterprise';
import { borderVariants } from '@/styles/design-tokens';

/**
 * 🏢 ENTERPRISE PROPERTY STATUS CONFIGURATION
 *
 * Κεντρικοποιημένη διαμόρφωση property status με semantic colors
 * Χρησιμοποιεί enterprise design tokens χωρίς React hooks
 */
export const PROPERTY_STATUS_CONFIG = {
    'for-sale': {
        label: PROPERTY_STATUS_LABELS['for-sale'],
        color: `bg-green-50 text-green-800 ${borderVariants.status.success.className}`,
    },
    'for-rent': {
        label: PROPERTY_STATUS_LABELS['for-rent'],
        color: `bg-blue-50 text-blue-800 ${borderVariants.status.info.className}`,
    },
    'sold': {
        label: PROPERTY_STATUS_LABELS['sold'],
        color: `bg-red-50 text-red-800 ${borderVariants.status.error.className}`,
    },
    'rented': {
        label: PROPERTY_STATUS_LABELS['rented'],
        color: `bg-yellow-50 text-yellow-800 ${borderVariants.status.warning.className}`,
    },
    'reserved': {
        label: PROPERTY_STATUS_LABELS['reserved'],
        color: `bg-orange-50 text-orange-800 ${borderVariants.status.warning.className}`,
    },
    default: {
        label: 'Άγνωστο',
        color: `bg-gray-50 text-gray-600 ${borderVariants.card.className}`,
    },
} as const;

export const PROPERTY_TYPE_ICONS: { [key: string]: React.ElementType } = {
  'Στούντιο': Home,
  'Γκαρσονιέρα': Home,
  'Διαμέρισμα 2Δ': Home,
  'Διαμέρισμα 3Δ': Home,
  'Μεζονέτα': Building,
  'Κατάστημα': Building,
  'Αποθήκη': Building,
  'default': Home,
};
