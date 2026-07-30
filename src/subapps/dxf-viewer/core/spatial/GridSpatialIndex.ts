/**
 * 🏢 GRID SPATIAL INDEX
 * Enterprise-level Grid implementation για fast snapping και real-time queries
 *
 * - Uniform grid spatial partitioning
 * - Optimized για snapping operations
 * - O(1) cell access για real-time performance
 *
 * The query algebra (queryNear/queryBounds/querySnap/querySelection/hitTest/update/
 * stats) lives in `BaseSpatialIndex`; this class only owns the uniform-grid storage
 * and exposes candidates via `getCandidates`. ADR-583 (N.18) — no twin logic.
 *
 * ## 🔴 ADR-735 — τι άλλαξε εδώ και γιατί (μετρημένο 2026-07-30)
 *
 * Η προηγούμενη υλοποίηση απαντούσε κάθε ερώτημα φτιάχνοντας **πίνακα με όλα τα κελιά του
 * παραθύρου, ως strings** `` `${col},${row}` ``. Επειδή το snap aperture είναι σταθερό σε **pixels
 * οθόνης**, σε world units μεγαλώνει με το zoom-out — και στην κλίμακα 1:2352 ένα ερώτημα σάρωνε
 * **62.500 κελιά** για να βρει 15-76 σημεία: **16-19ms ανά κλήση**, ×4 engines = 98% του χρόνου
 * ανίχνευσης snap.
 *
 * Τρεις αλλαγές, καμία σημασιολογική:
 *
 * 1. **Ένθετοι αριθμητικοί `Map`** (`col → row → items`) αντί για string κλειδιά — μηδέν
 *    allocation ανά κελί, και μια **άδεια στήλη παρακάμπτεται ολόκληρη** με ένα `Map.get`.
 *    Δεν το εφευρίσκουμε: το {@link ./PointHashGrid.ts} το κάνει ήδη και το τεκμηριώνει ως
 *    *«the dominant cost once queries are in the 10⁵ range»* (ADR-650 §M10e).
 * 2. **Φράγμα κατοικημένων κελιών** — όταν το παράθυρο είναι μεγαλύτερο από το πλήθος των
 *    **μη άδειων** κελιών, σαρώνονται εκείνα. Κόστος **Ο(min(παράθυρο, κατοικημένα))**: φραγμένο
 *    από τα **δεδομένα**, ποτέ από το zoom.
 * 3. Η πλευρά κελιού δίνεται πλέον από το SSoT {@link ./grid-sizing.ts} (προσαρμοστική), αντί για
 *    το πάγιο `50` — εκεί ζει το πλήρες επιχείρημα.
 *
 * ### ⚠️ Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΗΜΑΣΙΟΛΟΓΙΑ — μην την αλλάξεις
 *
 * Το `BaseSpatialIndex.finalizeResults` ταξινομεί κατά απόσταση με `Array.sort`, που είναι
 * **σταθερό** (ES2019): **οι ισοβαθμίες κρατούν τη σειρά εισαγωγής**. Δύο snap points στην ίδια
 * ακριβώς απόσταση ⇒ **νικά όποιο συναντήθηκε πρώτο**. Γι' αυτό **και τα δύο** μονοπάτια σάρωσης
 * επισκέπτονται τα κελιά με **αύξουσα στήλη, μετά αύξουσα γραμμή** — ταυτόσημα με την προ-ADR-735
 * σάρωση. Το ADR-728 §6 το απαιτεί ρητά ως «συμπεριφορική ισοδυναμία 100%»· καρφωμένο με
 * `__tests__/GridSpatialIndex-equivalence.test.ts`.
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

/** Το ορθογώνιο κελιών που καλύπτει ένα query box, ήδη clamped στα όρια του πλέγματος. */
interface CellWindow {
  startCol: number;
  endCol: number;
  startRow: number;
  endRow: number;
}

/**
 * 🏢 GRID SPATIAL INDEX
 * High-performance uniform grid για fast spatial queries
 */
export class GridSpatialIndex extends BaseSpatialIndex {
  /** `col → row → items`. Αριθμητικά κλειδιά, μηδέν string allocation ανά ερώτημα (ADR-735). */
  private grid: Map<number, Map<number, SpatialItem[]>> = new Map();

  /** Πλήθος **μη άδειων** κελιών — το φράγμα του δεύτερου μονοπατιού σάρωσης (ADR-735). */
  private populatedCells = 0;

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

    const w = this.resolveCellWindow(item.bounds);

    for (let col = w.startCol; col <= w.endCol; col++) {
      for (let row = w.startRow; row <= w.endRow; row++) {
        this.insertIntoCell(col, row, item);
      }
    }

    this.bumpItemCount(1);
  }

  /** Ένα κελί, ένα item — δημιουργεί στήλη/κελί κατ' απαίτηση και κρατά το {@link populatedCells}. */
  private insertIntoCell(col: number, row: number, item: SpatialItem): void {
    let rowMap = this.grid.get(col);
    if (!rowMap) {
      rowMap = new Map<number, SpatialItem[]>();
      this.grid.set(col, rowMap);
    }

    const items = rowMap.get(row);
    if (!items) {
      rowMap.set(row, [item]);
      this.populatedCells++;
      return;
    }

    // Check if item already exists in this cell
    if (!items.some(existing => existing.id === item.id)) {
      items.push(item);
    }
  }

  remove(itemId: string): boolean {
    let removed = false;

    for (const [col, rowMap] of this.grid) {
      for (const [row, items] of rowMap) {
        const itemIndex = items.findIndex(item => item.id === itemId);
        if (itemIndex === -1) continue;

        items.splice(itemIndex, 1);
        removed = true;

        // Remove empty cells για memory efficiency
        if (items.length === 0) {
          rowMap.delete(row);
          this.populatedCells--;
        }
      }
      if (rowMap.size === 0) this.grid.delete(col);
    }

    if (removed) {
      this.bumpItemCount(-1);
    }

    return removed;
  }

  clear(): void {
    this.grid.clear();
    this.populatedCells = 0;
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
    const memoryUsage = this.populatedCells * 8 + this._itemCount * 32; // Rough estimate
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
        cellCount: this.populatedCells,
        gridSize: this.cellSize,
        gridDimensions: { cols: this.cols, rows: this.rows }
      },
      performance: this.getStats()
    };
  }

  // ========================================
  // PRIVATE IMPLEMENTATION
  // ========================================

  /**
   * Base hook: every item whose bounds intersect the query window (deduped across cells).
   *
   * 🏢 **ADR-735** — δύο μονοπάτια, **ίδιο αποτέλεσμα και ίδια σειρά**. Το παράθυρο σαρώνεται
   * απευθείας όσο είναι μικρότερο από το πλήθος των κατοικημένων κελιών· αλλιώς σαρώνονται τα
   * κατοικημένα. Έτσι το κόστος είναι **Ο(min(παράθυρο, κατοικημένα))** — ποτέ Ο(zoom²), που ήταν
   * ακριβώς η αιτία των 16-19ms ανά κλήση.
   */
  protected getCandidates(bounds: SpatialBounds): SpatialItem[] {
    const w = this.resolveCellWindow(bounds);
    const windowCells = (w.endCol - w.startCol + 1) * (w.endRow - w.startRow + 1);

    // `Map` κρατά σειρά εισαγωγής και το `set` σε υπάρχον κλειδί ΔΕΝ την αλλάζει ⇒ η σειρά εξόδου
    // είναι «πρώτη εμφάνιση κατά τη σάρωση». Και τα δύο μονοπάτια σαρώνουν col-major (βλ. header).
    const found = new Map<string, SpatialItem>();

    if (windowCells <= this.populatedCells) {
      this.scanWindowCells(w, bounds, found);
    } else {
      this.scanPopulatedCells(w, bounds, found);
    }

    return Array.from(found.values());
  }

  /** Σάρωση του ορθογωνίου του ερωτήματος. Άδεια στήλη ⇒ παρακάμπτεται ολόκληρη με ένα `get`. */
  private scanWindowCells(w: CellWindow, bounds: SpatialBounds, out: Map<string, SpatialItem>): void {
    for (let col = w.startCol; col <= w.endCol; col++) {
      const rowMap = this.grid.get(col);
      if (!rowMap) continue;
      for (let row = w.startRow; row <= w.endRow; row++) {
        const items = rowMap.get(row);
        if (items) this.collectCell(items, bounds, out);
      }
    }
  }

  /**
   * Σάρωση **μόνο** των κατοικημένων κελιών που πέφτουν μέσα στο παράθυρο.
   *
   * Οι `Map` κρατούν **σειρά εισαγωγής**, όχι αριθμητική — γι' αυτό οι συντεταγμένες
   * ταξινομούνται ρητά. Χωρίς αυτό η σειρά θα εξαρτιόταν από τη σειρά χτισίματος του ευρετηρίου
   * και οι ισοβαθμίες αποστάσεων θα άλλαζαν νικητή (βλ. «Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΗΜΑΣΙΟΛΟΓΙΑ» στο header).
   */
  private scanPopulatedCells(w: CellWindow, bounds: SpatialBounds, out: Map<string, SpatialItem>): void {
    const cols: number[] = [];
    for (const col of this.grid.keys()) {
      if (col >= w.startCol && col <= w.endCol) cols.push(col);
    }
    cols.sort((a, b) => a - b);

    for (const col of cols) {
      const rowMap = this.grid.get(col);
      if (!rowMap) continue;

      const rows: number[] = [];
      for (const row of rowMap.keys()) {
        if (row >= w.startRow && row <= w.endRow) rows.push(row);
      }
      rows.sort((a, b) => a - b);

      for (const row of rows) {
        const items = rowMap.get(row);
        if (items) this.collectCell(items, bounds, out);
      }
    }
  }

  /** Ό,τι από ένα κελί τέμνει πράγματι το query box (το κελί είναι υπερ-εκτίμηση). */
  private collectCell(items: SpatialItem[], bounds: SpatialBounds, out: Map<string, SpatialItem>): void {
    for (const item of items) {
      if (SpatialUtils.boundsIntersect(item.bounds, bounds)) {
        out.set(item.id, item);
      }
    }
  }

  /** Το ορθογώνιο κελιών ενός box, clamped στα όρια του πλέγματος. */
  private resolveCellWindow(bounds: SpatialBounds): CellWindow {
    const minCol = Math.floor((bounds.minX - this.bounds.minX) / this.cellSize);
    const maxCol = Math.floor((bounds.maxX - this.bounds.minX) / this.cellSize);
    const minRow = Math.floor((bounds.minY - this.bounds.minY) / this.cellSize);
    const maxRow = Math.floor((bounds.maxY - this.bounds.minY) / this.cellSize);

    // 🏢 ADR-071: Clamp to grid bounds using centralized clamp
    return {
      startCol: clamp(minCol, 0, this.cols - 1),
      endCol: clamp(maxCol, 0, this.cols - 1),
      startRow: clamp(minRow, 0, this.rows - 1),
      endRow: clamp(maxRow, 0, this.rows - 1)
    };
  }
}
