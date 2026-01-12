/**
 * CENTRALIZED AUTO SAVE STATUS STYLES
 * Enterprise AutoSave Status Component - Centralized Styling Module
 *
 * Companion styling module για CentralizedAutoSaveStatus.tsx
 * ✅ ENTERPRISE REFACTORED: ZERO INLINE STYLES - SINGLE SOURCE OF TRUTH
 *
 * @module src/subapps/dxf-viewer/ui/components/CentralizedAutoSaveStatus.styles
 */

import { statusIndicatorComponents, autoSaveStatusTokens } from '@/styles/design-tokens';
import { UI_COLORS } from '../../config/color-config';

// ============================================================================
// DYNAMIC STYLE UTILITIES
// ============================================================================

/**
 * Get status color styles based on current status
 */
export const getStatusColorStyles = (
  isAutoSaving: boolean,
  saveStatus?: string
) => {
  if (isAutoSaving) {
    return statusIndicatorComponents.statusColors.saving;
  }

  switch (saveStatus) {
    case 'saved':
      return statusIndicatorComponents.statusColors.success;
    case 'error':
      return statusIndicatorComponents.statusColors.error;
    default:
      return statusIndicatorComponents.statusColors.idle;
  }
};

/**
 * Get settings dot style based on active state
 */
export const getSettingsDotStyle = (
  isActive: boolean,
  type: 'general' | 'specific' = 'general'
) => {
  const baseStyle = {
    width: '0.5rem',
    height: '0.5rem',
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background-color 150ms ease'
  };
  const activeColor = type === 'general' ? UI_COLORS.STATUS_GENERAL_ACTIVE : UI_COLORS.STATUS_SPECIFIC_ACTIVE;
  const inactiveColor = UI_COLORS.STATUS_INACTIVE;

  return {
    ...baseStyle,
    backgroundColor: isActive ? activeColor : inactiveColor
  };
};

/**
 * Get general settings dot style (blue)
 */
export const getGeneralSettingsDotStyle = (isActive: boolean) => ({
  width: '0.5rem',
  height: '0.5rem',
  borderRadius: '50%',
  flexShrink: 0,
  transition: 'background-color 150ms ease',
  backgroundColor: isActive ? UI_COLORS.STATUS_GENERAL_ACTIVE : UI_COLORS.STATUS_INACTIVE
});

/**
 * Get specific settings dot style (green)
 */
export const getSpecificSettingsDotStyle = (isActive: boolean) => ({
  width: '0.5rem',
  height: '0.5rem',
  borderRadius: '50%',
  flexShrink: 0,
  transition: 'background-color 150ms ease',
  backgroundColor: isActive ? UI_COLORS.STATUS_SPECIFIC_ACTIVE : UI_COLORS.STATUS_INACTIVE
});

/**
 * Get separator style
 */
export const getSeparatorStyle = () => ({
  width: '1px',
  height: '1rem',
  backgroundColor: UI_COLORS.STATUS_INACTIVE,
  opacity: 0.7
});

/**
 * Get compact status indicator style
 */
export const getCompactStatusStyle = (
  isAutoSaving: boolean,
  saveStatus?: string
) => {
  if (isAutoSaving) {
    return statusIndicatorComponents.statusColors.saving;
  }

  switch (saveStatus) {
    case 'error':
      return statusIndicatorComponents.statusColors.error;
    default:
      return statusIndicatorComponents.statusColors.success;
  }
};

// ============================================================================
// SEMANTIC HTML UTILITIES
// ============================================================================

/**
 * Get semantic props for status container
 */
export const getStatusContainerProps = () => ({
  role: 'status',
  'aria-live': 'polite' as const,
  'aria-label': 'AutoSave Status'
});

/**
 * Get semantic props for settings indicators
 */
export const getSettingsIndicatorProps = (type: 'general' | 'specific') => ({
  role: 'group',
  'aria-label': type === 'general' ? 'Γενικές Ρυθμίσεις' : 'Ειδικές Ρυθμίσεις'
});

/**
 * Get semantic props for individual setting dot
 */
export const getSettingDotProps = (
  isActive: boolean,
  label: string
) => ({
  role: 'img',
  'aria-label': `${label}: ${isActive ? 'Ενεργό' : 'Ανενεργό'}`,
  title: label
});

// ============================================================================
// COMPONENT STYLES COLLECTION
// ============================================================================

export const centralizedAutoSaveStatusStyles = {
  // Main container
  container: statusIndicatorComponents.container,

  // Compact container
  compactContainer: statusIndicatorComponents.container,

  // Status messages
  statusMessage: {
    primary: statusIndicatorComponents.text.primary,
    secondary: statusIndicatorComponents.text.secondary
  },

  // Settings indicators (fallback to basic styles)
  settingsDots: {
    container: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
    general: { dot: { base: statusIndicatorComponents.statusDot, active: { backgroundColor: UI_COLORS.STATUS_GENERAL_ACTIVE }, inactive: { backgroundColor: UI_COLORS.STATUS_INACTIVE } } },
    specific: { dot: { base: statusIndicatorComponents.statusDot, active: { backgroundColor: UI_COLORS.STATUS_SPECIFIC_ACTIVE }, inactive: { backgroundColor: UI_COLORS.STATUS_INACTIVE } } }
  },

  // Separator
  separator: statusIndicatorComponents.separator,

  // Status icons (fallback to statusDot)
  statusIcon: statusIndicatorComponents.statusDot,

  // Compact variants (fallback to statusColors)
  compact: {
    saving: statusIndicatorComponents.statusColors.saving,
    error: statusIndicatorComponents.statusColors.error,
    success: statusIndicatorComponents.statusColors.success
  }
} as const;

// ============================================================================
// TOOLTIP UTILITIES
// ============================================================================

/**
 * Generate tooltip text for compact status
 */
export const getCompactTooltipText = (
  isAutoSaving: boolean,
  saveStatus?: string,
  activeSystems: string[] = []
) => {
  if (isAutoSaving) {
    return 'Αποθήκευση όλων των ρυθμίσεων DXF...';
  }

  if (saveStatus === 'error') {
    return 'Σφάλμα αποθήκευσης ρυθμίσεων';
  }

  const systemsList = activeSystems.length > 0
    ? activeSystems.join(', ')
    : 'Γραμμές, Κείμενο, Grips, Κέρσορας, Grid, Χάρακες';

  return `Αυτόματη αποθήκευση ενεργή για: ${systemsList}`;
};

/**
 * Format last save time in Greek locale
 */
export const formatLastSaveTime = (date?: Date | null): string => {
  if (!date) return 'Ποτέ';

  return date.toLocaleTimeString('el-GR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// ============================================================================
// SETTINGS MAPPING UTILITIES
// ============================================================================

// 🏢 ENTERPRISE: Type-safe settings interfaces
interface GeneralSettingsFlags {
  line?: boolean;
  text?: boolean;
  grip?: boolean;
  cursor?: boolean;
  grid?: boolean;
  ruler?: boolean;
}

interface SpecificSettingsFlags extends GeneralSettingsFlags {
  specific?: {
    line?: {
      draft?: boolean;
      hover?: boolean;
      selection?: boolean;
      completion?: boolean;
    };
    text?: {
      draft?: boolean;
    };
  };
}

interface SettingsConfigItem {
  key: string;
  isActive: boolean | undefined;
  label: string;
}

/**
 * Map general settings to display configuration
 */
export const getGeneralSettingsConfig = (settings: GeneralSettingsFlags): SettingsConfigItem[] => [
  { key: 'line', isActive: settings.line, label: 'Γραμμές (Γενικά)' },
  { key: 'text', isActive: settings.text, label: 'Κείμενο (Γενικά)' },
  { key: 'grip', isActive: settings.grip, label: 'Grips (Γενικά)' },
  { key: 'cursor', isActive: settings.cursor, label: 'Κέρσορας' },
  { key: 'grid', isActive: settings.grid, label: 'Grid' },
  { key: 'ruler', isActive: settings.ruler, label: 'Χάρακες' }
];

/**
 * Map specific settings to display configuration
 */
export const getSpecificSettingsConfig = (settings: SpecificSettingsFlags): SettingsConfigItem[] => [
  { key: 'line.draft', isActive: settings.specific?.line?.draft, label: 'Line Draft (Προσχεδίαση)' },
  { key: 'line.hover', isActive: settings.specific?.line?.hover, label: 'Line Hover' },
  { key: 'line.selection', isActive: settings.specific?.line?.selection, label: 'Line Selection (Επιλογή)' },
  { key: 'line.completion', isActive: settings.specific?.line?.completion, label: 'Line Completion (Ολοκλήρωση)' },
  { key: 'text.draft', isActive: settings.specific?.text?.draft, label: 'Text Preview' }
];

/**
 * ✅ ENTERPRISE STYLING MODULE COMPLETE
 *
 * Features:
 * 1. ✅ Centralized styles από statusIndicatorComponents design tokens
 * 2. ✅ Dynamic style utilities για status και settings dots
 * 3. ✅ Semantic HTML utilities για accessibility compliance
 * 4. ✅ Tooltip generation utilities
 * 5. ✅ Settings mapping utilities για cleaner component code
 * 6. ✅ TypeScript strict typing για all functions
 * 7. ✅ Consistent color scheme (Blue για general, Green για specific)
 * 8. ✅ WCAG accessibility attributes
 *
 * Result: Professional styling module για Fortune 500 status indicator standards
 */