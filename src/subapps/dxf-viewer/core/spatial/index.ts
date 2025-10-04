/**
 * 🎯 CORE SPATIAL INDEX SYSTEM
 * Enterprise-level centralized spatial indexing exports
 *
 * ✅ ΦΑΣΗ 1: Unified spatial indexing architecture
 * - Consistent interfaces
 * - Smart factory selection
 * - Performance-optimized implementations
 */

// ========================================
// CORE INTERFACES & TYPES
// ========================================

export type {
  ISpatialIndex,
  ISpatialIndexFactory,
  SpatialItem,
  SpatialBounds,
  SpatialQueryOptions,
  SpatialQueryResult,
  SpatialIndexConfig,
  SpatialIndexStats
} from './ISpatialIndex';

export { SpatialIndexType } from './ISpatialIndex';

// ========================================
// UTILITIES
// ========================================

export { SpatialUtils } from './SpatialUtils';

// ========================================
// FACTORY & IMPLEMENTATIONS
// ========================================

export {
  SpatialIndexFactory,
  spatialIndexFactory,
  SpatialFactory
} from './SpatialIndexFactory';

// ========================================
// TYPE GUARDS
// ========================================

/**
 * Type guards για development
 */
export const SpatialTypeGuards = {
  isValidBounds: (bounds: any): bounds is SpatialBounds =>
    bounds &&
    typeof bounds.minX === 'number' &&
    typeof bounds.minY === 'number' &&
    typeof bounds.maxX === 'number' &&
    typeof bounds.maxY === 'number' &&
    bounds.minX <= bounds.maxX &&
    bounds.minY <= bounds.maxY,

  isValidItem: (item: any): item is SpatialItem =>
    item &&
    typeof item.id === 'string' &&
    SpatialTypeGuards.isValidBounds(item.bounds)
};