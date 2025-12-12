/**
 * 🎨 DXF VIEWER UI EFFECTS
 *
 * Centralized hover effects για το DXF Viewer subapp.
 * Re-exports από το κύριο enterprise effects system για consistency.
 *
 * @see src/components/ui/effects για το κύριο enterprise system
 *
 * ΚΑΝΟΝΕΣ ΧΡΗΣΗΣ:
 * 1. Χρησιμοποιήστε αυτά τα effects αντί για inline hover: classes
 * 2. Όλα τα effects είναι type-safe και documented
 * 3. Consistent με το κύριο σύστημα της εφαρμογής
 */

// Re-export όλα τα centralized effects από το κύριο σύστημα
export {
  // Core hover patterns
  INTERACTIVE_PATTERNS,
  HOVER_BACKGROUND_EFFECTS,
  HOVER_BORDER_EFFECTS,
  HOVER_TEXT_EFFECTS,
  HOVER_SHADOWS,

  // Advanced patterns
  COMPLEX_HOVER_EFFECTS,
  GROUP_HOVER_PATTERNS,
  CORE_HOVER_TRANSFORMS,

  // Utility function
  createCustomHoverEffect,

  // Default export
  default as UI_HOVER_EFFECTS
} from '@/components/ui/effects';

/**
 * 🎯 DXF VIEWER SPECIFIC PATTERNS
 *
 * Specialized hover effects που χρησιμοποιούνται συχνά στο DXF Viewer.
 * Βασίζονται στα κύρια effects για consistency.
 */

import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS, HOVER_BORDER_EFFECTS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';

// DXF Viewer specific patterns
export const DXF_HOVER_PATTERNS = {
  // Toolbar buttons
  TOOLBAR_BUTTON: INTERACTIVE_PATTERNS.SUBTLE_HOVER,
  TOOLBAR_BUTTON_ACTIVE: INTERACTIVE_PATTERNS.PRIMARY_HOVER,

  // Settings panels
  SETTINGS_ITEM: HOVER_BACKGROUND_EFFECTS.LIGHT,
  SETTINGS_TAB: INTERACTIVE_PATTERNS.PRIMARY_HOVER,

  // Layer management
  LAYER_ITEM: HOVER_BACKGROUND_EFFECTS.LIGHT,
  LAYER_VISIBILITY_TOGGLE: INTERACTIVE_PATTERNS.SUCCESS_HOVER,

  // Color pickers
  COLOR_SWATCH: HOVER_BORDER_EFFECTS.GRAY,
  COLOR_OPTION: INTERACTIVE_PATTERNS.SUBTLE_HOVER,

  // Debug panels
  DEBUG_SECTION: HOVER_BACKGROUND_EFFECTS.LIGHT,
  DEBUG_ACTION: INTERACTIVE_PATTERNS.PRIMARY_HOVER,

  // File operations
  FILE_ITEM: HOVER_BACKGROUND_EFFECTS.LIGHT,
  FILE_ACTION: INTERACTIVE_PATTERNS.SUBTLE_HOVER,
} as const;

/**
 * 🔧 MIGRATION HELPERS
 *
 * Helper functions για εύκολη migration από old hover patterns.
 */
export const MIGRATION_MAP = {
  // Common migrations
  'hover:bg-gray-50': HOVER_BACKGROUND_EFFECTS.LIGHT,
  'hover:bg-blue-50': INTERACTIVE_PATTERNS.PRIMARY_HOVER,
  'hover:bg-green-50': INTERACTIVE_PATTERNS.SUCCESS_HOVER,
  'hover:bg-red-50': INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER,

  'hover:border-gray-300': HOVER_BORDER_EFFECTS.GRAY,
  'hover:border-blue-500': HOVER_BORDER_EFFECTS.BLUE,

  'hover:text-gray-900': HOVER_TEXT_EFFECTS.DARKER,
  'hover:text-blue-600': HOVER_TEXT_EFFECTS.BLUE,

  // DXF specific common patterns
  'hover:bg-white': 'hover:bg-white', // Keep as is (special case)
  'hover:shadow-md': HOVER_SHADOWS.MEDIUM,
  'hover:scale-105': CORE_HOVER_TRANSFORMS.SCALE_UP,
} as const;

export default DXF_HOVER_PATTERNS;