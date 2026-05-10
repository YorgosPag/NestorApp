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
  private state: SelectionState = IDLE;
  private listeners = new Set<() => void>();

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  startSelection(startPoint: Point2D): void {
    this.state = {
      isSelecting: true,
      selectionStart: { x: startPoint.x, y: startPoint.y },
      selectionCurrent: { x: startPoint.x, y: startPoint.y },
    };
    this.notify();
  }

  updateSelection(current: Point2D): void {
    const prev = this.state.selectionCurrent;
    if (prev?.x === current.x && prev?.y === current.y) return;
    this.state = { ...this.state, selectionCurrent: { x: current.x, y: current.y } };
    this.notify();
  }

  endSelection(): void {
    this.state = IDLE;
    this.notify();
  }

  cancelSelection(): void {
    this.state = IDLE;
    this.notify();
  }

  getIsSelecting(): boolean { return this.state.isSelecting; }
  getSelectionStart(): Point2D | null { return this.state.selectionStart; }
  getSelectionCurrent(): Point2D | null { return this.state.selectionCurrent; }
  getSnapshot(): SelectionState { return this.state; }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

export const SelectionStore = new SelectionStoreClass();
