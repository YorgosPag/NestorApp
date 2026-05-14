/**
 * PolygonCropStore — module-level pub/sub store for polygon crop (click-to-add-points).
 * Zero React state. Follows HoverStore / ImmediatePositionStore pattern (ADR-040).
 *
 * Lifecycle:
 *   addPoint()  — user clicks canvas while tool === 'polygon-crop'
 *   close()     — user presses Enter (≥ 3 pts) → emits crop:polygon + clears
 *   cancel()    — user presses Escape or switches tool → clears silently
 */

import { EventBus } from '../events/EventBus';

type Listener = () => void;

let _points: Array<[number, number]> = [];
const _listeners = new Set<Listener>();

function _notify(): void {
  _listeners.forEach(fn => fn());
}

export const PolygonCropStore = {
  getPoints(): Array<[number, number]> {
    return _points;
  },

  addPoint(x: number, y: number): void {
    _points = [..._points, [x, y]];
    _notify();
  },

  /** Emits crop:polygon if ≥ 3 points, then clears. */
  close(): void {
    if (_points.length >= 3) {
      EventBus.emit('crop:polygon', { polygon: _points });
    }
    _points = [];
    _notify();
  },

  /** Discards current polygon without clipping. */
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

/** @deprecated Use PolygonCropStore */
export const LassoCropStore = PolygonCropStore;
