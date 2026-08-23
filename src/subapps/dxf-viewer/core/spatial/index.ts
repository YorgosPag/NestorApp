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

// 🔴 ADR-794 — ΕΔΩ ΖΟΥΣΕ ΔΕΥΤΕΡΟ `SpatialBounds`. Το σχόλιο έλεγε «define missing types
// locally if ISpatialIndex doesn't exist» — αλλά το `ISpatialIndex` ΥΠΑΡΧΕΙ και δηλώνει το
// δικό του (με προαιρετικά `centerX`/`centerY`). Αποτέλεσμα: μέσα στον ΙΔΙΟ φάκελο, το
// όνομα `SpatialBounds` σήμαινε ΑΛΛΟ πράγμα ανάλογα με το ποιο αρχείο εισήγαγες —
// `grid-sizing`/`SpatialUtils` έπαιρναν το πλήρες, το `snap-broad-phase` (μέσω αυτού του
// barrel) το κουτσουρεμένο. Δεν έσπαγε ΜΟΝΟ επειδή τα δύο πεδία είναι προαιρετικά.
// Πλέον ΜΙΑ πηγή: το `ISpatialIndex`.
export type {
  SpatialBounds,
  SpatialItem,
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
// GRID TUNING (ADR-735)
// ========================================

/**
 * ADR-735 — η **πλευρά κελιού** ενός ομοιόμορφου πλέγματος είναι συνάρτηση της έκτασης και του
 * πληθυσμού, **ποτέ σταθερά**. Ένα πάγιο `gridSize` κόστιζε 16-19ms ανά snap ερώτημα στο
 * zoom-out (μετρημένο). Πέρνα το αποτέλεσμα στο `SpatialFactory.forSnapping(bounds, gridSize)`.
 */
export { resolveGridSize, MIN_GRID_SIDE, MAX_GRID_SIDE } from './grid-sizing';

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