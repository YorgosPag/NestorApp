// ============================================================================
// ⚠️ DEPRECATED - ENTERPRISE PHOTO CONFIG REDIRECT
// ============================================================================
//
// 🚨 This monolithic file has been REPLACED with modular Enterprise architecture
//
// OLD STRUCTURE (❌ Deprecated):
// - 527 lines of mixed configurations in single file
// - Poor maintainability and reusability
// - Monolithic "God Object" anti-pattern
//
// NEW STRUCTURE (✅ Enterprise):
// - Modular architecture with focused modules
// - Clean separation of concerns
// - Better tree-shaking and performance
// - Enhanced developer experience
//
// ============================================================================

// ============================================================================
// 🔄 MIGRATION GUIDE
// ============================================================================

/*

BEFORE (Old imports):
import { PHOTO_HEIGHTS, PHOTO_COLORS } from './photo-dimensions';

AFTER (New imports):
import { PHOTO_HEIGHTS, PHOTO_COLORS } from './photo-dimensions';

No import changes needed! Backward compatibility maintained.

ADVANCED IMPORTS (for better tree-shaking):
import { PHOTO_SIZES } from './photo-config/dimensions';
import { PHOTO_COLORS } from './photo-config/styling';
import { buildPhotoClass } from './photo-config/utils';

*/

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// All exports from the new modular structure
export * from './photo-config';

// ============================================================================
// DEPRECATION WARNING
// ============================================================================

console.warn(`
🚨 DEPRECATION WARNING: Direct import from 'photo-dimensions.ts'

This file has been refactored into Enterprise modular architecture:

📁 NEW STRUCTURE:
├── photo-config/
│   ├── dimensions/     - Sizes, layouts & responsive configs
│   ├── styling/        - Colors, typography & effects
│   └── utils/          - Helper functions & contexts

✅ BENEFITS:
- Better tree-shaking & performance
- Enhanced maintainability
- Focused modules with clear responsibilities
- Improved developer experience

📖 See migration guide above for import examples.
`);

// Note: This file provides full backward compatibility while encouraging migration to the new modular structure

// ============================================================================
// LEGACY FUNCTION EXPORTS (Backward Compatibility)
// ============================================================================

// Re-exported from new modular structure για backward compatibility
// These are now imported from the organized modules

// Import legacy helpers for backward compatibility
import {
  calculatePhotoDimensions,
  buildResponsiveGrid,
  getPhotoConfig,
  getPhotoContextConfig,
  PHOTO_LAYOUTS
} from './photo-config';
import type { PhotoContext } from './photo-config';

// 🏢 ENTERPRISE: Define layout key type for type-safe casting
type PhotoLayoutKey = keyof typeof PHOTO_LAYOUTS;

// Legacy function exports for backward compatibility
export function getPhotoDimensions(viewportWidth: number = 1024): string {
  console.warn('⚠️ getPhotoDimensions is deprecated. Use calculatePhotoDimensions from photo-config instead.');
  // Default to 'individual' type for backward compatibility
  const dimensions = calculatePhotoDimensions(viewportWidth, 'individual');
  return `w-[${dimensions.width}px] h-[${dimensions.height}px]`;
}

export function getPhotoLayout(layout: string) {
  console.warn('⚠️ getPhotoLayout is deprecated. Use PHOTO_LAYOUTS from photo-config directly.');
  // Return layout key from PHOTO_LAYOUTS based on string key
  const layoutKey = layout as PhotoLayoutKey;
  return PHOTO_LAYOUTS[layoutKey] || PHOTO_LAYOUTS.PHOTO_GRID;
}

export function buildResponsivePhotoClass(
  mobile?: string,
  tablet?: string,
  desktop?: string
): string {
  console.warn('⚠️ buildResponsivePhotoClass is deprecated. Use buildResponsiveGrid from photo-config/utils.');
  // Fallback implementation for backward compatibility
  const classes: string[] = [];
  if (mobile) classes.push(mobile);
  if (tablet) classes.push(tablet);
  if (desktop) classes.push(desktop);
  return classes.join(' ') || buildResponsiveGrid('individual');
}

// ============================================================================
// MODERN REPLACEMENTS - Use these instead of deprecated functions
// ============================================================================

/*

MODERN USAGE EXAMPLES:

// OLD WAY (still works, but deprecated):
import { getPhotoDimensions } from './photo-dimensions';
const size = getPhotoDimensions('CONTACT_FORM');

// NEW WAY (recommended):
import { getPhotoConfig } from './photo-config';
const config = getPhotoConfig('individual');

// EVEN BETTER (tree-shaking friendly):
import { PHOTO_SIZES } from './photo-config/dimensions';
const size = PHOTO_SIZES.STANDARD_PREVIEW;

*/

// All configurations are now re-exported from the modular structure
// This maintains 100% backward compatibility for existing imports

// Legacy function for color scheme mapping
export function getPhotoColorScheme(context: 'container' | 'empty' | 'placeholder' | 'overlay' | 'label' | 'thumbnail') {
  console.warn('⚠️ getPhotoColorScheme is deprecated. Use getContextColorScheme from photo-config/utils.');

  // Fallback implementation για backward compatibility
  const { PHOTO_STYLES } = require('./photo-config');

  switch (context) {
    case 'container':
      return PHOTO_STYLES?.PHOTO_CONTAINER || '';
    case 'empty':
      return PHOTO_STYLES?.EMPTY_STATE || '';
    case 'placeholder':
      return PHOTO_STYLES?.PLACEHOLDER || '';
    case 'overlay':
      return PHOTO_STYLES?.HOVER_OVERLAY || '';
    case 'label':
      return PHOTO_STYLES?.PHOTO_LABEL || '';
    case 'thumbnail':
      return PHOTO_STYLES?.THUMBNAIL || '';
    default:
      return PHOTO_STYLES?.PHOTO_CONTAINER || '';
  }
}

// ============================================================================
// LEGACY DEFAULT EXPORT για backward compatibility
// ============================================================================

export default {
  // Legacy export structure - importing from new modular system
  ...require('./photo-config'),

  // Legacy functions για backward compatibility
  getDimensions: getPhotoDimensions,
  getLayout: getPhotoLayout,
  getColorScheme: getPhotoColorScheme,
  buildResponsive: buildResponsivePhotoClass
};

// ============================================================================
// END OF LEGACY FILE
// ============================================================================
//
// This file now serves as a backward compatibility layer.
// All new code should import from the modular photo-config structure.
//
// 🎯 ENTERPRISE MIGRATION PATH:
// 1. Existing imports continue to work (100% backward compatible)
// 2. New code uses modular imports για better tree-shaking
// 3. Gradual migration as files are touched
// 4. Eventually this file can be removed when all imports are updated
//
// ============================================================================