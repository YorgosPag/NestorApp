/**
 * 🏢 BASE SPATIAL INDEX — SSoT for the query/lifecycle logic shared by every
 * `ISpatialIndex` implementation (Grid, QuadTree, …).
 *
 * The concrete implementations differ ONLY in how they physically store items and
 * therefore how they gather candidate items for a bounds window (`getCandidates`).
 * Everything downstream of that — distance ranking, `maxResults` slicing, snap/near/
 * bounds/selection/hit-test query shapes, the `update = remove + insert` contract,
 * and item-count/stats bookkeeping — is IDENTICAL and lives here ONCE.
 *
 * ADR-583 (N.18): `GridSpatialIndex` and `QuadTreeSpatialIndex` previously carried
 * copy-pasted twins of these methods; jscpd flagged them as structural clones. This
 * base class is the single owner both now extend. Add a new backing structure by
 * subclassing this and implementing the small abstract surface — never re-derive the
 * query algebra.
 */

import type {
  ISpatialIndex,
  SpatialItem,
  SpatialBounds,
  SpatialQueryOptions,
  SpatialQueryResult,
  SpatialIndexStats,
  SpatialDebugInfo,
  SnapIndexSlot
} from './ISpatialIndex';
import { SpatialIndexType } from './ISpatialIndex';
import type { Point2D } from '../../rendering/types/Types';
import { SpatialUtils } from './SpatialUtils';

/**
 * 🏢 BASE SPATIAL INDEX
 * Abstract owner of the shared query algebra + lifecycle bookkeeping.
 */
export abstract class BaseSpatialIndex implements ISpatialIndex {
  readonly bounds: SpatialBounds;

  protected _itemCount: number = 0;
  protected stats: SpatialIndexStats;

  constructor(
    bounds: SpatialBounds,
    readonly indexType: SpatialIndexType
  ) {
    this.bounds = SpatialUtils.sanitizeBounds(bounds);
    this.stats = {
      itemCount: 0,
      queryTime: 0,
      indexType,
      memoryUsage: 0
    };
  }

  get itemCount(): number {
    return this._itemCount;
  }

  // ========================================
  // BACKING-STRUCTURE HOOKS (subclass owns these)
  // ========================================

  /**
   * Gather every stored item whose bounds intersect `bounds`. The ONLY thing a
   * backing structure must know how to do — the rest of the query surface is derived.
   */
  protected abstract getCandidates(bounds: SpatialBounds): SpatialItem[];

  abstract insert(item: SpatialItem): void;
  abstract remove(itemId: string): boolean;
  abstract clear(): void;
  abstract optimize(): void;
  abstract debug(): SpatialDebugInfo;

  // ========================================
  // COUNT / STATS BOOKKEEPING (shared)
  // ========================================

  /** Apply a delta (+1 on insert, -1 on remove) and keep `stats.itemCount` in sync. */
  protected bumpItemCount(delta: number): void {
    this._itemCount += delta;
    this.stats.itemCount = this._itemCount;
  }

  /** Reset the count to zero (used by `clear()`). */
  protected resetItemCount(): void {
    this._itemCount = 0;
    this.stats.itemCount = 0;
  }

  getStats(): SpatialIndexStats {
    return { ...this.stats };
  }

  // ========================================
  // QUERY OPERATIONS (shared — derived from getCandidates)
  // ========================================

  queryNear(center: Point2D, radius: number, options?: SpatialQueryOptions): SpatialQueryResult[] {
    const startTime = performance.now();

    const queryBounds = SpatialUtils.expandBounds(
      { minX: center.x, minY: center.y, maxX: center.x, maxY: center.y },
      radius
    );

    const candidates = this.getCandidates(queryBounds);
    const results: SpatialQueryResult[] = [];

    for (const item of candidates) {
      const distance = SpatialUtils.distanceToPoint(center, item.bounds);
      if (distance <= radius) {
        results.push({ item, distance, data: item.data });
      }
    }

    return this.finalizeResults(results, options, startTime);
  }

  queryBounds(bounds: SpatialBounds, options?: SpatialQueryOptions): SpatialQueryResult[] {
    const startTime = performance.now();

    const candidates = this.getCandidates(bounds);
    const results: SpatialQueryResult[] = [];

    for (const item of candidates) {
      const center = SpatialUtils.boundsCenter(item.bounds);
      const distance = SpatialUtils.distanceToPoint(center, bounds);
      results.push({ item, distance, data: item.data });
    }

    return this.finalizeResults(results, options, startTime);
  }

  queryClosest(point: Point2D, options?: SpatialQueryOptions): SpatialQueryResult | null {
    const results = this.queryNear(point, Number.MAX_VALUE, { ...options, maxResults: 1 });
    return results.length > 0 ? results[0] : null;
  }

  hitTest(point: Point2D, tolerance: number = 0): SpatialQueryResult | null {
    const results = this.queryNear(point, tolerance, { maxResults: 1 });
    return results.length > 0 ? results[0] : null;
  }

  update(item: SpatialItem): boolean {
    const removed = this.remove(item.id);
    if (removed) {
      this.insert(item);
      return true;
    }
    return false;
  }

  // ========================================
  // SPECIALIZED QUERIES (shared)
  // ========================================

  querySnap(point: Point2D, tolerance: number, _snapType: SnapIndexSlot): SpatialQueryResult[] {
    // `tolerance` is the snap APERTURE — a fixed SCREEN-space pickbox (px) already
    // converted to world units by the caller (`worldRadiusForType`). This is the
    // AutoCAD/Revit/Figma model: the reach is constant on screen at every zoom.
    // Honour it directly — `queryNear` scans exactly the region the radius covers, so
    // it is correct for ANY radius (an earlier `min(tolerance, cellSize/2)` clamp
    // silently killed snapping when zoomed out on large geometry — ADR-362/378).
    // `snapType` filtering is done per-engine upstream (each engine indexes only its
    // own point kind), so no post-filter is needed here.
    return this.queryNear(point, tolerance);
  }

  querySelection(bounds: SpatialBounds, selectionType: 'window' | 'crossing'): SpatialQueryResult[] {
    const candidates = this.getCandidates(bounds);

    // window → item must be fully contained; crossing → item must merely intersect.
    const predicate = selectionType === 'window'
      ? (item: SpatialItem) => SpatialUtils.boundsContains(bounds, item.bounds)
      : (item: SpatialItem) => SpatialUtils.boundsIntersect(bounds, item.bounds);

    return candidates
      .filter(predicate)
      .map(item => ({ item, distance: 0, data: item.data }));
  }

  // ========================================
  // SHARED HELPERS
  // ========================================

  /** Sort by distance, apply `maxResults`, stamp the query time. */
  protected finalizeResults(
    results: SpatialQueryResult[],
    options: SpatialQueryOptions | undefined,
    startTime: number
  ): SpatialQueryResult[] {
    results.sort((a, b) => a.distance - b.distance);

    const maxResults = options?.maxResults ?? results.length;
    const finalResults = results.slice(0, maxResults);

    this.stats.queryTime = performance.now() - startTime;
    return finalResults;
  }
}
