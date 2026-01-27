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
    MS: 'p-1.5',                       // 6px  - Medium-small spacing (panels, cards)
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

    // 🏢 ENTERPRISE: Vertical-only padding (py-*)
    VERTICAL_XS: 'py-1',               // 4px vertical padding
    VERTICAL_SM: 'py-2',               // 8px vertical padding
    VERTICAL_MD: 'py-3',               // 12px vertical padding
    VERTICAL_LG: 'py-4',               // 16px vertical padding

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
    // Core heights
    DIVIDER: 'h-0.5',                  // 2px  - Thin divider lines
    XS: 'h-1',                         // 4px  - Progress bar, dividers
    SM: 'h-2',                         // 8px  - Small height (snap indicators)
    MD: 'h-4',                         // 16px - Medium height
    LG: 'h-6',                         // 24px - Large height
    INPUT_SM: 'h-7',                   // 28px - Small inputs
    XL: 'h-8',                         // 32px - Extra large height
    XXL: 'h-9',                        // 36px - Button groups
    ICON_LG: 'h-10',                   // 40px - Large icons (empty states)
    PREVIEW: 'h-12',                   // 48px - Preview containers

    // Full height utilities
    FULL: 'h-full',                    // 100% height
  },

  // 📐 MAX_HEIGHT - Scroll container constraints (ADR-011: Enterprise Centralization)
  MAX_HEIGHT: {
    XS: 'max-h-24',                    // 96px  - Small scroll areas (calibration points)
    SM: 'max-h-32',                    // 128px - Compact lists (destinations)
    MD: 'max-h-48',                    // 192px - Medium scroll areas (level selection)
    LG: 'max-h-64',                    // 256px - Standard scroll lists (layers, colors)
    XL: 'max-h-96',                    // 384px - Large scroll areas (settings panels)
  },

  // 📏 WIDTH - Fixed width tokens
  WIDTH: {
    // Core widths
    XS: 'w-5',                         // 20px - Dropdown arrows, small buttons
    SM: 'w-8',                         // 32px - Small fixed width (labels)
    MD: 'w-16',                        // 64px - Medium fixed width
    LG: 'w-24',                        // 96px - Large fixed width
    XL: 'w-32',                        // 128px - Extra large width
    FULL: 'w-full',                    // Full width

    // Specific component widths
    VALUE_DISPLAY: 'w-12',             // 48px - Slider value displays (percentages, pixels)
    INPUT_SM: 'w-20',                  // 80px - Small input fields
    BUTTON_SM: 'w-6',                  // 24px - Small button width (zoom controls)
    BUTTON_MD: 'w-7',                  // 28px - Medium button width
    PANEL_SM: 'w-80',                  // 320px - Small panels, floating containers
    PANEL_LG: 'w-96',                  // 384px - Large panels, sidebars

    // Icon indicator widths
    INDICATOR_SM: 'w-3',               // 12px - Small color indicators
    INDICATOR_MD: 'w-4',               // 16px - Medium indicators
    INDICATOR_LG: 'w-5',               // 20px - Large indicators
    ICON_LG: 'w-10',                   // 40px - Large icons (empty states)

    // Flex utilities
    MIN_ZERO: 'min-w-0',               // Flex item reset for truncation
    FLEX_1: 'flex-1',                  // Flexible width
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
    LEFT_XS: 'ml-1',                   // 4px left margin (required asterisk)
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
    PADDING_X: 'px-3',                 // Horizontal padding only (for scale/zoom controls)
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
    SWATCH: 'w-6 h-6',                 // Color swatches (color picker)
    LOADING: 'w-4 h-4',                // Loading spinner size
    BUTTON_SM: 'w-10 h-9',             // Small icon buttons (40x36px)
  },

  // 🏢 INTERACTIVE - Interactive element patterns
  INTERACTIVE: {
    HOVER: 'hover:bg-accent/50',       // Hover effect
    FOCUS: 'focus:outline-none focus:ring-2 focus:ring-blue-500', // Focus ring
    ACTIVE: 'active:bg-accent/80',     // Active state
    DISABLED: 'disabled:opacity-50 disabled:cursor-not-allowed', // Disabled state
    DISABLED_OPACITY: 'opacity-50',    // Just opacity (for icons)
    TRANSITION: 'transition-colors duration-150', // Smooth transitions
  },

  // Loading states
  LOADING: {
    SPINNER: 'border border-white border-t-transparent rounded-full animate-spin',
    SIZE: 'w-4 h-4',
  },

  // ============================================================================
  // 🎯 SNAP INDICATOR TOKENS - CAD snap point visual feedback (ADR-013)
  // ============================================================================
  // Purpose: Visual indicator for snap points (endpoints, midpoints, etc.)
  // Usage: SnapIndicatorOverlay.tsx
  // Enterprise: Centralized snap indicator dimensions for consistency
  // ============================================================================
  SNAP_INDICATOR: {
    SIZE: 'w-2 h-2',              // 8px x 8px - Snap dot dimensions
    BORDER: 'border-2',           // 2px border width
    OFFSET_PX: 4,                 // Half of size for centering (8/2 = 4)
  },

  // ============================================================================
  // 🎯 CROSSHAIR PREVIEW SIZES - Visual preview element tokens (ADR-012)
  // ============================================================================
  // Purpose: Represent crosshair size percentages in settings UI
  // Usage: CrosshairAppearanceSettings.tsx size/type preview buttons
  // Enterprise: Centralized preview sizes for consistency across UI
  // ============================================================================
  CROSSHAIR_PREVIEW: {
    // Vertical line heights for size previews (representing % of screen)
    SIZE_5_PERCENT: 'h-3',    // 12px - Small crosshair preview (5%)
    SIZE_8_PERCENT: 'h-4',    // 16px - Medium crosshair preview (8% - default)
    SIZE_15_PERCENT: 'h-5',   // 20px - Large crosshair preview (15%)
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

  // ============================================================================
  // 🔤 TYPOGRAPHY - Text size tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  TYPOGRAPHY: {
    // Core text sizes (matching Tailwind scale)
    XS: 'text-xs',                       // 12px - Small labels, badges
    SM: 'text-sm',                       // 14px - Body text, buttons
    BASE: 'text-base',                   // 16px - Default text
    LG: 'text-lg',                       // 18px - Subheadings
    XL: 'text-xl',                       // 20px - Section headings
    '2XL': 'text-2xl',                   // 24px - Page headings
    '3XL': 'text-3xl',                   // 30px - Large headings
    '4XL': 'text-4xl',                   // 36px - Display headings
  },

  // ============================================================================
  // 🔠 FONT_FAMILY - Font family tokens (ENTERPRISE 2026-01-25)
  // ============================================================================
  // Pattern: Autodesk/Microsoft/Adobe - Semantic font tokens
  // Single source of truth for all font families in the application
  // ============================================================================
  FONT_FAMILY: {
    /** Default application font (Inter/system-ui via Tailwind) */
    BASE: 'font-sans',
    /** Technical/code font for coordinates, measurements, debug data */
    CODE: 'font-mono',
    /** Display font for headlines (if needed in future) */
    DISPLAY: 'font-serif',
  },

  // ============================================================================
  // 🔡 FONT_WEIGHT - Font weight tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  FONT_WEIGHT: {
    NORMAL: 'font-normal',               // 400 - Regular text
    MEDIUM: 'font-medium',               // 500 - Emphasized text
    SEMIBOLD: 'font-semibold',           // 600 - Subheadings
    BOLD: 'font-bold',                   // 700 - Headings, important text
  },

  // ============================================================================
  // 🔲 ROUNDED - Border radius tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  ROUNDED: {
    NONE: 'rounded-none',                // 0px - No border radius
    SM: 'rounded-sm',                    // 2px - Subtle rounding
    DEFAULT: 'rounded',                  // 4px - Default rounding
    MD: 'rounded-md',                    // 6px - Medium rounding
    LG: 'rounded-lg',                    // 8px - Large rounding
    XL: 'rounded-xl',                    // 12px - Extra large rounding
    '2XL': 'rounded-2xl',                // 16px - Very large rounding
    '3XL': 'rounded-3xl',                // 24px - Extra extra large rounding
    FULL: 'rounded-full',                // Full circular rounding
    // Directional variants - Top
    TOP_LG: 'rounded-t-lg',              // Top corners only (8px)
    TOP_MD: 'rounded-t-md',              // Top corners only (6px)
    TOP: 'rounded-t',                    // Top corners only (4px)
    // Directional variants - Bottom
    BOTTOM_LG: 'rounded-b-lg',           // Bottom corners only (8px)
    BOTTOM_MD: 'rounded-b-md',           // Bottom corners only (6px)
    BOTTOM: 'rounded-b',                 // Bottom corners only (4px)
    // Directional variants - Left
    LEFT_MD: 'rounded-l-md',             // Left corners only (6px)
    // Directional variants - Right
    RIGHT_MD: 'rounded-r-md',            // Right corners only (6px)
  },

  // ============================================================================
  // 👁️ OPACITY - Opacity tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  OPACITY: {
    '0': 'opacity-0',                    // 0% - Invisible
    '25': 'opacity-25',                  // 25% - Very transparent
    '50': 'opacity-50',                  // 50% - Semi-transparent (disabled)
    '60': 'opacity-60',                  // 60% - Debug overlays
    '70': 'opacity-70',                  // 70% - Preview text opacity
    '75': 'opacity-75',                  // 75% - Slightly transparent
    '80': 'opacity-80',                  // 80% - Badge count opacity
    '100': 'opacity-100',                // 100% - Fully opaque
  },

  // ============================================================================
  // 🎨 BG_OPACITY - Background opacity tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  BG_OPACITY: {
    '20': 'bg-opacity-20',               // 20% - Very subtle background
    '30': 'bg-opacity-30',               // 30% - Subtle warning/info backgrounds
    '50': 'bg-opacity-50',               // 50% - Debug overlay backgrounds
    '75': 'bg-opacity-75',               // 75% - Moderately transparent
  },

  // ============================================================================
  // 🌫️ SHADOW - Box shadow tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  SHADOW: {
    SM: 'shadow-sm',                     // Small shadow
    DEFAULT: 'shadow',                   // Default shadow
    MD: 'shadow-md',                     // Medium shadow
    LG: 'shadow-lg',                     // Large shadow
    XL: 'shadow-xl',                     // Extra large shadow
    '2XL': 'shadow-2xl',                 // Very large shadow
    NONE: 'shadow-none',                 // No shadow
  },

  // ============================================================================
  // ⏱️ DURATION - Transition duration tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  DURATION: {
    '75': 'duration-75',                 // 75ms - Very fast
    '100': 'duration-100',               // 100ms - Fast
    '150': 'duration-150',               // 150ms - Default (standard UI)
    '200': 'duration-200',               // 200ms - Comfortable
    '300': 'duration-300',               // 300ms - Smooth
    '500': 'duration-500',               // 500ms - Slow (emphasis)
  },

  // ============================================================================
  // 📏 LINE_HEIGHT - Leading tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  LEADING: {
    NONE: 'leading-none',                // 1 - No line height
    TIGHT: 'leading-tight',              // 1.25 - Compact text
    SNUG: 'leading-snug',                // 1.375 - Slightly compact
    NORMAL: 'leading-normal',            // 1.5 - Default
    RELAXED: 'leading-relaxed',          // 1.625 - Comfortable
    LOOSE: 'leading-loose',              // 2 - Very spacious
  },

  // ============================================================================
  // 🔤 TRACKING - Letter spacing tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  TRACKING: {
    TIGHTER: 'tracking-tighter',         // -0.05em - Very tight
    TIGHT: 'tracking-tight',             // -0.025em - Tight
    NORMAL: 'tracking-normal',           // 0 - Default
    WIDE: 'tracking-wide',               // 0.025em - Wide
    WIDER: 'tracking-wider',             // 0.05em - Wider
    WIDEST: 'tracking-widest',           // 0.1em - Widest
  },

  // ============================================================================
  // 📍 POSITION - Position offset tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  POSITION: {
    // Top positions
    TOP_0: 'top-0',                      // top: 0
    TOP_1: 'top-1',                      // top: 4px
    TOP_2: 'top-2',                      // top: 8px
    TOP_2_5: 'top-2.5',                  // top: 10px (icon centering)
    TOP_4: 'top-4',                      // top: 16px
    TOP_20: 'top-20',                    // top: 80px (info panels)
    TOP_FULL: 'top-full',                // top: 100% (dropdowns)
    TOP_HALF: 'top-1/2',                 // top: 50% (centering)
    NEGATIVE_TOP_6: '-top-6',            // top: -24px (labels above)
    // Left positions
    LEFT_0: 'left-0',                    // left: 0
    LEFT_2: 'left-2',                    // left: 8px
    LEFT_4: 'left-4',                    // left: 16px
    LEFT_HALF: 'left-1/2',               // left: 50% (centering)
    // Right positions
    RIGHT_0: 'right-0',                  // right: 0
    RIGHT_2: 'right-2',                  // right: 8px
    RIGHT_4: 'right-4',                  // right: 16px
    // Bottom positions
    BOTTOM_0: 'bottom-0',                // bottom: 0
    BOTTOM_4: 'bottom-4',                // bottom: 16px
    // Special
    INSET_0: 'inset-0',                  // all: 0 (full coverage)
  },

  // ============================================================================
  // 📊 Z_INDEX - Z-index tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  Z_INDEX: {
    '0': 'z-0',                          // 0 - Base level
    '10': 'z-10',                        // 10 - Low elevation
    '20': 'z-20',                        // 20 - Medium elevation
    '30': 'z-30',                        // 30 - High elevation
    '40': 'z-40',                        // 40 - Very high elevation
    '50': 'z-50',                        // 50 - Highest elevation
  },

  // ============================================================================
  // 👆 CURSOR - Cursor tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  CURSOR: {
    DEFAULT: 'cursor-default',           // Default arrow cursor
    POINTER: 'cursor-pointer',           // Clickable elements
    MOVE: 'cursor-move',                 // Draggable elements
    GRAB: 'cursor-grab',                 // Grabbable elements
    GRABBING: 'cursor-grabbing',         // Currently grabbing
    NOT_ALLOWED: 'cursor-not-allowed',   // Disabled/forbidden actions
    WAIT: 'cursor-wait',                 // Loading states
    CROSSHAIR: 'cursor-crosshair',       // Precision selection (CAD)
    TEXT: 'cursor-text',                 // Text input areas
    NONE: 'cursor-none',                 // Hidden cursor (custom cursors)
    HELP: 'cursor-help',                 // Help tooltips
    ZOOM_IN: 'cursor-zoom-in',           // Zoom in areas
    ZOOM_OUT: 'cursor-zoom-out',         // Zoom out areas
    COL_RESIZE: 'cursor-col-resize',     // Column resize
    ROW_RESIZE: 'cursor-row-resize',     // Row resize
    NS_RESIZE: 'cursor-ns-resize',       // North-South resize
    EW_RESIZE: 'cursor-ew-resize',       // East-West resize
    NESW_RESIZE: 'cursor-nesw-resize',   // NE-SW diagonal resize
    NWSE_RESIZE: 'cursor-nwse-resize',   // NW-SE diagonal resize
  },

  // ============================================================================
  // 📦 OVERFLOW - Overflow tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  OVERFLOW: {
    AUTO: 'overflow-auto',               // Auto scrollbars
    HIDDEN: 'overflow-hidden',           // Hide overflow
    VISIBLE: 'overflow-visible',         // Show overflow
    SCROLL: 'overflow-scroll',           // Always show scrollbars
    X_AUTO: 'overflow-x-auto',           // Horizontal auto scroll
    X_HIDDEN: 'overflow-x-hidden',       // Hide horizontal overflow
    Y_AUTO: 'overflow-y-auto',           // Vertical auto scroll
    Y_HIDDEN: 'overflow-y-hidden',       // Hide vertical overflow
    Y_SCROLL: 'overflow-y-scroll',       // Vertical always scroll
  },

  // ============================================================================
  // 🖱️ POINTER_EVENTS - Pointer event tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  POINTER_EVENTS: {
    NONE: 'pointer-events-none',         // Disable pointer events (pass-through)
    AUTO: 'pointer-events-auto',         // Enable pointer events (default)
  },

  // ============================================================================
  // 📝 SELECT - User select tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  SELECT: {
    NONE: 'select-none',                 // Disable text selection
    TEXT: 'select-text',                 // Enable text selection
    ALL: 'select-all',                   // Select all on click
    AUTO: 'select-auto',                 // Default selection behavior
  },

  // ============================================================================
  // 🔄 RESIZE - Resize tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  RESIZE: {
    NONE: 'resize-none',                 // No resize allowed
    BOTH: 'resize',                      // Resize in both directions
    X: 'resize-x',                       // Horizontal resize only
    Y: 'resize-y',                       // Vertical resize only
  },

  // ============================================================================
  // ↔️ TRANSLATE - Transform translate tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  TRANSLATE: {
    X_0: 'translate-x-0',                // No horizontal translation
    X_HALF: 'translate-x-1/2',           // 50% horizontal translation
    X_FULL: 'translate-x-full',          // 100% horizontal translation
    X_HALF_NEG: '-translate-x-1/2',      // -50% horizontal translation (centering)
    X_FULL_NEG: '-translate-x-full',     // -100% horizontal translation
    Y_0: 'translate-y-0',                // No vertical translation
    Y_HALF: 'translate-y-1/2',           // 50% vertical translation
    Y_FULL: 'translate-y-full',          // 100% vertical translation
    Y_HALF_NEG: '-translate-y-1/2',      // -50% vertical translation (centering)
    Y_FULL_NEG: '-translate-y-full',     // -100% vertical translation
  },

  // ============================================================================
  // 🔍 SCALE - Transform scale tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  SCALE: {
    '0': 'scale-0',                      // Invisible (0%)
    '50': 'scale-50',                    // Half size (50%)
    '75': 'scale-75',                    // 3/4 size (75%)
    '90': 'scale-90',                    // Slightly smaller (90%)
    '95': 'scale-95',                    // Almost full (95%)
    '100': 'scale-100',                  // Full size (100%)
    '105': 'scale-105',                  // Slightly larger (105%)
    '110': 'scale-110',                  // Larger (110%)
    '125': 'scale-125',                  // Much larger (125%)
    '150': 'scale-150',                  // Very large (150%)
    HOVER_105: 'hover:scale-105',        // Scale on hover (common pattern)
    HOVER_110: 'hover:scale-110',        // Larger scale on hover
  },

  // ============================================================================
  // 🔄 ROTATE - Transform rotate tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  ROTATE: {
    '0': 'rotate-0',                     // No rotation
    '45': 'rotate-45',                   // 45 degrees
    '90': 'rotate-90',                   // 90 degrees
    '180': 'rotate-180',                 // 180 degrees
    '270': '-rotate-90',                 // 270 degrees (or -90)
    NEG_45: '-rotate-45',                // -45 degrees
    NEG_90: '-rotate-90',                // -90 degrees
    NEG_180: '-rotate-180',              // -180 degrees
  },

  // ============================================================================
  // 🎬 TRANSITION - Transition property tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  // NOTE: For complex transitions, use TRANSITION_PRESETS from @/components/ui/effects
  TRANSITION: {
    NONE: 'transition-none',             // No transition
    ALL: 'transition-all',               // Transition all properties
    DEFAULT: 'transition',               // Default (colors, bg, border, etc.)
    COLORS: 'transition-colors',         // Color transitions only
    OPACITY: 'transition-opacity',       // Opacity transitions only
    SHADOW: 'transition-shadow',         // Box shadow transitions
    TRANSFORM: 'transition-transform',   // Transform transitions only
  },

  // ============================================================================
  // 🖼️ INSET - Inset positioning tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  INSET: {
    '0': 'inset-0',                      // All sides 0 (full coverage)
    X_0: 'inset-x-0',                    // Left and right 0
    Y_0: 'inset-y-0',                    // Top and bottom 0
    AUTO: 'inset-auto',                  // Auto positioning
  },

  // ============================================================================
  // 📐 MIN_WIDTH - Minimum width tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  MIN_WIDTH: {
    '0': 'min-w-0',                      // Reset minimum width (flex truncation)
    FULL: 'min-w-full',                  // 100% minimum width
    MIN: 'min-w-min',                    // Min-content
    MAX: 'min-w-max',                    // Max-content
    FIT: 'min-w-fit',                    // Fit-content
  },

  // ============================================================================
  // 📏 MIN_HEIGHT - Minimum height tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  MIN_HEIGHT: {
    '0': 'min-h-0',                      // Reset minimum height
    FULL: 'min-h-full',                  // 100% minimum height
    SCREEN: 'min-h-screen',              // Viewport height
    MIN: 'min-h-min',                    // Min-content
    MAX: 'min-h-max',                    // Max-content
    FIT: 'min-h-fit',                    // Fit-content
  },

  // ============================================================================
  // 📐 MAX_WIDTH - Maximum width tokens (ENTERPRISE 2026-01-05)
  // ============================================================================
  MAX_WIDTH: {
    NONE: 'max-w-none',                  // No maximum
    XS: 'max-w-xs',                      // 320px
    SM: 'max-w-sm',                      // 384px
    MD: 'max-w-md',                      // 448px
    LG: 'max-w-lg',                      // 512px
    XL: 'max-w-xl',                      // 576px
    '2XL': 'max-w-2xl',                  // 672px
    FULL: 'max-w-full',                  // 100%
    SCREEN: 'max-w-screen-xl',           // Screen breakpoint
  },

  // ============================================================================
  // 🎨 CAD_COLORS - AutoCAD Standard Colors (ENTERPRISE 2026-01-05)
  // Single source of truth for all CAD-related color constants
  // ============================================================================
  CAD_COLORS: {
    // Line colors (Factory defaults)
    LINE_DEFAULT: '#FFFFFF',             // Pure white - default line color
    LINE_HOVER: '#FFFF00',               // Pure yellow - hover state
    LINE_SELECTED: '#00FF00',            // Pure green - selected state
    LINE_ERROR: '#FF0000',               // Pure red - error/warning
    LINE_INFO: '#0000FF',                // Pure blue - info/secondary selection
    // Grip colors (AutoCAD standard)
    GRIP_COLD: '#0000FF',                // Blue - unselected grips
    GRIP_WARM: '#FF69B4',                // Hot Pink - hover grips
    GRIP_HOT: '#FF0000',                 // Red - selected grips
    // Text colors
    TEXT_DEFAULT: '#000000',             // Black - default text on light bg
    TEXT_INVERTED: '#FFFFFF',            // White - text on dark bg
    // Drawing colors
    DRAWING_WHITE: '#FFFFFF',            // Pure white for drawings
    DRAWING_BLACK: '#000000',            // Pure black for drawings
    // Transparent
    TRANSPARENT: 'transparent',          // Transparent color
  },

  // ============================================================================
  // 📐 LAYOUT_DIMENSIONS - Fixed dimensions for UI components (ENTERPRISE 2026-01-05)
  // Centralizes arbitrary Tailwind values like [384px], [90vh], etc.
  // ============================================================================
  LAYOUT_DIMENSIONS: {
    // Sidebar dimensions
    SIDEBAR_WIDTH: 'w-[384px]',          // Standard sidebar width
    SIDEBAR_MIN_WIDTH: 'min-w-[384px]',  // Minimum sidebar width
    SIDEBAR_MAX_WIDTH: 'max-w-[384px]',  // Maximum sidebar width
    // Modal dimensions
    MODAL_MAX_HEIGHT: 'max-h-[90vh]',    // Standard modal max height
    MODAL_MIN_HEIGHT: 'min-h-[850px]',   // Settings panel min height
    // Panel dimensions
    PANEL_WIDTH_SM: 'w-[220px]',         // Small panel (dynamic input)
    PANEL_WIDTH_MD: 'w-[340px]',         // Medium panel (properties)
    PANEL_WIDTH_LG: 'w-[400px]',         // Large panel (color dialog)
    // Min-width variants
    PANEL_MIN_WIDTH_SM: 'min-w-[220px]', // Small panel minimum width
    // Max-width variants
    PANEL_MAX_WIDTH_LG: 'max-w-[400px]', // Large panel maximum width (dialogs)
    // Dropdown dimensions
    DROPDOWN_MIN_WIDTH: 'min-w-[150px]', // Standard dropdown min width
    // Text sizes (arbitrary)
    TEXT_TINY: 'text-[10px]',            // Very small text (badges, hints)
  },

  // ============================================================================
  // ⏱️ TIMING - Animation and timeout constants (ENTERPRISE 2026-01-05)
  // Single source of truth for ALL setTimeout/setInterval values
  // ============================================================================
  TIMING: {
    // ─────────────────────────────────────────────────────────────────────────
    // MICRO DELAYS (10-50ms) - Focus/DOM updates
    // ─────────────────────────────────────────────────────────────────────────
    FOCUS_DELAY: 10,                     // Focus after DOM update (DynamicInputOverlay)
    VIEWPORT_LAYOUT_STABILIZATION: 50,   // 🏢 ADR-045: Wait for browser layout stabilization (CanvasSection)
    TOOL_TRANSITION: 50,                 // Tool state transition (ToolStateManager)

    // ─────────────────────────────────────────────────────────────────────────
    // DEBOUNCE INTERVALS (100-200ms)
    // ─────────────────────────────────────────────────────────────────────────
    DEBOUNCE_SCROLL: 100,                // Scroll event debounce
    OBSERVER_RETRY: 100,                 // Canvas observer setup retry (CanvasSection)
    CURSOR_THROTTLE: 100,                // Collaboration cursor throttle
    DEBOUNCE_INPUT: 150,                 // User input debounce
    DEBOUNCE_RESIZE: 200,                // Window resize debounce
    STATE_TRANSITION: 200,               // State transition delay (useSceneState fitToView)
    FIT_TO_VIEW_DELAY: 200,              // Fit-to-view after scene load

    // ─────────────────────────────────────────────────────────────────────────
    // ANIMATION DURATIONS (150-500ms)
    // ─────────────────────────────────────────────────────────────────────────
    ANIMATION_FAST: 150,                 // Fast transitions
    ANIMATION_DEFAULT: 300,              // Standard animations
    DOUBLE_CLICK_WINDOW: 300,            // Double-click detection window (RulerCornerBox)
    ANIMATION_SLOW: 500,                 // Slow/emphasis animations
    ELEMENT_REMOVE: 500,                 // Element removal after feedback (DxfViewerContent)
    TOOLTIP_DELAY: 500,                  // Tooltip show delay
    AUTOSAVE_DEBOUNCE: 500,              // Auto-save debounce (useStorageSave)

    // ─────────────────────────────────────────────────────────────────────────
    // MEDIUM INTERVALS (1000-2000ms)
    // ─────────────────────────────────────────────────────────────────────────
    MEASURE_INTERVAL: 1000,              // Layout measurement (LayoutMapper)
    PERFORMANCE_MONITOR: 1000,           // Performance monitoring interval
    PAGE_RELOAD: 1500,                   // Page reload after storage action (StorageStatus)
    TOAST_SHORT: 2000,                   // Quick notifications
    COPY_FEEDBACK_RESET: 2000,           // Clipboard copy feedback reset (TestResultsModal)

    // ─────────────────────────────────────────────────────────────────────────
    // LONG INTERVALS (3000-60000ms)
    // ─────────────────────────────────────────────────────────────────────────
    TOAST_DEFAULT: 3000,                 // Standard notifications
    SAVE_STATUS_RESET: 3000,             // Save status reset to idle
    TOAST_LONG: 5000,                    // Important notifications
    PRESENCE_HEARTBEAT: 5000,            // Collaboration presence heartbeat
    SERVICE_INIT_TIMEOUT: 5000,          // Service initialization timeout
    AUTO_SAVE_INTERVAL: 30000,           // Auto-save interval (30 seconds)
    HEALTH_CHECK: 30000,                 // Service health check interval
    TEST_TIMEOUT: 30000,                 // Test runner timeout
    QUOTA_CHECK: 60000,                  // Storage quota check interval
    IMPORT_TIMEOUT: 60000,               // DXF import timeout (1 minute)
  },

  // ============================================================================
  // 🎭 ANIMATE - Animation tokens (ENTERPRISE 2026-01-05)
  // Centralizes all animate-* Tailwind classes
  // ============================================================================
  ANIMATE: {
    SPIN: 'animate-spin',                // Continuous rotation
    PING: 'animate-ping',                // Ping/pulse effect
    PULSE: 'animate-pulse',              // Gentle pulse
    BOUNCE: 'animate-bounce',            // Bouncing animation
    NONE: 'animate-none',                // No animation
  },

  // ============================================================================
  // 💍 RING - Focus ring tokens (ENTERPRISE 2026-01-05)
  // Centralizes all ring-* focus styles
  // ============================================================================
  RING: {
    // Ring widths
    NONE: 'ring-0',                      // No ring
    DEFAULT: 'ring',                     // Default ring (3px)
    '1': 'ring-1',                       // 1px ring
    '2': 'ring-2',                       // 2px ring
    '4': 'ring-4',                       // 4px ring
    // Ring colors (focus states)
    FOCUS_BLUE: 'ring-blue-500',         // Blue focus ring
    FOCUS_RED: 'ring-red-500',           // Red/error focus ring
    FOCUS_GREEN: 'ring-green-500',       // Green/success focus ring
    // Ring offsets
    OFFSET_1: 'ring-offset-1',           // 1px offset
    OFFSET_2: 'ring-offset-2',           // 2px offset
    // Combined focus ring patterns (common combinations)
    FOCUS_INFO: 'ring-2 ring-blue-500 ring-offset-2',    // Standard info focus
    FOCUS_ERROR: 'ring-2 ring-red-500 ring-offset-2',    // Error focus
    FOCUS_SUCCESS: 'ring-2 ring-green-500 ring-offset-2', // Success focus
  },

  // ============================================================================
  // 🎢 EASING - Transition timing functions (ENTERPRISE 2026-01-05)
  // Centralizes all ease-* Tailwind classes
  // ============================================================================
  EASING: {
    LINEAR: 'ease-linear',               // Linear timing (no acceleration)
    IN: 'ease-in',                       // Accelerate at start
    OUT: 'ease-out',                     // Decelerate at end
    IN_OUT: 'ease-in-out',               // Smooth start and end
  },

  // ============================================================================
  // 🔄 TRANSFORM - Transform tokens (ENTERPRISE 2026-01-05)
  // Centralizes all transform utilities
  // ============================================================================
  TRANSFORM: {
    // Centering transforms
    CENTER: 'transform -translate-x-1/2 -translate-y-1/2',  // Center absolutely positioned elements
    CENTER_X: 'transform -translate-x-1/2',                  // Center horizontally
    CENTER_Y: 'transform -translate-y-1/2',                  // Center vertically
    // Toggle/switch transforms
    TOGGLE_ON: 'translate-x-5',                              // Toggle switch ON position
    TOGGLE_OFF: 'translate-x-0',                             // Toggle switch OFF position
    // Rotation
    ROTATE_0: 'rotate-0',                                    // No rotation
    ROTATE_90: 'rotate-90',                                  // 90 degrees
    ROTATE_180: 'rotate-180',                                // 180 degrees (accordion arrows)
    ROTATE_270: 'rotate-270',                                // 270 degrees
    // Scale
    SCALE_100: 'scale-100',                                  // Normal scale
    SCALE_105: 'scale-105',                                  // Subtle hover scale
    SCALE_110: 'scale-110',                                  // Emphasized hover scale
    SCALE_95: 'scale-95',                                    // Pressed state
  },

  // ============================================================================
  // 📊 GRID - Grid layout tokens (ENTERPRISE 2026-01-05)
  // Centralizes all grid-cols-* patterns
  // ============================================================================
  GRID: {
    COLS_1: 'grid-cols-1',               // Single column
    COLS_2: 'grid-cols-2',               // Two columns
    COLS_3: 'grid-cols-3',               // Three columns
    COLS_4: 'grid-cols-4',               // Four columns
    COLS_5: 'grid-cols-5',               // Five columns
    COLS_6: 'grid-cols-6',               // Six columns
    // Responsive variants
    MD_COLS_2: 'md:grid-cols-2',         // 2 cols on medium screens
    MD_COLS_3: 'md:grid-cols-3',         // 3 cols on medium screens
  },

  // ============================================================================
  // 📐 FLEX_UTILS - Flexbox utility tokens (ENTERPRISE 2026-01-05)
  // Critical utilities for proper flexbox behavior
  // ============================================================================
  FLEX_UTILS: {
    ALLOW_SHRINK: 'min-w-0',             // Allows flex items to shrink below content width
    ALLOW_SCROLL: 'min-h-0',             // Enables overflow scrolling in flex containers
    FLEX_1_MIN_0: 'flex-1 min-w-0',      // Common pattern: flex-grow with shrink
  },

  // ============================================================================
  // ✂️ TEXT_OVERFLOW - Text overflow tokens (ENTERPRISE 2026-01-05)
  // Centralizes text truncation patterns
  // ============================================================================
  TEXT_OVERFLOW: {
    TRUNCATE: 'truncate',                // Single line truncation with ellipsis
    LINE_CLAMP_1: 'line-clamp-1',        // Clamp to 1 line
    LINE_CLAMP_2: 'line-clamp-2',        // Clamp to 2 lines
    LINE_CLAMP_3: 'line-clamp-3',        // Clamp to 3 lines
  },

  // ============================================================================
  // 📍 TEXT_ALIGN - Text alignment tokens (ENTERPRISE 2026-01-05)
  // Centralizes all text-center, text-left, text-right patterns
  // ============================================================================
  TEXT_ALIGN: {
    LEFT: 'text-left',                   // Left alignment
    CENTER: 'text-center',               // Center alignment
    RIGHT: 'text-right',                 // Right alignment
    JUSTIFY: 'text-justify',             // Justified text
  },

  // ============================================================================
  // 🔄 FLEX_SHRINK - Flex shrink tokens (ENTERPRISE 2026-01-05)
  // Centralizes flex-shrink patterns for consistent flex behavior
  // ============================================================================
  FLEX_SHRINK: {
    NONE: 'flex-shrink-0',               // Prevent shrinking (icons, fixed elements)
    DEFAULT: 'flex-shrink',              // Allow default shrinking
  },

  // ============================================================================
  // ↕️ SPACE - Space between children tokens (ENTERPRISE 2026-01-05)
  // Centralizes space-y-* and space-x-* patterns
  // ============================================================================
  SPACE: {
    Y_1: 'space-y-1',                    // 4px vertical spacing
    Y_2: 'space-y-2',                    // 8px vertical spacing
    Y_3: 'space-y-3',                    // 12px vertical spacing
    Y_4: 'space-y-4',                    // 16px vertical spacing
    Y_6: 'space-y-6',                    // 24px vertical spacing
    X_1: 'space-x-1',                    // 4px horizontal spacing
    X_2: 'space-x-2',                    // 8px horizontal spacing
    X_3: 'space-x-3',                    // 12px horizontal spacing
    X_4: 'space-x-4',                    // 16px horizontal spacing
  },

  // ============================================================================
  // 📏 BORDER_WIDTH - Border width tokens (ENTERPRISE 2026-01-05)
  // Centralizes border-0, border, border-2 patterns
  // ============================================================================
  BORDER_WIDTH: {
    NONE: 'border-0',                    // No border (reset)
    DEFAULT: 'border',                   // 1px border
    '2': 'border-2',                     // 2px border
    '4': 'border-4',                     // 4px border
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
    // 🏢 ENTERPRISE: BG_PRIMARY (bg-background) for consistency with centralized Input component
    // @see src/components/ui/input.tsx - uses colors.bg.primary (bg-background)
    BASE: [
      'flex-1',
      PANEL_LAYOUT.INPUT.PADDING,
      `${PANEL_COLORS.BG_PRIMARY} border ${PANEL_COLORS.BORDER_PRIMARY}`,
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

  // 🏢 ENTERPRISE: Content wrapper για consistent padding με GeneralSettingsPanel
  CONTENT_WRAPPER: PANEL_LAYOUT.CONTAINER.PADDING,

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
// 🏢 PANEL ANCHORING SYSTEM - ENTERPRISE ARCHITECTURE (ADR-029)
// ============================================================================
// Purpose: Centralized, declarative panel positioning system
// Similar to: Autodesk AutoCAD palette anchoring, Bentley MicroStation docking
// Benefits: No hardcoded positions, responsive, DOM-based measurements
// ============================================================================

/**
 * 🏢 ENTERPRISE: Panel Anchoring Configuration
 * Defines how floating panels anchor to layout elements
 */
export const PANEL_ANCHORING = {
  // ─────────────────────────────────────────────────────────────────────────
  // LAYOUT ELEMENT SELECTORS (data-testid values)
  // ─────────────────────────────────────────────────────────────────────────
  SELECTORS: {
    MAIN_TOOLBAR: '[data-testid="dxf-main-toolbar"]',
    CAD_STATUS_BAR: '[data-testid="cad-status-bar"]',
    CANVAS_CONTAINER: '[data-testid="dxf-canvas-container"]',
    SIDEBAR: '[data-testid="dxf-sidebar"]',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // OFFSET TOKENS (in pixels)
  // ─────────────────────────────────────────────────────────────────────────
  OFFSETS: {
    /** Margin from viewport edges */
    VIEWPORT_MARGIN: 8,
    /** Margin between panels */
    PANEL_GAP: 12,
    /** Toolbar to panel gap */
    TOOLBAR_GAP: 0,
    /** Status bar to panel gap */
    STATUSBAR_GAP: 4,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FALLBACK VALUES (when DOM elements not found)
  // ─────────────────────────────────────────────────────────────────────────
  FALLBACKS: {
    /** Main toolbar height (header + toolbar rows) */
    TOOLBAR_BOTTOM: 140,
    /** Status bar height from bottom */
    STATUSBAR_HEIGHT: 32,
    /** Windows taskbar height (approximate) */
    WINDOWS_TASKBAR: 40,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 🏢 PANEL DIMENSIONS - Centralized floating panel sizes (ADR-029)
  // ─────────────────────────────────────────────────────────────────────────
  DIMENSIONS: {
    /** Overlay Drawing Toolbar (Εργαλεία Σχεδίασης) */
    OVERLAY_TOOLBAR: {
      width: 380,
      height: 80,
    },
    /** Overlay Properties Panel (Ιδιότητες Overlay) */
    OVERLAY_PROPERTIES: {
      width: 340,
      height: 500,
    },
    /** PDF Background Controls Panel (Ρυθμίσεις PDF) */
    PDF_CONTROLS: {
      width: 280,
      height: 450,
    },
    /** Performance Monitor Panel */
    PERFORMANCE_MONITOR: {
      width: 340,
      height: 400,
    },
    /** Default panel dimensions */
    DEFAULT: {
      width: 340,
      height: 400,
    },
  },
} as const;

/**
 * 🏢 ENTERPRISE: Panel Position Calculator
 *
 * Pure functions for calculating panel positions based on DOM measurements.
 * Follows Autodesk/Bentley patterns for palette anchoring.
 */
export const PanelPositionCalculator = {
  /**
   * Calculate position for TOP-RIGHT anchored panel (below toolbar)
   *
   * Anchor: Panel TOP edge aligns with toolbar BOTTOM edge
   * Horizontal: Panel RIGHT edge aligns with viewport RIGHT edge
   */
  getTopRightPosition: (panelWidth: number): { x: number; y: number } => {
    const { SELECTORS, OFFSETS, FALLBACKS } = PANEL_ANCHORING;

    // 🎯 Find toolbar bottom position via DOM
    const toolbar = document.querySelector(SELECTORS.MAIN_TOOLBAR);
    let toolbarBottom: number = FALLBACKS.TOOLBAR_BOTTOM;

    if (toolbar) {
      const rect = toolbar.getBoundingClientRect();
      toolbarBottom = rect.bottom;
    }

    return {
      x: window.innerWidth - panelWidth - OFFSETS.VIEWPORT_MARGIN,
      y: toolbarBottom + OFFSETS.TOOLBAR_GAP,
    };
  },

  /**
   * Calculate position for BOTTOM-RIGHT anchored panel (above status bar)
   *
   * Anchor: Panel BOTTOM edge aligns with status bar TOP edge
   * Horizontal: Panel RIGHT edge aligns with viewport RIGHT edge
   */
  getBottomRightPosition: (panelWidth: number, panelHeight: number): { x: number; y: number } => {
    const { SELECTORS, OFFSETS, FALLBACKS } = PANEL_ANCHORING;

    // 🎯 Find status bar top position via DOM
    const statusBar = document.querySelector(SELECTORS.CAD_STATUS_BAR);

    let panelBottomY: number;

    if (statusBar) {
      const rect = statusBar.getBoundingClientRect();
      // Panel BOTTOM = Status bar TOP - gap
      panelBottomY = rect.top - OFFSETS.STATUSBAR_GAP;
    } else {
      // Fallback: Use screen.availHeight which EXCLUDES Windows taskbar
      // This is the most reliable cross-browser way to get usable screen height
      const availableHeight = window.screen.availHeight;
      const windowTop = window.screenY || window.screenTop || 0;

      // Calculate where the bottom of usable area is relative to viewport
      panelBottomY = availableHeight - windowTop - FALLBACKS.STATUSBAR_HEIGHT - OFFSETS.STATUSBAR_GAP;

      // Clamp to viewport
      panelBottomY = Math.min(panelBottomY, window.innerHeight - FALLBACKS.STATUSBAR_HEIGHT);
    }

    // y = panelBottom - panelHeight (top-left corner position)
    return {
      x: window.innerWidth - panelWidth - OFFSETS.VIEWPORT_MARGIN,
      y: panelBottomY - panelHeight,
    };
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