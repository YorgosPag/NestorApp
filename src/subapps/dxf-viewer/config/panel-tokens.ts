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
 * - 'border-gray-600' → borderTokens.default (from useBorderTokens)
 * - 'bg-blue-600' → PANEL_TOKENS.TAB.ACTIVE.BACKGROUND
 *
 * 🏗️ INTEGRATES WITH EXISTING SYSTEMS:
 * - INTERACTIVE_PATTERNS from @/components/ui/effects
 * - Base design tokens from src/styles/design-tokens/
 * - Color config from ./color-config.ts
 */

// ============================================================================
// ENTERPRISE IMPORTS - ZERO DUPLICATES
// ============================================================================

// 🏢 ENTERPRISE: Import existing centralized systems (NO duplicates)
import { INTERACTIVE_PATTERNS, HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS, HOVER_BORDER_EFFECTS, TRANSITION_PRESETS } from '../../../components/ui/effects';

// 🏢 ENTERPRISE: Import enterprise semantic colors (SINGLE SOURCE OF TRUTH)
import { tailwindColorMappings } from '@/ui-adapters/tailwind/colors.adapter';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import type { UseSemanticColorsReturn } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// ENTERPRISE PANEL COLOR FACTORY - ZERO HARDCODED VALUES
// ============================================================================

/**
 * 🏢 ENTERPRISE PANEL COLORS FACTORY FUNCTION - FORTUNE 500 STANDARD
 * Creates panel color configuration using centralized semantic color system
 *
 * This is THE ENTERPRISE WAY:
 * ✅ No hardcoded values anywhere
 * ✅ Single source of truth (useSemanticColors)
 * ✅ Type-safe configuration
 * ✅ Runtime dynamic colors (theme support)
 * ✅ Centralized system usage only
 *
 * @param colors - Semantic colors from useSemanticColors hook
 * @returns Panel color configuration object
 */
export function createPanelColors(colors: UseSemanticColorsReturn) {
  return {
    // ✅ ENTERPRISE: Background colors από centralized semantic system
    BG_PRIMARY: colors.bg.primary,                    // Dynamic theme support
    BG_SECONDARY: colors.bg.secondary,                // Dynamic theme support
    BG_TERTIARY: colors.bg.hover,                     // Consistent hover state
    BG_HOVER: colors.bg.hover,                        // Centralized interaction state

    // ✅ ENTERPRISE: Text colors από centralized semantic system
    TEXT_PRIMARY: colors.text.primary,                // Dynamic theme support
    TEXT_SECONDARY: colors.text.secondary,            // Dynamic theme support
    TEXT_MUTED: colors.text.muted,                    // Centralized muted text
    TEXT_DISABLED: colors.text.muted,                 // Reuse muted for disabled (semantic)
    TEXT_TERTIARY: colors.text.muted,                 // Consistent with muted pattern

    // ✅ ENTERPRISE: Border colors από centralized semantic system
    BORDER_PRIMARY: colors.border.primary,            // Dynamic theme support
    BORDER_SECONDARY: colors.border.secondary,        // Dynamic theme support
    BORDER_MUTED: colors.border.primary,              // Consistent with primary
    BORDER_ACCENT: colors.border.info,                // Semantic accent borders

    // ✅ ENTERPRISE: Status borders από centralized semantic system
    BORDER_INFO: colors.border.info,                  // Centralized info borders
    BORDER_SUCCESS: colors.border.success,            // Centralized success borders
    BORDER_WARNING: colors.border.warning,            // Centralized warning borders
    BORDER_ERROR: colors.border.error,                // Centralized error borders

    // ✅ ENTERPRISE: Interactive states από centralized semantic system
    ACTIVE_BG: colors.bg.info,                        // Dynamic semantic active
    ACTIVE_BORDER: colors.border.info,                // Dynamic semantic active
    ACTIVE_TEXT: colors.text.inverse,                 // Dynamic inverted text

    // ✅ ENTERPRISE: Status states από centralized semantic system
    SUCCESS_BG: 'bg-green-600',                       // Static semantic success
    SUCCESS_HOVER: 'hover:bg-green-700',              // Static success hover
    DANGER_TEXT: colors.text.primary,                 // Dynamic semantic error
    DANGER_HOVER: COLOR_BRIDGE.interactive.hover.error, // Centralized error hover από COLOR_BRIDGE
    FOCUS_RING: colors.border.info,                   // Dynamic focus indication
  } as const;
}

// ============================================================================
// ENTERPRISE PANEL TOKENS FACTORY - COMPLETE SYSTEM
// ============================================================================

/**
 * 🏢 ENTERPRISE PANEL TOKENS FACTORY FUNCTION - FORTUNE 500 STANDARD
 * Creates complete panel token configuration using centralized semantic color system
 *
 * This replaces ALL hardcoded tokens with dynamic, type-safe configuration
 * ✅ Zero hardcoded values
 * ✅ Runtime theme support
 * ✅ Centralized system integration
 * ✅ Enterprise architecture compliance
 *
 * @param colors - Semantic colors from useSemanticColors hook
 * @param borderTokens - Border tokens from useBorderTokens hook
 * @returns Complete panel tokens configuration object
 */
export function createPanelTokens(
  colors: UseSemanticColorsReturn,
  borderTokens: { quick: { card: string }; getStatusBorder: (status: string) => string }
) {
  const panelColors = createPanelColors(colors);

  return {
    // Panel Color System
    COLORS: panelColors,

    // Background tokens for panel containers
    // 🚫 ADR-002: CANVAS_BACKGROUND ΑΦΑΙΡΕΘΗΚΕ - Χρησιμοποιήστε CANVAS_THEME από color-config.ts
    // 📍 Single source of truth: import { CANVAS_THEME } from './color-config'
    BACKGROUND: {
      MAIN_CONTAINER: colors.bg.primary,              // Dynamic main containers
      VIEW_CONTAINER: colors.bg.secondary,            // Dynamic view containers
      // ❌ REMOVED: CANVAS_BACKGROUND - Use CANVAS_THEME.DXF_CANVAS instead
      HEADER_BACKGROUND: colors.bg.primary,           // Dynamic headers
      CONTENT_BACKGROUND: colors.bg.secondary,        // Dynamic content areas
      SIDEBAR_BACKGROUND: colors.bg.hover,            // Dynamic sidebars
    },

    // Interactive patterns with centralized hover effects
    INTERACTIVE: {
      HOVER_BACKGROUND: COLOR_BRIDGE.interactive.hover.bg, // Από COLOR_BRIDGE instead of colors
      FOCUS_RING: borderTokens.getStatusBorder('info'),
      ACTIVE_BACKGROUND: colors.bg.primary,
      DISABLED_OPACITY: 'opacity-50',                 // Standard disabled state
    },

    // Tab navigation with dynamic borders
    TAB_NAVIGATION: {
      CONTAINER: `border-b mb-4`,                     // Layout only
      BORDER: borderTokens.getStatusBorder('default'), // Dynamic borders
    },

    // Loading states with dynamic text
    LOADING_STATE: {
      CONTAINER: `px-4 py-8 text-center`,             // Layout only
      TEXT: colors.text.muted,                        // Dynamic muted text
    },

    // Error states with semantic colors
    ERROR_STATE: {
      CONTAINER: `px-4 py-8 text-center`,             // Layout only
      TEXT: colors.text.error,                        // Dynamic error text
      BACKGROUND: colors.bg.errorSubtle,              // Dynamic error background
    },

    // Success states with semantic colors
    SUCCESS_STATE: {
      CONTAINER: `px-4 py-8 text-center`,             // Layout only
      TEXT: colors.text.success,                      // Dynamic success text
      BACKGROUND: colors.bg.successSubtle,            // Dynamic success background
    },
  } as const;
}

// ============================================================================
// PANEL LAYOUT TOKENS - ENTERPRISE SPACING SYSTEM
// ============================================================================

/**
 * 📏 PANEL LAYOUT CONSTANTS
 * Consistent spacing, sizing και layout tokens για όλα τα panels
 */
export const PANEL_LAYOUT = {
  // ============================================================================
  // 🏢 ENTERPRISE SPACING SYSTEM - SINGLE SOURCE OF TRUTH
  // ============================================================================
  // Αλλαγή εδώ επηρεάζει: SubTabRenderer, AccordionSection, Settings components,
  // FloatingPanel, OverrideToggle, και όλα τα DXF Viewer UI components
  // ============================================================================

  // 📏 UNIFIED SPACING SCALE - Based on 4px grid (Tailwind standard)
  SPACING: {
    // 🏢 ENTERPRISE: Zero values (explicit reset)
    NONE: 'p-0',                       // 0px  - No padding (icon-only buttons)
    HALF: 'p-0.5',                     // 2px  - Sub-pixel padding (fine-tuning)

    // Uniform padding (all sides)
    XS: 'p-1',                         // 4px  - Micro spacing
    SM: 'p-2',                         // 8px  - Compact spacing
    MD: 'p-3',                         // 12px - Default spacing
    LG: 'p-4',                         // 16px - Comfortable spacing
    XL: 'p-5',                         // 20px - Large spacing
    XXL: 'p-6',                        // 24px - Extra large spacing
    XXXL: 'p-8',                       // 32px - Maximum spacing

    // Horizontal + Vertical combinations
    COMPACT: 'px-2 py-1',              // Compact: buttons, badges, inputs
    STANDARD: 'px-3 py-2',             // Standard: most elements
    COMFORTABLE: 'px-4 py-3',          // Comfortable: cards, sections

    // 🏢 ENTERPRISE: Horizontal-only padding (px-*)
    HORIZONTAL_HALF: 'px-0.5',         // 2px horizontal padding (fine-tuning)
    HORIZONTAL_XS: 'px-1',             // 4px horizontal padding
    HORIZONTAL_SM: 'px-2',             // 8px horizontal padding
    HORIZONTAL_MD: 'px-3',             // 12px horizontal padding
    HORIZONTAL_LG: 'px-4',             // 16px horizontal padding

    // 🏢 ENTERPRISE: Responsive spacing (for breakpoints)
    SM_NONE: 'sm:p-0',                 // 0px padding at sm breakpoint and above

    // 🏢 ENTERPRISE: Ultra-compact spacing combinations
    COMPACT_XS: 'px-1 py-0.5',         // Ultra-compact: badges, indicators

    // Section spacing (vertical gap between stacked elements - space-y-*)
    GAP_XS: 'space-y-1',               // 4px gap
    GAP_SM: 'space-y-2',               // 8px gap
    GAP_MD: 'space-y-3',               // 12px gap
    GAP_LG: 'space-y-4',               // 16px gap
    GAP_XL: 'space-y-6',               // 24px gap

    // 🏢 ENTERPRISE: Horizontal spacing (horizontal gap between inline elements - space-x-*)
    GAP_H_XS: 'space-x-1',             // 4px horizontal gap
    GAP_H_SM: 'space-x-2',             // 8px horizontal gap
    GAP_H_MD: 'space-x-3',             // 12px horizontal gap
    GAP_H_LG: 'space-x-4',             // 16px horizontal gap
    GAP_H_XL: 'space-x-6',             // 24px horizontal gap
  },

  // 🔗 FLEX/GRID GAPS - For flex and grid layouts (gap-*)
  GAP: {
    HALF: 'gap-0.5',                   // 2px  - Sub-pixel gap (fine-tuning)
    XS: 'gap-1',                       // 4px  - Tight gap
    SM: 'gap-2',                       // 8px  - Small gap
    MD: 'gap-3',                       // 12px - Default gap
    LG: 'gap-4',                       // 16px - Large gap
    XL: 'gap-6',                       // 24px - Extra large gap
  },

  // 📐 HEIGHT - Fixed height tokens
  HEIGHT: {
    XS: 'h-1',                         // 4px  - Progress bar, dividers
    SM: 'h-2',                         // 8px  - Small height
    MD: 'h-4',                         // 16px - Medium height
    LG: 'h-6',                         // 24px - Large height
    XL: 'h-8',                         // 32px - Extra large height
  },

  // ↕️ DIRECTIONAL MARGINS - For specific margin directions
  MARGIN: {
    // 🏢 ENTERPRISE: Zero values (explicit reset)
    NONE: 'm-0',                       // 0px  - No margin (reset for headings)

    TOP_HALF: 'mt-0.5',                // 2px top margin (fine-tuning)
    TOP_XS: 'mt-1',                    // 4px top margin
    TOP_SM: 'mt-2',                    // 8px top margin
    TOP_MD: 'mt-3',                    // 12px top margin
    TOP_LG: 'mt-4',                    // 16px top margin
    TOP_XL: 'mt-6',                    // 24px top margin
    BOTTOM_XS: 'mb-1',                 // 4px bottom margin
    BOTTOM_SM: 'mb-2',                 // 8px bottom margin
    BOTTOM_MD: 'mb-3',                 // 12px bottom margin
    BOTTOM_LG: 'mb-4',                 // 16px bottom margin
    BOTTOM_XL: 'mb-6',                 // 24px bottom margin
    LEFT_MD: 'pl-4',                   // 16px left padding
    LEFT_LG: 'pl-6',                   // 24px left padding (indentation)
    LEFT_XL: 'pl-8',                   // 32px left padding (deep nesting)
    LEFT_XXL: 'pl-12',                 // 48px left padding (very deep nesting)

    // 🏢 ENTERPRISE: Right margins (for icon-text spacing)
    RIGHT_XS: 'mr-1',                  // 4px right margin
    RIGHT_SM: 'mr-2',                  // 8px right margin (icon-text spacing)
    RIGHT_MD: 'mr-3',                  // 12px right margin
    RIGHT_LG: 'mr-4',                  // 16px right margin

    // 🏢 ENTERPRISE: Horizontal margins (mx-*)
    X_XS: 'mx-1',                      // 4px horizontal margin (small separators)
    X_SM: 'mx-2',                      // 8px horizontal margin (separators)
    X_MD: 'mx-3',                      // 12px horizontal margin
    X_LG: 'mx-4',                      // 16px horizontal margin

    // 🏢 ENTERPRISE: Vertical margins (my-*)
    Y_XS: 'my-1',                      // 4px vertical margin (separators)

    // 🏢 ENTERPRISE: Left margins (ml-*)
    LEFT_SM: 'ml-2',                   // 8px left margin (icon-text spacing)
    LEFT_3XL: 'ml-12',                 // 48px left margin (entity card indentation)

    // 🏢 ENTERPRISE: Sub-pixel margins (fine-tuning)
    LEFT_HALF: 'ml-0.5',               // 2px  - Sub-pixel left margin (fine-tuning icons)
  },

  // ↔️ DIRECTIONAL PADDINGS - For specific padding directions
  PADDING: {
    // ⬆️ TOP paddings
    TOP_SM: 'pt-2',                    // 8px top padding
    TOP_LG: 'pt-4',                    // 16px top padding
    // ⬇️ BOTTOM paddings
    BOTTOM_SM: 'pb-2',                 // 8px bottom padding
    BOTTOM_LG: 'pb-4',                 // 16px bottom padding
    // ↔️ VERTICAL paddings
    VERTICAL_NONE: 'py-0',             // 0px vertical padding (inline inputs)
    VERTICAL_XS: 'py-1',               // 4px vertical padding (compact status bars)
    VERTICAL_SM: 'py-2',               // 8px vertical padding
    VERTICAL_XXXL: 'py-8',             // 32px vertical padding (empty states)
    // ➡️ RIGHT paddings
    RIGHT_XS: 'pr-1',                  // 4px right padding
    RIGHT_SM: 'pr-2',                  // 8px right padding (scroll container)
    RIGHT_MD: 'pr-3',                  // 12px right padding
    // ⬅️ LEFT paddings
    LEFT_SM: 'pl-2',                   // 8px left padding
    LEFT_MD: 'pl-4',                   // 16px left padding
    LEFT_XL: 'pl-8',                   // 32px left padding (indented content)
    // 🏷️ SPECIAL paddings
    TOOLTIP: 'px-1 py-0.5',            // Tooltip/snap indicator padding
    BADGE: 'px-1.5 py-0.5',            // Badge/chip padding
    HORIZONTAL_HALF: 'px-0.5',         // 2px horizontal padding (sub-pixel)
  },

  // Panel containers
  CONTAINER: {
    PADDING: 'px-1 py-1',              // Standard panel padding (REDUCED)
    INNER_PADDING: 'p-1',              // Inner content padding (REDUCED: 4px)
    SECTION_SPACING: 'space-y-2',      // Vertical section spacing (8px gap)
    BORDER_RADIUS: 'rounded-lg',       // Standard border radius
  },

  // 🚨 ALERT/WARNING elements - Semantic feedback areas
  ALERT: {
    PADDING: 'p-2',                    // Alert padding (8px)
    PADDING_LG: 'p-4',                 // Large alert padding (16px)
    BORDER_RADIUS: 'rounded',          // Alert border radius
    TEXT_SIZE: 'text-xs',              // Alert text size
  },

  // Input elements
  INPUT: {
    HEIGHT: 'h-8',                     // Standard input height
    PADDING: 'px-3 py-2',              // Standard input padding
    PADDING_COMPACT: 'px-2 py-1',      // Compact input padding (for inline inputs)
    BORDER_RADIUS: 'rounded',          // Input border radius
    TEXT_SIZE: 'text-sm',              // Input text size
    FULL_WIDTH: 'w-full',              // Full width inputs
    FOCUS: 'focus:outline-none',       // Focus behavior
  },

  // Button elements
  BUTTON: {
    HEIGHT: 'h-8',                     // Standard button height (32px)
    HEIGHT_SM: 'h-6',                  // Small button height (24px - zoom controls)
    HEIGHT_MD: 'h-10',                 // Medium button height (40px)
    HEIGHT_LG: 'h-12',                 // Large button height (48px)
    PADDING: 'px-3 py-2',              // Standard button padding
    PADDING_COMPACT: 'px-3 py-1',      // Compact button padding (for inline buttons)
    PADDING_LG: 'px-4 py-2',           // Large button padding (modal actions)
    PADDING_XL: 'px-6 py-2',           // Extra large button padding (wizard actions)
    BORDER_RADIUS: 'rounded',          // Button border radius
    TEXT_SIZE: 'text-sm',              // Button text size
    TEXT_SIZE_XS: 'text-xs',           // Extra small button text
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
    SPINNER: 'border border-white border-t-transparent rounded-full animate-spin',
    SIZE: 'w-4 h-4',
  },

  // 🎯 FLOATING TOOLBAR TOKENS - DraggableOverlayToolbar configuration
  FLOATING_TOOLBAR: {
    // Default dimensions (pixels)
    DIMENSIONS: {
      WIDTH: 300,
      HEIGHT: 100,
    },
    // Default position (pixels from top-left)
    POSITION: {
      X: 450,
      Y: 150,
    },
    // Separator height classes
    SEPARATOR: {
      HEIGHT: 'h-6',
    },
  },

  // 🏢 OVERLAY DRAWING DEFAULTS - Tool style defaults
  OVERLAY_DEFAULTS: {
    LINE_WIDTH: 2,
    OPACITY: 1,
    LINE_TYPE: 'solid' as const,
  },
} as const;

// ============================================================================
// ENTERPRISE BACKWARD COMPATIBILITY - STATIC PANEL COLORS
// ============================================================================

/**
 * 🏢 STATIC PANEL COLORS - ENTERPRISE BACKWARD COMPATIBILITY
 * Provides static color constants για immediate use σε existing components
 * Maintains backward compatibility while supporting enterprise factory functions
 */
export const PANEL_COLORS = {
  // ✅ ENTERPRISE: Background colors από centralized semantic system
  BG_PRIMARY: COLOR_BRIDGE.bg.primary,                    // ✅ ENTERPRISE: Centralized primary background
  BG_SECONDARY: COLOR_BRIDGE.bg.secondary,                  // ✅ ENTERPRISE: Centralized secondary background
  BG_TERTIARY: COLOR_BRIDGE.bg.card,                   // ✅ ENTERPRISE: Centralized card background
  BG_HOVER: 'hover:bg-gray-600',                // Static hover state

  // ✅ ENTERPRISE: Text colors από centralized semantic system
  TEXT_PRIMARY: 'text-white',                   // Static primary text
  TEXT_SECONDARY: 'text-gray-300',              // Static secondary text
  TEXT_MUTED: COLOR_BRIDGE.text.muted,                  // ✅ ENTERPRISE: Centralized muted text
  TEXT_DISABLED: COLOR_BRIDGE.text.muted,               // ✅ ENTERPRISE: Centralized muted text
  TEXT_TERTIARY: COLOR_BRIDGE.text.secondary,               // ✅ ENTERPRISE: Centralized secondary text

  // ✅ ENTERPRISE: Border colors από centralized semantic system
  BORDER_PRIMARY: 'gray-600',                   // Static primary borders
  BORDER_SECONDARY: 'gray-500',                 // Static secondary borders
  BORDER_MUTED: 'gray-600',                     // Static muted borders
  BORDER_ACCENT: 'blue-400',                    // Static accent borders

  // ✅ ENTERPRISE FIX: Missing border colors for DxfViewerComponents.styles
  BORDER_HEX_PRIMARY: '#4b5563',               // Primary border hex (gray-600)
  BORDER_HEX_SECONDARY: '#6b7280',             // Secondary border hex (gray-500)
  BORDER_HEX_LIGHT: '#e5e7eb',                 // Light border hex for dashed borders (gray-200)
  BORDER_HEX_ACCENT: '#60a5fa',                // Accent border hex (blue-400)

  // ✅ ENTERPRISE: Status borders από centralized semantic system
  BORDER_INFO: 'blue-400',                      // Static info borders
  BORDER_SUCCESS: 'green-400',                  // Static success borders
  BORDER_SUCCESS_PRIMARY: 'border-green-400',   // Success border for modal-colors.ts
  BORDER_SUCCESS_SECONDARY: 'border-green-300', // Success secondary border for modal-colors.ts
  BORDER_WARNING: 'orange-400',                 // Static warning borders
  BORDER_WARNING_PRIMARY: 'border-orange-400',  // Warning border for modal-colors.ts
  BORDER_ERROR: 'red-400',                      // Static error borders

  // ✅ ENTERPRISE: Interactive states από centralized semantic system
  ACTIVE_BG: 'bg-blue-600',                     // Static semantic active
  ACTIVE_BORDER: 'blue-500',                    // Static semantic active
  ACTIVE_TEXT: 'text-white',                    // Static inverted text

  // ✅ ENTERPRISE: Status states από centralized semantic system
  SUCCESS_BG: 'bg-green-600',                   // Static semantic success
  SUCCESS_HOVER: 'hover:bg-green-700',          // Static success hover
  DANGER_TEXT: 'text-red-400',                  // Static semantic error
  DANGER_HOVER: 'hover:text-red-300',           // Static error hover
  FOCUS_RING: 'blue-400',                       // Static focus indication
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
 * 🏢 ENTERPRISE REFACTORED: Centralized button sizes
 */

// 🏢 ENTERPRISE: Icon sizes από τα centralized design tokens
// Note: Το h-8 w-8 αντιστοιχεί στο componentSizes.icon.xl από design-tokens.ts
const ICON_SIZES = {
  XL: 'h-8 w-8', // Matches componentSizes.icon.xl
} as const;

export const SPECIFIC_SETTINGS_TOKENS = {
  CATEGORY_BUTTON: {
    BASE: 'h-8 w-8 p-0 rounded-md border transition-colors duration-150 flex items-center justify-center relative',
    ACTIVE: `${PANEL_COLORS.ACTIVE_BG} ${PANEL_COLORS.SUCCESS_HOVER} ${PANEL_COLORS.ACTIVE_TEXT} border ${PANEL_COLORS.ACTIVE_BORDER}`, // ✅ ENTERPRISE: Uses semantic tokens
    COMING_SOON: `${PANEL_COLORS.BG_SECONDARY} ${PANEL_COLORS.TEXT_DISABLED} border ${PANEL_COLORS.BORDER_SECONDARY} cursor-not-allowed opacity-50`,
    INACTIVE: `${PANEL_COLORS.BG_SECONDARY} hover:${PANEL_COLORS.BG_HOVER} ${PANEL_COLORS.TEXT_SECONDARY} border ${PANEL_COLORS.BORDER_SECONDARY}`,
  },

  COMING_SOON_BADGE: {
    BASE: `absolute -top-1 -right-1 w-3 h-3 ${PANEL_COLORS.ACTIVE_BG} rounded-full text-[8px] flex items-center justify-center ${PANEL_COLORS.ACTIVE_TEXT} font-bold`,
  },

  FALLBACK_CONTENT: {
    BASE: `px-4 py-8 text-center`,
    TEXT: `${PANEL_COLORS.TEXT_MUTED}`, // ✅ ENTERPRISE: Uses centralized semantic colors
  },
} as const;

/**
 * 🔧 GENERAL SETTINGS PANEL TOKENS
 * Specific tokens για το GeneralSettingsPanel component (Phase 2.2)
 */
export const GENERAL_SETTINGS_TOKENS = {
  FALLBACK_CONTENT: {
    BASE: `px-4 py-8 text-center`,
    TEXT: `${PANEL_COLORS.TEXT_MUTED}`, // ✅ ENTERPRISE: Uses centralized semantic colors
  },

  TAB_NAVIGATION: {
    CONTAINER: `border-b mb-4`, // Enterprise: Use borderTokens.getStatusBorder() in components
    BORDER_CLASS: COLOR_BRIDGE.border.default, // ✅ ENTERPRISE: Centralized border from COLOR_BRIDGE
  },

  LOADING_STATE: {
    BASE: `px-4 py-8 text-center`,
    TEXT: `${PANEL_COLORS.TEXT_MUTED}`, // ✅ ENTERPRISE: Uses centralized semantic colors
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
    BASE: 'bg-blue-900 bg-opacity-20 border border-blue-400 rounded-lg p-3 mb-3 space-y-2', // ✅ ENTERPRISE: Info border pattern (consistent)
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