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
import { createExternalStore } from '../../stores/createExternalStore';

type Listener = () => void;

type Snapshot = { points: Array<[number, number]>; nearClose: boolean };

let _active = false;
let _nearClose = false;
let _points: Array<[number, number]> = [];

// SSoT pub/sub via createExternalStore (WAVE 2.6). `_active`/`_nearClose`/
// `_points` above stay as plain module `let`s (mutation accelerators, and
// `isActive()`/`isNearClose()`/`getPoints()` read them directly like before);
// the store carries ONLY the composite derived snapshot, rebuilt once per
// `_notify()` call — mirrors `systems/grip/GripArmedStore.ts`. No `equals`, so
// `set` always notifies (byte-identical to the old hand-rolled listener loop).
const store = createExternalStore<Snapshot>({ points: _points, nearClose: _nearClose });

function _notify(): void {
  store.set({ points: _points, nearClose: _nearClose });
}

export const LassoFreehandStore = {
  isActive(): boolean {
    return _active;
  },

  isNearClose(): boolean {
    return _nearClose;
  },

  getPoints(): Array<[number, number]> {
    return _points;
  },

  getSnapshot(): Snapshot {
    return store.get();
  },

  startAt(x: number, y: number): void {
    _active = true;
    _nearClose = false;
    _points = [[x, y]];
    _notify();
  },

  addPoint(x: number, y: number): void {
    if (!_active) return;
    _points = [..._points, [x, y]];
    _notify();
  },

  setNearClose(v: boolean): void {
    if (_nearClose === v) return;
    _nearClose = v;
    _notify();
  },

  /** Emits crop:lasso-polygon if ≥ 3 points, then clears. */
  finish(): void {
    if (_active && _points.length >= 3) {
      EventBus.emit('crop:lasso-polygon', { polygon: _points });
    }
    _active = false;
    _nearClose = false;
    _points = [];
    _notify();
  },

  /** Discards freehand lasso without clipping. */
  cancel(): void {
    if (!_active && _points.length === 0) return;
    _active = false;
    _nearClose = false;
    _points = [];
    _notify();
  },

  subscribe(listener: Listener): () => void {
    return store.subscribe(listener);
  },
} as const;
