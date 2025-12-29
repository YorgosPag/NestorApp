// ============================================================================
// 🌉 COLOR BRIDGE - Single Source of Truth Mapping
// ============================================================================
//
// ✨ Bridge between Enterprise Semantic API ↔ shadcn/ui CSS Variables
// 🎯 Single source of truth for color mappings
// 🔒 Compile-time safe, auditable, reversible
//
// Enterprise → shadcn → CSS Variables → UI
// ============================================================================

/**
 * 🌉 COLOR BRIDGE MAPPING TABLE
 *
 * Maps semantic Enterprise API calls to working shadcn/ui Tailwind classes
 *
 * @example
 * // Before (broken):
 * colors.bg.primary → 'bg-[hsl(var(--bg-primary))]' ❌
 *
 * // After (working):
 * colors.bg.primary → 'bg-background' ✅
 */
export const COLOR_BRIDGE = {
  /** 🎨 Background Color Mappings */
  bg: {
    // Core backgrounds
    primary: 'bg-background',      // CORRECTED BACK: Use --background for navigation test
    secondary: 'bg-muted',         // Secondary areas → --muted
    card: 'bg-card',               // Card backgrounds → --card
    surface: 'bg-card',            // Surface/elevated → --card

    // ✅ ENTERPRISE MISSING MAPPINGS - Required by DXF-Viewer components
    muted: 'bg-muted',             // Muted backgrounds
    skeleton: 'bg-muted',          // Loading skeleton backgrounds
    tertiary: 'bg-slate-100',      // Tertiary backgrounds
    elevated: 'bg-card',           // Elevated surfaces
    selection: 'bg-accent',        // Selected states
    backgroundSecondary: 'bg-muted', // Secondary background surfaces
    overlay: 'bg-background/95',   // Overlay backgrounds
    accent: 'bg-accent',           // Accent backgrounds

    // Interactive states
    hover: 'bg-accent',            // Hover state → --accent
    active: 'bg-accent/80',        // Active state → --accent with opacity

    // Status colors
    success: 'bg-green-50',        // Success background
    error: 'bg-red-50',            // Error background
    warning: 'bg-yellow-50',       // Warning background
    info: 'bg-blue-50',            // Info background

    // ✅ ENTERPRISE MISSING STATUS VARIANTS
    danger: 'bg-red-50',           // Danger background (alias for error)
    successHover: 'bg-green-100',  // Success hover state
    dangerHover: 'bg-red-100',     // Danger hover state

    // Subtle variants
    successSubtle: 'bg-green-50',  // Soft success
    errorSubtle: 'bg-red-50',      // Soft error
    infoSubtle: 'bg-blue-50',      // Soft info
    neutralSubtle: 'bg-muted',     // Soft neutral
    warningSubtle: 'bg-yellow-50', // Soft warning
    errorLight: 'bg-red-100',      // Light error background
    warningLight: 'bg-yellow-100', // Light warning background

    // Special backgrounds
    light: 'bg-card',              // ✅ ENTERPRISE: Light surface (was white, now beautiful blue)
    transparent: 'bg-transparent', // Transparent

    // ✅ GOOGLE-STYLE FIX: Missing constraint colors
    yellow: 'bg-yellow-100',       // Yellow constraint backgrounds
    orange: 'bg-orange-100',       // Orange constraint backgrounds
    purple: 'bg-purple-100',       // Purple constraint backgrounds
    magenta: 'bg-pink-100',        // Magenta constraint backgrounds (pink is closest)
  },

  /** 📝 Text Color Mappings */
  text: {
    // Core text colors
    primary: 'text-foreground',           // Main text → --foreground
    secondary: 'text-muted-foreground',   // Secondary text → --muted-foreground
    muted: 'text-muted-foreground',       // Muted text → --muted-foreground
    inverse: 'text-primary-foreground',   // Text on dark backgrounds
    inverted: 'text-primary-foreground',  // ✅ ENTERPRISE: Alias for inverse (used in DestinationWizard)
    foreground: 'text-foreground',        // ✅ ENTERPRISE: Direct foreground mapping

    // Status text colors
    success: 'text-green-600',            // Success text
    error: 'text-red-600',                // Error text
    warning: 'text-yellow-600',           // Warning text
    info: 'text-blue-600',                // Info text
    price: 'text-green-600',              // Price text (reuse success)

    // Strong text variants
    successStrong: 'text-green-800',      // Strong success text
    errorStrong: 'text-red-800',          // Strong error text

    // ✅ ENTERPRISE MISSING VARIANTS - ADDED FOR COMPONENT COMPATIBILITY
    danger: 'text-red-600',               // Danger text (alias for error)
    accent: 'text-blue-600',              // Accent text (alias for info)
    tertiary: 'text-slate-500',           // Tertiary text για DynamicInput components

    // ✅ GOOGLE-STYLE FIX: Missing constraint text colors
    yellow: 'text-yellow-600',            // Yellow constraint text
    orange: 'text-orange-600',            // Orange constraint text
    purple: 'text-purple-600',            // Purple constraint text
    magenta: 'text-pink-600',             // Magenta constraint text (pink is closest)
  },

  /** 🔲 Border Color Mappings */
  border: {
    // Core borders
    default: 'border-border',             // Default border → --border
    muted: 'border-border',               // Muted border → --border
    primary: 'border-border',             // Primary border → --border
    secondary: 'border-border',           // Secondary border → --border

    // Interactive borders
    focus: 'border-ring',                 // Focus border → --ring
    input: 'border-input',                // Input border → --input
    checkbox: 'border-[1px] border-[rgb(229, 231, 235)] rounded-md', // ✅ ENTERPRISE: Checkbox borders

    // Status borders
    success: 'border-green-300',          // Success border
    error: 'border-red-300',              // Error border
    warning: 'border-yellow-300',         // Warning border
    info: 'border-blue-300',              // Info border
  },

  /** 💍 Ring Color Mappings (Focus States) */
  ring: {
    // Core rings
    default: 'ring-ring',                 // Default ring → --ring
    muted: 'ring-ring/50',               // Muted ring → --ring with opacity
    primary: 'ring-ring',                // Primary ring → --ring

    // Status rings
    success: 'ring-green-500',           // Success ring
    error: 'ring-red-500',               // Error ring
    warning: 'ring-yellow-500',          // Warning ring
    info: 'ring-blue-500',               // Info ring
  },

  /** 🎯 Interactive State Mappings (Legacy Support) */
  interactive: {
    focus: {
      ring: 'focus:ring-2 focus:ring-ring',  // Focus ring → --ring
    },
  },

  /** 🌈 ENTERPRISE GRADIENT MAPPINGS - Professional gradient patterns */
  gradients: {
    // Map-specific gradients
    mapSuccess: 'bg-gradient-to-br from-green-100 via-blue-50 to-green-100',  // Maps success areas
    mapWarning: 'bg-gradient-to-br from-yellow-100 via-orange-50 to-yellow-100', // Maps warning areas
    mapInfo: 'bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-100',    // Maps info areas

    // Generic gradients
    successSubtle: 'bg-gradient-to-r from-green-50 to-green-100',           // Soft success
    warningSubtle: 'bg-gradient-to-r from-yellow-50 to-yellow-100',         // Soft warning
    infoSubtle: 'bg-gradient-to-r from-blue-50 to-blue-100',               // Soft info
    neutralSubtle: 'bg-gradient-to-r from-gray-50 to-gray-100',            // Soft neutral

    // Card gradients
    cardElevated: 'bg-gradient-to-b from-card to-muted',                    // Elevated cards
    cardInteractive: 'bg-gradient-to-br from-card via-accent/5 to-card',    // Interactive cards
  },
} as const;

/**
 * 🔍 Type Definitions for Bridge Mappings
 * Compile-time safety for color bridge usage
 */
export type BgColorKey = keyof typeof COLOR_BRIDGE.bg;
export type TextColorKey = keyof typeof COLOR_BRIDGE.text;
export type BorderColorKey = keyof typeof COLOR_BRIDGE.border;

/**
 * 🎯 Bridge Validation Helpers
 * Runtime checks to ensure mappings are valid
 */
export const validateBridgeMapping = (
  category: keyof typeof COLOR_BRIDGE,
  key: string
): boolean => {
  return key in COLOR_BRIDGE[category];
};

/**
 * 📊 Bridge Statistics
 * Useful for migration tracking and analytics
 */
export const BRIDGE_STATS = {
  totalMappings: Object.keys(COLOR_BRIDGE.bg).length +
                 Object.keys(COLOR_BRIDGE.text).length +
                 Object.keys(COLOR_BRIDGE.border).length,
  backgroundMappings: Object.keys(COLOR_BRIDGE.bg).length,
  textMappings: Object.keys(COLOR_BRIDGE.text).length,
  borderMappings: Object.keys(COLOR_BRIDGE.border).length,
} as const;

/**
 * 🎨 Default Export
 * Main bridge for consumption by useSemanticColors
 */
export default COLOR_BRIDGE;