/**
 * LassoStore — ADR-040 Phase (Lasso Selection)
 *
 * Singleton store for free-form lasso selection state.
 * Mirrors SelectionStore pattern: zero React dispatch on mousemove.
 *
 * WHY: Lasso path grows every mousemove (potentially 60fps). Dispatching
 * to React state would cascade re-renders. Store pattern keeps appends
 * imperatively; subscribers (canvas render loops) mark isDirty and re-render.
 */

import type { Point2D } from '../../rendering/types/Types';

export type LassoMode = 'window' | 'crossing';

export interface LassoState {
  readonly isLasso: boolean;
  readonly lassoPath: readonly Point2D[];
}

const IDLE: LassoState = { isLasso: false, lassoPath: [] };

// Minimum pixel distance between consecutive lasso points (perf guard).
const LASSO_POINT_MIN_DIST = 1;

class LassoStoreClass {
  private state: LassoState = IDLE;
  private listeners = new Set<() => void>();

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  startLasso(firstPoint: Point2D): void {
    this.state = { isLasso: true, lassoPath: [{ x: firstPoint.x, y: firstPoint.y }] };
    this.notify();
  }

  appendPoint(point: Point2D): void {
    if (!this.state.isLasso) return;
    const path = this.state.lassoPath;
    const last = path[path.length - 1];
    if (last &&
      Math.abs(point.x - last.x) < LASSO_POINT_MIN_DIST &&
      Math.abs(point.y - last.y) < LASSO_POINT_MIN_DIST) return;
    this.state = { ...this.state, lassoPath: [...path, { x: point.x, y: point.y }] };
    this.notify();
  }

  /** Returns final snapshot for processing, then resets to idle. */
  endLasso(): LassoState {
    const final = this.state;
    this.state = IDLE;
    this.notify();
    return final;
  }

  cancelLasso(): void {
    if (!this.state.isLasso) return;
    this.state = IDLE;
    this.notify();
  }

  getIsLasso(): boolean { return this.state.isLasso; }
  getLassoPath(): readonly Point2D[] { return this.state.lassoPath; }
  getSnapshot(): LassoState { return this.state; }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

export const LassoStore = new LassoStoreClass();

/**
 * Shoelace formula to determine lasso winding in screen coordinates (Y-down).
 *
 * Screen Y-down convention:
 *   signed area > 0  → clockwise visually     → window  (AutoCAD: solid blue fill)
 *   signed area <= 0 → counter-clockwise visually → crossing (AutoCAD: dashed green fill)
 */
export function computeLassoMode(path: readonly Point2D[]): LassoMode {
  if (path.length < 3) return 'window';
  let area = 0;
  for (let i = 0; i < path.length; i++) {
    const j = (i + 1) % path.length;
    area += path[i].x * path[j].y - path[j].x * path[i].y;
  }
  return area > 0 ? 'window' : 'crossing';
}
