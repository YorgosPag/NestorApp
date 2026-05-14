/**
 * LassoCropStore — module-level pub/sub store for lasso crop polygon points.
 * Zero React state. Follows HoverStore / ImmediatePositionStore pattern (ADR-040).
 *
 * Lifecycle:
 *   addPoint()  — user clicks canvas while tool === 'lasso-crop'
 *   close()     — user presses Enter (≥ 3 pts) → emits crop:lasso-polygon + clears
 *   cancel()    — user presses Escape or switches tool → clears silently
 */

import { EventBus } from '../events/EventBus';

type Listener = () => void;

let _points: Array<[number, number]> = [];
const _listeners = new Set<Listener>();

function _notify(): void {
  _listeners.forEach(fn => fn());
}

export const LassoCropStore = {
  getPoints(): Array<[number, number]> {
    return _points;
  },

  addPoint(x: number, y: number): void {
    _points = [..._points, [x, y]];
    _notify();
  },

  /** Emits crop:lasso-polygon if ≥ 3 points, then clears. */
  close(): void {
    if (_points.length >= 3) {
      EventBus.emit('crop:lasso-polygon', { polygon: _points });
    }
    _points = [];
    _notify();
  },

  /** Discards current lasso without clipping. */
  cancel(): void {
    if (_points.length === 0) return;
    _points = [];
    _notify();
  },

  subscribe(listener: Listener): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
} as const;
