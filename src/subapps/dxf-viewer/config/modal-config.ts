/**
 * @fileoverview Enterprise Modal Configuration
 * @description Centralized modal sizing, styling, and behavior patterns following enterprise standards
 * @author Claude (Anthropic AI)
 * @date 2025-12-17
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards
 */

// 🏢 ENTERPRISE: Centralized border tokens for consistency
const MODAL_CONFIG_BORDERS = {
  dark: 'border-gray-600',      // Dark theme borders
  light: 'border-gray-200',     // Light theme borders
} as const;

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
    content: 'bg-background text-foreground border',
    overlay: 'bg-black/80',
    header: 'border-b border-border',
    footer: 'border-t border-border',
  },

  // Dark theme for DXF viewer and technical interfaces
  DARK_TECHNICAL: {
    content: `bg-gray-800 text-white ${MODAL_CONFIG_BORDERS.dark}`,
    overlay: 'bg-black/75 backdrop-blur-sm',
    header: `border-b ${MODAL_CONFIG_BORDERS.dark}`,
    footer: `border-t ${MODAL_CONFIG_BORDERS.dark}`,
  },

  // Light theme for admin and business interfaces
  LIGHT_BUSINESS: {
    content: `bg-white text-gray-900 ${MODAL_CONFIG_BORDERS.light}`,
    overlay: 'bg-black/50',
    header: `border-b ${MODAL_CONFIG_BORDERS.light}`,
    footer: `border-t ${MODAL_CONFIG_BORDERS.light}`,
  },

  // Success theme for confirmations
  SUCCESS: {
    content: 'bg-green-50 text-green-900 border-green-200',
    overlay: 'bg-black/60',
    header: 'border-b border-green-200',
    footer: 'border-t border-green-200',
  },

  // Warning theme for destructive actions
  WARNING: {
    content: 'bg-red-50 text-red-900 border-red-200',
    overlay: 'bg-black/70',
    header: 'border-b border-red-200',
    footer: 'border-t border-red-200',
  },
} as const;

// ====================================================================
// ENTERPRISE Z-INDEX MANAGEMENT
// ====================================================================

/**
 * Centralized z-index values for proper modal layering
 * Based on design system standards and preventing conflicts
 */
export const MODAL_Z_INDEX = {
  // Base modal layer
  BASE: 50,

  // Nested modals (modal within modal)
  NESTED: 60,

  // Critical system modals (errors, confirmations)
  SYSTEM: 70,

  // Toast notifications (should appear above all modals)
  NOTIFICATIONS: 80,

  // Dev tools and debug panels
  DEBUG: 90,

  // Emergency override (use sparingly)
  EMERGENCY: 100,
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
    zIndex: MODAL_Z_INDEX.NESTED,
    className: `${MODAL_SIZES.UPLOAD} ${MODAL_HEIGHTS.AUTO}`,
  },

  // Project Selection Modal Configuration
  PROJECT_WIZARD: {
    size: MODAL_SIZES.WIZARD,
    height: MODAL_HEIGHTS.STANDARD_SCROLL,
    theme: MODAL_THEMES.DARK_TECHNICAL,
    zIndex: MODAL_Z_INDEX.BASE,
    className: `${MODAL_SIZES.WIZARD} ${MODAL_HEIGHTS.STANDARD_SCROLL}`,
  },

  // Settings Modal Configuration
  SETTINGS_PANEL: {
    size: MODAL_SIZES.SETTINGS,
    height: MODAL_HEIGHTS.TALL,
    theme: MODAL_THEMES.DEFAULT,
    zIndex: MODAL_Z_INDEX.BASE,
    className: `${MODAL_SIZES.SETTINGS} ${MODAL_HEIGHTS.TALL}`,
  },

  // Confirmation Modal Configuration
  CONFIRMATION: {
    size: MODAL_SIZES.CONFIRMATION,
    height: MODAL_HEIGHTS.AUTO,
    theme: MODAL_THEMES.DEFAULT,
    zIndex: MODAL_Z_INDEX.SYSTEM,
    className: `${MODAL_SIZES.CONFIRMATION} ${MODAL_HEIGHTS.AUTO}`,
  },

  // Contact Form Modal Configuration
  CONTACT_FORM: {
    size: MODAL_SIZES.LARGE,
    height: MODAL_HEIGHTS.STANDARD_SCROLL,
    theme: MODAL_THEMES.DEFAULT,
    zIndex: MODAL_Z_INDEX.BASE,
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

/**
 * Get z-index CSS class
 */
export function getModalZIndex(level: keyof typeof MODAL_Z_INDEX): string {
  return `z-[${MODAL_Z_INDEX[level]}]`;
}

// ====================================================================
// TYPE EXPORTS
// ====================================================================

export type ModalSize = keyof typeof MODAL_SIZES;
export type ModalHeight = keyof typeof MODAL_HEIGHTS;
export type ModalTheme = keyof typeof MODAL_THEMES;
export type ModalZIndex = keyof typeof MODAL_Z_INDEX;
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