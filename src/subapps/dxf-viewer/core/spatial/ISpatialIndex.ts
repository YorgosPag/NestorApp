/**
 * 🎯 UNIFIED SPATIAL INDEX INTERFACE
 * Enterprise-level centralized spatial indexing for CAD applications
 *
 * ✅ ΦΑΣΗ 1: Unified interface που υποστηρίζει:
 * - QuadTree για complex hit testing
 * - Grid για fast snapping operations
 * - Consistent API για όλα τα spatial operations
 */

import type { Point2D } from '../../rendering/types/Types';

// ========================================
// CORE INTERFACES
// ========================================

/**
 * Base spatial indexable item
 *
 * @see docs/CENTRALIZED_SYSTEMS.md - Spatial Indexing Systems
 * @example
 * // Χρησιμοποίησε το SpatialFactory αντί να δημιουργείς custom items
 * const index = SpatialFactory.forHitTesting(bounds);
 * index.insert(spatialItem);
 */
export interface SpatialItem {
  id: string;
  bounds: SpatialBounds;
  data?: any; // Flexible data payload
}

/**
 * Unified bounding box interface
 */
export interface SpatialBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Query options for spatial searches
 */
export interface SpatialQueryOptions {
  tolerance?: number;
  maxResults?: number;
  includeInvisible?: boolean;
  layerFilter?: string[];
  typeFilter?: string[];
}

/**
 * Query result with distance information
 */
export interface SpatialQueryResult<T = any> {
  item: SpatialItem;
  distance: number;
  data: T;
}

/**
 * Index type selection for factory
 */
export enum SpatialIndexType {
  QUADTREE = 'quadtree',    // Best for complex hit testing, large datasets
  GRID = 'grid',            // Best for snapping, real-time queries
  AUTO = 'auto'             // Automatic selection based on use case
}

/**
 * Performance statistics
 */
export interface SpatialIndexStats {
  itemCount: number;
  queryTime: number;
  indexType: SpatialIndexType;
  memoryUsage?: number;
}

// ========================================
// MAIN INTERFACE
// ========================================

/**
 * 🎯 UNIFIED SPATIAL INDEX INTERFACE
 *
 * All spatial index implementations must implement this interface
 * Supports both QuadTree and Grid patterns with consistent API
 */
export interface ISpatialIndex {
  readonly indexType: SpatialIndexType;
  readonly bounds: SpatialBounds;
  readonly itemCount: number;

  // ========================================
  // CORE OPERATIONS
  // ========================================

  /**
   * Insert item into spatial index
   */
  insert(item: SpatialItem): void;

  /**
   * Remove item from spatial index
   */
  remove(itemId: string): boolean;

  /**
   * Update item position (remove + insert)
   */
  update(item: SpatialItem): boolean;

  /**
   * Clear all items from index
   */
  clear(): void;

  // ========================================
  // QUERY OPERATIONS
  // ========================================

  /**
   * Find items near a point (radius query)
   */
  queryNear(center: Point2D, radius: number, options?: SpatialQueryOptions): SpatialQueryResult[];

  /**
   * Find items within bounds (rectangle query)
   */
  queryBounds(bounds: SpatialBounds, options?: SpatialQueryOptions): SpatialQueryResult[];

  /**
   * Find closest item to a point
   */
  queryClosest(point: Point2D, options?: SpatialQueryOptions): SpatialQueryResult | null;

  /**
   * Test if point intersects any items
   */
  hitTest(point: Point2D, tolerance?: number): SpatialQueryResult | null;

  // ========================================
  // SPECIALIZED QUERIES (for CAD operations)
  // ========================================

  /**
   * Find items for snapping operations
   */
  querySnap(point: Point2D, tolerance: number, snapType: 'endpoint' | 'midpoint' | 'center'): SpatialQueryResult[];

  /**
   * Find items for selection operations
   */
  querySelection(bounds: SpatialBounds, selectionType: 'window' | 'crossing'): SpatialQueryResult[];

  // ========================================
  // PERFORMANCE & DIAGNOSTICS
  // ========================================

  /**
   * Get performance statistics
   */
  getStats(): SpatialIndexStats;

  /**
   * Optimize index structure (rebuild if needed)
   */
  optimize(): void;

  /**
   * Debug information (development only)
   */
  debug(): any;
}

// ========================================
// FACTORY INTERFACE
// ========================================

/**
 * Factory configuration for creating spatial indices
 */
export interface SpatialIndexConfig {
  indexType?: SpatialIndexType;
  bounds?: SpatialBounds;

  // QuadTree specific options
  maxDepth?: number;
  maxItemsPerNode?: number;

  // Grid specific options
  gridSize?: number;

  // Performance options
  autoOptimize?: boolean;
  enableStats?: boolean;
}

/**
 * Factory interface for creating spatial indices
 */
export interface ISpatialIndexFactory {
  /**
   * Create spatial index with smart type selection
   */
  create(config?: SpatialIndexConfig): ISpatialIndex;

  /**
   * Create QuadTree index specifically
   */
  createQuadTree(bounds: SpatialBounds, maxDepth?: number, maxItemsPerNode?: number): ISpatialIndex;

  /**
   * Create Grid index specifically
   */
  createGrid(bounds: SpatialBounds, gridSize?: number): ISpatialIndex;

  /**
   * Get recommended index type for use case
   */
  getRecommendedType(useCase: 'hit-testing' | 'snapping' | 'selection' | 'general'): SpatialIndexType;
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Utility functions for spatial operations
 */
export namespace SpatialUtils {
  export function boundsFromPoints(points: Point2D[]): SpatialBounds;
  export function boundsIntersect(a: SpatialBounds, b: SpatialBounds): boolean;
  export function boundsContains(container: SpatialBounds, contained: SpatialBounds): boolean;
  export function pointInBounds(point: Point2D, bounds: SpatialBounds): boolean;
  export function distanceToPoint(point: Point2D, bounds: SpatialBounds): number;
  export function expandBounds(bounds: SpatialBounds, margin: number): SpatialBounds;
}