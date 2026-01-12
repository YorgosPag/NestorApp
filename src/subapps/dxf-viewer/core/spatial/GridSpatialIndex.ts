/**
 * 🏢 GRID SPATIAL INDEX
 * Enterprise-level Grid implementation για fast snapping και real-time queries
 *
 * ✅ ΦΑΣΗ 1: Full Grid implementation
 * - Uniform grid spatial partitioning
 * - Optimized για snapping operations
 * - O(1) cell access για real-time performance
 */

import type {
  ISpatialIndex,
  SpatialItem,
  SpatialBounds,
  SpatialQueryOptions,
  SpatialQueryResult,
  SpatialIndexStats,
  SpatialDebugInfo
} from './ISpatialIndex';
import { SpatialIndexType } from './ISpatialIndex';
import type { Point2D } from '../../rendering/types/Types';
import { SpatialUtils } from './SpatialUtils';

/**
 * Internal grid cell structure
 */
interface GridCell {
  items: SpatialItem[];
  x: number;
  y: number;
}

/**
 * 🏢 GRID SPATIAL INDEX
 * High-performance uniform grid για fast spatial queries
 */
export class GridSpatialIndex implements ISpatialIndex {
  readonly indexType = SpatialIndexType.GRID;
  readonly bounds: SpatialBounds;

  private grid: Map<string, GridCell> = new Map();
  private _itemCount: number = 0;
  private stats: SpatialIndexStats;

  private readonly cols: number;
  private readonly rows: number;

  constructor(
    bounds: SpatialBounds,
    private cellSize: number = 100
  ) {
    this.bounds = SpatialUtils.sanitizeBounds(bounds);

    // Calculate grid dimensions
    this.cols = Math.ceil((this.bounds.maxX - this.bounds.minX) / this.cellSize);
    this.rows = Math.ceil((this.bounds.maxY - this.bounds.minY) / this.cellSize);

    this.stats = {
      itemCount: 0,
      queryTime: 0,
      indexType: this.indexType,
      memoryUsage: 0
    };
  }

  get itemCount(): number {
    return this._itemCount;
  }

  // ========================================
  // CORE OPERATIONS
  // ========================================

  insert(item: SpatialItem): void {
    if (!SpatialUtils.boundsIntersect(item.bounds, this.bounds)) {
      console.warn('🚧 Grid: Item outside index bounds, skipping insertion');
      return;
    }

    const cells = this.getItemCells(item.bounds);

    for (const cellKey of cells) {
      let cell = this.grid.get(cellKey);
      if (!cell) {
        const { x, y } = this.parseCellKey(cellKey);
        cell = { items: [], x, y };
        this.grid.set(cellKey, cell);
      }

      // Check if item already exists in this cell
      if (!cell.items.some(existing => existing.id === item.id)) {
        cell.items.push(item);
      }
    }

    this._itemCount++;
    this.stats.itemCount = this._itemCount;
  }

  remove(itemId: string): boolean {
    let removed = false;

    for (const cellKey of Array.from(this.grid.keys())) {
      const cell = this.grid.get(cellKey);
      if (!cell) continue;
      const itemIndex = cell.items.findIndex(item => item.id === itemId);
      if (itemIndex !== -1) {
        cell.items.splice(itemIndex, 1);
        removed = true;

        // Remove empty cells για memory efficiency
        if (cell.items.length === 0) {
          this.grid.delete(cellKey);
        }
      }
    }

    if (removed) {
      this._itemCount--;
      this.stats.itemCount = this._itemCount;
    }

    return removed;
  }

  update(item: SpatialItem): boolean {
    const removed = this.remove(item.id);
    if (removed) {
      this.insert(item);
      return true;
    }
    return false;
  }

  clear(): void {
    this.grid.clear();
    this._itemCount = 0;
    this.stats.itemCount = 0;
  }

  // ========================================
  // QUERY OPERATIONS
  // ========================================

  queryNear(center: Point2D, radius: number, options?: SpatialQueryOptions): SpatialQueryResult[] {
    const startTime = performance.now();

    const queryBounds = SpatialUtils.expandBounds(
      { minX: center.x, minY: center.y, maxX: center.x, maxY: center.y },
      radius
    );

    const candidates = this.getItemsInBounds(queryBounds);
    const results: SpatialQueryResult[] = [];

    for (const item of candidates) {
      const distance = SpatialUtils.distanceToPoint(center, item.bounds);
      if (distance <= radius) {
        results.push({
          item,
          distance,
          data: item.data
        });
      }
    }

    // Sort by distance
    results.sort((a, b) => a.distance - b.distance);

    // Apply limits
    const maxResults = options?.maxResults || results.length;
    const finalResults = results.slice(0, maxResults);

    this.stats.queryTime = performance.now() - startTime;
    return finalResults;
  }

  queryBounds(bounds: SpatialBounds, options?: SpatialQueryOptions): SpatialQueryResult[] {
    const startTime = performance.now();

    const candidates = this.getItemsInBounds(bounds);
    const results: SpatialQueryResult[] = [];

    for (const item of candidates) {
      const center = SpatialUtils.boundsCenter(item.bounds);
      const distance = SpatialUtils.distanceToPoint(center, bounds);

      results.push({
        item,
        distance,
        data: item.data
      });
    }

    // Sort by distance
    results.sort((a, b) => a.distance - b.distance);

    const maxResults = options?.maxResults || results.length;
    const finalResults = results.slice(0, maxResults);

    this.stats.queryTime = performance.now() - startTime;
    return finalResults;
  }

  queryClosest(point: Point2D, options?: SpatialQueryOptions): SpatialQueryResult | null {
    // Start με small radius και expand progressively
    let radius = this.cellSize;
    const maxRadius = Math.max(
      this.bounds.maxX - this.bounds.minX,
      this.bounds.maxY - this.bounds.minY
    );

    while (radius <= maxRadius) {
      const results = this.queryNear(point, radius, { ...options, maxResults: 1 });
      if (results.length > 0) {
        return results[0];
      }
      radius *= 2;
    }

    return null;
  }

  hitTest(point: Point2D, tolerance: number = 0): SpatialQueryResult | null {
    const results = this.queryNear(point, tolerance, { maxResults: 1 });
    return results.length > 0 ? results[0] : null;
  }

  // ========================================
  // SPECIALIZED QUERIES
  // ========================================

  querySnap(point: Point2D, tolerance: number, snapType: 'endpoint' | 'midpoint' | 'center'): SpatialQueryResult[] {
    // Grid is optimized για snapping - use smaller search radius
    const snapRadius = Math.min(tolerance, this.cellSize / 2);
    const results = this.queryNear(point, snapRadius);

    // Filter based on snap type (basic implementation)
    return results.filter(result => {
      // Placeholder για snap type filtering
      return true;
    });
  }

  querySelection(bounds: SpatialBounds, selectionType: 'window' | 'crossing'): SpatialQueryResult[] {
    const candidates = this.getItemsInBounds(bounds);

    if (selectionType === 'window') {
      // Window selection - item must be completely inside
      return candidates
        .filter(item => SpatialUtils.boundsContains(bounds, item.bounds))
        .map(item => ({
          item,
          distance: 0,
          data: item.data
        }));
    } else {
      // Crossing selection - item must intersect
      return candidates
        .filter(item => SpatialUtils.boundsIntersect(bounds, item.bounds))
        .map(item => ({
          item,
          distance: 0,
          data: item.data
        }));
    }
  }

  // ========================================
  // PERFORMANCE & DIAGNOSTICS
  // ========================================

  getStats(): SpatialIndexStats {
    const memoryUsage = this.grid.size * 8 + this._itemCount * 32; // Rough estimate
    return {
      ...this.stats,
      memoryUsage
    };
  }

  optimize(): void {
    // Grid doesn't need optimization - already O(1) access
    // Could implement cell compaction here if needed
    console.log('🏢 Grid index is already optimized');
  }

  debug(): SpatialDebugInfo {
    return {
      indexType: SpatialIndexType.GRID,
      itemCount: this._itemCount,
      bounds: this.bounds,
      structure: {
        cellCount: this.grid.size,
        gridSize: this.cellSize,
        gridDimensions: { cols: this.cols, rows: this.rows }
      },
      performance: this.getStats()
    };
  }

  // ========================================
  // PRIVATE IMPLEMENTATION
  // ========================================

  private getItemCells(bounds: SpatialBounds): string[] {
    const cells: string[] = [];

    const minCol = Math.floor((bounds.minX - this.bounds.minX) / this.cellSize);
    const maxCol = Math.floor((bounds.maxX - this.bounds.minX) / this.cellSize);
    const minRow = Math.floor((bounds.minY - this.bounds.minY) / this.cellSize);
    const maxRow = Math.floor((bounds.maxY - this.bounds.minY) / this.cellSize);

    // Clamp to grid bounds
    const startCol = Math.max(0, Math.min(this.cols - 1, minCol));
    const endCol = Math.max(0, Math.min(this.cols - 1, maxCol));
    const startRow = Math.max(0, Math.min(this.rows - 1, minRow));
    const endRow = Math.max(0, Math.min(this.rows - 1, maxRow));

    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        cells.push(this.getCellKey(col, row));
      }
    }

    return cells;
  }

  private getItemsInBounds(bounds: SpatialBounds): SpatialItem[] {
    const cells = this.getItemCells(bounds);
    const itemMap = new Map<string, SpatialItem>();

    for (const cellKey of cells) {
      const cell = this.grid.get(cellKey);
      if (cell) {
        for (const item of cell.items) {
          // Only add if bounds actually intersect
          if (SpatialUtils.boundsIntersect(item.bounds, bounds)) {
            itemMap.set(item.id, item);
          }
        }
      }
    }

    return Array.from(itemMap.values());
  }

  private getCellKey(col: number, row: number): string {
    return `${col},${row}`;
  }

  private parseCellKey(key: string): { x: number; y: number } {
    const [col, row] = key.split(',').map(Number);
    return { x: col, y: row };
  }

  private pointToCell(point: Point2D): { col: number; row: number } {
    const col = Math.floor((point.x - this.bounds.minX) / this.cellSize);
    const row = Math.floor((point.y - this.bounds.minY) / this.cellSize);

    return {
      col: Math.max(0, Math.min(this.cols - 1, col)),
      row: Math.max(0, Math.min(this.rows - 1, row))
    };
  }
}