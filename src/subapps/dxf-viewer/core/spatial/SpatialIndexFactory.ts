/**
 * 🏭 SPATIAL INDEX FACTORY
 * Enterprise-level factory για intelligent spatial index creation
 *
 * ⚠️  ΠΡΙΝ ΔΗΜΙΟΥΡΓΗΣΕΙΣ ΝΕΟ SPATIAL INDEX:
 * 📖 Architecture Guide: src/subapps/dxf-viewer/docs/CENTRALIZED_SYSTEMS.md
 * 🔍 Section: "Spatial Indexing" - Βρες εάν υπάρχει ήδη κατάλληλο index
 *
 * 🏢 ENTERPRISE PATTERN: Central Factory για όλα τα spatial indices
 *
 * ✅ ΦΑΣΗ 1: Smart selection μεταξύ QuadTree και Grid
 * ✅ Performance-optimized configurations
 * ✅ CAD-specific use case recommendations
 *
 * @example
 * // ✅ ΣΩΣΤΑ - Χρήση factory
 * const index = SpatialFactory.forHitTesting(bounds);
 *
 * // ❌ ΛΑΘΟΣ - Direct instantiation
 * const index = new QuadTreeSpatialIndex(bounds);
 */

import type {
  ISpatialIndex,
  ISpatialIndexFactory,
  SpatialIndexConfig,
  SpatialBounds,
  SpatialIndexStats,
  SpatialQueryResult,
  SpatialQueryOptions,
  SpatialItem,
  SpatialDebugInfo
} from './ISpatialIndex';
import type { Point2D } from '../../rendering/types/Types';
import { SpatialIndexType } from './ISpatialIndex';
import { SpatialUtils } from './SpatialUtils';
import { QuadTreeSpatialIndex } from './QuadTreeSpatialIndex';
import { GridSpatialIndex } from './GridSpatialIndex';
import { dwarn } from '../../debug';

/**
 * Default configurations για διαφορετικά use cases
 */
const DEFAULT_CONFIGS = {
  HIT_TESTING: {
    indexType: SpatialIndexType.QUADTREE,
    maxDepth: 8,
    maxItemsPerNode: 10,
    autoOptimize: true,
    enableStats: true
  },
  SNAPPING: {
    indexType: SpatialIndexType.GRID,
    gridSize: 50,
    autoOptimize: false,
    enableStats: false
  },
  SELECTION: {
    indexType: SpatialIndexType.QUADTREE,
    maxDepth: 6,
    maxItemsPerNode: 15,
    autoOptimize: true,
    enableStats: true
  },
  GENERAL: {
    indexType: SpatialIndexType.AUTO,
    maxDepth: 7,
    maxItemsPerNode: 12,
    gridSize: 100,
    autoOptimize: true,
    enableStats: false
  }
} as const;

/**
 * 🏭 SPATIAL INDEX FACTORY
 * Creates optimal spatial indices based on use case and data characteristics
 */
export class SpatialIndexFactory implements ISpatialIndexFactory {

  /**
   * Create spatial index με smart type selection
   */
  create(config: SpatialIndexConfig = {}): ISpatialIndex {
    const finalConfig = this.mergeConfig(config);

    // Smart type selection αν είναι AUTO
    if (finalConfig.indexType === SpatialIndexType.AUTO) {
      finalConfig.indexType = this.selectOptimalType(finalConfig);
    }

    switch (finalConfig.indexType) {
      case SpatialIndexType.QUADTREE:
        return this.createQuadTree(
          finalConfig.bounds!,
          finalConfig.maxDepth,
          finalConfig.maxItemsPerNode
        );

      case SpatialIndexType.GRID:
        return this.createGrid(
          finalConfig.bounds!,
          finalConfig.gridSize
        );

      default:
        throw new Error(`Unsupported spatial index type: ${finalConfig.indexType}`);
    }
  }

  /**
   * Create QuadTree index specifically
   */
  createQuadTree(
    bounds: SpatialBounds,
    maxDepth: number = 8,
    maxItemsPerNode: number = 10
  ): ISpatialIndex {
    return new QuadTreeSpatialIndex(bounds, maxDepth, maxItemsPerNode);
  }

  /**
   * Create Grid index specifically
   */
  createGrid(
    bounds: SpatialBounds,
    gridSize: number = 100
  ): ISpatialIndex {
    return new GridSpatialIndex(bounds, gridSize);
  }

  /**
   * Get recommended index type για specific use case
   */
  getRecommendedType(useCase: 'hit-testing' | 'snapping' | 'selection' | 'general'): SpatialIndexType {
    switch (useCase) {
      case 'hit-testing':
        return SpatialIndexType.QUADTREE; // Better για complex hit testing

      case 'snapping':
        return SpatialIndexType.GRID; // Faster για real-time snapping

      case 'selection':
        return SpatialIndexType.QUADTREE; // Better για marquee selection

      case 'general':
      default:
        return SpatialIndexType.AUTO; // Let factory decide
    }
  }

  /**
   * 🧠 INTELLIGENT TYPE SELECTION
   * Αναλύει τα χαρακτηριστικά και επιλέγει optimal index type
   */
  private selectOptimalType(config: SpatialIndexConfig): SpatialIndexType {
    if (!config.bounds) {
      return SpatialIndexType.QUADTREE; // Safe default
    }

    const bounds = config.bounds;
    const area = SpatialUtils.boundsArea(bounds);

    // Decision logic βασισμένη σε area και χρήση
    if (area > 100000) {
      // Large areas - QuadTree is better
      return SpatialIndexType.QUADTREE;
    } else if (area < 10000) {
      // Small areas - Grid is faster
      return SpatialIndexType.GRID;
    } else {
      // Medium areas - default to QuadTree
      return SpatialIndexType.QUADTREE;
    }
  }

  /**
   * Merge user config με defaults
   */
  private mergeConfig(userConfig: SpatialIndexConfig): Required<SpatialIndexConfig> {
    const defaults = DEFAULT_CONFIGS.GENERAL;

    return {
      indexType: userConfig.indexType ?? defaults.indexType,
      bounds: userConfig.bounds ?? { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
      maxDepth: userConfig.maxDepth ?? defaults.maxDepth,
      maxItemsPerNode: userConfig.maxItemsPerNode ?? defaults.maxItemsPerNode,
      gridSize: userConfig.gridSize ?? defaults.gridSize,
      autoOptimize: userConfig.autoOptimize ?? defaults.autoOptimize,
      enableStats: userConfig.enableStats ?? defaults.enableStats
    };
  }

  /**
   * 🚧 TEMPORARY PLACEHOLDER
   * Placeholder implementation μέχρι να υλοποιηθούν τα πραγματικά indices
   */
  private createPlaceholder(type: SpatialIndexType, bounds: SpatialBounds): ISpatialIndex {
    return new PlaceholderSpatialIndex(type, bounds);
  }
}

/**
 * 🚧 PLACEHOLDER IMPLEMENTATION
 * Temporary implementation για testing purposes
 */
class PlaceholderSpatialIndex implements ISpatialIndex {
  readonly indexType: SpatialIndexType;
  readonly bounds: SpatialBounds;
  readonly itemCount: number = 0;

  constructor(type: SpatialIndexType, bounds: SpatialBounds) {
    this.indexType = type;
    this.bounds = bounds;
  }

  insert(_item: SpatialItem): void {
    dwarn('SpatialIndex', '🚧 PlaceholderSpatialIndex.insert() - not implemented');
  }

  remove(_itemId: string): boolean {
    dwarn('SpatialIndex', '🚧 PlaceholderSpatialIndex.remove() - not implemented');
    return false;
  }

  update(_item: SpatialItem): boolean {
    dwarn('SpatialIndex', '🚧 PlaceholderSpatialIndex.update() - not implemented');
    return false;
  }

  clear(): void {
    dwarn('SpatialIndex', '🚧 PlaceholderSpatialIndex.clear() - not implemented');
  }

  queryNear(_center: Point2D, _radius: number, _options?: SpatialQueryOptions): SpatialQueryResult[] {
    dwarn('SpatialIndex', '🚧 PlaceholderSpatialIndex.queryNear() - not implemented');
    return [];
  }

  queryBounds(_bounds: SpatialBounds, _options?: SpatialQueryOptions): SpatialQueryResult[] {
    dwarn('SpatialIndex', '🚧 PlaceholderSpatialIndex.queryBounds() - not implemented');
    return [];
  }

  queryClosest(_point: Point2D, _options?: SpatialQueryOptions): SpatialQueryResult | null {
    dwarn('SpatialIndex', '🚧 PlaceholderSpatialIndex.queryClosest() - not implemented');
    return null;
  }

  hitTest(_point: Point2D, _tolerance?: number): SpatialQueryResult | null {
    dwarn('SpatialIndex', '🚧 PlaceholderSpatialIndex.hitTest() - not implemented');
    return null;
  }

  querySnap(_point: Point2D, _tolerance: number, _snapType: 'endpoint' | 'midpoint' | 'center' | 'dim_def_point' | 'dim_line' | 'beam_corner' | 'column_center' | 'column_corner' | 'opening_corner' | 'slab_corner' | 'wall_corner' | 'mep_connector'): SpatialQueryResult[] {
    dwarn('SpatialIndex', '🚧 PlaceholderSpatialIndex.querySnap() - not implemented');
    return [];
  }

  querySelection(_bounds: SpatialBounds, _selectionType: 'window' | 'crossing'): SpatialQueryResult[] {
    dwarn('SpatialIndex', '🚧 PlaceholderSpatialIndex.querySelection() - not implemented');
    return [];
  }

  getStats(): SpatialIndexStats {
    return {
      itemCount: this.itemCount,
      queryTime: 0,
      indexType: this.indexType,
      memoryUsage: 0
    };
  }

  optimize(): void {
    dwarn('SpatialIndex', '🚧 PlaceholderSpatialIndex.optimize() - not implemented');
  }

  debug(): SpatialDebugInfo {
    return {
      indexType: this.indexType,
      bounds: this.bounds,
      itemCount: this.itemCount
    };
  }
}

// ========================================
// EXPORTS
// ========================================

/**
 * Singleton factory instance
 */
export const spatialIndexFactory = new SpatialIndexFactory();

/**
 * Convenience functions για common use cases
 */
export const SpatialFactory = {
  /**
   * Create index optimized για hit testing
   */
  forHitTesting: (bounds: SpatialBounds) =>
    spatialIndexFactory.create({ ...DEFAULT_CONFIGS.HIT_TESTING, bounds }),

  /**
   * Create index optimized για snapping
   */
  forSnapping: (bounds: SpatialBounds) =>
    spatialIndexFactory.create({ ...DEFAULT_CONFIGS.SNAPPING, bounds }),

  /**
   * Create index optimized για selection
   */
  forSelection: (bounds: SpatialBounds) =>
    spatialIndexFactory.create({ ...DEFAULT_CONFIGS.SELECTION, bounds }),

  /**
   * Create index με automatic optimization
   */
  auto: (bounds: SpatialBounds) =>
    spatialIndexFactory.create({ bounds, indexType: SpatialIndexType.AUTO })
};
