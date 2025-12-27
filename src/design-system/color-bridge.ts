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

    // Interactive states
    hover: 'bg-accent',            // Hover state → --accent
    active: 'bg-accent/80',        // Active state → --accent with opacity

    // Status colors
    success: 'bg-green-50',        // Success background
    error: 'bg-red-50',            // Error background
    warning: 'bg-yellow-50',       // Warning background
    info: 'bg-blue-50',            // Info background

    // Subtle variants
    successSubtle: 'bg-green-50',  // Soft success
    errorSubtle: 'bg-red-50',      // Soft error
    infoSubtle: 'bg-blue-50',      // Soft info
    neutralSubtle: 'bg-muted',     // Soft neutral

    // Special backgrounds
    light: 'bg-card',              // ✅ ENTERPRISE: Light surface (was white, now beautiful blue)
    transparent: 'bg-transparent', // Transparent
  },

  /** 📝 Text Color Mappings */
  text: {
    // Core text colors
    primary: 'text-foreground',           // Main text → --foreground
    secondary: 'text-muted-foreground',   // Secondary text → --muted-foreground
    muted: 'text-muted-foreground',       // Muted text → --muted-foreground
    inverse: 'text-primary-foreground',   // Text on dark backgrounds

    // Status text colors
    success: 'text-green-600',            // Success text
    error: 'text-red-600',                // Error text
    warning: 'text-yellow-600',           // Warning text
    info: 'text-blue-600',                // Info text
    price: 'text-green-600',              // Price text (reuse success)

    // Strong text variants
    successStrong: 'text-green-800',      // Strong success text
    errorStrong: 'text-red-800',          // Strong error text
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

    // Status borders
    success: 'border-green-300',          // Success border
    error: 'border-red-300',              // Error border
    warning: 'border-yellow-300',         // Warning border
    info: 'border-blue-300',              // Info border
  },

  /** 🎯 Interactive State Mappings (Legacy Support) */
  interactive: {
    focus: {
      ring: 'focus:ring-2 focus:ring-ring',  // Focus ring → --ring
    },
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