/**
 * 🏢 DXF VIEWER PANEL DESIGN TOKENS - ENTERPRISE ARCHITECTURE
 *
 * @description Κεντρικοποιημένα design tokens για όλα τα Panel UI components
 * του DXF Viewer. Αντικαθιστά hardcoded inline styles σε PanelTabs, LevelPanel,
 * DxfSettingsPanel και άλλα components.
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2025-12-18
 * @version 1.0.0 - Enterprise Panel Tokens System
 *
 * 🎯 ELIMINATES HARDCODED VALUES:
 * - 'bg-gray-800' → PANEL_TOKENS.BACKGROUND.PRIMARY
 * - 'text-white' → PANEL_TOKENS.TEXT.PRIMARY
 * - 'border-gray-600' → PANEL_TOKENS.BORDER.PRIMARY
 * - 'bg-blue-600' → PANEL_TOKENS.TAB.ACTIVE.BACKGROUND
 *
 * 🏗️ INTEGRATES WITH EXISTING SYSTEMS:
 * - INTERACTIVE_PATTERNS from @/components/ui/effects
 * - Base design tokens from src/styles/design-tokens/
 * - Color config from ./color-config.ts
 */

// ============================================================================
// IMPORTS - ENTERPRISE INTEGRATION
// ============================================================================

// Import existing centralized systems για consistency
import { INTERACTIVE_PATTERNS, HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS, HOVER_BORDER_EFFECTS, TRANSITION_PRESETS } from '../../../components/ui/effects';

// ============================================================================
// PANEL COLOR SYSTEM - SINGLE SOURCE OF TRUTH
// ============================================================================

/**
 * 🎨 PANEL COLOR CONSTANTS
 * Centralized color definitions που χρησιμοποιούνται σε όλα τα panel components
 */
export const PANEL_COLORS = {
  // Primary panel backgrounds
  BG_PRIMARY: '#1f2937',        // bg-gray-800 - Main panel background
  BG_SECONDARY: '#374151',      // bg-gray-700 - Secondary backgrounds, cards
  BG_TERTIARY: '#4b5563',       // bg-gray-600 - Hover states, inputs

  // Text colors
  TEXT_PRIMARY: '#ffffff',      // text-white - Primary text
  TEXT_SECONDARY: '#d1d5db',    // text-gray-300 - Secondary text
  TEXT_MUTED: '#9ca3af',        // text-gray-400 - Muted text, placeholders
  TEXT_DISABLED: '#6b7280',     // text-gray-500 - Disabled states

  // Border colors
  BORDER_PRIMARY: '#4b5563',    // border-gray-600 - Primary borders
  BORDER_SECONDARY: '#6b7280',  // border-gray-500 - Secondary borders
  BORDER_MUTED: '#374151',      // border-gray-700 - Subtle borders

  // Interactive states
  ACTIVE_BG: '#2563eb',         // bg-blue-600 - Active tab background
  ACTIVE_BORDER: '#3b82f6',     // border-blue-500 - Active borders
  ACTIVE_TEXT: '#ffffff',       // text-white - Active text

  // Success states
  SUCCESS_BG: '#059669',        // bg-green-600 - Success buttons
  SUCCESS_HOVER: '#047857',     // hover:bg-green-700 - Success hover

  // Danger states
  DANGER_TEXT: '#ef4444',       // text-red-400 - Danger text
  DANGER_HOVER: '#dc2626',      // hover:text-red-500 - Danger hover

  // Focus states
  FOCUS_RING: '#3b82f6',        // focus:border-blue-500 - Focus ring color
} as const;

// ============================================================================
// DXF VIEWER BACKGROUND SYSTEM - ENTERPRISE CENTRALIZATION
// ============================================================================

/**
 * 🏗️ DXF VIEWER BACKGROUND TOKENS
 * Κεντρικοποιημένα background colors που αντικαθιστούν hardcoded bg-gray-* values
 * στα main layout components του DXF Viewer
 */
export const DXF_VIEWER_BACKGROUNDS = {
  // Main layout backgrounds
  MAIN_CONTAINER: PANEL_COLORS.BG_PRIMARY,     // Replaces bg-gray-800 in DxfViewerContent.tsx
  VIEW_CONTAINER: '#111827',                   // Replaces bg-gray-900 in NormalView.tsx (darker main area)
  CANVAS_BACKGROUND: '#f9fafb',                // Light canvas background for better contrast

  // Layout utility classes
  MAIN_CONTAINER_CLASS: 'bg-gray-800',         // For Tailwind compilation
  VIEW_CONTAINER_CLASS: 'bg-gray-900',         // For Tailwind compilation
  CANVAS_BACKGROUND_CLASS: 'bg-gray-50',       // For Tailwind compilation
} as const;

// ============================================================================
// PANEL LAYOUT TOKENS - ENTERPRISE SPACING SYSTEM
// ============================================================================

/**
 * 📏 PANEL LAYOUT CONSTANTS
 * Consistent spacing, sizing και layout tokens για όλα τα panels
 */
export const PANEL_LAYOUT = {
  // Panel containers
  CONTAINER: {
    PADDING: 'px-1 py-2',              // Standard panel padding
    INNER_PADDING: 'p-3',              // Inner content padding
    SECTION_SPACING: 'space-y-4',      // Vertical section spacing
    BORDER_RADIUS: 'rounded-lg',       // Standard border radius
  },

  // Input elements
  INPUT: {
    HEIGHT: 'h-8',                     // Standard input height
    PADDING: 'px-3 py-2',              // Input padding
    BORDER_RADIUS: 'rounded',          // Input border radius
    TEXT_SIZE: 'text-sm',              // Input text size
    FULL_WIDTH: 'w-full',              // Full width inputs
    FOCUS: 'focus:outline-none',       // Focus behavior
  },

  // Button elements
  BUTTON: {
    HEIGHT: 'h-8',                     // Standard button height
    PADDING: 'px-3 py-2',              // Button padding
    BORDER_RADIUS: 'rounded',          // Button border radius
    TEXT_SIZE: 'text-sm',              // Button text size
    ICON_SIZE: 'w-4 h-4',              // Button icon size
  },

  // Tab elements
  TAB: {
    PADDING: 'px-3 py-2',              // Tab padding
    TEXT_SIZE: 'text-sm',              // Tab text size
    FONT_WEIGHT: 'font-medium',        // Tab font weight
    BORDER_RADIUS: 'rounded-md',       // Tab border radius
    CONTAINER: 'p-2 space-y-2',        // Tab container
    FLEX: 'flex space-x-1',            // Tab flex layout
    FULL_WIDTH: 'flex-1',              // Tab full width
    TRANSITIONS: 'transition-colors',   // Tab transitions
  },

  // Icon elements
  ICON: {
    SMALL: 'w-3 h-3',                  // Small icons (clear buttons)
    REGULAR: 'w-4 h-4',                // Regular icons (buttons, tabs)
    LARGE: 'w-5 h-5',                  // Large icons (headers)
    LOADING: 'w-4 h-4',                // Loading spinner size
  },

  // Loading states
  LOADING: {
    SPINNER: 'border-2 border-white border-t-transparent rounded-full animate-spin',
    SIZE: 'w-4 h-4',
  },
} as const;

// ============================================================================
// COMPONENT-SPECIFIC TOKEN GROUPS
// ============================================================================

/**
 * 🏗️ PANEL TABS TOKENS
 * Specific tokens για το PanelTabs component
 */
export const PANEL_TABS_TOKENS = {
  CONTAINER: {
    BASE: `${PANEL_LAYOUT.TAB.CONTAINER} ${PANEL_COLORS.BG_PRIMARY}`,
    BORDER: `border-b ${PANEL_COLORS.BORDER_SECONDARY}`,
  },

  TAB_ROW: {
    BASE: PANEL_LAYOUT.TAB.FLEX,
  },

  TAB_BUTTON: {
    BASE: [
      'flex items-center justify-center space-x-1',
      PANEL_LAYOUT.TAB.PADDING,
      PANEL_LAYOUT.TAB.TEXT_SIZE,
      PANEL_LAYOUT.TAB.FONT_WEIGHT,
      PANEL_LAYOUT.TAB.TRANSITIONS,
      'cursor-pointer',
      PANEL_LAYOUT.TAB.FULL_WIDTH,
      PANEL_LAYOUT.TAB.BORDER_RADIUS,
    ].join(' '),

    ACTIVE: `${PANEL_COLORS.ACTIVE_TEXT} ${PANEL_COLORS.ACTIVE_BG} border border-${PANEL_COLORS.ACTIVE_BORDER}`,
    INACTIVE: `${PANEL_COLORS.TEXT_SECONDARY} border ${PANEL_COLORS.BORDER_SECONDARY} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`,
    DISABLED: `${PANEL_COLORS.TEXT_DISABLED} cursor-not-allowed ${PANEL_COLORS.BG_PRIMARY}`,
  },

  TAB_ICON: {
    SIZE: PANEL_LAYOUT.ICON.LARGE,
  },

  TAB_LABEL: {
    SIZE: 'text-xs',
  },
} as const;

/**
 * 🎯 LEVEL PANEL TOKENS
 * Specific tokens για το LevelPanel component
 */
export const LEVEL_PANEL_TOKENS = {
  CONTAINER: {
    BASE: 'h-full flex flex-col',
    SECTION: PANEL_LAYOUT.CONTAINER.SECTION_SPACING,
    PADDING: PANEL_LAYOUT.CONTAINER.PADDING,
  },

  HEADER: {
    TEXT: `text-lg font-semibold ${PANEL_COLORS.TEXT_PRIMARY} flex items-center gap-2`,
    ICON: PANEL_LAYOUT.ICON.LARGE,
  },

  LEVEL_CARD: {
    BASE: `${PANEL_LAYOUT.CONTAINER.INNER_PADDING} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} border transition-all`,
    ACTIVE: `${PANEL_COLORS.ACTIVE_BG} border-${PANEL_COLORS.ACTIVE_BORDER} ${PANEL_COLORS.ACTIVE_TEXT}`,
    INACTIVE: `${PANEL_COLORS.BG_SECONDARY} border-${PANEL_COLORS.BORDER_PRIMARY} ${PANEL_COLORS.TEXT_SECONDARY} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`,
  },

  LEVEL_INPUT: {
    BASE: [
      PANEL_LAYOUT.INPUT.FULL_WIDTH,
      `${PANEL_COLORS.BG_PRIMARY} border border-${PANEL_COLORS.BORDER_SECONDARY}`,
      PANEL_LAYOUT.INPUT.BORDER_RADIUS,
      PANEL_LAYOUT.INPUT.PADDING,
      `${PANEL_COLORS.TEXT_PRIMARY} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`,
      'autoFocus',
    ].join(' '),
  },

  ADD_SECTION: {
    CONTAINER: `${PANEL_LAYOUT.CONTAINER.SECTION_SPACING} pt-4 border-t ${PANEL_COLORS.BORDER_MUTED}`,
    FORM: 'flex gap-2',
  },

  ADD_INPUT: {
    BASE: [
      'flex-1',
      PANEL_LAYOUT.INPUT.PADDING,
      `${PANEL_COLORS.BG_SECONDARY} border ${PANEL_COLORS.BORDER_PRIMARY}`,
      PANEL_LAYOUT.INPUT.BORDER_RADIUS,
      `${PANEL_COLORS.TEXT_PRIMARY} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`,
      `placeholder-${PANEL_COLORS.TEXT_MUTED}`,
      `focus:border-${PANEL_COLORS.FOCUS_RING}`,
      PANEL_LAYOUT.INPUT.FOCUS,
      'disabled:opacity-50',
    ].join(' '),
  },

  ADD_BUTTON: {
    BASE: [
      PANEL_LAYOUT.BUTTON.PADDING,
      `${PANEL_COLORS.SUCCESS_BG} disabled:opacity-50`,
      PANEL_COLORS.TEXT_PRIMARY,
      PANEL_LAYOUT.BUTTON.BORDER_RADIUS,
      'flex items-center gap-1',
      INTERACTIVE_PATTERNS.SUCCESS_HOVER,
      TRANSITION_PRESETS.STANDARD_COLORS,
    ].join(' '),

    LOADING_SPINNER: PANEL_LAYOUT.LOADING.SPINNER,
  },

  ACTION_BUTTON: {
    EDIT: [
      'p-1',
      PANEL_COLORS.TEXT_MUTED,
      PANEL_LAYOUT.BUTTON.BORDER_RADIUS,
      HOVER_TEXT_EFFECTS.GRAY,
      INTERACTIVE_PATTERNS.SUBTLE_HOVER,
      TRANSITION_PRESETS.STANDARD_COLORS,
    ].join(' '),

    DELETE: [
      'p-1',
      PANEL_COLORS.DANGER_TEXT,
      PANEL_LAYOUT.BUTTON.BORDER_RADIUS,
      HOVER_TEXT_EFFECTS.RED,
      INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER,
      TRANSITION_PRESETS.STANDARD_COLORS,
    ].join(' '),
  },

  EMPTY_STATE: {
    CONTAINER: `text-center py-8 ${PANEL_COLORS.TEXT_MUTED}`,
    ICON: 'w-12 h-12 mx-auto mb-3 opacity-50',
  },

  SECTIONS_BORDER: `mt-4 pt-4 border-t ${PANEL_COLORS.BORDER_MUTED}`,

  OVERLAY_SECTION: `mt-4 pt-4 border-t ${PANEL_COLORS.BORDER_MUTED} flex-1 min-h-0`,
} as const;

/**
 * ⚙️ DXF SETTINGS PANEL TOKENS
 * Specific tokens για το DxfSettingsPanel component
 */
export const DXF_SETTINGS_TOKENS = {
  CONTAINER: {
    BASE: `${PANEL_COLORS.BG_PRIMARY} ${PANEL_COLORS.TEXT_PRIMARY}`,
  },

  TAB_NAVIGATION: {
    CONTAINER: `border-b ${PANEL_COLORS.BORDER_PRIMARY} mb-4`,
    NAV: 'flex gap-1 p-2',
  },

  TAB_BUTTON: {
    BASE: [
      PANEL_LAYOUT.BUTTON.PADDING,
      PANEL_LAYOUT.BUTTON.TEXT_SIZE,
      PANEL_LAYOUT.TAB.FONT_WEIGHT,
      PANEL_LAYOUT.TAB.BORDER_RADIUS,
      PANEL_LAYOUT.TAB.TRANSITIONS,
    ].join(' '),

    ACTIVE: `${PANEL_COLORS.ACTIVE_BG} ${PANEL_COLORS.ACTIVE_TEXT}`,
    INACTIVE: [
      PANEL_COLORS.TEXT_MUTED,
      HOVER_TEXT_EFFECTS.GRAY,
      HOVER_BACKGROUND_EFFECTS.GRAY_DARK,
    ].join(' '),
  },

  CONTENT: {
    GENERAL: 'min-h-[850px] max-h-[96vh] overflow-y-auto',
    SPECIFIC: '', // No special styling needed
  },
} as const;

/**
 * 🔧 SPECIFIC SETTINGS PANEL TOKENS
 * Specific tokens για το SpecificSettingsPanel component (Phase 2.1)
 */
export const SPECIFIC_SETTINGS_TOKENS = {
  CATEGORY_BUTTON: {
    BASE: 'h-8 w-8 p-0 rounded-md border transition-colors duration-150 flex items-center justify-center relative',
    ACTIVE: `${PANEL_COLORS.ACTIVE_BG} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${PANEL_COLORS.ACTIVE_TEXT} border-${PANEL_COLORS.ACTIVE_BORDER}`,
    COMING_SOON: `${PANEL_COLORS.BG_SECONDARY} ${PANEL_COLORS.TEXT_DISABLED} ${PANEL_COLORS.BORDER_PRIMARY} cursor-not-allowed opacity-50`,
    INACTIVE: `${PANEL_COLORS.BG_SECONDARY} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${PANEL_COLORS.TEXT_SECONDARY} ${PANEL_COLORS.BORDER_PRIMARY} ${HOVER_BORDER_EFFECTS.GRAY}`,
  },

  COMING_SOON_BADGE: {
    BASE: 'absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full text-[8px] flex items-center justify-center text-white font-bold',
  },

  FALLBACK_CONTENT: {
    BASE: `px-4 py-8 text-center ${PANEL_COLORS.TEXT_MUTED}`,
  },
} as const;

/**
 * 🔧 GENERAL SETTINGS PANEL TOKENS
 * Specific tokens για το GeneralSettingsPanel component (Phase 2.2)
 */
export const GENERAL_SETTINGS_TOKENS = {
  FALLBACK_CONTENT: {
    BASE: `px-4 py-8 text-center ${PANEL_COLORS.TEXT_MUTED}`,
  },

  TAB_NAVIGATION: {
    CONTAINER: `border-b ${PANEL_COLORS.BORDER_PRIMARY} mb-4`,
  },

  LOADING_STATE: {
    BASE: `px-4 py-8 text-center ${PANEL_COLORS.TEXT_MUTED}`,
  },
} as const;

/**
 * ⚙️ OVERLAY PANEL TOKENS
 * Specific tokens για το OverlayPanel component (Phase 2.3)
 */
export const OVERLAY_PANEL_TOKENS = {
  INFO_SECTION: {
    BASE: `${PANEL_COLORS.BG_SECONDARY} rounded p-3 space-y-1`,
  },
} as const;

/**
 * 🔗 MERGE PANEL TOKENS
 * Specific tokens για το MergePanel component (Phase 2.4)
 */
export const MERGE_PANEL_TOKENS = {
  CONTAINER: {
    BASE: 'bg-blue-900 bg-opacity-20 border border-blue-400 rounded-lg p-3 mb-3 space-y-2',
  },

  TITLE: {
    BASE: 'text-sm font-medium text-blue-200 mb-2',
  },

  SECTION_TEXT: {
    BASE: 'text-xs text-blue-200',
  },

  ACTION_BUTTON: {
    BASE: `flex items-center gap-1 px-2 py-1 bg-blue-600 ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} text-white rounded text-xs`,
  },

  FOOTER_TEXT: {
    BASE: 'text-xs text-blue-300 opacity-75',
  },
} as const;

// ============================================================================
// UNIFIED EXPORT - ENTERPRISE API
// ============================================================================

/**
 * 🏢 PANEL TOKENS - UNIFIED EXPORT
 * Single export object που περιέχει όλα τα panel design tokens
 */
export const PANEL_TOKENS = {
  // Core token groups
  COLORS: PANEL_COLORS,
  LAYOUT: PANEL_LAYOUT,

  // Component-specific token groups
  TABS: PANEL_TABS_TOKENS,
  LEVEL_PANEL: LEVEL_PANEL_TOKENS,
  DXF_SETTINGS: DXF_SETTINGS_TOKENS,

  // Phase 2 - Additional panel tokens
  SPECIFIC_SETTINGS: SPECIFIC_SETTINGS_TOKENS,
  GENERAL_SETTINGS: GENERAL_SETTINGS_TOKENS,
  OVERLAY_PANEL: OVERLAY_PANEL_TOKENS,
  MERGE_PANEL: MERGE_PANEL_TOKENS,

  // Integration with existing systems
  INTERACTIVE: INTERACTIVE_PATTERNS,
  HOVER: {
    TEXT: HOVER_TEXT_EFFECTS,
    BACKGROUND: HOVER_BACKGROUND_EFFECTS,
  },
  TRANSITIONS: TRANSITION_PRESETS,
} as const;

// ============================================================================
// TYPE DEFINITIONS - ENTERPRISE TYPE SAFETY
// ============================================================================

/**
 * 📝 TYPE DEFINITIONS
 * Type-safe interfaces για όλα τα panel tokens
 */
export type PanelColorsType = typeof PANEL_COLORS;
export type PanelLayoutType = typeof PANEL_LAYOUT;
export type PanelTabsTokensType = typeof PANEL_TABS_TOKENS;
export type LevelPanelTokensType = typeof LEVEL_PANEL_TOKENS;
export type DxfSettingsTokensType = typeof DXF_SETTINGS_TOKENS;
export type PanelTokensType = typeof PANEL_TOKENS;

// ============================================================================
// UTILITY FUNCTIONS - ENTERPRISE HELPERS
// ============================================================================

/**
 * 🔧 UTILITY FUNCTIONS
 * Helper functions για εύκολη χρήση των tokens
 */
export const PanelTokenUtils = {
  /**
   * Δημιουργεί class string για tab button βάσει state
   */
  getTabButtonClasses: (isActive: boolean, isDisabled: boolean = false): string => {
    if (isDisabled) {
      return `${PANEL_TABS_TOKENS.TAB_BUTTON.BASE} ${PANEL_TABS_TOKENS.TAB_BUTTON.DISABLED}`;
    }

    if (isActive) {
      return `${PANEL_TABS_TOKENS.TAB_BUTTON.BASE} ${PANEL_TABS_TOKENS.TAB_BUTTON.ACTIVE}`;
    }

    return `${PANEL_TABS_TOKENS.TAB_BUTTON.BASE} ${PANEL_TABS_TOKENS.TAB_BUTTON.INACTIVE}`;
  },

  /**
   * Δημιουργεί class string για level card βάσει state
   */
  getLevelCardClasses: (isActive: boolean): string => {
    const baseClasses = PANEL_TOKENS.LEVEL_PANEL.LEVEL_CARD.BASE;
    const stateClasses = isActive
      ? PANEL_TOKENS.LEVEL_PANEL.LEVEL_CARD.ACTIVE
      : PANEL_TOKENS.LEVEL_PANEL.LEVEL_CARD.INACTIVE;

    return `${baseClasses} ${stateClasses}`;
  },

  /**
   * Δημιουργεί class string για DXF settings tab βάσει state
   */
  getDxfSettingsTabClasses: (isActive: boolean): string => {
    const baseClasses = PANEL_TOKENS.DXF_SETTINGS.TAB_BUTTON.BASE;
    const stateClasses = isActive
      ? PANEL_TOKENS.DXF_SETTINGS.TAB_BUTTON.ACTIVE
      : PANEL_TOKENS.DXF_SETTINGS.TAB_BUTTON.INACTIVE;

    return `${baseClasses} ${stateClasses}`;
  },

  /**
   * Δημιουργεί class string για specific settings category button βάσει state
   * Phase 2.1 - Enterprise function
   */
  getSpecificCategoryButtonClasses: (isActive: boolean, isComingSoon: boolean = false): string => {
    const baseClasses = SPECIFIC_SETTINGS_TOKENS.CATEGORY_BUTTON.BASE;

    if (isActive) {
      return `${baseClasses} ${SPECIFIC_SETTINGS_TOKENS.CATEGORY_BUTTON.ACTIVE}`;
    }

    if (isComingSoon) {
      return `${baseClasses} ${SPECIFIC_SETTINGS_TOKENS.CATEGORY_BUTTON.COMING_SOON}`;
    }

    return `${baseClasses} ${SPECIFIC_SETTINGS_TOKENS.CATEGORY_BUTTON.INACTIVE}`;
  },
} as const;

// ============================================================================
// EXPORTS - ENTERPRISE MODULE INTERFACE
// ============================================================================

export default PANEL_TOKENS;

/**
 * 🏗️ USAGE EXAMPLES
 *
 * @example PanelTabs component
 * ```tsx
 * import { PANEL_TOKENS, PanelTokenUtils } from './config/panel-tokens';
 *
 * const getTabClass = (tabId: PanelType) => {
 *   const disabled = disabledPanels[tabId];
 *   const isActive = activePanel === tabId;
 *   return PanelTokenUtils.getTabButtonClasses(isActive, disabled);
 * };
 * ```
 *
 * @example LevelPanel component
 * ```tsx
 * import { PANEL_TOKENS } from './config/panel-tokens';
 *
 * <div className={PANEL_TOKENS.LEVEL_PANEL.CONTAINER.BASE}>
 *   <h3 className={PANEL_TOKENS.LEVEL_PANEL.HEADER.TEXT}>
 *     <Building2 className={PANEL_TOKENS.LEVEL_PANEL.HEADER.ICON} />
 *     Επίπεδα Έργου
 *   </h3>
 * </div>
 * ```
 *
 * @example DxfSettingsPanel component
 * ```tsx
 * import { PANEL_TOKENS, PanelTokenUtils } from './config/panel-tokens';
 *
 * <div className={PANEL_TOKENS.DXF_SETTINGS.CONTAINER.BASE}>
 *   <button
 *     className={PanelTokenUtils.getDxfSettingsTabClasses(activeMainTab === 'general')}
 *     onClick={() => setActiveMainTab('general')}
 *   >
 *     Γενικές Ρυθμίσεις
 *   </button>
 * </div>
 * ```
 */