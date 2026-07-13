/**
 * 🏢 GRID SPATIAL INDEX
 * Enterprise-level Grid implementation για fast snapping και real-time queries
 *
 * ✅ ΦΑΣΗ 1: Full Grid implementation
 * - Uniform grid spatial partitioning
 * - Optimized για snapping operations
 * - O(1) cell access για real-time performance
 *
 * The query algebra (queryNear/queryBounds/querySnap/querySelection/hitTest/update/
 * stats) lives in `BaseSpatialIndex`; this class only owns the uniform-grid storage
 * and exposes candidates via `getCandidates`. ADR-583 (N.18) — no twin logic.
 */

import type {
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
import { BaseSpatialIndex } from './BaseSpatialIndex';
// 🏢 ADR-071: Centralized clamp function
import { clamp } from '../../rendering/entities/shared/geometry-utils';

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
export class GridSpatialIndex extends BaseSpatialIndex {
  private grid: Map<string, GridCell> = new Map();

  private readonly cols: number;
  private readonly rows: number;

  constructor(
    bounds: SpatialBounds,
    private cellSize: number = 100
  ) {
    super(bounds, SpatialIndexType.GRID);

    // Calculate grid dimensions
    this.cols = Math.ceil((this.bounds.maxX - this.bounds.minX) / this.cellSize);
    this.rows = Math.ceil((this.bounds.maxY - this.bounds.minY) / this.cellSize);
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

    this.bumpItemCount(1);
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
      this.bumpItemCount(-1);
    }

    return removed;
  }

  clear(): void {
    this.grid.clear();
    this.resetItemCount();
  }

  // ========================================
  // QUERY OVERRIDES (grid-specific)
  // ========================================

  /**
   * Grid override: start with a small radius and expand progressively — cheaper than
   * the base `Number.MAX_VALUE` scan because the grid can answer small windows in O(1).
   */
  queryClosest(point: Point2D, options?: SpatialQueryOptions): SpatialQueryResult | null {
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

  /** Base hook: every item whose bounds intersect the query window (deduped across cells). */
  protected getCandidates(bounds: SpatialBounds): SpatialItem[] {
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

  private getItemCells(bounds: SpatialBounds): string[] {
    const cells: string[] = [];

    const minCol = Math.floor((bounds.minX - this.bounds.minX) / this.cellSize);
    const maxCol = Math.floor((bounds.maxX - this.bounds.minX) / this.cellSize);
    const minRow = Math.floor((bounds.minY - this.bounds.minY) / this.cellSize);
    const maxRow = Math.floor((bounds.maxY - this.bounds.minY) / this.cellSize);

    // 🏢 ADR-071: Clamp to grid bounds using centralized clamp
    const startCol = clamp(minCol, 0, this.cols - 1);
    const endCol = clamp(maxCol, 0, this.cols - 1);
    const startRow = clamp(minRow, 0, this.rows - 1);
    const endRow = clamp(maxRow, 0, this.rows - 1);

    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        cells.push(this.getCellKey(col, row));
      }
    }

    return cells;
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

    // 🏢 ADR-071: Using centralized clamp
    return {
      col: clamp(col, 0, this.cols - 1),
      row: clamp(row, 0, this.rows - 1)
    };
  }
}
