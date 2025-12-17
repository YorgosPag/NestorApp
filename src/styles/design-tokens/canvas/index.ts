/**
 * 🎨 CANVAS DESIGN TOKENS - UNIFIED EXPORTS
 *
 * Centralized exports για όλα τα canvas UI styling tokens
 * Αντικαθιστά το τεράστιο canvas-utilities.ts με modular approach
 *
 * @author Enterprise Canvas Team
 * @since 2025-12-18
 * @version 1.0.0 - Foundation Consolidation
 */

// ============================================================================
// UI STYLING TOKENS IMPORTS
// ============================================================================

import {
  canvasPositioning,
  mobilePositioning,
  positioningUtils,
  type MobilePositioning,
  type PositioningUtils,
  type CanvasPositioning
} from './positioning-tokens';

import {
  cursorTokens,
  pointerTokens,
  feedbackTokens,
  touchTokens,
  chartTokens,
  colorPickerTokens,
  interactionUtils,
  type CursorTokens,
  type PointerTokens,
  type FeedbackTokens,
  type TouchTokens,
  type InteractionUtils
} from './interaction-tokens';

// ============================================================================
// UI STYLING TOKENS EXPORTS
// ============================================================================

export {
  canvasPositioning,
  mobilePositioning,
  positioningUtils,
  type MobilePositioning,
  type PositioningUtils
};

export type { CanvasPositioning };

export {
  cursorTokens,
  pointerTokens,
  feedbackTokens,
  touchTokens,
  chartTokens,
  colorPickerTokens,
  interactionUtils,
  type CursorTokens,
  type PointerTokens,
  type FeedbackTokens,
  type TouchTokens,
  type InteractionUtils
};

/**
 * ✅ LEGACY COMPATIBILITY
 * Re-exports για backward compatibility με existing code
 */

// Legacy positioning exports (replaces canvas-utilities positioning section)
export const canvasUtilitiesPositioning = canvasPositioning;
export const canvasUtilitiesMobile = mobilePositioning;

// Legacy interaction exports (replaces canvas-utilities interaction section)
export const canvasUtilitiesInteraction = {
  cursor: cursorTokens,
  pointerEvents: pointerTokens,
  feedback: feedbackTokens
};

/**
 * 🔄 MIGRATION HELPERS
 * Helpers για migration από canvas-utilities.ts
 */
export const migrationHelpers = {
  /**
   * Map legacy canvasUtilities.positioning calls to new API
   */
  mapPositioning: (legacyCall: string) => {
    const mappings = {
      'canvasUtilities.positioning.absolute.topLeft': 'canvasUI.positioning.absolute.topLeft',
      'canvasUtilities.positioning.withCoordinates': 'canvasUI.positioning.withCoordinates',
      'canvasUtilities.positioning.canvasContainer': 'canvasUI.positioning.canvasContainer'
      // Add more mappings as needed during migration
    };

    return mappings[legacyCall as keyof typeof mappings] || legacyCall;
  },

  /**
   * Map legacy interaction calls to new API
   */
  mapInteractions: (legacyCall: string) => {
    const mappings = {
      'canvasUtilities.interactions.cursor.crosshair': 'canvasUI.cursors.canvas.crosshair',
      'canvasUtilities.interactions.pointerEvents.enabled': 'canvasUI.pointers.standard.auto',
      'canvasUtilities.interactions.pointerEvents.disabled': 'canvasUI.pointers.standard.none'
      // Add more mappings as needed during migration
    };

    return mappings[legacyCall as keyof typeof mappings] || legacyCall;
  }
} as const;

/**
 * 📊 CANVAS UI STATISTICS
 * Statistics για migration tracking
 */
export const canvasUIStats = {
  totalTokens: {
    positioning: Object.keys(canvasPositioning).length,
    cursors: Object.keys(cursorTokens).length,
    pointers: Object.keys(pointerTokens).length,
    feedback: Object.keys(feedbackTokens).length,
    touch: Object.keys(touchTokens).length
  },

  migrationProgress: {
    // Track migration από canvas-utilities.ts
    totalUtilitiesInOriginal: 1446, // lines in original canvas-utilities.ts
    utilitiesMigrated: 0, // to be updated during migration
    percentageMigrated: 0 // calculated during migration
  }
} as const;

// ============================================================================
// UNIFIED CANVAS UI UTILITIES
// ============================================================================

/**
 * 🎨 UNIFIED CANVAS UI SYSTEM
 * Combined styling utilities για complete canvas UI management
 */
export const canvasUI = {
  // Positioning utilities
  positioning: canvasPositioning,
  mobilePositioning,

  // Interaction utilities
  cursors: cursorTokens,
  pointers: pointerTokens,
  feedback: feedbackTokens,
  touch: touchTokens,
  charts: chartTokens,
  colorPicker: colorPickerTokens,

  // Utility functions
  utils: {
    positioning: positioningUtils,
    interaction: interactionUtils
  }
} as const;

/**
 * ✅ TYPE EXPORTS
 * Complete type definitions για external use
 */
export type CanvasUI = typeof canvasUI;
export type MigrationHelpers = typeof migrationHelpers;
export type CanvasUIStats = typeof canvasUIStats;

// Note: Individual types already exported above in their respective sections

/**
 * 🎯 DEFAULT EXPORT
 * Main canvas UI system για easy importing
 */
export default canvasUI;