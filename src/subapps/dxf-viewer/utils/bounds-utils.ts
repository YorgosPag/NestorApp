/**
 * 🏢 BOUNDS UTILITIES - FACADE
 * Re-exports from canonical bounds system for backward compatibility
 *
 * @see ADR-010: Bounds Consolidation (2026-01-04)
 * @see systems/zoom/utils/bounds.ts - CANONICAL implementation
 */

// ============================================================================
// 🏢 ADR-010: ALL EXPORTS FROM CANONICAL BOUNDS SYSTEM
// ============================================================================
// This file is a FACADE - all implementations are in the canonical location.
// Import from here for convenience, or directly from the canonical location.
// ============================================================================

export {
  // Types
  type Bounds,
  type BoundsEntity,
  type MutableBoundsEntity,
  type LegacyBounds,
  type NormalizedSceneBounds,

  // Bounds Creation
  createCombinedBounds,
  createBoundsFromDxfScene,
  createBoundsFromLayers,
  createBoundsFromPoints,

  // Bounds Union
  unionBounds,

  // Bounds Validation
  isValidBounds,
  hasMinimumSize,

  // Bounds Manipulation
  expandBounds,
  normalizeBounds,

  // Bounds Properties
  getBoundsDimensions,
  getBoundsAspectRatio,
  getBoundsCenter,

  // Default Bounds
  getDefaultBounds,
  getViewportBounds,

  // Entity Bounds
  getEntityBounds,
  getEntityBoundsLegacy,

  // Format Conversion
  legacyToModernBounds,
  modernToLegacyBounds,

  // Scene Normalization
  calculateTightBounds,
  calculateTightBoundsNormalized,
  normalizeEntityPositions,
  // ADR-650 §M10e — normalizes AND reports the offset (import paths must keep it).
  normalizeEntitiesToOrigin
} from '../systems/zoom/utils/bounds';

// ============================================================================
// 🚨 MIGRATION NOTES
// ============================================================================
//
// REMOVED FUNCTIONS (use canonical equivalents):
// - getOverlayBounds() → use createBoundsFromLayers()
// - calculateUnifiedBounds() → use createCombinedBounds()
//
// REMOVED DUPLICATE TYPES (use canonical):
// - Local Bounds interface → use exported Bounds from canonical
// - Local entity interfaces → use BoundsEntity from canonical
//
// ============================================================================
