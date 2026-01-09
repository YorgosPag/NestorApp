
import { PROPERTY_STATUS_LABELS } from '@/constants/property-statuses-enterprise';
import { borderVariants } from '@/styles/design-tokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

// 🏢 ENTERPRISE: Centralized Icons
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const BuildingIcon = NAVIGATION_ENTITIES.building.icon;
const StorageIcon = NAVIGATION_ENTITIES.storage.icon;

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
        color: `${COLOR_BRIDGE.bg.success} ${COLOR_BRIDGE.text.success} ${borderVariants.status.success.className}`,  // ✅ SEMANTIC: green -> success
    },
    'for-rent': {
        label: PROPERTY_STATUS_LABELS['for-rent'],
        color: `${COLOR_BRIDGE.bg.info} ${COLOR_BRIDGE.text.info} ${borderVariants.status.info.className}`,          // ✅ SEMANTIC: blue -> info
    },
    'sold': {
        label: PROPERTY_STATUS_LABELS['sold'],
        color: `${COLOR_BRIDGE.bg.error} ${COLOR_BRIDGE.text.error} ${borderVariants.status.error.className}`,        // ✅ SEMANTIC: red -> error
    },
    'rented': {
        label: PROPERTY_STATUS_LABELS['rented'],
        color: `${COLOR_BRIDGE.bg.warning} ${COLOR_BRIDGE.text.warning} ${borderVariants.status.warning.className}`,  // ✅ SEMANTIC: yellow -> warning
    },
    'reserved': {
        label: PROPERTY_STATUS_LABELS['reserved'],
        color: `${COLOR_BRIDGE.bg.warning} ${COLOR_BRIDGE.text.warning} ${borderVariants.status.warning.className}`,  // ✅ SEMANTIC: orange -> warning
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

// 🏢 ENTERPRISE: Centralized Property Type Icons - ZERO HARDCODED VALUES
export const PROPERTY_TYPE_ICONS: { [key: string]: React.ElementType } = {
  'Στούντιο': UnitIcon,
  'Γκαρσονιέρα': UnitIcon,
  'Διαμέρισμα 2Δ': UnitIcon,
  'Διαμέρισμα 3Δ': UnitIcon,
  'Μεζονέτα': BuildingIcon,
  'Κατάστημα': BuildingIcon,
  'Αποθήκη': StorageIcon,
  'default': UnitIcon,
};
