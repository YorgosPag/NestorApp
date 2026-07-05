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
import { createExternalStore } from '../../stores/createExternalStore';

type Listener = () => void;

// SSoT pub/sub via createExternalStore (WAVE 2.6). The points array IS the
// store's single state — no `equals`, so `set` always notifies (byte-identical
// to the old hand-rolled `_notify()` loop).
const store = createExternalStore<Array<[number, number]>>([]);

export const PolygonCropStore = {
  getPoints(): Array<[number, number]> {
    return store.get();
  },

  addPoint(x: number, y: number): void {
    store.set([...store.get(), [x, y]]);
  },

  /** Emits crop:polygon if ≥ 3 points, then clears. */
  close(): void {
    const points = store.get();
    if (points.length >= 3) {
      EventBus.emit('crop:polygon', { polygon: points });
    }
    store.set([]);
  },

  /** Discards current polygon without clipping. */
  cancel(): void {
    if (store.get().length === 0) return;
    store.set([]);
  },

  subscribe(listener: Listener): () => void {
    return store.subscribe(listener);
  },
} as const;

/** @deprecated Use PolygonCropStore */
export const LassoCropStore = PolygonCropStore;
