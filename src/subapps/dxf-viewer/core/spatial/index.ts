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

// Define missing types locally if ISpatialIndex doesn't exist
type SpatialBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type SpatialItem<T = unknown> = {
  id: string;
  bounds: SpatialBounds;
  data?: T;
};

export type {
  SpatialBounds,
  SpatialItem
};

// Try to export from ISpatialIndex, fallback to local definitions
export type {
  ISpatialIndex,
  ISpatialIndexFactory,
  SpatialQueryOptions,
  SpatialQueryResult,
  SpatialIndexConfig,
  SpatialIndexStats,
  SnapIndexSlot
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
// BARE-COORDINATE INDEXING (different abstraction — see the class doc)
// ========================================

/**
 * ADR-650 §M10e — `PointHashGrid` indexes COORDINATES (no id, no bounds, no result
 * objects), for "is there a point within τ of (x,y)" asked in a hot loop. The
 * `ISpatialIndex` family above indexes ITEMS. Reach for this one before hand-rolling
 * yet another `Map` keyed on `Math.floor(x / tolerance)` — five of those already existed.
 */
export { PointHashGrid, NO_POINT } from './PointHashGrid';

// ========================================
// TYPE GUARDS
// ========================================

/**
 * Type guards για development
 * 🏢 ENTERPRISE: Type-safe guards with unknown instead of any
 */
export const SpatialTypeGuards = {
  isValidBounds: (bounds: unknown): bounds is SpatialBounds => {
    if (!bounds || typeof bounds !== 'object') return false;
    const b = bounds as Record<string, unknown>;
    return (
      typeof b.minX === 'number' &&
      typeof b.minY === 'number' &&
      typeof b.maxX === 'number' &&
      typeof b.maxY === 'number' &&
      b.minX <= b.maxX &&
      b.minY <= b.maxY
    );
  },

  isValidItem: (item: unknown): item is SpatialItem => {
    if (!item || typeof item !== 'object') return false;
    const i = item as Record<string, unknown>;
    return (
      typeof i.id === 'string' &&
      SpatialTypeGuards.isValidBounds(i.bounds)
    );
  }
};