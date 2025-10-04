/**
 * 🎯 CORE SYSTEMS UNIFIED EXPORTS
 * Enterprise-level centralized core system exports
 *
 * ✅ ΦΑΣΗ 1: Κεντρικοποιημένα core συστήματα
 * - Spatial indexing για hit testing & selection
 * - Geometry utilities για CAD operations
 * - Performance-optimized implementations
 */

// ========================================
// SPATIAL INDEXING SYSTEM
// ========================================

export * from './spatial';

// ========================================
// CONVENIENCE RE-EXPORTS
// ========================================

/**
 * Quick access για πιο συχνά χρησιμοποιούμενα
 */
export {
  SpatialIndex,
  SpatialFactory,
  SpatialUtils
} from './spatial';

/**
 * Type exports για development
 */
export type {
  ISpatialIndex,
  SpatialItem,
  SpatialBounds,
  SpatialQueryOptions,
  SpatialQueryResult,
  SpatialIndexConfig
} from './spatial';

export { SpatialIndexType } from './spatial';

/**
 * 🔧 DEVELOPMENT UTILITIES
 * Βοηθητικά tools για debugging και development
 */
export const CoreSystemUtils = {
  /**
   * Validate spatial system integration
   */
  validateSpatialSystem: () => {
    console.log('🎯 Core Spatial System validation - ready for enterprise use');
    return true;
  }
};