/**
 * LassoFreehandStore — module-level pub/sub store for freehand lasso-crop.
 * Zero React state. Follows HoverStore / ImmediatePositionStore pattern (ADR-040).
 *
 * Lifecycle:
 *   startAt(x,y) — mousedown while tool === 'lasso-crop' → activates, adds first point
 *   addPoint()   — mousemove while active (throttled by caller to ≥ 3px screen)
 *   finish()     — mouseup → emits crop:lasso-polygon if ≥ 3 pts, then clears
 *   cancel()     — Escape or tool switch → clears silently
 */

import { EventBus } from '../events/EventBus';

type Listener = () => void;

let _active = false;
let _points: Array<[number, number]> = [];
const _listeners = new Set<Listener>();

function _notify(): void {
  _listeners.forEach(fn => fn());
}

export const LassoFreehandStore = {
  isActive(): boolean {
    return _active;
  },

  getPoints(): Array<[number, number]> {
    return _points;
  },

  startAt(x: number, y: number): void {
    _active = true;
    _points = [[x, y]];
    _notify();
  },

  addPoint(x: number, y: number): void {
    if (!_active) return;
    _points = [..._points, [x, y]];
    _notify();
  },

  /** Emits crop:lasso-polygon if ≥ 3 points, then clears. */
  finish(): void {
    if (_active && _points.length >= 3) {
      EventBus.emit('crop:lasso-polygon', { polygon: _points });
    }
    _active = false;
    _points = [];
    _notify();
  },

  /** Discards freehand lasso without clipping. */
  cancel(): void {
    if (!_active && _points.length === 0) return;
    _active = false;
    _points = [];
    _notify();
  },

  subscribe(listener: Listener): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
} as const;
