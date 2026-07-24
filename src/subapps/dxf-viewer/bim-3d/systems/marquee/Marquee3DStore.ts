/**
 * Marquee3DStore — drag state for the 3D window/crossing marquee (ADR-692).
 *
 * Mirrors the 2D `systems/cursor/SelectionStore` (ADR-040 Phase III): a zero-React
 * external store so the ~60fps `mousemove` during a rubber-band drag NEVER dispatches
 * through React. Only the thin `Marquee3DOverlay` leaf subscribes and repaints the
 * rectangle; the whole BimViewport3D tree stays still (ADR-040 micro-leaf rule).
 *
 * Points are stored in CLIENT pixels (the same space `worldToScreen` returns and the
 * DOM overlay positions in), so no camera/transform is needed to draw the box.
 */

import type { Point2D } from '../../../rendering/types/Types';
import { pointsEqual } from '../../../rendering/entities/shared/geometry-vector-utils';
import { createExternalStore } from '../../../stores/createExternalStore';
// ADR-692 Φ2 — ο τύπος + η πράξη του συνδυασμού ζουν στο κοινό selection SSoT (BIM + raw DXF).
import type { MarqueeCombineMode } from '../../../systems/selection/marquee-combine';

export type { MarqueeCombineMode };

export interface Marquee3DState {
  isSelecting: boolean;
  /** Anchor point (mousedown), client px. */
  start: Point2D | null;
  /** Live pointer, client px. */
  current: Point2D | null;
  /** Modifier-derived combine mode, frozen at drag start. */
  mode: MarqueeCombineMode;
}

const IDLE: Marquee3DState = {
  isSelecting: false,
  start: null,
  current: null,
  mode: 'replace',
};

class Marquee3DStoreClass {
  // Always-notify pub/sub (same contract as the 2D SelectionStore); the `pointsEqual`
  // guard in `update` short-circuits before notifying on the mousemove hot path.
  private readonly store = createExternalStore<Marquee3DState>(IDLE);

  begin(start: Point2D, mode: MarqueeCombineMode): void {
    this.store.set({
      isSelecting: true,
      start: { x: start.x, y: start.y },
      current: { x: start.x, y: start.y },
      mode,
    });
  }

  update(current: Point2D): void {
    const state = this.store.get();
    if (!state.isSelecting) return;
    if (pointsEqual(state.current, current)) return;
    this.store.set({ ...state, current: { x: current.x, y: current.y } });
  }

  end(): void {
    if (this.store.get().isSelecting) this.store.set(IDLE);
  }

  getIsSelecting(): boolean { return this.store.get().isSelecting; }
  getSnapshot(): Marquee3DState { return this.store.get(); }

  subscribe(listener: () => void): () => void {
    return this.store.subscribe(listener);
  }
}

export const Marquee3DStore = new Marquee3DStoreClass();
