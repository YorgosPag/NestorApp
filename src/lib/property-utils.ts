
import { Home, Building } from "lucide-react";
import { PROPERTY_STATUS_LABELS } from '@/constants/property-statuses-enterprise';
import { borderVariants } from '@/styles/design-tokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

/**
 * 🏢 ENTERPRISE PROPERTY STATUS CONFIGURATION με SEMANTIC COLORS
 *
 * Dynamic configuration function που χρησιμοποιεί semantic colors
 * Enterprise-grade με fallback support
 */
export const getPropertyStatusConfig = (colors?: ReturnType<typeof useSemanticColors>) => {
    if (!colors) {
        // Enterprise fallback για non-React contexts
        return {
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
        color: `bg-slate-50 text-slate-600 ${borderVariants.card.className}`,
    },
        } as const;
    }

    // 🎨 Semantic colors implementation
    return {
        'for-sale': {
            label: PROPERTY_STATUS_LABELS['for-sale'],
            color: `${colors.bg.successSubtle} ${colors.text.success} ${borderVariants.status.success.className}`,
        },
        'sold': {
            label: PROPERTY_STATUS_LABELS['sold'],
            color: `${colors.bg.errorSubtle} ${colors.text.error} ${borderVariants.status.error.className}`,
        },
        'for-rent': {
            label: PROPERTY_STATUS_LABELS['for-rent'],
            color: `${colors.bg.infoSubtle} ${colors.text.info} ${borderVariants.status.info.className}`,
        },
        'rented': {
            label: PROPERTY_STATUS_LABELS['rented'],
            color: `${colors.bg.warningSubtle} ${colors.text.warning} ${borderVariants.status.warning.className}`,
        },
        'reserved': {
            label: PROPERTY_STATUS_LABELS['reserved'],
            color: `${colors.bg.warningSubtle} ${colors.text.warning} ${borderVariants.status.warning.className}`,
        },
        default: {
            label: 'Άγνωστο',
            color: `${colors.bg.muted} ${colors.text.muted} ${borderVariants.card.className}`,
        },
    } as const;
};

// Legacy export για backward compatibility
export const PROPERTY_STATUS_CONFIG = getPropertyStatusConfig();

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
