/**
 * 🚀 PERF (2026-05-10): SelectionStore — ADR-040 Phase III
 *
 * Singleton store for selection state (isSelecting, selectionStart, selectionCurrent).
 * Mirrors the ImmediatePositionStore pattern: zero React dispatch on mousemove.
 *
 * WHY: cursor.updateSelection() was dispatching to useReducer on every mousemove
 * during a selection drag → CursorSystem (provider) re-rendered ~60fps →
 * cascaded its entire subtree. Moving selection state here eliminates the cascade.
 * Only DxfCanvas and LayerCanvas subscribe (via useSelectionState) and re-render.
 */

import type { Point2D } from '../../rendering/types/Types';
import { pointsEqual } from '../../rendering/entities/shared/geometry-vector-utils';
import { createExternalStore } from '../../stores/createExternalStore';

export interface SelectionState {
  isSelecting: boolean;
  selectionStart: Point2D | null;
  selectionCurrent: Point2D | null;
}

const IDLE: SelectionState = {
  isSelecting: false,
  selectionStart: null,
  selectionCurrent: null,
};

class SelectionStoreClass {
  // SSoT pub/sub primitive· ΧΩΡΙΣ `equals` (always-notify) = byte-identical με το
  // παλιό hand-rolled `Set` (60fps mousemove hot-path — ADR-040· το `pointsEqual`
  // guard στο updateSelection κόβει νωρίς πριν το notify).
  private readonly store = createExternalStore<SelectionState>(IDLE);

  startSelection(startPoint: Point2D): void {
    this.store.set({
      isSelecting: true,
      selectionStart: { x: startPoint.x, y: startPoint.y },
      selectionCurrent: { x: startPoint.x, y: startPoint.y },
    });
  }

  updateSelection(current: Point2D): void {
    const state = this.store.get();
    if (pointsEqual(state.selectionCurrent, current)) return;
    this.store.set({ ...state, selectionCurrent: { x: current.x, y: current.y } });
  }

  endSelection(): void {
    this.store.set(IDLE);
  }

  cancelSelection(): void {
    this.store.set(IDLE);
  }

  getIsSelecting(): boolean { return this.store.get().isSelecting; }
  getSelectionStart(): Point2D | null { return this.store.get().selectionStart; }
  getSelectionCurrent(): Point2D | null { return this.store.get().selectionCurrent; }
  getSnapshot(): SelectionState { return this.store.get(); }

  subscribe(listener: () => void): () => void {
    return this.store.subscribe(listener);
  }
}

export const SelectionStore = new SelectionStoreClass();
