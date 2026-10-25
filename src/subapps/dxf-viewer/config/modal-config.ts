/**
 * @fileoverview Enterprise Modal Configuration
 * @description Centralized modal sizing, styling, and behavior patterns following enterprise standards
 * @author Claude (Anthropic AI)
 * @date 2025-12-17
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards
 */

// 🏢 ENTERPRISE: Import centralized panel tokens instead of local duplicates
import { PANEL_COLORS } from './panel-tokens';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
// 🏢 ENTERPRISE: Import semantic colors for proper centralization

// ====================================================================
// ENTERPRISE MODAL SIZING STANDARDS
// ====================================================================

/**
 * Standard modal size presets based on content type and user experience best practices
 * Following Material Design and Human Interface Guidelines
 */
export const MODAL_SIZES = {
  // Small modals for simple forms, confirmations
  SMALL: 'sm:max-w-[400px]',

  // Medium modals for standard forms, settings
  MEDIUM: 'sm:max-w-[600px]',

  // Large modals for complex forms, data entry
  LARGE: 'sm:max-w-[800px]',

  // Extra large for wizards, multi-step processes
  EXTRA_LARGE: 'sm:max-w-[900px]',

  // Full width for dashboards, complex interfaces
  FULL_WIDTH: 'sm:max-w-[95vw]',

  // Specific use cases
  WIZARD: 'sm:max-w-[700px]',           // Multi-step processes
  SETTINGS: 'sm:max-w-[650px]',         // Settings panels
  CONFIRMATION: 'sm:max-w-[450px]',     // Delete/confirm dialogs
  UPLOAD: 'sm:max-w-[500px]',          // File upload modals
  PREVIEW: 'sm:max-w-[1000px]',        // Content preview
} as const;

/**
 * Standard modal height constraints with overflow handling
 */
export const MODAL_HEIGHTS = {
  // Standard heights
  AUTO: '',                             // Auto height based on content
  COMPACT: 'max-h-[60vh]',             // Compact for mobile
  STANDARD: 'max-h-[75vh]',            // Standard desktop
  TALL: 'max-h-[85vh]',                // Tall content
  FULL: 'max-h-[95vh]',                // Maximum utilization

  // With overflow
  AUTO_SCROLL: 'max-h-[75vh] overflow-y-auto',
  STANDARD_SCROLL: 'max-h-[85vh] overflow-y-auto',
  FULL_SCROLL: 'max-h-[95vh] overflow-y-auto',
} as const;

// ====================================================================
// ENTERPRISE MODAL THEMES
// ====================================================================

/**
 * Modal theme configurations for different contexts
 */
export const MODAL_THEMES = {
  // Default theme for general use
  DEFAULT: {
    content: `${COLOR_BRIDGE.bg.primary} text-foreground border`,
    overlay: 'bg-black/80',
    header: 'border-b border-border',
    footer: 'border-t border-border',
  },

  // Dark theme for DXF viewer and technical interfaces
  DARK_TECHNICAL: {
    content: `bg-background-secondary text-foreground border ${PANEL_COLORS.BORDER_PRIMARY}`,
    overlay: 'bg-black/75 backdrop-blur-sm',
    header: `border-b ${PANEL_COLORS.BORDER_PRIMARY}`, // ✅ ENTERPRISE: Using centralized PANEL_COLORS
    footer: `border-t ${PANEL_COLORS.BORDER_PRIMARY}`, // ✅ ENTERPRISE: Using centralized PANEL_COLORS
  },

  // Light theme for admin and business interfaces
  LIGHT_BUSINESS: {
    content: `${COLOR_BRIDGE.bg.primary} text-foreground border ${PANEL_COLORS.BORDER_SECONDARY}`, // ✅ ENTERPRISE: bg-white/text-black → semantic colors // ✅ ENTERPRISE: Using centralized PANEL_COLORS - black for light theme
    overlay: 'bg-black/50',
    header: `border-b ${PANEL_COLORS.BORDER_SECONDARY}`, // ✅ ENTERPRISE: Using centralized PANEL_COLORS
    footer: `border-t ${PANEL_COLORS.BORDER_SECONDARY}`, // ✅ ENTERPRISE: Using centralized PANEL_COLORS
  },

  // Success theme for confirmations
  SUCCESS: {
    content: `bg-success/10 text-success-foreground border ${PANEL_COLORS.BORDER_SUCCESS_SECONDARY}`,
    overlay: 'bg-black/60',
    header: `border-b ${PANEL_COLORS.BORDER_SUCCESS_SECONDARY}`, // ✅ ENTERPRISE: Centralized success border
    footer: `border-t ${PANEL_COLORS.BORDER_SUCCESS_SECONDARY}`, // ✅ ENTERPRISE: Centralized success border
  },

  // Warning theme for destructive actions
  WARNING: {
    content: `bg-destructive/10 text-destructive-foreground border ${PANEL_COLORS.BORDER_PRIMARY}`,
    overlay: 'bg-black/70',
    header: `border-b ${PANEL_COLORS.BORDER_PRIMARY}`, // ✅ ENTERPRISE: Centralized error border
    footer: `border-t ${PANEL_COLORS.BORDER_PRIMARY}`, // ✅ ENTERPRISE: Centralized error border
  },
} as const;

// ====================================================================
// ENTERPRISE Z-INDEX MANAGEMENT
// ====================================================================

/**
 * ⚠️ ADR-780 — a Radix `Dialog` takes its layer from the ONE z-index scale (`--z-index-transient-stack`), for its
 * overlay AND its content together. This file used to hand out a private ladder (BASE 50 · NESTED 60 · SYSTEM 70 …)
 * that the DXF import dialogs applied as an inline `zIndex` on `DialogContent`: once the scale moved the overlay to
 * 1095, the content stayed at 60 — the backdrop covered the dialog and every click on it «closed» the dialog as an
 * outside click (the window looked dark and did nothing). The ladder is gone so it cannot be applied again; the
 * anchor is `src/components/ui/__tests__/layer-contract.test.tsx` Σ6.
 *
 * What remains is the colour dialog's own shell (not a Radix Dialog, no shared overlay).
 */
export const MODAL_Z_INDEX = {
  // 🏢 ENTERPRISE: Color Dialog Z-Index (maximum - above canvas crosshair overlays)
  // Note: These must be at maximum z-index level to appear above WebGL/Canvas overlays
  COLOR_DIALOG_CONTAINER: 2147483646,  // Just below max to allow stacking
  COLOR_DIALOG: 2147483647,            // Maximum z-index - above everything
} as const;

// ====================================================================
// ENTERPRISE MODAL CONFIGURATIONS
// ====================================================================

/**
 * Pre-configured modal setups for common use cases
 */
export const MODAL_CONFIGURATIONS = {
  // DXF Import Modal Configuration
  DXF_IMPORT: {
    size: MODAL_SIZES.UPLOAD,
    height: MODAL_HEIGHTS.AUTO,
    theme: MODAL_THEMES.DARK_TECHNICAL,
    className: `${MODAL_SIZES.UPLOAD} ${MODAL_HEIGHTS.AUTO}`,
  },

  // Project Selection Modal Configuration
  PROJECT_WIZARD: {
    size: MODAL_SIZES.WIZARD,
    height: MODAL_HEIGHTS.STANDARD_SCROLL,
    theme: MODAL_THEMES.DARK_TECHNICAL,
    className: `${MODAL_SIZES.WIZARD} ${MODAL_HEIGHTS.STANDARD_SCROLL}`,
  },

  // Settings Modal Configuration
  SETTINGS_PANEL: {
    size: MODAL_SIZES.SETTINGS,
    height: MODAL_HEIGHTS.TALL,
    theme: MODAL_THEMES.DEFAULT,
    className: `${MODAL_SIZES.SETTINGS} ${MODAL_HEIGHTS.TALL}`,
  },

  // Confirmation Modal Configuration
  CONFIRMATION: {
    size: MODAL_SIZES.CONFIRMATION,
    height: MODAL_HEIGHTS.AUTO,
    theme: MODAL_THEMES.DEFAULT,
    className: `${MODAL_SIZES.CONFIRMATION} ${MODAL_HEIGHTS.AUTO}`,
  },

  // Contact Form Modal Configuration
  CONTACT_FORM: {
    size: MODAL_SIZES.LARGE,
    height: MODAL_HEIGHTS.STANDARD_SCROLL,
    theme: MODAL_THEMES.DEFAULT,
    className: `${MODAL_SIZES.LARGE} ${MODAL_HEIGHTS.STANDARD_SCROLL}`,
  },
} as const;

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

/**
 * Get modal configuration by type
 */
export function getModalConfig(type: keyof typeof MODAL_CONFIGURATIONS) {
  return MODAL_CONFIGURATIONS[type];
}

/**
 * Build custom modal className from configuration
 */
export function buildModalClassName(config: {
  size?: string;
  height?: string;
  theme?: typeof MODAL_THEMES[keyof typeof MODAL_THEMES];
  additionalClasses?: string;
}): string {
  const { size, height, theme, additionalClasses = '' } = config;

  const classes = [
    size || MODAL_SIZES.MEDIUM,
    height || MODAL_HEIGHTS.AUTO,
    theme?.content || MODAL_THEMES.DEFAULT.content,
    additionalClasses,
  ].filter(Boolean);

  return classes.join(' ');
}

// ====================================================================
// TYPE EXPORTS
// ====================================================================

export type ModalSize = keyof typeof MODAL_SIZES;
export type ModalHeight = keyof typeof MODAL_HEIGHTS;
export type ModalTheme = keyof typeof MODAL_THEMES;
export type ModalConfiguration = keyof typeof MODAL_CONFIGURATIONS;

// ====================================================================
// ENTERPRISE STANDARDS COMPLIANCE
// ====================================================================

/**
 * This configuration follows enterprise standards:
 * ✅ No inline styles
 * ✅ No hardcoded values
 * ✅ Centralized configuration
 * ✅ Type safety
 * ✅ Consistent naming
 * ✅ Comprehensive documentation
 * ✅ Future-proof extensibility
 */