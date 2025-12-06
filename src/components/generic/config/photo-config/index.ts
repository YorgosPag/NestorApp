// ============================================================================
// PHOTO CONFIGURATION - MAIN INDEX
// ============================================================================
//
// 📱 Enterprise Photo Configuration System - Main Entry Point
// Centralized access to all photo-related configurations and utilities
//
// 🏢 ENTERPRISE BENEFITS:
// - Tree-shaking optimization (import only what you need)
// - Clear separation of concerns (dimensions vs styling vs utilities)
// - Enhanced maintainability (focused modules)
// - Better developer experience (organized imports)
//
// ============================================================================

// =============================================================================
// DIMENSIONS MODULE - 📐 Size, layout and responsive configurations
// =============================================================================
export * from './dimensions';

// =============================================================================
// STYLING MODULE - 🎨 Colors, typography and effects
// =============================================================================
export * from './styling';

// =============================================================================
// UTILITIES MODULE - 🛠️ Helper functions and context mappings
// =============================================================================
export * from './utils';

// =============================================================================
// CONVENIENCE RE-EXPORTS - Most commonly used configurations
// =============================================================================

// Primary dimensions
export {
  PHOTO_SIZES,
  PHOTO_HEIGHTS,
  PHOTO_WIDTHS,
  PHOTO_LAYOUTS,
  PHOTO_RESPONSIVE
} from './dimensions';

// Primary styling
export {
  PHOTO_COLORS,
  PHOTO_BORDERS,
  PHOTO_TEXT_COLORS,
  PHOTO_TYPOGRAPHY,
  PHOTO_COMBINED_EFFECTS
} from './styling';

// Primary utilities
export {
  buildPhotoClass,
  getPhotoConfig,
  buildContextPhotoClass,
  getPhotoContextConfig
} from './utils';

// Key types
export type { PhotoType, PhotoContext } from './utils';